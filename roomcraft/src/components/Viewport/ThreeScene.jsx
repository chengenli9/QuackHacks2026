import { useEffect, useRef, useCallback } from 'react';
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Environment,
  Grid,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei';
import { PCFShadowMap, Euler, Quaternion, Vector3 } from 'three';
import useStore from '../../store/useStore';
import { floorColliderForSceneObjects } from '../../lib/floorCollider';
import { rapierBodyTypeFor, rapierColliderFor } from '../../lib/rapierMapping';

/* ------------------------------------------------------------------ */
/*  ChaoMan (default interactive scene)                               */
/* ------------------------------------------------------------------ */

function ChaoMan({ groupRef, onSelect }) {
  const { scene } = useGLTF('/chaoman.glb');

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera helpers                                                     */
/* ------------------------------------------------------------------ */

function CameraTracker({ onUpdate }) {
  useFrame(({ camera }) => {
    onUpdate(camera.position);
  });
  return null;
}

function CameraPositioner({ target }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    if (!target) return;
    camera.position.set(target.x, target.y, target.z);
    controls?.update();
  }, [camera, controls, target]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Ground collider                                                    */
/* ------------------------------------------------------------------ */

function GroundCollider({ sceneObjects }) {
  const floor = floorColliderForSceneObjects(sceneObjects);
  const halfExtents = floor.args.map((value) => value / 2);

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={halfExtents} position={floor.position} />
    </RigidBody>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Quaternion → Euler [x, y, z] */
function quatToEuler(quat) {
  const euler = new Euler().setFromQuaternion(
    new Quaternion(quat.x, quat.y, quat.z, quat.w),
  );
  return [euler.x, euler.y, euler.z];
}

/** Euler [x, y, z] → Quaternion-like {x, y, z, w} */
function eulerToQuatObj(eulerArr) {
  const q = new Quaternion().setFromEuler(
    new Euler(eulerArr[0], eulerArr[1], eulerArr[2]),
  );
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** Three numbers equal within tolerance */
function vecEqual(a, b, tol = 0.0005) {
  return (
    Math.abs(a[0] - b[0]) < tol &&
    Math.abs(a[1] - b[1]) < tol &&
    Math.abs(a[2] - b[2]) < tol
  );
}

/* ------------------------------------------------------------------ */
/*  Imported scene object (physics body)                               */
/* ------------------------------------------------------------------ */

function ImportedSceneObject({ object, isSelected, transformMode }) {
  const rigidBodyRef = useRef(null);
  const groupRef = useRef(null);
  const isDragging = useRef(false);
  const lastSyncedPos = useRef([0, 0, 0]);
  const lastSyncedRot = useRef([0, 0, 0]);

  // --- sync physics → store (every frame when not dragging) ---
  useFrame(() => {
    const body = rigidBodyRef.current;
    if (!body || isDragging.current) return;

    const pos = body.translation();
    const quat = body.rotation();
    const posArr = [pos.x, pos.y, pos.z];
    const rotArr = quatToEuler(quat);

    if (!vecEqual(posArr, lastSyncedPos.current) || !vecEqual(rotArr, lastSyncedRot.current)) {
      lastSyncedPos.current = posArr;
      lastSyncedRot.current = rotArr;
      // use direct setState to avoid re-rendering the whole scene
      useStore.getState().updateObjectTransform(object.id, {
        position: posArr,
        rotation: rotArr,
      });
    }
  });

  // --- apply store → physics (when panel edits transform) ---
  const storedTransform = useStore(
    useCallback(
      (state) => state.sceneObjectTransforms[object.id],
      [object.id],
    ),
  );

  const lastAppliedPos = useRef(null);
  const lastAppliedRot = useRef(null);

  useEffect(() => {
    const body = rigidBodyRef.current;
    if (!body || !storedTransform || isDragging.current) return;

    const targetPos = storedTransform.position;
    const targetRot = storedTransform.rotation;

    if (
      !lastAppliedPos.current ||
      !vecEqual(targetPos, lastAppliedPos.current)
    ) {
      body.setTranslation({ x: targetPos[0], y: targetPos[1], z: targetPos[2] }, true);
      lastAppliedPos.current = [...targetPos];
    }

    if (
      !lastAppliedRot.current ||
      !vecEqual(targetRot, lastAppliedRot.current)
    ) {
      const quat = eulerToQuatObj(targetRot);
      body.setRotation(quat, true);
      lastAppliedRot.current = [...targetRot];
    }
  }, [storedTransform?.position, storedTransform?.rotation]);

  // --- TransformControls drag handling ---
  const handleDraggingChange = useCallback(
    (dragging) => {
      isDragging.current = dragging;

      if (!rigidBodyRef.current || !groupRef.current) return;

      if (dragging) {
        // Reset group local to identity so the gizmo starts from the rigid body position
        groupRef.current.position.set(0, 0, 0);
        groupRef.current.quaternion.identity();
      } else {
        // drag ended — compute world-space transform of the group
        const worldPos = new Vector3();
        groupRef.current.getWorldPosition(worldPos);
        const worldQuat = new Quaternion();
        groupRef.current.getWorldQuaternion(worldQuat);

        // apply to rigid body
        rigidBodyRef.current.setTranslation(worldPos, true);
        rigidBodyRef.current.setRotation(
          { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w },
          true,
        );

        // reset group local back to identity
        groupRef.current.position.set(0, 0, 0);
        groupRef.current.quaternion.identity();
      }
    },
    [],
  );

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={rapierBodyTypeFor(object.physics)}
      colliders={rapierColliderFor(object.physics)}
      mass={object.physics.static ? undefined : object.physics.massKg}
      friction={object.physics.friction}
      restitution={object.physics.restitution}
      linearDamping={0.15}
      angularDamping={0.15}
      position={
        storedTransform?.position && storedTransform.position.length === 3
          ? storedTransform.position
          : object.center
      }
    >
      <group ref={groupRef}>
        <primitive object={object.object3d} />
      </group>

      {isSelected && transformMode && (
        <TransformControls
          object={groupRef}
          mode={transformMode}
          onDraggingChange={handleDraggingChange}
        />
      )}
    </RigidBody>
  );
}

/* ------------------------------------------------------------------ */
/*  Imported physics scene                                             */
/* ------------------------------------------------------------------ */

function ImportedPhysicsScene({ sceneObjects }) {
  const selectedObjectId = useStore((state) => state.selectedObjectId);
  const activeTool = useStore((state) => state.activeTool);

  const transformMode =
    activeTool === 'move'
      ? 'translate'
      : activeTool === 'rotate'
        ? 'rotate'
        : activeTool === 'scale'
          ? 'scale'
          : null;

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <GroundCollider sceneObjects={sceneObjects} />
      {sceneObjects.map((object) => (
        <ImportedSceneObject
          key={object.id}
          object={object}
          isSelected={selectedObjectId === object.id}
          transformMode={transformMode}
        />
      ))}
    </Physics>
  );
}

/* ------------------------------------------------------------------ */
/*  Default interactive scene (ChaoMan)                                */
/* ------------------------------------------------------------------ */

function DefaultInteractiveScene() {
  const groupRef = useRef(null);
  const selectedObjectId = useStore((state) => state.selectedObjectId);
  const setSelectedObject = useStore((state) => state.setSelectedObject);
  const activeTool = useStore((state) => state.activeTool);

  const isSelected = selectedObjectId === 'ChaoMan';

  const transformMode =
    activeTool === 'move'
      ? 'translate'
      : activeTool === 'rotate'
        ? 'rotate'
        : activeTool === 'scale'
          ? 'scale'
          : null;

  // --- sync group transform → store (every frame) ---
  const lastSynced = useRef({ pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1] });

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    const pos = [g.position.x, g.position.y, g.position.z];
    const rot = [g.rotation.x, g.rotation.y, g.rotation.z];
    const scl = [g.scale.x, g.scale.y, g.scale.z];

    if (
      !vecEqual(pos, lastSynced.current.pos) ||
      !vecEqual(rot, lastSynced.current.rot) ||
      !vecEqual(scl, lastSynced.current.scl)
    ) {
      lastSynced.current = { pos, rot, scl };
      useStore.getState().updateObjectTransform('ChaoMan', {
        position: pos,
        rotation: rot,
        scale: scl,
      });
    }
  });

  // --- apply store → group (when panel edits) ---
  const storedTransform = useStore(
    useCallback((state) => state.sceneObjectTransforms['ChaoMan'], []),
  );

  const lastApplied = useRef({ pos: null, rot: null, scl: null });

  useEffect(() => {
    const g = groupRef.current;
    if (!g || !storedTransform) return;

    const tp = storedTransform.position;
    const tr = storedTransform.rotation;
    const ts = storedTransform.scale;

    if (!lastApplied.current.pos || !vecEqual(tp, lastApplied.current.pos)) {
      g.position.set(tp[0], tp[1], tp[2]);
      lastApplied.current.pos = [...tp];
    }
    if (!lastApplied.current.rot || !vecEqual(tr, lastApplied.current.rot)) {
      g.rotation.set(tr[0], tr[1], tr[2]);
      lastApplied.current.rot = [...tr];
    }
    if (!lastApplied.current.scl || !vecEqual(ts, lastApplied.current.scl)) {
      g.scale.set(ts[0], ts[1], ts[2]);
      lastApplied.current.scl = [...ts];
    }
  }, [storedTransform?.position, storedTransform?.rotation, storedTransform?.scale]);

  return (
    <>
      <ChaoMan
        groupRef={groupRef}
        onSelect={() => setSelectedObject('ChaoMan')}
      />
      {isSelected && transformMode && (
        <TransformControls object={groupRef} mode={transformMode} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ThreeScene                                                    */
/* ------------------------------------------------------------------ */

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  const sceneObjects = useStore((state) => state.sceneObjects);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#444444' }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight intensity={0.85} color="#ffffff" groundColor="#4b5563" />
      <Environment preset="studio" />
      <directionalLight
        castShadow
        position={[5, 8, 4]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-3, 3, -3]} intensity={0.4} color="#4488ff" />

      <Grid
        args={[20, 20]}
        position={[0, 0.001, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2a2a2a"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#00e5ca"
        fadeDistance={300}
        fadeStrength={5}
        infiniteGrid
      />

      <DefaultInteractiveScene />
      {sceneObjects.length > 0 && (
        <ImportedPhysicsScene sceneObjects={sceneObjects} />
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.8}
      />

      <GizmoHelper alignment="top-right" margin={[65, 100]}>
        <GizmoViewport
          axisColors={['#e8524a', '#6abf69', '#4d9de0']}
          labelColor="#ffffff"
          hideNegativeAxes={false}
        />
      </GizmoHelper>

      <CameraTracker onUpdate={onCameraUpdate} />
      <CameraPositioner target={cameraTarget} />
    </Canvas>
  );
}
