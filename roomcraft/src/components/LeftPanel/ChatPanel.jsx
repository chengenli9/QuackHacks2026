import { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Send } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './LeftPanel.module.css';

const AI_REPLIES = [
  'Interesting choice! Generating a 3D mesh for that asset now.',
  'Processing your request — this usually takes about 10 seconds.',
  "Got it! I'll add that to your scene once it's ready.",
  'Acknowledged. Queueing asset generation with VGGT backend.',
];

export default function ChatPanel() {
  const { chatSubTab, setChatSubTab, chatMessages, addChatMessage, updateLastMessage } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue('');
    setIsSending(true);

    const userMsg = { id: Date.now(), sender: 'user', text };
    addChatMessage(userMsg);

    const typingMsg = { id: Date.now() + 1, sender: 'ai', text: 'Thinking...', typing: true };
    addChatMessage(typingMsg);

    setTimeout(() => {
      const reply = AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)];
      updateLastMessage({ id: Date.now() + 2, sender: 'ai', text: reply });
      setIsSending(false);
    }, 1500);
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
            className={`${styles.messageBubble} ${styles[msg.sender]} ${msg.typing ? styles.typing : ''}`}
          >
            {msg.sender === 'ai' && !msg.typing && (
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>AI:</span>
            )}
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          placeholder="Describe an asset..."
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
