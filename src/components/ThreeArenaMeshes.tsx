import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const ArenaLights: React.FC = () => {
  const dLightRef = useRef<THREE.DirectionalLight>(null);

  useFrame((state) => {
    if (dLightRef.current) {
      // Subtle light movement or pulse if needed
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight
        ref={dLightRef}
        position={[15, 20, 10]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[-10, 5, -10]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[10, 5, 10]} intensity={0.5} color="#ef4444" />
    </>
  );
};

export const ParticleSystem3D: React.FC<{
  position: [number, number, number];
  color: string;
  count?: number;
}> = ({ position, color, count = 15 }) => {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3 + 1] += 0.05; // float upwards
        if (positions[i3 + 1] > 2) {
          positions[i3 + 1] = 0; // reset
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const particlePositions = React.useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.5;
      arr[i * 3 + 1] = Math.random() * 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    return arr;
  }, [count]);

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.15}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
