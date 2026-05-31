import { useEffect, useRef, useState } from 'react';
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
import { PCFShadowMap } from 'three';
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
    controls?.update();
  }, [camera, controls, target]);

  return null;
}

function SelectableObject({ object, onSelect }) {
  const groupRef = useRef();
  return (
    <group
      ref={groupRef}
      onClick={(e) => { e.stopPropagation(); onSelect(groupRef.current); }}
    >
      <primitive object={object.object3d} />
    </group>
  );
}

function InteractiveScene({ sceneObjects, selectedObj, onSelect }) {
  const chaomanRef = useRef();
  // const { scene: chaomanScene } = useGLTF('/chaoman.glb');

  return (
    <>
      <group
        ref={chaomanRef}
        onClick={(e) => { e.stopPropagation(); onSelect(chaomanRef.current); }}
      >
        {/* <primitive object={chaomanScene} /> */}
      </group>
      {sceneObjects.map((obj) => (
        <SelectableObject key={obj.id} object={obj} onSelect={onSelect} />
      ))}
      {selectedObj && <TransformControls object={selectedObj} mode="translate" />}
    </>
  );
}

export default function ThreeScene({ onCameraUpdate, cameraTarget }) {
  const sceneObjects = useStore((state) => state.sceneObjects);
  const deletedNodeIds = useStore((state) => state.deletedNodeIds);
  const hiddenNodeIds = useStore((state) => state.hiddenNodeIds);
  const [selectedObj, setSelectedObj] = useState(null);

  const del = (id) => deletedNodeIds.includes(id);
  const hidden = (id) => hiddenNodeIds.includes(id);
  const visibleObjects = sceneObjects.filter((o) => !del(o.id) && !hidden(o.id));

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

      <InteractiveScene
        sceneObjects={visibleObjects}
        selectedObj={selectedObj}
        onSelect={setSelectedObj}
      />

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
