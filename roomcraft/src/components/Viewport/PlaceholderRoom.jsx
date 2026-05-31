// A simple open-top box room: floor + 4 walls
export default function PlaceholderRoom() {
  const matProps = { color: '#3a3a3a', roughness: 0.85, metalness: 0.05 };

  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial {...matProps} color="#2e2e2e" />
      </mesh>

      {/* Back wall */}
      <mesh receiveShadow castShadow position={[0, 2, -4]}>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Front wall */}
      <mesh receiveShadow castShadow position={[0, 2, 4]}>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Left wall */}
      <mesh receiveShadow castShadow position={[-4, 2, 0]}>
        <boxGeometry args={[0.1, 4, 8]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Right wall */}
      <mesh receiveShadow castShadow position={[4, 2, 0]}>
        <boxGeometry args={[0.1, 4, 8]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Placeholder furniture — small box */}
      <mesh castShadow receiveShadow position={[1.5, 0.4, -1]}>
        <boxGeometry args={[1.2, 0.8, 0.8]} />
        <meshStandardMaterial color="#4a3c2a" roughness={0.9} metalness={0} />
      </mesh>

      {/* Placeholder table */}
      <mesh castShadow receiveShadow position={[-1.5, 0.35, 1]}>
        <boxGeometry args={[1.5, 0.05, 0.8]} />
        <meshStandardMaterial color="#5c4a30" roughness={0.8} metalness={0} />
      </mesh>
      <mesh castShadow receiveShadow position={[-1.5, 0.175, 1]}>
        <boxGeometry args={[1.4, 0.3, 0.7]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}
