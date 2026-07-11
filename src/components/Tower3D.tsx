import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TowerProps {
  id: string;
  side: 'player' | 'enemy';
  type: 'king' | 'princess';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
}

export const Tower3D: React.FC<TowerProps> = ({ id, side, type, x, y, hp, maxHp, isDead }) => {
  const groupRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);

  // Convert 2D to 3D coordinates
  const posX = (x - 200) / 20;
  const posZ = (y - 300) / 20;

  useFrame((clockState) => {
    if (!groupRef.current) return;
    const t = clockState.clock.getElapsedTime();

    if (isDead) {
      // Physical debris collapse look: sink & rotate slightly
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, -0.6, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.25, 0.05);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -0.15, 0.05);
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
      // Make the crystals or banners hover slightly
      if (crystalRef.current) {
        crystalRef.current.rotation.y = t * 1.5;
        crystalRef.current.position.y = 1.9 + Math.sin(t * 3.0) * 0.1;
      }
    }
  });

  const isEnemy = side === 'enemy';
  const towerColor = isEnemy ? '#dc2626' : '#2563eb';
  const stoneColor = isEnemy ? '#292524' : '#78716c'; // dark lava stone for enemy tower, grey granite for player

  if (type === 'king') {
    return (
      <group ref={groupRef} position={[posX, 0, posZ]}>
        {/* Main Fortress Base */}
        <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.8, 1.2, 12]} />
          <meshStandardMaterial color={stoneColor} roughness={0.8} metalness={0.1} />
        </mesh>

        {/* Crenellations (Becken) */}
        {[-1.1, 1.1].map((cx, idx) =>
          [-1.1, 1.1].map((cz, idz) => (
            <mesh key={`${idx}-${idz}`} position={[cx, 1.2, cz]} castShadow>
              <boxGeometry args={[0.4, 0.3, 0.4]} />
              <meshStandardMaterial color={stoneColor} roughness={0.7} />
            </mesh>
          ))
        )}

        {/* Central Arch or Crown platform */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <cylinderGeometry args={[1.0, 1.0, 0.3, 10]} />
          <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Lava channel glowing or Blue Banner */}
        {isEnemy ? (
          <mesh position={[0, 0.6, -1.2]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.3, 0.8, 0.1]} />
            <meshBasicMaterial color="#f97316" toneMapped={false} />
          </mesh>
        ) : (
          <mesh position={[0, 0.5, -1.2]}>
            <boxGeometry args={[0.5, 0.7, 0.1]} />
            <meshStandardMaterial color={towerColor} roughness={0.5} />
          </mesh>
        )}

        {/* Floating Crown Crystal */}
        {!isDead && (
          <mesh ref={crystalRef} position={[0, 1.9, 0]} castShadow>
            <octahedronGeometry args={[0.3]} />
            <meshStandardMaterial
              color={isEnemy ? '#f43f5e' : '#60a5fa'}
              emissive={isEnemy ? '#be123c' : '#1d4ed8'}
              emissiveIntensity={1.0}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        )}

        {/* HP Bar */}
        {!isDead && (
          <mesh position={[0, 2.5, 0]}>
            <planeGeometry args={[2.0, 0.16]} />
            <meshBasicMaterial color="#dc2626" />
            <mesh position={[-1.0 * (1 - hp / maxHp), 0, 0.01]}>
              <planeGeometry args={[2.0 * (hp / maxHp), 0.14]} />
              <meshBasicMaterial color="#22c55e" />
            </mesh>
          </mesh>
        )}
      </group>
    );
  }

  // Princess tower
  return (
    <group ref={groupRef} position={[posX, 0, posZ]}>
      {/* Tall Round Tower Pedestal */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.2, 1.6, 12]} />
        <meshStandardMaterial color={stoneColor} roughness={0.8} />
      </mesh>

      {/* Golden/Metallic crown ring */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <torusGeometry args={[0.8, 0.1, 8, 24]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.1} />
      </mesh>

      {/* Team banner hanging */}
      <mesh position={[0, 0.8, isEnemy ? -0.92 : 0.92]}>
        <boxGeometry args={[0.4, 0.8, 0.05]} />
        <meshStandardMaterial color={towerColor} roughness={0.6} />
      </mesh>

      {/* Tower HP Bar */}
      {!isDead && (
        <mesh position={[0, 2.2, 0]}>
          <planeGeometry args={[1.4, 0.12]} />
          <meshBasicMaterial color="#dc2626" />
          <mesh position={[-0.7 * (1 - hp / maxHp), 0, 0.01]}>
            <planeGeometry args={[1.4 * (hp / maxHp), 0.1]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </mesh>
      )}
    </group>
  );
};
