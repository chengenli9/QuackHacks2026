import {
  MousePointer2,
  Move3d,
  RefreshCw,
  Maximize,
  Trash2,
  Zap,
  ZapOff,
  Download,
  FileUp,
  FilePlus,
} from 'lucide-react'
import { useRef, type ReactNode, type ChangeEvent } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { buildPhysicsJson, downloadJson } from '../lib/export'
import { loadGLB, registerObjectsFromScene } from '../lib/glbImport'
import { loadManifestFile } from '../lib/manifest'
import type { TransformTool } from '../store/types'
import styles from './Toolbar.module.css'

const TOOLS: Array<{ id: TransformTool; icon: ReactNode; title: string }> = [
  { id: 'select', icon: <MousePointer2 size={16} />, title: 'Select (Q)' },
  { id: 'translate', icon: <Move3d size={16} />, title: 'Move (W)' },
  { id: 'rotate', icon: <RefreshCw size={16} />, title: 'Rotate (E)' },
  { id: 'scale', icon: <Maximize size={16} />, title: 'Scale (R)' },
]

export default function Toolbar() {
  const activeTool = useSceneStore((s) => s.activeTool)
  const setActiveTool = useSceneStore((s) => s.setActiveTool)
  const gravityEnabled = useSceneStore((s) => s.gravityEnabled)
  const setGravity = useSceneStore((s) => s.setGravity)
  const selectedId = useSceneStore((s) => s.selectedId)
  const objects = useSceneStore((s) => s.objects)
  const removeObject = useSceneStore((s) => s.removeObject)
  const addObject = useSceneStore((s) => s.addObject)
  const setSceneMetadata = useSceneStore((s) => s.setSceneMetadata)
  const clearScene = useSceneStore((s) => s.clearScene)

  const glbInputRef = useRef<HTMLInputElement>(null)
  const manifestInputRef = useRef<HTMLInputElement>(null)
  const pendingGLBRef = useRef<File | null>(null)
  const pendingGLBUrlRef = useRef<string | null>(null)

  const handleDelete = () => {
    if (selectedId && objects[selectedId] && !objects[selectedId].locked) {
      removeObject(selectedId)
    }
  }

  const handleGLBImport = async (file: File) => {
    if (pendingGLBUrlRef.current) {
      URL.revokeObjectURL(pendingGLBUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    pendingGLBUrlRef.current = url
    const scene = await loadGLB(url)
    const objs = registerObjectsFromScene(scene, file.name, undefined, url)
    clearScene()
    objs.forEach((o) => addObject(o))
    setSceneMetadata({ name: file.name.replace(/\.glb$/i, ''), importedFileName: file.name })
  }

  const handleGLBChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    pendingGLBRef.current = file
    e.target.value = ''
    await handleGLBImport(file)
  }

  const handleManifestChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingGLBRef.current || !pendingGLBUrlRef.current) return
    e.target.value = ''
    const manifest = await loadManifestFile(file)
    const scene = await loadGLB(pendingGLBUrlRef.current)
    const objs = registerObjectsFromScene(scene, pendingGLBRef.current.name, manifest, pendingGLBUrlRef.current)
    clearScene()
    objs.forEach((o) => addObject(o))
  }

  const handleExport = () => {
    const json = buildPhysicsJson(objects)
    downloadJson(json)
    window.dispatchEvent(new CustomEvent('docs-frontend:export-glb'))
  }

  const deleteDisabled = !selectedId || !objects[selectedId] || objects[selectedId].locked

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`${styles.toolBtn} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.title}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={`${styles.toolBtn} ${gravityEnabled ? styles.active : ''}`}
          onClick={() => setGravity(!gravityEnabled)}
          title={gravityEnabled ? 'Disable Gravity' : 'Enable Gravity'}
        >
          {gravityEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
          <span className={styles.label}>{gravityEnabled ? 'Gravity On' : 'Gravity Off'}</span>
        </button>
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={styles.toolBtn}
          onClick={() => glbInputRef.current?.click()}
          title="Import GLB"
        >
          <FileUp size={16} />
          <span className={styles.label}>Import GLB</span>
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => manifestInputRef.current?.click()}
          title="Import Manifest"
          disabled={!pendingGLBRef.current}
        >
          <FilePlus size={16} />
          <span className={styles.label}>Manifest</span>
        </button>
        <button className={styles.toolBtn} onClick={handleExport} title="Export scene.physics.json">
          <Download size={16} />
          <span className={styles.label}>Export</span>
        </button>
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={`${styles.toolBtn} ${styles.danger}`}
          onClick={handleDelete}
          disabled={deleteDisabled}
          title="Delete selected"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <input
        ref={glbInputRef}
        type="file"
        accept=".glb"
        style={{ display: 'none' }}
        onChange={handleGLBChange}
      />
      <input
        ref={manifestInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleManifestChange}
      />
    </div>
  )
}
