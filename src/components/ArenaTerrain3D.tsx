import React from 'react';
import * as THREE from 'three';

export const ArenaTerrain3D: React.FC = () => {
  // Checkered pattern helper data
  const gridCells = [];
  for (let x = -10; x <= 10; x += 2) {
    for (let z = -15; z <= 15; z += 2) {
      gridCells.push({ x, z, isLight: (x + z) % 4 === 0 });
    }
  }

  return (
    <group>
      {/* 1. Base Green Grass Field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[22, 32]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>

      {/* Styled Grid Tiles for visual movement depth */}
      {gridCells.map((tile, i) => (
        <mesh
          key={i}
          position={[tile.x, -0.19, tile.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[1.9, 1.9]} />
          <meshStandardMaterial
            color={tile.isLight ? '#16a34a' : '#14532d'}
            roughness={1.0}
          />
        </mesh>
      ))}

      {/* 2. 3D Stone Paths (Slate Walkways) */}
      {/* Left/Right Top lanes (z: -12.5 to -1) */}
      <mesh position={[-5, -0.16, -6.75]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.05, 11.5]} />
        <meshStandardMaterial color="#57534e" roughness={0.8} />
      </mesh>
      <mesh position={[5, -0.16, -6.75]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.05, 11.5]} />
        <meshStandardMaterial color="#57534e" roughness={0.8} />
      </mesh>

      {/* Left/Right Bottom lanes (z: 1 to 12.5) */}
      <mesh position={[-5, -0.16, 6.75]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.05, 11.5]} />
        <meshStandardMaterial color="#57534e" roughness={0.8} />
      </mesh>
      <mesh position={[5, -0.16, 6.75]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.05, 11.5]} />
        <meshStandardMaterial color="#57534e" roughness={0.8} />
      </mesh>

      {/* 3. Outer Stone Arena Boundary Walls */}
      {/* Left Boundary Wall */}
      <mesh position={[-11, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 1.5, 32]} />
        <meshStandardMaterial color="#292524" roughness={0.9} />
      </mesh>
      {/* Right Boundary Wall */}
      <mesh position={[11, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 1.5, 32]} />
        <meshStandardMaterial color="#292524" roughness={0.9} />
      </mesh>

      {/* 4. Little decorative boulders/rocks along boundaries */}
      {[-12, -6, 0, 8, 14].map((rz) => (
        <group key={rz}>
          <mesh position={[-10.2, 0.2, rz]} castShadow>
            <dodecahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#78716c" roughness={0.9} />
          </mesh>
          <mesh position={[10.2, 0.2, -rz]} castShadow>
            <dodecahedronGeometry args={[0.35]} />
            <meshStandardMaterial color="#78716c" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
