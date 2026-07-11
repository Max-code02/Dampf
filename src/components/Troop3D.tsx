import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CardTemplate {
  id: string;
  name: string;
  image: string;
  cost: number;
}

interface TroopProps {
  id: string;
  side: 'player' | 'enemy';
  x: number;
  y: number;
  template: CardTemplate;
  hp: number;
  maxHp: number;
  state: 'idle' | 'moving' | 'attacking' | 'charging' | 'dashing';
}

export const Troop3D: React.FC<TroopProps> = ({ id, side, x, y, template, hp, maxHp, state }) => {
  const meshRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const weaponRef = useRef<THREE.Mesh>(null);

  // Map 2D pixel coordinates (0-400, 0-600) to 3D space
  const posX = (x - 200) / 20;
  const posZ = (y - 300) / 20;
  const targetY = template.name.toLowerCase().includes('fly') ? 1.8 : 0.5;

  useFrame((clockState) => {
    if (!meshRef.current) return;
    const t = clockState.clock.getElapsedTime();

    // Smooth movement towards positions
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, posX, 0.25);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, posZ, 0.25);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.1);

    // Directional orientation
    const sideMult = side === 'player' ? -1 : 1;
    meshRef.current.rotation.y = side === 'player' ? 0 : Math.PI;

    // Movement/Attack animation logic
    if (state === 'moving' || state === 'charging') {
      const speedFactor = state === 'charging' ? 20 : 10;
      meshRef.current.position.y += Math.sin(t * speedFactor) * 0.08; // bouncy walk

      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(t * 10) * 0.6;
        rightArmRef.current.rotation.x = -Math.sin(t * 10) * 0.6;
      }
    } else if (state === 'attacking') {
      // Weapon swinging animation
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -Math.PI / 3 + Math.sin(t * 18) * 0.8;
      }
    } else {
      // Idle breathing
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = 0;
        rightArmRef.current.rotation.x = 0;
      }
    }
  });

  const isEnemy = side === 'enemy';
  const colorBase = isEnemy ? '#dc2626' : '#2563eb';
  const nameLower = template.name.toLowerCase();

  // Pick graphics model based on the troop type
  const renderTroopModel = () => {
    if (nameLower.includes('ritter') || nameLower.includes('knight')) {
      return (
        <group>
          {/* Body/Plate armor */}
          <mesh castShadow receiveShadow>
            <capsuleGeometry args={[0.3, 0.5, 8, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Helper cape */}
          <mesh position={[0, -0.1, 0.25]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.45, 0.8, 0.05]} />
            <meshStandardMaterial color={colorBase} roughness={0.6} />
          </mesh>
          {/* Iron Helmet */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <sphereGeometry args={[0.27, 16, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Left Arm and Shield */}
          <mesh ref={leftArmRef} position={[-0.45, 0.1, 0]} castShadow>
            <boxGeometry args={[0.15, 0.4, 0.15]} />
            <meshStandardMaterial color="#475569" />
            {/* Wooden Shield */}
            <mesh position={[-0.1, 0, 0.1]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.1, 0.5, 0.35]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
          </mesh>
          {/* Right Arm and Sword */}
          <mesh ref={rightArmRef} position={[0.45, 0.1, 0]} castShadow>
            <boxGeometry args={[0.15, 0.4, 0.15]} />
            <meshStandardMaterial color="#475569" />
            {/* Metal Sword */}
            <mesh ref={weaponRef} position={[0.15, 0.3, 0.1]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
            </mesh>
          </mesh>
        </group>
      );
    }

    if (nameLower.includes('pekka') || nameLower.includes('mini p.e.k.k.a')) {
      return (
        <group>
          {/* Heavy Dark Metal Body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.7, 0.6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Glowing Eyes */}
          <mesh position={[-0.15, 0.2, -0.32]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>
          <mesh position={[0.15, 0.2, -0.32]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>
          {/* Twin Horns */}
          <mesh position={[-0.2, 0.45, 0]} rotation={[0, 0, 0.4]}>
            <coneGeometry args={[0.06, 0.3, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          <mesh position={[0.2, 0.45, 0]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.06, 0.3, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          {/* Right Arm & Huge Katana */}
          <mesh ref={rightArmRef} position={[0.45, 0.1, 0]} castShadow>
            <boxGeometry args={[0.18, 0.4, 0.18]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
            <mesh position={[0.1, 0.4, 0.1]} rotation={[Math.PI / 4, 0, 0]}>
              <boxGeometry args={[0.04, 0.9, 0.12]} />
              <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.5} />
            </mesh>
          </mesh>
        </group>
      );
    }

    if (nameLower.includes('riese') || nameLower.includes('giant')) {
      return (
        <group scale={[1.5, 1.5, 1.5]}>
          {/* Giant Leather Jacket */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.8, 0.5]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          {/* Head & Ginger hair/brows */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#ffedd5" />
          </mesh>
          <mesh position={[0, 0.65, 0.05]}>
            <boxGeometry args={[0.25, 0.1, 0.2]} />
            <meshStandardMaterial color="#ea580c" roughness={0.8} />
          </mesh>
          {/* Huge Fists */}
          <mesh ref={leftArmRef} position={[-0.38, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#ea580c" />
          </mesh>
          <mesh ref={rightArmRef} position={[0.38, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#ea580c" />
          </mesh>
        </group>
      );
    }

    // Default cute 3D character placeholder for other troops
    return (
      <group>
        <mesh castShadow>
          <capsuleGeometry args={[0.28, 0.45, 8, 8]} />
          <meshStandardMaterial color={colorBase} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.4, 0.1]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#e11d48" />
        </mesh>
        {/* Foot shadows */}
        <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#000" transparent opacity={0.4} />
        </mesh>
      </group>
    );
  };

  return (
    <group ref={meshRef} position={[posX, 0.5, posZ]}>
      {renderTroopModel()}

      {/* HP Bar Overlay */}
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.8, 0.1]} />
        <meshBasicMaterial color="#dc2626" />
        <mesh position={[-0.4 * (1 - hp / maxHp), 0, 0.01]}>
          <planeGeometry args={[0.8 * (hp / maxHp), 0.08]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </mesh>
    </group>
  );
};
