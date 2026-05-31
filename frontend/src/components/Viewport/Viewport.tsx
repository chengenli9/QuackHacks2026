import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { BallCollider, CuboidCollider, CylinderCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import type { ColliderType } from '../../schemas'
import type { ObjectBounds, SceneObject } from '../../store/types'
import { exportSceneGLB } from '../../lib/export'
import styles from './Viewport.module.css'

const DEFAULT_BOUNDS: ObjectBounds = {
  min: [-0.5, -0.5, -0.5],
  max: [0.5, 0.5, 0.5],
  size: [1, 1, 1],
  center: [0, 0, 0],
}

function bodyTypeFor(obj: SceneObject, editing: boolean): 'fixed' | 'dynamic' | 'kinematicPosition' {
  if (editing) return 'kinematicPosition'
  if (obj.locked || obj.physics?.static || obj.physics?.massKg === 0) return 'fixed'
  return 'dynamic'
}

function toEulerArray(quat: { x: number; y: number; z: number; w: number }): [number, number, number] {
  const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w))
  return [euler.x, euler.y, euler.z]
}

function boundsFor(obj: SceneObject): ObjectBounds {
  return obj.bounds ?? DEFAULT_BOUNDS
}

function halfExtents(bounds: ObjectBounds): [number, number, number] {
  return [
    Math.max(bounds.size[0] / 2, 0.05),
    Math.max(bounds.size[1] / 2, 0.05),
    Math.max(bounds.size[2] / 2, 0.05),
  ]
}

function Collider({ collider, bounds }: { collider: ColliderType | undefined; bounds: ObjectBounds }) {
  const [hx, hy, hz] = halfExtents(bounds)

  if (collider === 'ball') {
    return <BallCollider args={[Math.max(hx, hy, hz)]} />
  }

  if (collider === 'cylinder') {
    return <CylinderCollider args={[hy, Math.max(hx, hz)]} />
  }

  return <CuboidCollider args={[hx, hy, hz]} />
}

function computeBounds(object: THREE.Object3D): ObjectBounds {
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    size: [Math.max(size.x, 0.1), Math.max(size.y, 0.1), Math.max(size.z, 0.1)],
    center: [center.x, center.y, center.z],
  }
}

function findNamedObject(scene: THREE.Object3D, obj: SceneObject): THREE.Object3D {
  const wanted = obj.nodePath ?? obj.nodeName
  if (!wanted) return scene

  let found: THREE.Object3D | null = null
  scene.traverse((node) => {
    if (!found && node.name === wanted) {
      found = node
    }
  })
  return found ?? scene
}

function usePreparedGLB(obj: SceneObject) {
  const gltf = useLoader(GLTFLoader, obj.glbUrl ?? '')

  return useMemo(() => {
    const clonedScene = gltf.scene.clone(true)
    const selected = findNamedObject(clonedScene, obj).clone(true)

    selected.position.set(0, 0, 0)
    selected.rotation.set(0, 0, 0)
    selected.scale.set(1, 1, 1)
    selected.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials) {
          if (material) material.needsUpdate = true
        }
      }
    })

    return {
      object: selected,
      bounds: computeBounds(selected),
    }
  }, [gltf, obj])
}

function GLBVisual({ obj }: { obj: SceneObject }) {
  const prepared = usePreparedGLB(obj)
  const updateObject = useSceneStore((s) => s.updateObject)

  useEffect(() => {
    if (!obj.bounds) {
      updateObject(obj.id, { bounds: prepared.bounds })
    }
  }, [obj.bounds, obj.id, prepared.bounds, updateObject])

  return <primitive object={prepared.object} />
}

function PlaceholderVisual({ selected }: { selected: boolean }) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={selected ? '#7d8aff' : '#6c7aff'}
        emissive={selected ? '#222a66' : '#101433'}
        roughness={0.65}
        metalness={0.05}
        transparent
        opacity={0.72}
        wireframe={!selected}
      />
    </mesh>
  )
}

function SelectionBox({ bounds }: { bounds: ObjectBounds }) {
  return (
    <mesh>
      <boxGeometry args={bounds.size} />
      <meshBasicMaterial color="#7d8aff" wireframe transparent opacity={0.8} />
    </mesh>
  )
}

