import { Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react'
import { useSceneStore } from '../store/sceneStore'
import styles from './Outliner.module.css'

export default function Outliner() {
  const objects = useSceneStore((s) => s.objects)
  const selectedId = useSceneStore((s) => s.selectedId)
  const selectObject = useSceneStore((s) => s.selectObject)
  const setVisibility = useSceneStore((s) => s.setVisibility)
  const setLocked = useSceneStore((s) => s.setLocked)
  const removeObject = useSceneStore((s) => s.removeObject)

  const list = Object.values(objects)

  return (
    <div className={styles.outliner}>
      <div className={styles.header}>
        <span>Outliner</span>
        <span className={styles.count}>{list.length}</span>
      </div>
      <div className={styles.list}>
        {list.length === 0 && (
          <div className={styles.empty}>No objects. Import a GLB to start.</div>
        )}
        {list.map((obj) => (
          <div
            key={obj.id}
            className={`${styles.row} ${selectedId === obj.id ? styles.selected : ''} ${!obj.visible ? styles.hidden : ''}`}
            onClick={() => selectObject(selectedId === obj.id ? null : obj.id)}
          >
            <span className={styles.label} title={obj.id}>
              {obj.kind === 'placeholder' ? (
                <span className={styles.placeholder}>[generating] {obj.label}</span>
              ) : (
                obj.label
              )}
            </span>
            <div className={styles.actions}>
              <button
                onClick={(e) => { e.stopPropagation(); setVisibility(obj.id, !obj.visible) }}
                title={obj.visible ? 'Hide' : 'Show'}
                className={styles.iconBtn}
              >
                {obj.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLocked(obj.id, !obj.locked) }}
                title={obj.locked ? 'Unlock' : 'Lock'}
                className={styles.iconBtn}
              >
                {obj.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (!obj.locked) removeObject(obj.id)
                }}
                disabled={obj.locked}
                title="Delete"
                className={`${styles.iconBtn} ${styles.deleteBtn}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
