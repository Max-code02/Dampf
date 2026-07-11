import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const River3D: React.FC = () => {
  const waterMeshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (waterMeshRef.current) {
      const t = state.clock.getElapsedTime();
      // Animate texture displacement or custom wave effect via rotation/position oscillation
      const mat = waterMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        // Animate color/emission pulsing slightly to simulate foaming waves
        mat.emissiveIntensity = 0.3 + Math.sin(t * 2.0) * 0.15;
      }
      // Slight vertical breathing wave motion
      waterMeshRef.current.position.y = -0.15 + Math.sin(t * 1.5) * 0.02;
    }
  });

  return (
    <group>
      {/* 1. Animated River Water Mesh */}
      <mesh ref={waterMeshRef} position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[25, 2.5, 32, 8]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0284c7"
          emissiveIntensity={0.3}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>

      {/* Foam Shore borders */}
      <mesh position={[0, -0.13, -1.27]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25, 0.08]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, -0.13, 1.27]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25, 0.08]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.6} />
      </mesh>

      {/* 2. 3D Bridges (Stone Architecture & Wood Planks) */}
      {[-5, 5].map((bridgeX) => (
        <group key={bridgeX} position={[bridgeX, -0.05, 0]}>
          {/* Stone arch supports underneath */}
          <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 0.6, 2.7]} />
            <meshStandardMaterial color="#44403c" roughness={0.9} />
          </mesh>

          {/* Golden/Brass side safety rails */}
          {[-1.3, 1.3].map((railZ) => (
            <mesh key={railZ} position={[0, 0.25, railZ]} castShadow>
              <boxGeometry args={[2.6, 0.4, 0.1]} />
              <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}

          {/* Wooden Deck Planks */}
          {[-1.0, -0.5, 0, 0.5, 1.0].map((pz, idx) => (
            <mesh key={idx} position={[0, 0.05, pz]} castShadow receiveShadow>
              <boxGeometry args={[2.4, 0.08, 0.4]} />
              <meshStandardMaterial color="#78350f" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
