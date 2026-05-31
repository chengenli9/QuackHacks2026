import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SceneObject, ObjectBounds, ObjectSource } from '../store/types'
import type { Manifest } from './manifest'
import { normalizePhysicsDefaults } from './physicsNormalize'
import { generateId } from './idgen'

export type ImportedGLB = {
  scene: THREE.Group
  objects: SceneObject[]
}

function computeBounds(object: THREE.Object3D): ObjectBounds {
  const box = new THREE.Box3().setFromObject(object)
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

function setupMesh(mesh: THREE.Mesh) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (mesh.material) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if ('needsUpdate' in mat) mat.needsUpdate = true
    }
  }
}

export async function loadGLB(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        const clone = gltf.scene.clone(true)
        clone.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) setupMesh(node as THREE.Mesh)
        })
        resolve(clone)
      },
      undefined,
      reject
    )
  })
}

export async function loadGLBFromFile(file: File): Promise<THREE.Group> {
  const url = URL.createObjectURL(file)
  try {
    return await loadGLB(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function isUsefulName(name: string): boolean {
  if (!name) return false
  if (/^(mesh|node|object|scene|group|unnamed)[\d_]*$/i.test(name)) return false
  return true
}

export function registerObjectsFromScene(
  scene: THREE.Group,
  fileName: string,
  manifest?: Manifest,
  glbUrl?: string
): SceneObject[] {
  const source: ObjectSource = { type: 'imported', fileName }

  if (manifest) {
    return manifest.objects.map((entry) => {
      let node = null as THREE.Object3D | null

      if (entry.nodePath) {
        scene.traverse((n) => { if (n.name === entry.nodePath) node = n })
      } else if (entry.nodeName) {
        scene.traverse((n) => { if (n.name === entry.nodeName) node = n })
      }

      const matched: THREE.Object3D | null = node

      const bounds = matched ? computeBounds(matched) : undefined
      const position = matched
        ? ([matched.position.x, matched.position.y, matched.position.z] as [number, number, number])
        : [0, 0, 0] as [number, number, number]
      const rotation = matched
        ? ([matched.rotation.x, matched.rotation.y, matched.rotation.z] as [number, number, number])
        : [0, 0, 0] as [number, number, number]
      const scale = matched
        ? ([matched.scale.x, matched.scale.y, matched.scale.z] as [number, number, number])
        : [1, 1, 1] as [number, number, number]

      const physics = normalizePhysicsDefaults(entry.id, entry.label)

      return {
        id: entry.id,
        label: entry.label,
        kind: 'imported' as const,
        visible: true,
        locked: entry.locked ?? false,
        transform: { position, rotation, scale },
        bounds,
        physics,
        source,
        glbUrl,
        nodeName: entry.nodeName,
        nodePath: entry.nodePath,
      }
    })
  }

  const topLevel: THREE.Object3D[] = []
  scene.children.forEach((child) => topLevel.push(child))

  const namedNodes = topLevel.filter((n) => isUsefulName(n.name))

  if (namedNodes.length > 0) {
    return namedNodes.map((node) => {
      const id = generateId(node.name)
      const label = node.name
      const bounds = computeBounds(node)
      const physics = normalizePhysicsDefaults(id, label)
      return {
        id,
        label,
        kind: 'imported' as const,
        visible: true,
        locked: false,
        transform: {
          position: [node.position.x, node.position.y, node.position.z],
          rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
          scale: [node.scale.x, node.scale.y, node.scale.z],
        },
        bounds,
        physics,
        source,
        glbUrl,
        nodeName: node.name,
      }
    })
  }

  const id = generateId(fileName)
  const bounds = computeBounds(scene)
  const physics = normalizePhysicsDefaults(id, fileName.replace(/\.glb$/i, ''))
  return [{
    id,
    label: fileName.replace(/\.glb$/i, ''),
    kind: 'imported',
    visible: true,
    locked: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    bounds,
    physics,
    source,
    glbUrl,
  }]
}
