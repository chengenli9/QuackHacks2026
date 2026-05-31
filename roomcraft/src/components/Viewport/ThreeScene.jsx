import { forwardRef, useEffect, useRef, useState } from 'react';
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Environment,
  Grid,
  Html,
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
import {
  generatedTaskDisplayStatus,
  isGeneratedTaskPlaceholderVisible,
  placementPositionForTask,
} from '../../lib/generatedTaskState';
import { applyObjectAppearance } from '../../lib/objectAppearance';
import {
  buildObjectInsightLabel,
  labelPositionForObject,
  shouldShowObjectInsightLabel,
} from '../../lib/objectInsightLabels';
import {
  physicsXrayProfileForObject,
  shouldShowPhysicsXray,
} from '../../lib/physicsXray';
import { rapierBodyTypeFor, rapierColliderFor } from '../../lib/rapierMapping';
import styles from './Viewport.module.css';

const CAMERA_PRESETS = {
  Perspective: { position: [5, 3.2, 5], target: [0, 0, 0], up: [0, 1, 0] },
  Front: { position: [0, 2, 8], target: [0, 0.8, 0], up: [0, 1, 0] },
  Right: { position: [8, 2, 0], target: [0, 0.8, 0], up: [0, 1, 0] },
  Top: { position: [0, 8, 0.001], target: [0, 0, 0], up: [0, 0, -1] },
  Camera: { position: [5, 3.2, 5], target: [0, 0, 0], up: [0, 1, 0] },
};

