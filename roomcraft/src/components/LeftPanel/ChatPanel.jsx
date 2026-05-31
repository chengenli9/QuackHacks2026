import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import useStore from '../../store/useStore';
import {
  requestBackgroundImage,
  requestFallbackAsset,
  requestGeneratedAsset,
  requestGeneratedAssetModel,
  requestGeneratedAssetStatus,
  requestSceneCommand,
} from '../../lib/apiClient';
import {
  operationsFromCommandResponse,
  toolCallLabel,
  visibleThoughtsFromCommandResponse,
} from '../../lib/agentCommandResponse';
import { fallbackPromptForAssetKey } from '../../lib/fallbackAssets';
import { loadGlbIntoScene } from '../../lib/glbImport';
import { createProjectAssetSource } from '../../lib/projectPersistence';
import { exportSceneArtifacts } from '../../lib/sceneExport';
import styles from './LeftPanel.module.css';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SCRIPTED_PROMPTS = [
  'add a rubber duck on the coffee table',
  'make the duck bouncier',
  'export scene',
];

export default function ChatPanel() {
  const {
    chatMessages,
    addChatMessage,
    updateLastMessage,
    applySceneOperation,
    upsertGeneratedTask,
    addImportedScene,
    setGlbImportStatus,
    setVlmEstimateStatus,
    mergeSceneObjectEstimate,
    addGlbImportWarning,
    setHighlightedObject,
    setSceneBackgroundStatus,
    setSceneBackground,
  } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messageIdRef = useRef(10);

  const nextMessageId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async (overrideText = null) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || isSending) return;
    if (!overrideText) setInputValue('');
    setIsSending(true);

    addChatMessage({ id: nextMessageId(), sender: 'user', text });
    addChatMessage({ id: nextMessageId(), sender: 'ai', text: 'Thinking...', typing: true });

    try {
      const state = useStore.getState();
      const response = await requestSceneCommand({
        message: text,
        sceneObjects: state.sceneObjects,
        selectedObjectId: state.selectedObjectId,
        gravityEnabled: state.gravityEnabled,
        collisionsEnabled: state.collisionsEnabled,
      });
      const operations = operationsFromCommandResponse(response);
      const thoughts = visibleThoughtsFromCommandResponse(response);
      if (operations.length > 0) {
        updateLastMessage({
          id: nextMessageId(),
          sender: 'ai',
          kind: 'thought',
          text: response.message ?? `I will run ${operations.length} editor tool${operations.length === 1 ? '' : 's'}.`,
        });
        const visibleThoughts = operations.length > 1 ? thoughts : [];
        for (const thought of visibleThoughts) {
          addChatMessage({
            id: nextMessageId(),
            sender: 'ai',
            kind: 'thought',
            text: `Thought: ${thought}`,
          });
        }
        await handleOperations(operations);
      } else {
        updateLastMessage({
          id: nextMessageId(),
          sender: 'ai',
          kind: 'answer',
          text: response.message ?? 'I can help edit the scene when you ask for a specific change.',
        });
      }
    } catch (error) {
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'answer',
        text: `I could not apply that command: ${errorMessage(error)}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOperations = async (operations) => {
    for (const operation of operations) {
      addChatMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'tool',
        text: `Tool: ${toolCallLabel(operation)}...`,
        typing: true,
      });
      await handleOperation(operation);
    }
  };

  const handleOperation = async (operation, assistantMessage = null) => {
    if (operation.action === 'add_generated_object') {
      await handleGeneratedAssetOperation(operation, assistantMessage);
      return;
    }

    if (operation.action === 'add_local_object') {
      await handleLocalAssetOperation(operation);
      return;
    }

    if (operation.action === 'export_scene') {
      await handleExportOperation();
      return;
    }

    if (operation.action === 'generate_background_image') {
      await handleBackgroundImageOperation(operation);
      return;
    }

    if (operation.action === 'generate_environment_scene') {
      await handleEnvironmentSceneOperation(operation, assistantMessage);
      return;
    }

    applySceneOperation(operation);
    updateLastMessage({
      id: nextMessageId(),
      sender: 'ai',
      kind: 'tool',
      text: assistantMessage ?? labelForAppliedOperation(operation),
    });
  };

  const handleGeneratedAssetOperation = async (operation, assistantMessage = null) => {
    try {
      const task = await requestGeneratedAsset({
        prompt: operation.prompt,
        assetType: operation.assetType,
      });
      upsertGeneratedTask({
        ...task,
        prompt: operation.prompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
      });
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'tool',
        text: assistantMessage ?? `Started Meshy generation for "${operation.prompt}".`,
      });

      const status = await pollGeneratedAsset(task.taskId, operation);
      if (status.status !== 'succeeded') {
        upsertGeneratedTask({
          ...task,
          ...status,
          prompt: operation.prompt,
          placement: operation.placement,
          fallbackAssetKey: operation.fallbackAssetKey,
          status: operation.fallbackAssetKey ? 'fallback_available' : 'failed',
        });
        addChatMessage({
          id: nextMessageId(),
          sender: 'ai',
          kind: 'answer',
          text: operation.fallbackAssetKey
            ? 'Generation did not finish. Use the fallback asset button in Import when you want the deterministic local asset.'
            : 'Generation did not finish and no fallback asset is available for this prompt.',
        });
        return;
      }

      const asset = await requestGeneratedAssetModel({ taskId: task.taskId });
      const assetSource = createProjectAssetSource({
        fileName: `${asset.id}.glb`,
        sourceUrl: asset.glbUrl,
        type: 'url',
      });
      upsertGeneratedTask({
        ...task,
        ...status,
        ...asset,
        prompt: operation.prompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'importing_glb',
      });

      const objects = await loadGlbIntoScene({
        sourceUrl: asset.glbUrl,
        fileName: `${asset.id}.glb`,
        sceneObjects: useStore.getState().sceneObjects,
        addImportedScene,
        setGlbImportStatus,
        setVlmEstimateStatus,
        mergeSceneObjectEstimate,
        addGlbImportWarning,
        sourcePrompt: asset.sourcePrompt,
        placement: operation.placement,
        assetSource,
      });
      const selectedId = objects[0]?.id ?? null;
      if (selectedId) setHighlightedObject(selectedId);
      upsertGeneratedTask({
        ...task,
        ...status,
        ...asset,
        prompt: operation.prompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'ready',
        importedObjectIds: objects.map((object) => object.id),
      });

      addChatMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'answer',
        text: `Added "${asset.sourcePrompt}" to the scene.`,
      });
    } catch (error) {
      upsertGeneratedTask({
        taskId: `failed-${nextMessageId()}`,
        prompt: operation.prompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: operation.fallbackAssetKey ? 'fallback_available' : 'failed',
        error: errorMessage(error),
      });
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'answer',
        text: operation.fallbackAssetKey
          ? `Generation failed: ${errorMessage(error)}. A fallback asset is available in Import.`
          : `Generation failed: ${errorMessage(error)}.`,
      });
    }
  };

  const handleLocalAssetOperation = async (operation) => {
    const sourcePrompt = fallbackPromptForAssetKey(operation.fallbackAssetKey);
    const taskId = `local-${nextMessageId()}`;

    try {
      upsertGeneratedTask({
        taskId,
        provider: 'local',
        prompt: sourcePrompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'loading-fallback',
      });
      const asset = await requestFallbackAsset({
        fallbackAssetKey: operation.fallbackAssetKey,
        sourcePrompt,
      });
      const assetSource = createProjectAssetSource({
        fileName: `${asset.id}.glb`,
        sourceUrl: asset.glbUrl,
        type: 'url',
      });
      upsertGeneratedTask({
        taskId,
        ...asset,
        prompt: sourcePrompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'importing_glb',
      });

      const objects = await loadGlbIntoScene({
        sourceUrl: asset.glbUrl,
        fileName: `${asset.id}.glb`,
        sceneObjects: useStore.getState().sceneObjects,
        addImportedScene,
        setGlbImportStatus,
        setVlmEstimateStatus,
        mergeSceneObjectEstimate,
        addGlbImportWarning,
        sourcePrompt: asset.sourcePrompt,
        placement: operation.placement,
        assetSource,
      });
      const selectedId = objects[0]?.id ?? null;
      if (selectedId) setHighlightedObject(selectedId);
      upsertGeneratedTask({
        taskId,
        ...asset,
        prompt: sourcePrompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'ready',
        importedObjectIds: objects.map((object) => object.id),
      });

      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'tool',
        text: `Added "${asset.sourcePrompt}" to the scene.`,
      });
    } catch (error) {
      upsertGeneratedTask({
        taskId,
        provider: 'local',
        prompt: sourcePrompt,
        placement: operation.placement,
        fallbackAssetKey: operation.fallbackAssetKey,
        status: 'fallback-error',
        error: errorMessage(error),
      });
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'answer',
        text: `Fallback import failed: ${errorMessage(error)}.`,
      });
    }
  };

  const handleExportOperation = async () => {
    try {
      await exportSceneArtifacts({ sceneObjects: useStore.getState().sceneObjects });
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'tool',
        text: 'Exported scene.glb and scene.physics.json.',
      });
    } catch (error) {
      updateLastMessage({
        id: nextMessageId(),
        sender: 'ai',
        kind: 'answer',
        text: `Export failed: ${errorMessage(error)}.`,
      });
    }
  };

  const writeAssistantStatus = (text, { append = false } = {}) => {
    const message = { id: nextMessageId(), sender: 'ai', kind: 'tool', text };
    if (append) {
      addChatMessage(message);
    } else {
      updateLastMessage(message);
    }
  };

  const handleBackgroundImageOperation = async (operation, options = {}) => {
    const { appendMessage = false } = options;
    try {
      setSceneBackgroundStatus('generating');
      const background = await requestBackgroundImage({ prompt: operation.prompt });
      setSceneBackground(background);
      writeAssistantStatus('Generated a scene background.', { append: appendMessage });
      return true;
    } catch (error) {
      setSceneBackgroundStatus('error', errorMessage(error));
      writeAssistantStatus(`Background generation failed: ${errorMessage(error)}.`, { append: appendMessage });
      return false;
    }
  };

  const handleEnvironmentSceneOperation = async (operation, assistantMessage = null) => {
    updateLastMessage({
      id: nextMessageId(),
      sender: 'ai',
      kind: 'tool',
      text: assistantMessage ?? `Generating environment scene "${operation.scenePrompt}".`,
    });

    const backgroundReady = await handleBackgroundImageOperation({
      action: 'generate_background_image',
      prompt: operation.backgroundPrompt,
    }, { appendMessage: true });
    addChatMessage({
      id: nextMessageId(),
      sender: 'ai',
      kind: 'tool',
      text: backgroundReady
        ? 'Starting Meshy environment GLB generation.'
        : 'Continuing with Meshy environment GLB generation without a new background.',
      typing: true,
    });
    await handleGeneratedAssetOperation({
      action: 'add_generated_object',
      prompt: operation.scenePrompt,
      assetType: 'environment_scene',
      placement: operation.placement ?? { mode: 'on_floor' },
    });
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatMessages}>
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageBubble} ${styles[msg.sender]} ${msg.kind ? styles[msg.kind] : ''} ${msg.typing ? styles.typing : ''}`}
          >
            {msg.sender === 'ai' && !msg.typing && (
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>AI:</span>
            )}
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.scriptedPrompts}>
        {SCRIPTED_PROMPTS.map((prompt) => (
          <button key={prompt} onClick={() => void handleSend(prompt)} disabled={isSending}>
            {prompt}
          </button>
        ))}
      </div>

      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          placeholder="Edit scene or generate an asset..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          disabled={isSending}
        />
        <button className={styles.sendBtn} onClick={() => void handleSend()} disabled={isSending || !inputValue.trim()}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

