import { Physics, RigidBody } from '@react-three/rapier';
import { Canvas, useFrame } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import PlaceholderRoom from './PlaceholderRoom';
import useStore from '../../store/useStore';
import { rapierBodyTypeFor, rapierColliderFor } from '../../lib/rapierMapping';

function CameraTracker({ onUpdate }) {
  useFrame(({ camera }) => {
    onUpdate(camera.position);
  });
  return null;
}

function GroundCollider() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh visible={false} position={[0, -0.06, 0]}>
        <boxGeometry args={[40, 0.1, 40]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
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

function SceneContents() {
  const sceneObjects = useStore((state) => state.sceneObjects);

  if (!sceneObjects.length) {
    return <PlaceholderRoom />;
  }

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <GroundCollider />
      {sceneObjects.map((object) => (
        <ImportedSceneObject key={object.id} object={object} />
      ))}
    </Physics>
  );
}

export default function ThreeScene({ onCameraUpdate }) {
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

      <SceneContents />

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
    </Canvas>
  );
}
