import { useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import PlaceholderRoom from './PlaceholderRoom';
import useStore from '../../store/useStore';

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
    if (controls) controls.update();
  }, [target]);
  return null;
}

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#444444' }}
    >
      {/* Lighting */}
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

      {/* Grid */}
      <Grid
        args={[20, 20]}
        position={[0, 0.001, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2a2a2a"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#00e5ca09"
        fadeDistance={300}
        fadeStrength={5}
        infiniteGrid
      />

      {/* Scene */}
      <PlaceholderRoom />

      {/* Controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.8}
      />

      {/* Navigation Gizmo */}
      <GizmoHelper alignment="top-right" margin={[65, 100]}>
        <GizmoViewport
          axisColors={['#e8524a', '#6abf69', '#4d9de0']}
          labelColor="#ffffff"
          hideNegativeAxes={false}
        />
      </GizmoHelper>

      {/* Camera tracker */}
      <CameraTracker onUpdate={onCameraUpdate} />
      <CameraPositioner target={cameraTarget} />
    </Canvas>
  );
}
