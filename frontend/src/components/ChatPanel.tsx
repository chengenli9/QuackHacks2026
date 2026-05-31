import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useSceneStore } from '../store/sceneStore'
import { useOperationDispatch } from '../hooks/useOperationDispatch'
import styles from './ChatPanel.module.css'

type Message = {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
}

let msgCounter = 0
function msgId() { return `msg_${++msgCounter}` }

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const objects = useSceneStore((s) => s.objects)
  const dispatch = useOperationDispatch()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    setMessages((prev) => [...prev, { id: msgId(), role: 'user', text }])

    try {
      const { sendCommand } = await import('../lib/api')
      const sceneObjects = Object.values(objects).map((o) => ({ id: o.id, label: o.label }))
      const res = await sendCommand(text, sceneObjects)

      const reply = `Operation: ${res.operation.action}`
      setMessages((prev) => [...prev, { id: msgId(), role: 'assistant', text: reply }])

      await dispatch(res.operation)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [...prev, { id: msgId(), role: 'error', text: `Error: ${msg}` }])
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Chat</div>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.hint}>Try: "add a rubber duck on the table"</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`${styles.message} ${styles[m.role]}`}>
            <span className={styles.roleLabel}>{m.role === 'user' ? 'You' : m.role === 'error' ? 'Error' : 'AI'}</span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={styles.inputRow}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe what to add or change..."
          className={styles.textarea}
          rows={2}
          disabled={sending}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          className={styles.sendBtn}
          title="Send"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
