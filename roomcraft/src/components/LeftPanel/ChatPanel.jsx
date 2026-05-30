import { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Send } from 'lucide-react';
import useStore from '../../store/useStore';
import { sendCommand, generateAsset, getAssetStatus, getAssetModel, createFallbackAsset } from '../../api';
import styles from './LeftPanel.module.css';

// Valid fallback asset keys accepted by the backend
const FALLBACK_KEY_PATTERNS = [
  { key: 'duck', test: (s) => s.includes('duck') },
  { key: 'rubber_ball', test: (s) => s.includes('ball') || s.includes('sphere') },
  { key: 'wooden_crate', test: (s) => s.includes('crate') || s.includes('box') },
  { key: 'glass_vase', test: (s) => s.includes('vase') },
  { key: 'metal_barrel', test: (s) => s.includes('barrel') },
];

function pickFallbackKey(prompt) {
  const lower = prompt.toLowerCase();
  for (const { key, test } of FALLBACK_KEY_PATTERNS) {
    if (test(lower)) return key;
  }
  return null;
}

function resolvePosition(placement, getObjects) {
  if (!placement) return [0, 0.5, 0];
  const { mode } = placement;
  if (mode === 'on_floor') return [0, 0.5, 0];
  if (mode === 'at_position') return placement.position || [0, 0.5, 0];
  if (mode === 'on_object') {
    const objects = getObjects();
    const target = objects[placement.target];
    if (target && target.position) {
      return [target.position[0], target.position[1] + 0.9, target.position[2]];
    }
    return [0, 0.9, 0];
  }
  return [0, 0.5, 0];
}

async function pollUntilDone(taskId, onProgress) {
  const MAX_POLLS = 60;
  let attempts = 0;
  while (attempts < MAX_POLLS) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await getAssetStatus(taskId);
    onProgress(status);
    if (status.status === 'succeeded') return status;
    if (status.status === 'failed') throw new Error(status.error || 'Generation failed');
    attempts++;
  }
  throw new Error('Generation timed out');
}