function CameraTracker({ onUpdate }) {
  const lastUpdateRef = useRef({ time: 0, position: new Vector3(Number.POSITIVE_INFINITY, 0, 0) });

  useFrame(({ camera }) => {
    const now = performance.now();
    const previous = lastUpdateRef.current;
    const moved = previous.position.distanceToSquared(camera.position) > 0.0004;
    if (!moved && now - previous.time < 250) return;
    if (now - previous.time < 120) return;

    previous.time = now;
    previous.position.copy(camera.position);
    onUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
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

function EditorFloor({ sceneObjects }) {
  const floor = floorColliderForSceneObjects(sceneObjects);

  return (
    <mesh
      position={[floor.position[0], floor.position[1] + floor.args[1] / 2 + 0.002, floor.position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
      receiveShadow
    >
      <planeGeometry args={[floor.args[0], floor.args[2]]} />
      <meshStandardMaterial color="#2c333a" transparent opacity={0.56} roughness={0.88} metalness={0.02} />
    </mesh>
  );
}

function ImportedSceneObject({
  object,
  isSelected,
  isHighlighted,
  isLabeled,
  isXrayed,
  collisionsEnabled,
  onDragStateChange,
}) {
  const bodyRef = useRef(null);
  const hitboxRef = useRef(null);
  const highlightRef = useRef(null);
  const xrayRef = useRef(null);
  const labelRef = useRef(null);
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
    if (!object.object3d) return;
    applyObjectAppearance(object.object3d, object.appearance, viewMode);
  }, [object.appearance, object.object3d, viewMode]);

  useEffect(() => {
    if (!object.object3d) return;
    object.object3d.visible = object.visible !== false;
  }, [object.object3d, object.visible]);

  const syncOverlayGroupsToBody = (body) => {
    const translation = body.translation();
    const rotation = body.rotation();
    for (const group of [hitboxRef.current, highlightRef.current, xrayRef.current]) {
      if (!group) continue;
      group.position.set(translation.x, translation.y, translation.z);
      group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    if (labelRef.current) {
      labelRef.current.position.set(translation.x, translation.y, translation.z);
    }
  };

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;

    syncOverlayGroupsToBody(body);

    if (!shouldApplyRuntimePhysicsTransform({
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

  const editorWorldPose = () => {
    const target = object.object3d;
    if (!target) return null;
    target.updateWorldMatrix(true, false);

    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    target.getWorldPosition(position);
    target.getWorldQuaternion(quaternion);
    target.getWorldScale(scale);
    const rotation = new Euler().setFromQuaternion(quaternion, 'XYZ');

    return { position, quaternion, rotation, scale };
  };

  const syncBodyToEditorPose = (pose) => {
    const body = bodyRef.current;
    if (!body || !pose) return;
    body.setTranslation?.({ x: pose.position.x, y: pose.position.y, z: pose.position.z }, true);
    body.setRotation?.({
      x: pose.quaternion.x,
      y: pose.quaternion.y,
      z: pose.quaternion.z,
      w: pose.quaternion.w,
    }, true);
    stopPhysicsBody();
  };

  const setPhysicsPausedForEditor = (paused) => {
    bodyRef.current?.setGravityScale?.(editorGravityScale({ isEditorDragging: paused }), true);
    stopPhysicsBody();
  };

  const commitTransform = () => {
    const target = object.object3d;
    const pose = editorWorldPose();
    if (!target || !pose) return null;

    target.position.set(0, 0, 0);
    target.rotation.set(0, 0, 0);
    target.scale.set(1, 1, 1);

    updateSceneObjectTransform(object.id, {
      position: [pose.position.x, pose.position.y, pose.position.z],
      rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z],
      scale: [pose.scale.x, pose.scale.y, pose.scale.z],
    });
    lastRuntimePositionRef.current = [pose.position.x, pose.position.y, pose.position.z];
    return pose;
  };

  const beginEditorDrag = () => {
    isEditorDraggingRef.current = true;
    setIsEditorDragging(true);
    setPhysicsPausedForEditor(true);
    onDragStateChange(true);
  };

  const endEditorDrag = () => {
    setPhysicsPausedForEditor(true);
    const pose = commitTransform();
    syncBodyToEditorPose(pose);
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
        colliders={collisionsEnabled ? rapierColliderFor(object.physics) : false}
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

      <ObjectSelectionHitbox ref={hitboxRef} object={object} onSelect={selectThisObject} />

      {showControls && (
        <TransformControls
          object={object.object3d}
          mode={transformMode}
          onMouseDown={beginEditorDrag}
          onMouseUp={endEditorDrag}
        />
      )}

      {isHighlighted && object.visible !== false && <ObjectHighlight ref={highlightRef} object={object} />}
      {isXrayed && object.visible !== false && <ObjectPhysicsXray ref={xrayRef} object={object} />}
      {isLabeled && object.visible !== false && <ObjectInsightLabel ref={labelRef} object={object} />}
    </>
  );
}

const ObjectSelectionHitbox = forwardRef(function ObjectSelectionHitbox({ object, onSelect }, ref) {
  const dimensions = object.localBoundsDimensions?.map((value) => Math.max(value, 0.18)) ?? [1, 1, 1];
  const localCenter = object.localBoundsCenter ?? [0, 0, 0];

  return (
    <group
      ref={ref}
      position={object.transform.position}
      rotation={object.transform.rotation}
      scale={object.transform.scale}
    >
      <mesh
        position={localCenter}
        onPointerDown={onSelect}
        onClick={onSelect}
      >
        <boxGeometry args={dimensions} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
});

function ImportedPhysicsScene({
  sceneObjects,
  selectedObjectId,
  objectLabelsEnabled,
  physicsXrayEnabled,
  onDragStateChange,
}) {
  const gravityEnabled = useStore((state) => state.gravityEnabled);
  const collisionsEnabled = useStore((state) => state.collisionsEnabled);
  const floorEnabled = useStore((state) => state.floorEnabled);
  const highlightedObjectId = useStore((state) => state.highlightedObjectId);

  return (
    <Physics gravity={gravityEnabled ? [0, -9.81, 0] : [0, 0, 0]}>
      {floorEnabled && <EditorFloor sceneObjects={sceneObjects} />}
      {floorEnabled && collisionsEnabled && <GroundCollider sceneObjects={sceneObjects} />}
      {sceneObjects.map((object) => (
        <ImportedSceneObject
          key={object.id}
          object={object}
          isSelected={selectedObjectId === object.id}
          isHighlighted={highlightedObjectId === object.id}
          isLabeled={shouldShowObjectInsightLabel(object, objectLabelsEnabled)}
          isXrayed={shouldShowPhysicsXray(object, physicsXrayEnabled)}
          collisionsEnabled={collisionsEnabled}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </Physics>
  );
}

const ObjectHighlight = forwardRef(function ObjectHighlight({ object }, ref) {
  const dimensions = object.localBoundsDimensions?.map((value) => Math.max(value, 0.12)) ?? [1, 1, 1];
  const localCenter = object.localBoundsCenter ?? [0, 0, 0];

  return (
    <group
      ref={ref}
      position={object.transform.position}
      rotation={object.transform.rotation}
      scale={object.transform.scale}
    >
      <mesh
        position={localCenter}
        renderOrder={20}
        raycast={() => null}
      >
        <boxGeometry args={dimensions} />
        <meshBasicMaterial color="#00e5ca" wireframe transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
});

const ObjectPhysicsXray = forwardRef(function ObjectPhysicsXray({ object }, ref) {
  const dimensions = object.localBoundsDimensions?.map((value) => Math.max(value, 0.14)) ?? [1, 1, 1];
  const localCenter = object.localBoundsCenter ?? [0, 0, 0];
  const profile = physicsXrayProfileForObject(object);

  return (
    <group
      ref={ref}
      position={object.transform.position}
      rotation={object.transform.rotation}
      scale={object.transform.scale}
    >
      <mesh position={localCenter} renderOrder={18} raycast={() => null}>
        <boxGeometry args={dimensions} />
        <meshBasicMaterial
          color={profile.color}
          transparent
          opacity={0.16}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh position={localCenter} renderOrder={19} raycast={() => null}>
        <boxGeometry args={dimensions.map((value) => value * 1.015)} />
        <meshBasicMaterial
          color={profile.color}
          wireframe
          transparent
          opacity={0.92}
          depthTest={false}
        />
      </mesh>
    </group>
  );
});

const ObjectInsightLabel = forwardRef(function ObjectInsightLabel({ object }, ref) {
  const insight = buildObjectInsightLabel(object);
  const worldPosition = labelPositionForObject(object);
  const objectPosition = object.transform?.position ?? [0, 0, 0];
  const localPosition = [
    worldPosition[0] - objectPosition[0],
    worldPosition[1] - objectPosition[1],
    worldPosition[2] - objectPosition[2],
  ];

  return (
    <group ref={ref} position={objectPosition}>
      <Html center position={localPosition} distanceFactor={9} occlude>
        <div className={styles.objectInsightLabel}>
          <strong>{insight.title}</strong>
          <span>{insight.subtitle}</span>
          {insight.metrics.length > 0 && (
            <small>{insight.metrics.slice(0, 3).join(' | ')}</small>
          )}
          {insight.texture && <small>{insight.texture}</small>}
        </div>
      </Html>
    </group>
  );
});

function GeneratedAssetPlaceholders({ tasks, sceneObjects }) {
  return tasks
    .filter(isGeneratedTaskPlaceholderVisible)
    .map((task) => {
      const position = placementPositionForTask(task, sceneObjects);
      return (
        <group key={task.taskId ?? task.prompt} position={position}>
          <mesh raycast={() => null}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#00e5ca" transparent opacity={0.22} wireframe />
          </mesh>
          <Html center position={[0, 0.45, 0]} distanceFactor={8}>
            <div style={{
              padding: '3px 6px',
              border: '1px solid rgba(0, 229, 202, 0.65)',
              borderRadius: 3,
              background: 'rgba(17, 17, 17, 0.85)',
              color: '#d7fff8',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 10,
              whiteSpace: 'nowrap',
            }}>
              {task.prompt ?? task.sourcePrompt}: {generatedTaskDisplayStatus(task)}
            </div>
          </Html>
        </group>
      );
    });
}

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  const [isTransforming, setIsTransforming] = useState(false);
  const sceneObjects = useStore((state) => state.sceneObjects);
  const selectedObjectId = useStore((state) => state.selectedObjectId);
  const perspective = useStore((state) => state.perspective);
  const overlaysEnabled = useStore((state) => state.overlaysEnabled);
  const objectLabelsEnabled = useStore((state) => state.objectLabelsEnabled);
  const physicsXrayEnabled = useStore((state) => state.physicsXrayEnabled);
  const generatedTasks = useStore((state) => state.generatedTasks);
  const highlightedObjectId = useStore((state) => state.highlightedObjectId);
  const pictureMode = useStore((state) => state.pictureMode);
  const showtimeEnabled = useStore((state) => state.showtimeEnabled);
  const setSelectedObject = useStore((state) => state.setSelectedObject);
  const setHighlightedObject = useStore((state) => state.setHighlightedObject);
  const renderableSceneObjects = sceneObjects.filter((object) => object.object3d);

  useEffect(() => {
    if (showtimeEnabled) return undefined;
    if (!highlightedObjectId) return undefined;
    const timeout = setTimeout(() => {
      if (useStore.getState().highlightedObjectId === highlightedObjectId) {
        setHighlightedObject(null);
      }
    }, 2500);
    return () => clearTimeout(timeout);
  }, [highlightedObjectId, setHighlightedObject, showtimeEnabled]);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', position: 'absolute', inset: 0, zIndex: 1 }}
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

      {renderableSceneObjects.length > 0 && (
        <ImportedPhysicsScene
          sceneObjects={renderableSceneObjects}
          selectedObjectId={selectedObjectId}
          objectLabelsEnabled={objectLabelsEnabled}
          physicsXrayEnabled={physicsXrayEnabled}
          onDragStateChange={setIsTransforming}
        />
      )}

      <GeneratedAssetPlaceholders tasks={generatedTasks} sceneObjects={sceneObjects} />

      <OrbitControls
        makeDefault
        enabled={!isTransforming}
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.8}
      />

      {!pictureMode && (
      <GizmoHelper alignment="top-right" margin={[65, 100]}>
        <GizmoViewport
          axisColors={['#e8524a', '#6abf69', '#4d9de0']}
          labelColor="#ffffff"
          hideNegativeAxes={false}
        />
      </GizmoHelper>
      )}

      <CameraTracker onUpdate={onCameraUpdate} />
      <CameraPositioner cameraTarget={cameraTarget} perspective={perspective} />
    </Canvas>
  );
}
