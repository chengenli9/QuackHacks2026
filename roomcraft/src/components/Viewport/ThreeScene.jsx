import { useEffect, useRef, useState } from 'react';
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Environment,
  Grid,
  OrbitControls,
  TransformControls,
} from '@react-three/drei';
import { Euler, PCFShadowMap, Quaternion, Vector3 } from 'three';
import useStore from '../../store/useStore';
import {
  editorGravityScale,
  selectViewportObject,
  shouldApplyRuntimePhysicsTransform,
  shouldShowTransformControls,
  transformModeForTool,
} from '../../lib/editorInteraction';
import { floorColliderForSceneObjects } from '../../lib/floorCollider';
import { applyObjectAppearance } from '../../lib/objectAppearance';
import { rapierBodyTypeFor, rapierColliderFor } from '../../lib/rapierMapping';

const CAMERA_PRESETS = {
  Perspective: { position: [5, 3.2, 5], target: [0, 0, 0], up: [0, 1, 0] },
  Front: { position: [0, 2, 8], target: [0, 0.8, 0], up: [0, 1, 0] },
  Right: { position: [8, 2, 0], target: [0, 0.8, 0], up: [0, 1, 0] },
  Top: { position: [0, 8, 0.001], target: [0, 0, 0], up: [0, 0, -1] },
  Camera: { position: [5, 3.2, 5], target: [0, 0, 0], up: [0, 1, 0] },
};

function CameraTracker({ onUpdate }) {
  useFrame(({ camera }) => {
    onUpdate(camera.position);
  });
  return null;
}

function CameraPositioner({ cameraTarget, perspective }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const preset = cameraTarget
      ? { position: [cameraTarget.x, cameraTarget.y, cameraTarget.z], target: [0, 0, 0], up: [0, 1, 0] }
      : CAMERA_PRESETS[perspective] ?? CAMERA_PRESETS.Perspective;

    camera.position.set(...preset.position);
    camera.up.set(...preset.up);
    camera.lookAt(...preset.target);
    if (controls?.target) controls.target.set(...preset.target);
    controls?.update();
  }, [camera, cameraTarget, controls, perspective]);

  return null;
}

function GroundCollider({ sceneObjects }) {
  const floor = floorColliderForSceneObjects(sceneObjects);
  const halfExtents = floor.args.map((value) => value / 2);

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={halfExtents} position={floor.position} />
    </RigidBody>
  );
}

