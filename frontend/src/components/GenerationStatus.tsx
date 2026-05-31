import { useSceneStore } from '../store/sceneStore'
import { useOperationDispatch } from '../hooks/useOperationDispatch'
import type { FallbackAssetKey } from '../schemas'
import styles from './GenerationStatus.module.css'

export default function GenerationStatus() {
  const task = useSceneStore((s) => s.generationTask)
  const setGenerationTask = useSceneStore((s) => s.setGenerationTask)
  const dispatch = useOperationDispatch()

  if (task.status === 'idle' || task.status === 'ready') return null

  const handleDismiss = () => setGenerationTask({ status: 'idle' })

  const applyFallback = (fallbackKey: FallbackAssetKey) => {
    setGenerationTask({ status: 'idle' })
    void dispatch({
      action: 'add_local_object',
      fallbackAssetKey: fallbackKey,
      placement: { mode: 'on_floor' },
    })
  }

  return (
    <div className={styles.container}>
      {(task.status === 'submitting_prompt' ||
        task.status === 'generating_mesh' ||
        task.status === 'importing_glb' ||
        task.status === 'placing_object') && (
        <div className={styles.card}>
          <div className={styles.spinner} />
          <div className={styles.info}>
            <div className={styles.title}>
              {task.status === 'submitting_prompt' && `Submitting: ${task.prompt}`}
              {task.status === 'generating_mesh' && `Generating: ${task.prompt}`}
              {task.status === 'importing_glb' && 'Importing GLB...'}
              {task.status === 'placing_object' && 'Placing object...'}
            </div>
            {task.status === 'generating_mesh' && task.progress != null && (
              <div className={styles.progress}>
                <div className={styles.progressBar} style={{ width: `${task.progress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {task.status === 'failed' && (
        <div className={`${styles.card} ${styles.failed}`}>
          <div className={styles.info}>
            <div className={styles.title}>Generation failed</div>
            <div className={styles.subtitle}>{task.error}</div>
          </div>
          <div className={styles.actions}>
            {task.fallbackKey && (
              <button className={styles.fallbackBtn} onClick={() => applyFallback(task.fallbackKey!)}>
                Use fallback asset
              </button>
            )}
            <button className={styles.dismissBtn} onClick={handleDismiss}>Dismiss</button>
          </div>
        </div>
      )}

      {task.status === 'fallback_available' && (
        <div className={`${styles.card} ${styles.fallback}`}>
          <div className={styles.info}>
            <div className={styles.title}>Generation complete</div>
            <div className={styles.subtitle}>Fallback: {task.fallbackKey}</div>
          </div>
          <div className={styles.actions}>
            <button className={styles.fallbackBtn} onClick={() => applyFallback(task.fallbackKey)}>
              Use fallback asset
            </button>
            <button className={styles.dismissBtn} onClick={handleDismiss}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
