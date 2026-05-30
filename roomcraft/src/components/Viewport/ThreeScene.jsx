import { useEffect, useRef, useState } from 'react';
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  TransformControls,
  useGLTF,
} from '@react-three/drei';
import { PCFShadowMap } from 'three';
import useStore from '../../store/useStore';
import { floorColliderForSceneObjects } from '../../lib/floorCollider';
import { rapierBodyTypeFor, rapierColliderFor } from '../../lib/rapierMapping';

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

function GroundCollider({ sceneObjects }) {
  const floor = floorColliderForSceneObjects(sceneObjects);
  const halfExtents = floor.args.map((value) => value / 2);

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={halfExtents} position={floor.position} />
    </RigidBody>
  );
}

function ImportedSceneObject({ object }) {
  return (
    <RigidBody
      type={rapierBodyTypeFor(object.physics)}
      colliders={rapierColliderFor(object.physics)}
      mass={object.physics.static ? undefined : object.physics.massKg}
      friction={object.physics.friction}
      restitution={object.physics.restitution}
      linearDamping={0.15}
      angularDamping={0.15}
    >
      <primitive object={object.object3d} />
    </RigidBody>
  );
}

function ImportedPhysicsScene({ sceneObjects }) {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <GroundCollider sceneObjects={sceneObjects} />
      {sceneObjects.map((object) => (
        <ImportedSceneObject key={object.id} object={object} />
      ))}
    </Physics>
  );
}

function DefaultInteractiveScene() {
  const meshRef = useRef();
  const [selectedObj, setSelectedObj] = useState(null);

  return (
    <>
      <ChaoMan groupRef={meshRef} onSelect={() => setSelectedObj(meshRef.current)} />
      {selectedObj && <TransformControls object={selectedObj} mode="translate" />}
    </>
  );
}

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  const sceneObjects = useStore((state) => state.sceneObjects);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#444444' }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[5, 8, 4]}
        intensity={1.2}
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

      {sceneObjects.length ? (
        <ImportedPhysicsScene sceneObjects={sceneObjects} />
      ) : (
        <DefaultInteractiveScene />
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