function ImportedSceneObject({ object, isSelected, onDragStateChange }) {
  const bodyRef = useRef(null);
  const isEditorDraggingRef = useRef(false);
  const lastRuntimePositionRef = useRef(object.transform.position);
  const [isEditorDragging, setIsEditorDragging] = useState(false);
  const activeTool = useStore((state) => state.activeTool);
  const viewMode = useStore((state) => state.viewMode);
  const gravityEnabled = useStore((state) => state.gravityEnabled);
  const setSelectedObject = useStore((state) => state.setSelectedObject);
  const updateSceneObjectTransform = useStore((state) => state.updateSceneObjectTransform);
  const setSceneObjectRuntimeTransform = useStore((state) => state.setSceneObjectRuntimeTransform);

  useEffect(() => {
    applyObjectAppearance(object.object3d, object.appearance, viewMode);
  }, [object.appearance, object.object3d, viewMode]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || !shouldApplyRuntimePhysicsTransform({
      gravityEnabled,
      isEditorDragging: isEditorDraggingRef.current,
      isStatic: object.physics.static,
    })) return;

    const translation = body.translation();
    const next = [translation.x, translation.y, translation.z];
    const previous = lastRuntimePositionRef.current;
    const moved = next.some((value, index) => Math.abs(value - previous[index]) > 0.03);
    if (!moved) return;

    lastRuntimePositionRef.current = next;
    setSceneObjectRuntimeTransform(object.id, { position: next });
  });

  const stopPhysicsBody = () => {
    const body = bodyRef.current;
    if (!body) return;
    body.setLinvel?.({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel?.({ x: 0, y: 0, z: 0 }, true);
  };

  const setPhysicsPausedForEditor = (paused) => {
    bodyRef.current?.setGravityScale?.(editorGravityScale({ isEditorDragging: paused }), true);
    stopPhysicsBody();
  };

  const commitTransform = () => {
    const target = object.object3d;
    target.updateWorldMatrix(true, false);

    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    target.getWorldPosition(position);
    target.getWorldQuaternion(quaternion);
    target.getWorldScale(scale);
    const rotation = new Euler().setFromQuaternion(quaternion, 'XYZ');

    target.position.set(0, 0, 0);
    target.rotation.set(0, 0, 0);
    target.scale.set(1, 1, 1);

    updateSceneObjectTransform(object.id, {
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      scale: [scale.x, scale.y, scale.z],
    });
    lastRuntimePositionRef.current = [position.x, position.y, position.z];
  };

  const beginEditorDrag = () => {
    isEditorDraggingRef.current = true;
    setIsEditorDragging(true);
    setPhysicsPausedForEditor(true);
    onDragStateChange(true);
  };

  const endEditorDrag = () => {
    setPhysicsPausedForEditor(true);
    commitTransform();
    isEditorDraggingRef.current = false;
    setIsEditorDragging(false);
    setPhysicsPausedForEditor(false);
    onDragStateChange(false);
  };

  const transformMode = transformModeForTool(activeTool);
  const showControls = shouldShowTransformControls({ isSelected });
  const selectThisObject = (event) => {
    selectViewportObject(event, object.id, setSelectedObject);
  };

  return (
    <>
      <RigidBody
        key={`${object.id}-${object.transformRevision}-${object.physicsRevision}`}
        ref={bodyRef}
        type={rapierBodyTypeFor(object.physics)}
        colliders={rapierColliderFor(object.physics)}
        position={object.transform.position}
        rotation={object.transform.rotation}
        scale={object.transform.scale}
        mass={object.physics.static ? undefined : object.physics.massKg}
        friction={object.physics.friction}
        restitution={object.physics.restitution}
        gravityScale={editorGravityScale({ isEditorDragging })}
        linearDamping={0.15}
        angularDamping={0.15}
      >
        <primitive
          object={object.object3d}
          onPointerDown={selectThisObject}
          onClick={selectThisObject}
        />
      </RigidBody>

      {showControls && (
        <TransformControls
          object={object.object3d}
          mode={transformMode}
          onMouseDown={beginEditorDrag}
          onMouseUp={endEditorDrag}
        />
      )}
    </>
  );
}

function ImportedPhysicsScene({ sceneObjects, selectedObjectId, onDragStateChange }) {
  const gravityEnabled = useStore((state) => state.gravityEnabled);

  return (
    <Physics gravity={gravityEnabled ? [0, -9.81, 0] : [0, 0, 0]}>
      <GroundCollider sceneObjects={sceneObjects} />
      {sceneObjects.map((object) => (
        <ImportedSceneObject
          key={object.id}
          object={object}
          isSelected={selectedObjectId === object.id}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </Physics>
  );
}

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  const [isTransforming, setIsTransforming] = useState(false);
  const sceneObjects = useStore((state) => state.sceneObjects);
  const selectedObjectId = useStore((state) => state.selectedObjectId);
  const perspective = useStore((state) => state.perspective);
  const overlaysEnabled = useStore((state) => state.overlaysEnabled);
  const setSelectedObject = useStore((state) => state.setSelectedObject);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#444444' }}
      onPointerMissed={() => setSelectedObject('Room_Mesh')}
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

      {overlaysEnabled && (
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
      )}

      {sceneObjects.length > 0 && (
        <ImportedPhysicsScene
          sceneObjects={sceneObjects}
          selectedObjectId={selectedObjectId}
          onDragStateChange={setIsTransforming}
        />
      )}

      <OrbitControls
        makeDefault
        enabled={!isTransforming}
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
      <CameraPositioner cameraTarget={cameraTarget} perspective={perspective} />
    </Canvas>
  );
}