export default function ChatPanel() {
  const {
    chatSubTab, setChatSubTab,
    chatMessages, addChatMessage, updateChatMessage,
    addSceneObject, removeSceneObject,
    setObjectPhysics, setGravityEnabled, getSceneContext,
  } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const msgIdRef = useRef(100);

  const nextMsgId = () => { msgIdRef.current += 1; return msgIdRef.current; };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue('');
    setIsSending(true);

    const userMsgId = nextMsgId();
    addChatMessage({ id: userMsgId, sender: 'user', text });

    const thinkingId = nextMsgId();
    addChatMessage({ id: thinkingId, sender: 'ai', text: 'Thinking...', typing: true });

    try {
      const sceneContext = getSceneContext();
      const { operation } = await sendCommand(text, sceneContext);

      if (!operation) {
        updateChatMessage(thinkingId, { text: 'No action needed.', typing: false });
        setIsSending(false);
        return;
      }

      await dispatchOperation(operation, thinkingId);
    } catch (err) {
      // If backend is unreachable, offer a local fallback for known asset types
      const fallbackKey = pickFallbackKey(text);
      const isNetworkError = err instanceof TypeError || err.message.includes('fetch') || err.message.toLowerCase().includes('network');
      if (isNetworkError && fallbackKey) {
        updateChatMessage(thinkingId, {
          text: `Backend unavailable. Use fallback for "${text}"?`,
          typing: false,
          fallbackAction: { prompt: text, fallbackAssetKey: fallbackKey, position: [0, 0.5, 0] },
        });
      } else {
        updateChatMessage(thinkingId, {
          text: `Error: ${err.message}`,
          typing: false,
          error: true,
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const dispatchOperation = async (op, msgId) => {
    switch (op.action) {
      case 'add_generated_object':
        await handleAddGenerated(op, msgId);
        break;
      case 'update_object_physics':
        handleUpdatePhysics(op, msgId);
        break;
      case 'toggle_gravity':
        handleToggleGravity(op, msgId);
        break;
      case 'remove_object':
        handleRemoveObject(op, msgId);
        break;
      case 'export_scene':
        handleExportScene(msgId);
        break;
      default:
        updateChatMessage(msgId, { text: op.message || 'Done.', typing: false });
    }
  };

  const handleAddGenerated = async (op, msgId) => {
    const prompt = op.prompt || op.description || 'object';
    const position = resolvePosition(op.placement, () => useStore.getState().sceneObjects);
    const placeholderId = `generating_${nextMsgId()}`;

    addSceneObject({
      id: placeholderId,
      label: `Generating: ${prompt}`,
      type: 'generating',
      visible: true,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#00e5ca',
      physics: { massKg: 1, friction: 0.5, restitution: 0.3 },
      meshInfo: null,
    });

    updateChatMessage(msgId, {
      text: `Submitting generation for "${prompt}"...`,
      typing: true,
    });

    try {
      const { taskId } = await generateAsset(prompt, 'cartoon', 'glb');

      updateChatMessage(msgId, {
        text: `Generating "${prompt}" (task ${taskId})...`,
        typing: true,
      });

      await pollUntilDone(
        taskId,
        (s) => {
          updateChatMessage(msgId, {
            text: `Generating "${prompt}"... ${s.progress != null ? `${Math.round(s.progress)}%` : s.status}`,
            typing: true,
          });
        }
      );

      updateChatMessage(msgId, { text: `Importing "${prompt}"...`, typing: true });

      const model = await getAssetModel(taskId);

      removeSceneObject(placeholderId);
      const newId = `glb_${nextMsgId()}`;
      addSceneObject({
        id: newId,
        label: prompt,
        type: 'glb',
        visible: true,
        glbUrl: model.glbUrl,
        position,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        physics: { massKg: 1, friction: 0.5, restitution: 0.3 },
        meshInfo: null,
      });
      useStore.getState().setSelectedObject(newId);

      updateChatMessage(msgId, {
        text: `✓ "${prompt}" added to scene.`,
        typing: false,
      });
    } catch (err) {
      removeSceneObject(placeholderId);

      const fallbackKey = op.fallbackAssetKey || pickFallbackKey(prompt);
      if (fallbackKey) {
        updateChatMessage(msgId, {
          text: `Generation failed. Use fallback asset for "${prompt}"?`,
          typing: false,
          fallbackAction: { prompt, fallbackAssetKey: fallbackKey, position },
        });
      } else {
        updateChatMessage(msgId, {
          text: `Generation failed: ${err.message}`,
          typing: false,
          error: true,
        });
      }
    }
  };

  const handleUpdatePhysics = (op, msgId) => {
    const { target, changes } = op;
    if (target && changes) {
      setObjectPhysics(target, changes);
      updateChatMessage(msgId, { text: `Updated physics for "${target}".`, typing: false });
    } else {
      updateChatMessage(msgId, { text: 'Could not find object to update.', typing: false });
    }
  };

  const handleToggleGravity = (op, msgId) => {
    const enabled = op.enabled !== undefined ? op.enabled : !useStore.getState().gravityEnabled;
    setGravityEnabled(enabled);
    updateChatMessage(msgId, { text: `Gravity ${enabled ? 'enabled' : 'disabled'}.`, typing: false });
  };

  const handleRemoveObject = (op, msgId) => {
    const target = op.target;
    if (target) {
      removeSceneObject(target);
      updateChatMessage(msgId, { text: `Removed "${target}" from scene.`, typing: false });
    } else {
      updateChatMessage(msgId, { text: 'No object specified to remove.', typing: false });
    }
  };

  const handleExportScene = (msgId) => {
    updateChatMessage(msgId, { text: 'Exporting scene...', typing: false });
    window.dispatchEvent(new CustomEvent('roomcraft:export-scene'));
  };

  const applyFallback = async (fallbackAction, msgId) => {
    const { prompt, fallbackAssetKey, position } = fallbackAction;
    updateChatMessage(msgId, { text: `Loading fallback for "${prompt}"...`, typing: true, fallbackAction: null });
    const newId = `glb_fallback_${nextMsgId()}`;
    try {
      const model = await createFallbackAsset({ fallbackAssetKey, sourcePrompt: prompt });
      addSceneObject({
        id: newId,
        label: `${prompt} (fallback)`,
        type: 'glb',
        visible: true,
        glbUrl: model.glbUrl,
        position: position || [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        physics: { massKg: 1, friction: 0.5, restitution: 0.3 },
        meshInfo: null,
      });
      useStore.getState().setSelectedObject(newId);
      updateChatMessage(msgId, { text: `✓ Fallback "${prompt}" added to scene.`, typing: false });
    } catch (err) {
      updateChatMessage(msgId, { text: `Fallback failed: ${err.message}`, typing: false, error: true });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: false,
  });

  return (
    <div className={styles.chatPanel}>
      <div className={styles.subTabToggle}>
        <button
          className={`${styles.subTab} ${chatSubTab === 'image' ? styles.active : ''}`}
          onClick={() => setChatSubTab('image')}
        >
          Image Upload
        </button>
        <button
          className={`${styles.subTab} ${chatSubTab === 'prompt' ? styles.active : ''}`}
          onClick={() => setChatSubTab('prompt')}
        >
          Text Prompt
        </button>
      </div>

      {chatSubTab === 'image' && (
        <div {...getRootProps()} className={`${styles.imageDropzone} ${isDragActive ? styles.dragOver : ''}`}>
          <input {...getInputProps()} />
          <ImagePlus size={18} color="var(--text-muted)" />
          <span className={styles.imageDropzoneText}>Drop image here<br />(jpg / png)</span>
        </div>
      )}

      <div className={styles.chatMessages}>
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageBubble} ${styles[msg.sender]} ${msg.typing ? styles.typing : ''} ${msg.error ? styles.errorMsg : ''}`}
          >
            {msg.sender === 'ai' && !msg.typing && (
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>AI:</span>
            )}
            {msg.text}
            {msg.fallbackAction && (
              <button
                style={{
                  display: 'block',
                  marginTop: 6,
                  padding: '4px 8px',
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'var(--font-ui)',
                }}
                onClick={() => applyFallback(msg.fallbackAction, msg.id)}
              >
                Use Fallback
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          placeholder="Describe an asset or give a command..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isSending}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={isSending || !inputValue.trim()}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
