import { useCallback } from 'react'
import * as THREE from 'three'
import { useSceneStore } from '../store/sceneStore'
import type { SceneOperation, AssetPlacement, FallbackAssetKey } from '../schemas'
import type { ObjectBounds } from '../store/types'
import { generateId } from '../lib/idgen'
import { normalizePhysicsDefaults } from '../lib/physicsNormalize'
import { computePlacementPosition } from '../lib/placement'
import { loadGLB } from '../lib/glbImport'
import { applyImmediateSceneOperation } from '../lib/operationDispatcher'
import { buildPhysicsJson, downloadJson } from '../lib/export'

const POLL_INTERVAL = 2500

export function useOperationDispatch() {
  return useCallback(async (op: SceneOperation) => {
    const store = useSceneStore.getState()

    const handled = applyImmediateSceneOperation(op, {
      getPhysics: (id) => useSceneStore.getState().objects[id]?.physics,
      removeObject: store.removeObject,
      setTransform: store.setTransform,
      updateObject: store.updateObject,
      setPhysics: store.setPhysics,
      setGravity: store.setGravity,
      exportScene: () => {
        downloadJson(buildPhysicsJson(useSceneStore.getState().objects))
        window.dispatchEvent(new CustomEvent('docs-frontend:export-glb'))
      },
    })

    if (handled) return

    if (op.action === 'add_local_object') {
      await insertFallbackObject(op.fallbackAssetKey, op.placement)
    } else if (op.action === 'add_generated_object') {
      await handleGeneratedObject(op.prompt, op.placement, op.fallbackAssetKey)
    }
  }, [])
}

async function insertFallbackObject(key: FallbackAssetKey, placement: AssetPlacement) {
  const store = useSceneStore.getState()
  const prompt = `fallback-${key}`
  try {
    const { insertFallbackAsset } = await import('../lib/api')
    const asset = await insertFallbackAsset(key, prompt)
    const scene = await loadGLB(asset.glbUrl)
    const id = generateId(key)
    const bounds = computeBoundsFromScene(scene)
    const targetBounds = getTargetBounds(placement)
    const position = computePlacementPosition(placement, bounds, targetBounds)
    const physics = normalizePhysicsDefaults(id, key, prompt)
    store.addObject({
      id,
      label: key.replace(/_/g, ' '),
      kind: 'fallback',
      visible: true,
      locked: false,
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      bounds,
      physics,
      source: { type: 'fallback', key, prompt },
      glbUrl: asset.glbUrl,
    })
    store.selectObject(id)
  } catch {
    // fallback insert failed silently
  }
}

async function handleGeneratedObject(
  prompt: string,
  placement: AssetPlacement,
  fallbackKey: FallbackAssetKey | undefined
) {
  const store = useSceneStore.getState()
  const placeholderId = generateId('placeholder')
  store.addObject({
    id: placeholderId,
    label: prompt,
    kind: 'placeholder',
    visible: true,
    locked: true,
    transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [0.3, 0.3, 0.3] },
    source: { type: 'placeholder', prompt },
  })
  store.setGenerationTask({ status: 'submitting_prompt', prompt })

  try {
    const { generateAsset, getGeneratedAssetStatus, getGeneratedAssetModel } = await import('../lib/api')
    const task = await generateAsset(prompt)
    store.setGenerationTask({ status: 'generating_mesh', taskId: task.taskId, prompt, placeholderId })

    let status = task.status
    while (status === 'queued' || status === 'running') {
      await sleep(POLL_INTERVAL)
      const s = await getGeneratedAssetStatus(task.taskId)
      status = s.status
      if (s.status === 'running' || s.status === 'queued') {
        store.setGenerationTask({
          status: 'generating_mesh',
          taskId: task.taskId,
          prompt,
          progress: s.progress,
          placeholderId,
        })
      }
    }

    if (status === 'failed') {
      store.removeObject(placeholderId)
      store.setGenerationTask({
        status: 'failed',
        taskId: task.taskId,
        prompt,
        error: 'Meshy generation failed',
        fallbackKey,
        placeholderId,
      })
      return
    }

    store.setGenerationTask({ status: 'importing_glb', taskId: task.taskId, prompt, placeholderId })
    const asset = await getGeneratedAssetModel(task.taskId)
    const scene = await loadGLB(asset.glbUrl)
    const id = generateId(prompt)
    const bounds = computeBoundsFromScene(scene)
    const targetBounds = getTargetBounds(placement)
    const position = computePlacementPosition(placement, bounds, targetBounds)
    const physics = normalizePhysicsDefaults(id, prompt, prompt)

    store.removeObject(placeholderId)
    store.setGenerationTask({ status: 'placing_object', objectId: id })
    store.addObject({
      id,
      label: prompt,
      kind: 'generated',
      visible: true,
      locked: false,
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      bounds,
      physics,
      source: { type: 'generated', prompt, provider: 'meshy', taskId: task.taskId },
      glbUrl: asset.glbUrl,
    })
    store.selectObject(id)
    store.setGenerationTask({ status: 'ready', objectId: id })

    try {
      const { estimateObject } = await import('../lib/api')
      const profile = await estimateObject({
        objectId: id,
        label: prompt,
        sourcePrompt: prompt,
        dimensions: bounds.size,
      })
      store.setPhysics(id, profile)
    } catch {
      // estimate failed, keep defaults
    }
  } catch (err) {
    store.removeObject(placeholderId)
    store.setGenerationTask({
      status: 'failed',
      prompt,
      error: err instanceof Error ? err.message : 'Unknown error',
      fallbackKey,
      placeholderId,
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function computeBoundsFromScene(scene: THREE.Group): ObjectBounds {
  const box = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    size: [size.x, size.y, size.z],
    center: [center.x, center.y, center.z],
  }
}

function getTargetBounds(placement: AssetPlacement): ObjectBounds | undefined {
  if (placement.mode === 'on_object') {
    return useSceneStore.getState().objects[placement.target]?.bounds
  }
  return undefined
}
