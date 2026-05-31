import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { SceneObject } from '../store/types'

export async function exportSceneGLB(
  scene: THREE.Object3D,
  fileName = 'scene.glb'
): Promise<void> {
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      },
      reject,
      { binary: true }
    )
  })
}

export type PhysicsExportObject = {
  id: string
  label: string
  transform: SceneObject['transform']
  bounds?: SceneObject['bounds']
  physics?: SceneObject['physics']
  visible: boolean
  locked: boolean
  source: SceneObject['source']
}

export function buildPhysicsJson(objects: Record<string, SceneObject>): string {
  const exportData: PhysicsExportObject[] = Object.values(objects).map((obj) => ({
    id: obj.id,
    label: obj.label,
    transform: obj.transform,
    bounds: obj.bounds,
    physics: obj.physics,
    visible: obj.visible,
    locked: obj.locked,
    source: obj.source,
  }))

  return JSON.stringify({ version: 1, objects: exportData }, null, 2)
}

export function downloadJson(data: string, fileName = 'scene.physics.json'): void {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