async function pollGeneratedAsset(taskId, operation) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await requestGeneratedAssetStatus({ taskId });
    useStore.getState().upsertGeneratedTask({
      taskId,
      prompt: operation.prompt,
      placement: operation.placement,
      fallbackAssetKey: operation.fallbackAssetKey,
      ...status,
    });
    if (status.status === 'succeeded' || status.status === 'failed') return status;
    await wait(3000);
  }

  return { taskId, status: 'failed', error: 'Timed out waiting for generated asset.' };
}

function labelForAppliedOperation(operation) {
  switch (operation.action) {
    case 'toggle_gravity':
      return operation.enabled ? 'Gravity is on.' : 'Gravity is off.';
    case 'toggle_collisions':
      return operation.enabled ? 'Collisions are on.' : 'Collisions are off.';
    case 'update_object_physics':
      return 'Updated object physics.';
    case 'update_object_appearance':
      return 'Updated object appearance.';
    case 'move_object':
      return 'Moved the selected object.';
    case 'rotate_object':
      return 'Rotated the selected object.';
    case 'scale_object':
      return 'Scaled the selected object.';
    case 'remove_object':
      return 'Removed the object.';
    case 'relabel_object':
      return 'Renamed the object.';
    case 'export_scene':
      return 'Exporting scene files.';
    default:
      return 'Applied scene change.';
  }
}
