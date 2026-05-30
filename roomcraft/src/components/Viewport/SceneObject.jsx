import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import useStore from '../../store/useStore';

const PLACEHOLDER_SHAPES = {
  floor: { type: 'plane', args: [8, 8], rotation: [-Math.PI / 2, 0, 0] },
  back_wall: { type: 'box', args: [8, 4, 0.1] },
  front_wall: { type: 'box', args: [8, 4, 0.1] },
  left_wall: { type: 'box', args: [0.1, 4, 8] },
  right_wall: { type: 'box', args: [0.1, 4, 8] },
  coffee_table_01: { type: 'box', args: [1.5, 0.05, 0.8] },
  box_01: { type: 'box', args: [1.2, 0.8, 0.8] },
};

function isBallLike(label) {
  const l = (label || '').toLowerCase();
  return l.includes('ball') || l.includes('sphere') || l === 'rubber_ball';
}

function getBodyType(physics) {
  if (!physics) return 'dynamic';
  if (physics.static === true || physics.massKg === 0 || physics.mass === 0) return 'fixed';
  return 'dynamic';
}

function PlaceholderMesh({ obj, isSelected, onClick }) {
  const shape = PLACEHOLDER_SHAPES[obj.id] || { type: 'box', args: [0.5, 0.5, 0.5] };
  const bodyType = getBodyType(obj.physics);

  // For plane shapes the collider is a flat box; rotation stays on the mesh only
  const halfExtents = shape.type === 'plane'
    ? [shape.args[0] / 2, 0.05, shape.args[1] / 2]
    : [shape.args[0] / 2, shape.args[1] / 2, shape.args[2] / 2];

  const matProps = {
    color: isSelected ? '#00e5ca' : (obj.color || '#888888'),
    roughness: 0.85,
    metalness: 0.05,
    emissive: isSelected ? '#004433' : '#000000',
  };

  return (
    <RigidBody
      type={bodyType}
      position={obj.position}
    >
      <CuboidCollider
        args={halfExtents}
        friction={obj.physics?.friction ?? 0.5}
        restitution={obj.physics?.restitution ?? 0.3}
      />
      <mesh
        castShadow
        receiveShadow
        rotation={shape.rotation || obj.rotation}
        scale={obj.scale}
        visible={obj.visible !== false}
        onClick={onClick}
      >
        {shape.type === 'plane'
          ? <planeGeometry args={shape.args} />
          : <boxGeometry args={shape.args} />}
        <meshStandardMaterial {...matProps} />
      </mesh>
    </RigidBody>
  );
}

function GlbObject({ obj, isSelected, onClick }) {
  const gltf = useLoader(GLTFLoader, obj.glbUrl);
  const { setObjectMeshInfo } = useStore();
  const bodyType = getBodyType(obj.physics);

  const cloned = useMemo(() => {
    const scene = gltf.scene.clone(true);
    let vertCount = 0;
    let polyCount = 0;
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.geometry) {
          const pos = node.geometry.attributes.position;
          if (pos) vertCount += pos.count;
          if (node.geometry.index) polyCount += node.geometry.index.count / 3;
          else if (pos) polyCount += pos.count / 3;
        }
      }
    });
    return { scene, vertCount, polyCount };
  }, [gltf]);

  useEffect(() => {
    if (cloned.vertCount > 0) {
      setObjectMeshInfo(obj.id, {
        vertices: cloned.vertCount,
        polygons: Math.floor(cloned.polyCount),
        format: '.glb',
      });
    }
  }, [obj.id, cloned.vertCount, cloned.polyCount, setObjectMeshInfo]);

  useEffect(() => {
    cloned.scene.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          m.emissive = new THREE.Color(isSelected ? '#004433' : '#000000');
        });
      }
    });
  }, [isSelected, cloned.scene]);

  return (
    <RigidBody
      type={bodyType}
      position={obj.position}
      rotation={obj.rotation}
    >
      {isBallLike(obj.label)
        ? <BallCollider args={[0.5]} friction={obj.physics?.friction ?? 0.5} restitution={obj.physics?.restitution ?? 0.3} />
        : <CuboidCollider args={[0.5, 0.5, 0.5]} friction={obj.physics?.friction ?? 0.5} restitution={obj.physics?.restitution ?? 0.3} />}
      <primitive
        object={cloned.scene}
        scale={obj.scale}
        visible={obj.visible !== false}
        onClick={onClick}
      />
    </RigidBody>
  );
}

function GeneratingPlaceholder({ obj }) {
  return (
    <group position={obj.position} visible={obj.visible !== false}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial
          color="#00e5ca"
          transparent
          opacity={0.35}
          wireframe
        />
      </mesh>
    </group>
  );
}

export default function SceneObject({ obj }) {
  const { selectedObjectId, setSelectedObject } = useStore();
  const isSelected = selectedObjectId === obj.id;
  const onClick = (e) => {
    e.stopPropagation();
    setSelectedObject(obj.id);
  };

  if (obj.type === 'generating') {
    return <GeneratingPlaceholder obj={obj} />;
  }

  if (obj.type === 'glb' && obj.glbUrl) {
    return <GlbObject obj={obj} isSelected={isSelected} onClick={onClick} />;
  }

  return <PlaceholderMesh obj={obj} isSelected={isSelected} onClick={onClick} />;
}
