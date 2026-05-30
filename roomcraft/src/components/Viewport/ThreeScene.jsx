import { Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import useStore from '../../store/useStore';
import SceneObject from './SceneObject';

function SceneExporter() {
  const { scene } = useThree();
  useEffect(() => {
    const handler = () => {
      const exporter = new GLTFExporter();
      exporter.parseAsync(scene, { binary: true })
        .then((result) => {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'scene.glb';
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch((err) => console.error('GLTFExporter error:', err));
    };
    window.addEventListener('roomcraft:export-glb', handler);
    return () => window.removeEventListener('roomcraft:export-glb', handler);
  }, [scene]);
  return null;
}

function CameraTracker({ onUpdate }) {
  useFrame(({ camera }) => {
    onUpdate(camera.position);
  });
  return null;
}

function SceneObjects() {
  const sceneObjects = useStore((s) => s.sceneObjects);
  return (
    <>
      {Object.values(sceneObjects).map((obj) => (
        <Suspense key={obj.id} fallback={null}>
          <SceneObject obj={obj} />
        </Suspense>
      ))}
    </>
  );
}

function PhysicsWrapper({ children }) {
  const gravityEnabled = useStore((s) => s.gravityEnabled);
  return (
    <Physics gravity={gravityEnabled ? [0, -9.81, 0] : [0, 0, 0]}>
      {children}
    </Physics>
  );
}

export default function ThreeScene({ onCameraUpdate }) {
  const handleMissed = () => useStore.getState().setSelectedObject(null);

  return (
    <Canvas
      shadows
      camera={{ position: [5, 3.2, 5], fov: 55, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#444444' }}
      onPointerMissed={handleMissed}
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
        sectionColor="#00e5ca"
        fadeDistance={300}
        fadeStrength={5}
        infiniteGrid
      />

      {/* Scene objects wrapped in Physics */}
      <PhysicsWrapper>
        <SceneObjects />
      </PhysicsWrapper>

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

      {/* GLB exporter — listens for roomcraft:export-glb inside Canvas context */}
      <SceneExporter />

      {/* Camera tracker */}
      <CameraTracker onUpdate={onCameraUpdate} />
    </Canvas>
  );
}