function SceneObjectView({ obj }: { obj: SceneObject }) {
  const selectedId = useSceneStore((s) => s.selectedId)
  const selectObject = useSceneStore((s) => s.selectObject)
  const activeTool = useSceneStore((s) => s.activeTool)
  const setTransform = useSceneStore((s) => s.setTransform)
  const handleRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<RapierRigidBody>(null)
  const [dragging, setDragging] = useState(false)

  const selected = selectedId === obj.id
  const canTransform = selected && activeTool !== 'select' && !obj.locked
  const bounds = boundsFor(obj)
  const bodyType = bodyTypeFor(obj, dragging)

  useFrame(() => {
    const body = bodyRef.current
    if (!body || dragging || bodyType !== 'dynamic') return
    const translation = body.translation()
    const rotation = body.rotation()
    const nextPosition: [number, number, number] = [translation.x, translation.y, translation.z]
    const current = obj.transform.position
    const changed = nextPosition.some((v, i) => Math.abs(v - current[i]) > 0.002)
    if (changed) {
      setTransform(obj.id, {
        position: nextPosition,
        rotation: toEulerArray(rotation),
      })
    }
  })

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    body.setTranslation(
      { x: obj.transform.position[0], y: obj.transform.position[1], z: obj.transform.position[2] },
      true
    )
  }, [obj.transform.position])

  const syncFromHandle = () => {
    const handle = handleRef.current
    if (!handle) return
    setTransform(obj.id, {
      position: [handle.position.x, handle.position.y, handle.position.z],
      rotation: [handle.rotation.x, handle.rotation.y, handle.rotation.z],
      scale: [handle.scale.x, handle.scale.y, handle.scale.z],
    })
    const body = bodyRef.current
    if (body) {
      body.setTranslation({ x: handle.position.x, y: handle.position.y, z: handle.position.z }, true)
      body.setRotation(new THREE.Quaternion().setFromEuler(handle.rotation), true)
    }
  }

  const onTransformEnd = () => {
    setDragging(false)
    syncFromHandle()
    const body = bodyRef.current
    if (body) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  if (!obj.visible) return null

  const content = (
    <group
      ref={handleRef}
      position={obj.transform.position}
      rotation={obj.transform.rotation}
      scale={obj.transform.scale}
      onClick={(event) => {
        event.stopPropagation()
        selectObject(obj.id)
      }}
    >
      <RigidBody
        ref={bodyRef}
        type={bodyType}
        colliders={false}
        position={[0, 0, 0]}
        friction={obj.physics?.friction ?? 0.5}
        restitution={obj.physics?.restitution ?? 0.3}
      >
        <Collider collider={obj.physics?.collider} bounds={bounds} />
        {obj.glbUrl ? (
          <Suspense fallback={<PlaceholderVisual selected={selected} />}>
            <GLBVisual obj={obj} />
          </Suspense>
        ) : (
          <PlaceholderVisual selected={selected} />
        )}
      </RigidBody>
      {selected && <SelectionBox bounds={bounds} />}
    </group>
  )

  return (
    <>
      {content}
      {canTransform && handleRef.current && (
        <TransformControls
          object={handleRef.current}
          mode={activeTool}
          space="world"
          size={0.85}
          onMouseDown={() => setDragging(true)}
          onObjectChange={syncFromHandle}
          onMouseUp={onTransformEnd}
        />
      )}
    </>
  )
}

function SceneObjects() {
  const objects = useSceneStore((s) => s.objects)

  return (
    <>
      {Object.values(objects).map((obj) => (
        <SceneObjectView key={obj.id} obj={obj} />
      ))}
    </>
  )
}

function SceneExporter() {
  const { scene } = useThree()

  useEffect(() => {
    const handler = () => {
      void exportSceneGLB(scene)
    }
    window.addEventListener('docs-frontend:export-glb', handler)
    return () => window.removeEventListener('docs-frontend:export-glb', handler)
  }, [scene])

  return null
}

function EditorScene() {
  const gravityEnabled = useSceneStore((s) => s.gravityEnabled)
  const selectObject = useSceneStore((s) => s.selectObject)

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[6, 8, 5]}
        intensity={1.35}
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight args={['#d8e3ff', '#202028', 0.5]} />
      <Grid
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#35354a"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#6c7aff"
        fadeDistance={80}
        fadeStrength={1.5}
        infiniteGrid
      />
      <Physics gravity={gravityEnabled ? [0, -9.81, 0] : [0, 0, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[20, 0.05, 20]} position={[0, -0.05, 0]} />
          <mesh receiveShadow position={[0, -0.055, 0]} onClick={() => selectObject(null)}>
            <boxGeometry args={[40, 0.02, 40]} />
            <meshStandardMaterial color="#1e2029" roughness={0.9} />
          </mesh>
        </RigidBody>
        <SceneObjects />
      </Physics>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1} maxDistance={80} />
      <SceneExporter />
    </>
  )
}

export default function Viewport() {
  const hasObjects = useSceneStore((s) => Object.keys(s.objects).length > 0)

  return (
    <div className={styles.viewport} role="img" aria-label="Editable 3D scene viewport">
      {!hasObjects && (
        <div className={styles.emptyHint}>
          Import a GLB to register editable scene objects, or use chat to generate a fallback object.
        </div>
      )}
      <Suspense fallback={<div className={styles.loading}>Loading scene...</div>}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [5, 3.5, 6], fov: 52, near: 0.1, far: 500 }}
          gl={{ antialias: true }}
          onPointerMissed={() => useSceneStore.getState().selectObject(null)}
        >
          <color attach="background" args={['#15161d']} />
          <EditorScene />
        </Canvas>
      </Suspense>
    </div>
  )
}
