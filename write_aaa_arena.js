const fs = require('fs');

const code = `
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CARDS_POOL } from '../data/cards';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, SoftShadows, Sky, PerspectiveCamera, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// --- INTERFACES ---
interface Troop {
  id: string; side: 'player' | 'enemy'; x: number; y: number; template: Card;
  hp: number; maxHp: number; shieldHp?: number; maxShield?: number;
  state: 'idle' | 'moving' | 'attacking' | 'charging' | 'dashing';
  targetId: string | null; lastAttack: number; chargeStart: number | null;
}
interface Tower {
  id: string; side: 'player' | 'enemy'; type: 'king' | 'princess';
  x: number; y: number; hp: number; maxHp: number; damage: number;
  range: number; hitSpeed: number; lastAttack: number; isActive: boolean; isDead: boolean;
}
interface Proj {
  id: string; type: 'arrow' | 'spell' | 'bomb'; side: 'player' | 'enemy';
  x: number; y: number; sx: number; sy: number; tx: number; ty: number;
  tid?: string | null; dmg: number; st: number; tt: number; splash?: number;
}
interface SpellArea {
  type: 'poison' | 'freeze'; side: 'player'|'enemy'; x: number; y: number; radius: number; timer: number;
}

const to3D = (x: number, y: number) => {
  const scl = 25; // scaling factor
  return new THREE.Vector3((x - 200) / scl, 0, (y - 300) / scl);
};
const Y_OFFSET = 0.5;

// --- 3D ARENA & ENVIRONMENT ---
const ArenaEnvironment = () => {
  return (
    <group>
      <Sky sunPosition={[50, 100, -50]} turbidity={0.1} rayleigh={0.5} />
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[20, 50, -20]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
        shadow-camera-far={100} shadow-bias={-0.0005}
      />
      {/* Ground */}
      <mesh receiveShadow position={[0, -0.5, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[60, 80]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.8} />
      </mesh>
      
      {/* River */}
      <mesh position={[0, -0.4, 0]} receiveShadow rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[40, 6]} />
        <MeshTransmissionMaterial thickness={2} roughness={0.1} transmission={0.9} ior={1.33} color="#44aaff" />
      </mesh>

      {/* Bridges */}
      {[-4.8, 4.8].map(bx => (
        <group key={bx} position={[bx, 0, 0]}>
          <mesh receiveShadow castShadow position={[0, -0.1, 0]}>
             <boxGeometry args={[3, 0.4, 6]} />
             <meshStandardMaterial color="#6a6a6a" roughness={0.9} />
          </mesh>
          <mesh receiveShadow castShadow position={[-1.4, 0.2, 0]}>
             <boxGeometry args={[0.4, 0.8, 6]} />
             <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh receiveShadow castShadow position={[1.4, 0.2, 0]}>
             <boxGeometry args={[0.4, 0.8, 6]} />
             <meshStandardMaterial color="#3a3a3a" />
          </mesh>
        </group>
      ))}
      
      {/* Stone Pathways */}
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[-4.8, -0.49, 6]}>
        <planeGeometry args={[3, 10]} />
        <meshStandardMaterial color="#888" roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[4.8, -0.49, 6]}>
        <planeGeometry args={[3, 10]} />
        <meshStandardMaterial color="#888" roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[-4.8, -0.49, -6]}>
        <planeGeometry args={[3, 10]} />
        <meshStandardMaterial color="#888" roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[4.8, -0.49, -6]}>
        <planeGeometry args={[3, 10]} />
        <meshStandardMaterial color="#888" roughness={0.9} />
      </mesh>
    </group>
  );
};

// --- TOWERS ---
const TowerModel = ({ tower, meshRef }: { tower: Tower, meshRef: any }) => {
  const p3 = to3D(tower.x, tower.y);
  const isDead = tower.hp <= 0;
  
  if (isDead) {
     return (
       <group position={[p3.x, p3.y, p3.z]}>
         <mesh castShadow receiveShadow position={[0,0.5,0]}>
           <boxGeometry args={[3,1,3]} />
           <meshStandardMaterial color="#444" roughness={0.9} />
         </mesh>
         <mesh position={[0,1,0]}>
           <sphereGeometry args={[1, 8, 8]} />
           <meshStandardMaterial color="#222" transparent opacity={0.6} />
         </mesh>
       </group>
     )
  }

  const isKing = tower.type === 'king';
  const color = tower.side === 'player' ? '#2b50aa' : '#aa2b2b';
  const accent = tower.side === 'player' ? '#4488ff' : '#ff4444';

  return (
    <group position={[p3.x, p3.y, p3.z]}>
      {/* Base */}
      <mesh castShadow receiveShadow position={[0, isKing?1.5:1.2, 0]}>
         <cylinderGeometry args={[isKing?2:1.5, isKing?2.5:1.8, isKing?3:2.4, 8]} />
         <meshStandardMaterial color="#555" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Top Rim */}
      <mesh castShadow receiveShadow position={[0, isKing?3.1:2.5, 0]}>
         <cylinderGeometry args={[isKing?2.2:1.7, isKing?2:1.5, 0.4, 8]} />
         <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Crystal / Crown */}
      <mesh castShadow position={[0, isKing?3.8:3, 0]}>
         <octahedronGeometry args={[isKing?1:0.6]} />
         <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* HP Bar */}
      <group position={[0, isKing?4.5:3.5, 0]}>
         <mesh position={[0,0,0]}>
            <planeGeometry args={[3, 0.3]} />
            <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
         </mesh>
         <mesh position={[-1.5 + (3*(tower.hp/tower.maxHp))/2, 0, 0.01]}>
            <planeGeometry args={[3*(tower.hp/tower.maxHp), 0.2]} />
            <meshBasicMaterial color="#22c55e" />
         </mesh>
      </group>
    </group>
  );
};

// --- TROOP MODELS ---
const TroopModel = React.forwardRef(({ troop }: { troop: Troop }, ref: any) => {
  const t = troop.template;
  const isRed = troop.side === 'enemy';
  const mainCol = isRed ? '#e74c3c' : '#3498db';
  const size = t.mass ? t.mass/1.5 : 1;
  const bodyY = size + Y_OFFSET;
  
  return (
    <group ref={ref}>
       <group position={[0, bodyY, 0]}>
         {/* Body */}
         <mesh castShadow receiveShadow>
            <capsuleGeometry args={[size, size, 4, 8]} />
            <meshStandardMaterial color={t.id==='mini_pekka'?'#7f8c8d':t.id==='giant'?'#d35400':'#ccc'} metalness={t.id==='mini_pekka'?0.8:0.1} roughness={0.4} />
         </mesh>
         {/* Team Color Ribbon */}
         <mesh castShadow position={[0, size*0.5, 0]}>
            <boxGeometry args={[size*2.1, size*0.4, size*2.1]} />
            <meshStandardMaterial color={mainCol} roughness={0.6} />
         </mesh>
       </group>
       
       {/* HP Bar */}
       <group position={[0, bodyY + size*2 + 0.5, 0]}>
         <mesh position={[0,0,0]}>
            <planeGeometry args={[2, 0.2]} />
            <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
         </mesh>
         <mesh position={[-1 + (2*(troop.hp/troop.maxHp))/2,0, 0.01]}>
            <planeGeometry args={[2*(troop.hp/troop.maxHp), 0.15]} />
            <meshBasicMaterial color="#22c55e" />
         </mesh>
       </group>
    </group>
  );
});

// --- RENDERER OVERSEER ---
const Engine3D = ({ trRef, twRef, prRef, spRef }: any) => {
  const troopMeshes = useRef<Record<string, THREE.Group | null>>({});
  const projMeshes = useRef<Record<string, THREE.Group | null>>({});
  
  // To avoid React rerenders on every frame, we force update the view by syncing React state occasionally
  const [troopsRev, setTroopsRev] = useState(0);
  const lastLen = useRef(0);
  const lastPrLen = useRef(0);

  useFrame((state, delta) => {
     if (trRef.current.length !== lastLen.current || prRef.current.length !== lastPrLen.current) {
        lastLen.current = trRef.current.length;
        lastPrLen.current = prRef.current.length;
        setTroopsRev(r=>r+1);
     }
     
     // Update troop transforms
     trRef.current.forEach((u: Troop) => {
        const m = troopMeshes.current[u.id];
        if (m) {
           const t3 = to3D(u.x, u.y);
           // Smooth lerp or direct set
           m.position.lerp(t3, 0.3);
           
           // Simple bobbing for walking
           if (u.state === 'moving') {
             m.position.y += Math.sin(state.clock.elapsedTime * 15) * 0.1;
           } else {
             m.position.y = THREE.MathUtils.lerp(m.position.y, 0, 0.3);
           }
           
           // Look at target approx
           if (u.targetId) {
              const tg = [...trRef.current, ...twRef.current].find((x:any)=>x.id===u.targetId);
              if (tg) {
                 const tt = to3D(tg.x, tg.y);
                 m.lookAt(new THREE.Vector3(tt.x, m.position.y, tt.z));
              }
           }
        }
     });

     // Update projectiles
     prRef.current.forEach((p: Proj) => {
        const m = projMeshes.current[p.id];
        if (m) {
           const el = (Date.now() - p.st)/1000;
           const prg = Math.min(1, el/p.tt);
           const pA = to3D(p.sx, p.sy);
           const pB = to3D(p.tx, p.ty);
           const arc = (p.type==='arrow') ? Math.sin(prg*Math.PI)*2 : Math.sin(prg*Math.PI)*4;
           m.position.lerpVectors(pA, pB, prg);
           m.position.y += arc;
        }
     });
  });

  return (
    <>
      <ArenaEnvironment />
      
      {/* TOWERS */}
      {twRef.current.map((tw: Tower) => (
         <TowerModel key={tw.id} tower={tw} meshRef={null} />
      ))}

      {/* TROOPS */}
      {trRef.current.map((tr: Troop) => (
         <TroopModel key={tr.id} troop={tr} ref={(el: any) => troopMeshes.current[tr.id] = el} />
      ))}
      
      {/* PROJECTILES */}
      {prRef.current.map((pr: Proj) => (
         <mesh key={pr.id} ref={(el: any) => projMeshes.current[pr.id] = el}>
            <sphereGeometry args={[pr.type==='arrow'?0.3:0.6]} />
            <meshStandardMaterial color={pr.type==='arrow'?"#fff":'#111'} emissive={pr.type!=='bomb' ? "#ffa" : "#000"} />
         </mesh>
      ))}
      
      {/* SPELLS */}
      {spRef.current.map((sp: SpellArea, i: number) => (
         <mesh key={i} position={[to3D(sp.x, sp.y).x, 0.1, to3D(sp.x, sp.y).z]} rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[sp.radius*1.25, 32]} />
            <meshBasicMaterial color={sp.type==='poison' ? '#e67e22' : '#3498db'} transparent opacity={0.4} />
         </mesh>
      ))}
    </>
  );
};

// --- MAIN COMPONENT ---
export const ClashArenaBattle = ({ deck, cardLevels, onEnd, onExit }: any) => {
  const [elixir, setElixir] = useState(5);
  const [sec, setSec] = useState(180);
  const [x2, setX2] = useState(false);
  const [res, setRes] = useState<'victory'|'defeat'|'draw'|null>(null);

  const [hand, setHand] = useState<Card[]>([]);
  const [nextC, setNextC] = useState<Card | null>(null);
  const rotQ = useRef<Card[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  const trRef = useRef<Troop[]>([]);
  const prRef = useRef<Proj[]>([]);
  const spRef = useRef<SpellArea[]>([]);
  const twRef = useRef<Tower[]>([
    { id: 'pk', side: 'player', type: 'king', x: 200, y: 560, hp: 4000, maxHp: 4000, damage: 100, range: 7, hitSpeed: 1, lastAttack: 0, isActive: false, isDead: false },
    { id: 'ppl', side: 'player', type: 'princess', x: 70, y: 440, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false },
    { id: 'ppr', side: 'player', type: 'princess', x: 330, y: 440, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false },
    { id: 'ek', side: 'enemy', type: 'king', x: 200, y: 40, hp: 4000, maxHp: 4000, damage: 100, range: 7, hitSpeed: 1, lastAttack: 0, isActive: false, isDead: false },
    { id: 'epl', side: 'enemy', type: 'princess', x: 70, y: 160, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false },
    { id: 'epr', side: 'enemy', type: 'princess', x: 330, y: 160, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false }
  ]);

  const lastT = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const act = CARDS_POOL.filter(c => deck.includes(c.id));
    const shuf = [...act].sort(() => 0.5 - Math.random());
    setHand(shuf.slice(0, 4));
    setNextC(shuf[4] || CARDS_POOL[0]);
    rotQ.current = shuf.slice(5);
  }, [deck]);

  const lvlMult = (val: number=0, cardId: string, side: string) => {
    const lvl = side === 'player' && cardLevels && cardLevels[cardId] ? cardLevels[cardId].level : 1;
    return val * Math.pow(1.1, lvl - 1);
  };

  const getDmg = (t: any, amt: number) => {
    if (t.isDead) return;
    if (t.shieldHp && t.shieldHp > 0) {
      if (t.shieldHp >= amt) t.shieldHp -= amt;
      else t.shieldHp = 0;
      return;
    }
    t.hp -= amt;
    if (t.hp <= 0) {
      t.hp = 0; t.isDead = true;
      if (t.type === 'king') setRes(t.side === 'enemy' ? 'victory' : 'defeat');
      else if (t.type === 'princess') {
        const k = twRef.current.find(k => k.side === t.side && k.type === 'king');
        if (k) k.isActive = true;
      } else if (t.template && t.template.onDeath === 'bomb') {
        prRef.current.push({ id: Math.random().toString(), type: 'bomb', side: t.side, x:t.x, y:t.y, sx:t.x, sy:t.y, tx:t.x, ty:t.y, dmg: lvlMult(800, t.template.id, t.side), st: Date.now(), tt: 3, splash: 3*20 });
      }
    }
  };

  useEffect(() => {
    const loop = (t: number) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current)/1000, 0.05);
      lastT.current = t;

      if (res) return;
      setElixir(e => Math.min(10, e + (x2 ? (1/1.4) : (1/2.8)) * dt));

      const tr = trRef.current; const tw = twRef.current; const pr = prRef.current; const sp = spRef.current;

      // 1. Spells
      for (let i=sp.length-1; i>=0; i--) {
        sp[i].timer -= dt;
        if (sp[i].timer <= 0) { sp.splice(i,1); continue; }
        if (sp[i].type === 'poison') {
           const aff = [...tr, ...tw].filter(x => !x.isDead && Math.hypot(x.x-sp[i].x, x.y-sp[i].y) <= sp[i].radius*20);
           aff.forEach(a => { if(a.side!==sp[i].side) getDmg(a, 30*dt); });
        }
      }

      // 2. AI
      for (let i=0; i<tr.length; i++) {
        const u = tr[i];
        if (u.hp <= 0) continue;

        const isFrz = sp.some(s => s.type === 'freeze' && s.side!==u.side && Math.hypot(s.x-u.x, s.y-u.y) <= s.radius*20);
        if (isFrz) { u.lastAttack = 0; u.chargeStart = null; continue; }

        if (!u.targetId || u.state === 'idle') {
          let bT: any = null, bD = Infinity;
          const cands = u.template.targetType === 'buildings' ? tw : [...tw, ...tr];
          cands.forEach(c => {
             if (c.side === u.side || c.isDead) return;
             if (!c.isActive && c.type === 'king') return;
             if (u.template.playType === 'troop' && !u.template.targetsFlying && c.template?.isFlying) return;
             // Scale fix for 3D vs 2D collision
             const d = Math.hypot(c.x-u.x, c.y-u.y);
             if (d < bD && (u.template.targetType === 'buildings' || d <= (u.template.sightRadius||5.5)*20*1.5)) { bD = d; bT = c; }
          });
          if (bT) { u.targetId = bT.id; u.state = 'moving'; }
        }

        if (u.targetId && u.state === 'moving') {
          const tar = [...tr, ...tw].find(x => x.id === u.targetId && !x.isDead);
          if (!tar) { u.targetId = null; u.state = 'idle'; u.chargeStart = null; continue; }

          const d = Math.hypot(tar.x-u.x, tar.y-u.y);
          const atkR = (u.template.range||1)*20;
          if (d <= atkR) { u.state = 'attacking'; u.chargeStart = null; }
          else {
             let tx = tar.x, ty = tar.y;
             if (!u.template.isFlying) {
               const uP = u.y > 300; const tP = tar.y > 300;
               if (uP !== tP) {
                 const bx = Math.abs(u.x-80) < Math.abs(u.x-320) ? 80 : 320;
                 tx = bx; ty = uP ? 280 : 320;
               }
             }
             if (u.template.chargeDuration) {
               if (u.chargeStart === null) u.chargeStart = 0;
               else u.chargeStart += dt;
             }
             const isCharging = (u.chargeStart||0) >= ((u.template.chargeDuration||0)/1000);
             const moveD = (u.template.speed||50) * (isCharging ? 2 : 1) * dt;
             const a = Math.atan2(ty-u.y, tx-u.x);
             u.x += Math.cos(a)*moveD; u.y += Math.sin(a)*moveD;
          }
        }

        if (u.state === 'attacking' && u.targetId) {
          const tar = [...tr, ...tw].find(x => x.id === u.targetId && !x.isDead);
          if (!tar || Math.hypot(tar.x-u.x, tar.y-u.y) > (u.template.range||1)*20*1.5) { u.state = 'idle'; }
          else {
             u.lastAttack += dt;
             if (u.lastAttack >= (u.template.hitSpeed||1.0)) {
                u.lastAttack = 0;
                let dmg = lvlMult(u.template.damage, u.template.id, u.side);
                if ((u.chargeStart||0) >= ((u.template.chargeDuration||0)/1000)) dmg *= 2;
                u.chargeStart = null;
                if ((u.template.range||1)>2.5) {
                  pr.push({ id: Math.random().toString(), type: 'arrow', x: u.x, y: u.y, sx: u.x, sy: u.y, tx: tar.x, ty: tar.y, tid: tar.id, side: u.side, dmg, st: Date.now(), tt: Math.hypot(tar.x-u.x, tar.y-u.y)/400 });
                } else { getDmg(tar, dmg); }
             }
          }
        }
      }

      // 3. Collision
      for (let i=0; i<tr.length; i++) {
        if(tr[i].template.isFlying || tr[i].hp<=0) continue;
        for (let j=i+1; j<tr.length; j++) {
           if(tr[j].template.isFlying || tr[j].hp<=0) continue;
           const dx = tr[j].x - tr[i].x; const dy = tr[j].y - tr[i].y;
           const d = Math.hypot(dx, dy); const minDist = ((tr[i].template.mass||3)+(tr[j].template.mass||3))*1.2;
           if (d < minDist && d > 0) {
             const o = minDist-d; const fx = (dx/d)*o*0.5; const fy = (dy/d)*o*0.5;
             const r1 = (tr[j].template.mass||3) / ((tr[i].template.mass||3)+(tr[j].template.mass||3));
             const r2 = (tr[i].template.mass||3) / ((tr[i].template.mass||3)+(tr[j].template.mass||3));
             tr[i].x -= fx*r1; tr[i].y -= fy*r1; tr[j].x += fx*r2; tr[j].y += fy*r2;
           }
        }
      }
      trRef.current = tr.filter(x => x.hp > 0);

      // 4. Projs
      for (let i=pr.length-1; i>=0; i--) {
        const p = pr[i]; const el = (Date.now() - p.st)/1000;
        if (el >= p.tt) {
           if (p.splash) {
              [...tr, ...tw].filter(x => !x.isDead && x.side!==p.side && Math.hypot(x.x-p.tx, x.y-p.ty)<=p.splash!).forEach(x => { getDmg(x, p.dmg); });
           } else if (p.tid) {
              const tar = [...tr, ...tw].find(x => x.id===p.tid && !x.isDead);
              if (tar) getDmg(tar, p.dmg);
           }
           pr.splice(i,1);
        }
      }

      // 5. Towers
      twRef.current.forEach(tower => {
         if (tower.isDead || !tower.isActive) return;
         const isFrz = sp.some(s => s.type === 'freeze' && s.side!==tower.side && Math.hypot(s.x-tower.x, s.y-tower.y) <= s.radius*20);
         if (isFrz) { tower.lastAttack = 0; return; }

         let bT: any = null, bD = Infinity;
         trRef.current.forEach(u => {
           if (u.side === tower.side || u.hp <= 0) return;
           const d = Math.hypot(u.x-tower.x, u.y-tower.y);
           if (d < bD && d <= tower.range*20) { bD = d; bT = u; }
         });

         if (bT) {
            tower.lastAttack += dt;
            if (tower.lastAttack >= tower.hitSpeed) {
               tower.lastAttack = 0;
               prRef.current.push({ id: Math.random().toString(), type: 'arrow', x: tower.x, y: tower.y, sx: tower.x, sy: tower.y, tx: bT.x, ty: bT.y, tid: bT.id, side: tower.side, dmg: tower.damage, st: Date.now(), tt: bD/400 });
            }
         } else { tower.lastAttack = 0; }
      });

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [res, x2]);

  // AI & Timer
  useEffect(() => {
    const aiInt = setInterval(() => {
      if (res) return;
      const t = CARDS_POOL.filter(c => c.playType !== 'spell');
      const cx=50+Math.random()*300, cy=50+Math.random()*150;
      spawnUnit(t[Math.floor(Math.random()*t.length)], cx, cy, 'enemy');
    }, 4500);

    const tim = setInterval(() => {
      if (res) return;
      setSec(s => {
        if (s<=60 && !x2) setX2(true);
        if (s<=1) { setRes('draw'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { clearInterval(aiInt); clearInterval(tim); };
  }, [res, x2]);

  const spawnUnit = (c: Card, sx:number, sy:number, side: 'player'|'enemy') => {
    if (side==='player' && c.playType!=='spell' && sy<300) {
      if (!twRef.current.some(t => t.side==='enemy' && t.type==='princess' && t.isDead)) return false;
      let ok = false;
      if (sx<140 && sy>200 && twRef.current.find(t=>t.id==='epl')?.isDead) ok=true;
      if (sx>260 && sy>200 && twRef.current.find(t=>t.id==='epr')?.isDead) ok=true;
      if (!ok) return false;
    }
    
    if (c.playType === 'spell') {
      if (c.spellType==='damage') prRef.current.push({ id: Math.random().toString(), type:'spell', side, x:sx, y:side==='player'?600:0, sx, sy:side==='player'?600:0, tx:sx, ty:sy, dmg:lvlMult(c.damage, c.id, side), st:Date.now(), tt:1.5, splash:c.radius!*20 });
      else spRef.current.push({ type: c.spellType as 'poison'|'freeze', side, x:sx, y:sy, radius: c.radius||3, timer: (c.duration||4000)/1000 });
      return true;
    }

    const o = c.count || 1;
    for(let i=0;i<o;i++) {
      trRef.current.push({
        id: Math.random().toString(), side, template: c, state: 'idle', targetId: null, lastAttack: 0, chargeStart: null,
        hp: lvlMult(c.hp, c.id, side), maxHp: lvlMult(c.hp, c.id, side),
        shieldHp: lvlMult(c.shieldHp, c.id, side), maxShield: lvlMult(c.shieldHp, c.id, side),
        x: sx+(o>1?(Math.random()-0.5)*30:0), y: sy+(o>1?(Math.random()-0.5)*30:0)
      });
    }
    return true;
  };

  const handlePointerDown = (e: any) => {
    if (!sel || res) return;
    const pt = e.point;
    if (!pt) return; 
    
    // Reverse scale (pt.x * scl + 200)
    const gx = pt.x * 25 + 200;
    const gy = pt.z * 25 + 300;

    const c = hand.find(h => h.id===sel);
    if (!c || Math.floor(elixir) < (c.cost||0)) return;

    if (spawnUnit(c, gx, gy, 'player')) {
      setElixir(el => el - (c.cost||0));
      const nH = hand.filter(h => h.id!==sel);
      if (nextC) nH.push(nextC);
      setHand(nH); rotQ.current.push(c);
      const n = rotQ.current.shift(); if(n) setNextC(n);
      setSel(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-[100dvh] overflow-hidden bg-black select-none">
      {/* 3D ARENA */}
      <div className="absolute inset-0 z-0">
         <Canvas shadows camera={{ position: [0, 24, 25], fov: 35, rotation: [-Math.PI/3.5, 0, 0] }} gl={{ antialias: true, toneMappingExposure: 1.5 }}>
            <Engine3D trRef={trRef} twRef={twRef} prRef={prRef} spRef={spRef} />
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.48, 0]} onPointerDown={handlePointerDown} receiveShadow>
               <planeGeometry args={[100, 100]} />
               <meshStandardMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
         </Canvas>
      </div>

      {/* OVERLAY UI */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-between p-4 pointer-events-none items-start mx-auto w-full max-w-lg">
        {/* Left Player Level */}
        <div className="w-16 h-20 bg-[linear-gradient(135deg,#6366f1,#3b82f6)] rounded-b-full border-4 border-[#cbd5e1] flex flex-col items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.5)] drop-shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-white/20 blur-md pointer-events-none" />
          <div className="w-10 h-10 rounded-full border-2 border-white shadow-inner flex items-center justify-center relative z-10 bg-blue-900">
             <span className="text-white font-black text-xl drop-shadow-md">11</span>
          </div>
        </div>

        {/* Center Timer */}
        <div className="bg-[linear-gradient(to_bottom,#f8fafc,#cbd5e1)] px-8 py-2 rounded border-y-4 border-[#94a3b8] shadow-[0_10px_30px_rgba(0,0,0,0.7)] flex items-center gap-3 relative mt-2 transform hover:scale-105 transition-transform duration-300">
          <div className="w-5 h-5 bg-[#d946ef] rotate-45 border-[3px] border-white shadow-[0_0_10px_rgba(217,70,239,0.8)] absolute -left-2.5"></div>
          <div className="w-5 h-5 bg-[#d946ef] rotate-45 border-[3px] border-white shadow-[0_0_10px_rgba(217,70,239,0.8)] absolute -right-2.5"></div>
          <span className="text-[#1e293b] font-black text-lg tracking-widest font-sans drop-shadow-sm">
             {Math.floor(sec/60)}:{(sec%60).toString().padStart(2,'0')}
          </span>
          {x2 && <span className="absolute -bottom-6 inset-x-0 text-center text-[#d946ef] text-[12px] uppercase font-black animate-pulse drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">2x Elixier!</span>}
        </div>

        {/* Right Gold & Gems */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="bg-[linear-gradient(to_bottom,#334155,#0f172a)] px-3 py-1.5 rounded-full border-2 border-[#475569] flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
             <div className="w-5 h-5 rounded-full bg-[radial-gradient(ellipse_at_top_right,#fef08a,#ca8a04)] shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)] border border-yellow-200"></div>
             <span className="text-white font-black text-sm pr-1">1000</span>
          </div>
          <div className="bg-[linear-gradient(to_bottom,#334155,#0f172a)] px-3 py-1.5 rounded-full border-2 border-[#475569] flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
             <div className="w-5 h-5 bg-[linear-gradient(135deg,#34d399,#059669)] rotate-45 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)] border border-emerald-200 ml-1"></div>
             <span className="text-white font-black text-sm pr-1">200</span>
          </div>
        </div>
      </div>

      {res && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <motion.h2 initial={{scale:0}} animate={{scale:1}} className={\`text-7xl font-black italic uppercase drop-shadow-[0_10px_20px_rgba(0,0,0,1)] \${res==='victory'?'text-yellow-400':'text-red-500'}\`}>
             {res==='draw'?'Unentschieden':res==='victory'?'SIEG!':'NIEDERLAGE'}
          </motion.h2>
          <motion.button initial={{y:100, opacity:0}} animate={{y:0, opacity:1}} onClick={() => { onEnd(res); onExit(); }} className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 px-12 py-5 rounded-2xl text-white font-black tracking-widest uppercase shadow-[0_15px_30px_rgba(37,99,235,0.5)] border-b-[6px] border-blue-900 active:border-b-0 active:translate-y-[6px] transition-all text-xl pointer-events-auto">Weiter</motion.button>
        </div>
      )}

      {/* BOTTOM UI (Cards and Elixir) */}
      <div className="absolute bottom-0 inset-x-0 z-40 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.9),#020617)] pt-12 pb-8 border-t-[4px] border-[#334155] drop-shadow-[0_-15px_40px_rgba(0,0,0,0.9)] backdrop-blur-md pointer-events-auto select-none">
        <div className="max-w-2xl mx-auto px-2 sm:px-4 relative">
          
          {/* Elixir Bar */}
          <div className="absolute -top-7 inset-x-4 h-10 bg-black/80 rounded-full border-y-[4px] border-[#fbbf24] shadow-[0_10px_25px_rgba(0,0,0,0.9)] flex items-center z-50 overflow-visible">
            {/* Liquid */}
            <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#9333ea,#d946ef)] rounded-l-full rounded-r-md transition-all duration-300 shadow-[inset_0_5px_15px_rgba(255,255,255,0.4)]" style={{width:\`\${(elixir/10)*100}%\`, minWidth: '40px'}}>
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 animate-pulse"></div>
            </div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_bottom,#fef08a,#b45309)] w-[4.5rem] h-9 border-[3px] border-[#fde047] shadow-[0_10px_20px_rgba(0,0,0,1)] rounded-sm relative z-20 flex items-center justify-center">
                <span className="text-white font-black text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] uppercase">{Math.floor(elixir)}</span>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-4 justify-center items-end mt-2 h-[120px]">
            {/* NEXT CARD */}
            <div className="w-[60px] sm:w-[70px] flex flex-col items-center gap-2 select-none shrink-0 cursor-default">
              <div className="aspect-[3/4.2] w-full rounded-lg border-2 border-[#a855f7] relative overflow-hidden bg-[#2e1065] shadow-[0_0_25px_rgba(168,85,247,0.6)] pt-1 group">
                 {/* Portal Effect */}
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#a855f7,#4c1d95)] opacity-50 animate-ping"></div>
                 {nextC && <img src={nextC.image} onError={(e) => e.currentTarget.style.display='none'} className="w-full h-[80%] object-cover opacity-60 mix-blend-screen scale-110" />}
              </div>
              <span className="text-[#e9d5ff] font-black text-[9px] sm:text-[10px] uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] bg-purple-900/50 px-2 py-0.5 rounded-full">Next</span>
            </div>

            {/* HAND */}
            <div className="flex-1 flex gap-2 sm:gap-3 justify-center items-end">
              <AnimatePresence mode="popLayout">
              {hand.map((c) => {
                const ok = Math.floor(elixir) >= (c.cost||0);
                const act = sel === c.id;
                return (
                  <motion.button 
                    layoutId={c.id}
                    key={c.id} 
                    initial={{scale: 0.5, y: 100, opacity: 0}}
                    animate={{scale: 1, y: 0, opacity: 1}}
                    exit={{scale: 0, opacity: 0, transition: {duration: 0.1}}}
                    onClick={() => { if(ok||act) setSel(act?null:c.id); }} 
                    className={\`w-[22%] max-w-[90px] relative flex flex-col items-center gap-1 transition-all duration-300 ease-out origin-bottom
                      \${act ? '-translate-y-10 scale-125 z-50' : ok ? 'hover:-translate-y-4 hover:scale-110 z-20 cursor-pointer' : 'opacity-60 scale-95 grayscale-[50%] z-10 cursor-not-allowed'}
                    \`}
                  >
                     <div className={\`aspect-[3/4.2] w-full rounded-lg border-[3px] \${act ? 'border-yellow-400 shadow-[0_20px_40px_rgba(250,204,21,0.6)]' : 'border-[#94a3b8] shadow-[0_10px_20px_rgba(0,0,0,0.8)]'} relative overflow-hidden bg-[#0f172a]\`}>
                        <img src={c.image} onError={(e) => e.currentTarget.style.display='none'} className="w-full h-[70%] object-cover object-top border-b-2 border-[#1e293b]" />
                        
                        <div className="absolute bottom-0 inset-x-0 h-[30%] bg-[linear-gradient(to_bottom,#1e293b,#020617)] flex flex-col justify-end items-center pb-1">
                           <span className={\`text-white font-black text-[7px] sm:text-[9px] uppercase tracking-wider drop-shadow-md truncate w-full text-center px-1 \${act?'text-yellow-300':''}\`}>{c.name}</span>
                        </div>

                        {/* Cost Gem */}
                        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-7 sm:w-7 sm:h-8 bg-[linear-gradient(135deg,#e879f9,#9333ea)] rounded-full border-2 border-white flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.9)] z-20">
                           <span className="text-white font-black text-[12px] sm:text-[14px] drop-shadow-[0_2px_2px_rgba(0,0,0,1)] uppercase leading-none mt-0.5">{c.cost}</span>
                        </div>
                        
                        {/* Shimmer effect when active */}
                        {act && <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/50 to-white/0 -translate-x-full animate-[shimmer_2s_infinite]"></div>}
                        
                        {!ok && <div className="absolute inset-0 bg-black/60 pointer-events-none" />}
                     </div>
                  </motion.button>
                )
              })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
`
fs.writeFileSync('generate_aaa_arena.js', code);
