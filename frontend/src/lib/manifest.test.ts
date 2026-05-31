import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { parseManifest } from './manifest'
import { registerObjectsFromScene } from './glbImport'

describe('manifest parsing', () => {
  it('accepts version 1 manifests', () => {
    const manifest = parseManifest({
      version: 1,
      objects: [
        {
          id: 'coffee_table_01',
          label: 'Coffee Table',
          nodeName: 'TableMesh',
          locked: true,
        },
      ],
    })

    expect(manifest.objects[0].id).toBe('coffee_table_01')
    expect(manifest.objects[0].locked).toBe(true)
  })

  it('rejects invalid manifest versions', () => {
    expect(() => parseManifest({ version: 2, objects: [] })).toThrow()
  })

  it('registers manifest objects even when a referenced node is missing', () => {
    const scene = new THREE.Group()
    const objects = registerObjectsFromScene(
      scene,
      'missing-node-scene.glb',
      parseManifest({
        version: 1,
        objects: [{ id: 'duck_01', label: 'Duck', nodeName: 'NoSuchNode' }],
      })
    )

    expect(objects).toHaveLength(1)
    expect(objects[0]).toMatchObject({
      id: 'duck_01',
      label: 'Duck',
      kind: 'imported',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    })
    expect(objects[0].bounds).toBeUndefined()
  })
})
