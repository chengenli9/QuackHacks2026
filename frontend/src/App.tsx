import { useEffect, useCallback } from 'react'
import { useSceneStore } from './store/sceneStore'
import Toolbar from './components/Toolbar'
import Outliner from './components/Outliner'
import Inspector from './components/Inspector'
import ChatPanel from './components/ChatPanel'
import Viewport from './components/Viewport/Viewport'
import GenerationStatus from './components/GenerationStatus'
import './App.css'

export default function App() {
  const selectedId = useSceneStore((s) => s.selectedId)
  const objects = useSceneStore((s) => s.objects)
  const removeObject = useSceneStore((s) => s.removeObject)
  const setActiveTool = useSceneStore((s) => s.setActiveTool)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      const editable = target.isContentEditable
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && objects[selectedId] && !objects[selectedId].locked) {
          removeObject(selectedId)
        }
      }
      if (e.key === 'q') setActiveTool('select')
      if (e.key === 'w') setActiveTool('translate')
      if (e.key === 'e') setActiveTool('rotate')
      if (e.key === 'r') setActiveTool('scale')
    },
    [selectedId, objects, removeObject, setActiveTool]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <Outliner />
        <div className="viewport-area">
          <Viewport />
          <GenerationStatus />
        </div>
        <div className="right-panels">
          <Inspector selectedId={selectedId} />
        </div>
      </div>
      <ChatPanel />
    </div>
  )
}
