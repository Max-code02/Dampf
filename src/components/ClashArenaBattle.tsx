import React, { useState, useEffect, useRef } from 'react';
import { Card, CARDS_POOL } from '../data/cards';
import { Canvas, useThree } from '@react-three/fiber';
import { ArenaLights, ParticleSystem3D } from './ThreeArenaMeshes';
import { Troop3D } from './Troop3D';
import { Tower3D } from './Tower3D';
import { River3D } from './River3D';
import { ArenaTerrain3D } from './ArenaTerrain3D';

interface Troop {
  id: string;
  side: 'player' | 'enemy';
  x: number;
  y: number;
  template: Card;
  type?: string;
  isDead?: boolean;
  isActive?: boolean;
  hp: number;
  maxHp: number;
  shieldHp?: number;
  maxShield?: number;
  state: 'idle' | 'moving' | 'attacking' | 'charging' | 'dashing';
  targetId: string | null;
  lastAttack: number;
  chargeStart: number | null;
}

interface Tower {
  id: string;
  side: 'player' | 'enemy';
  type: 'king' | 'princess';
  template?: any;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  hitSpeed: number;
  lastAttack: number;
  isActive: boolean;
  isDead: boolean;
}

interface Proj {
  id: string;
  type: 'arrow' | 'spell' | 'bomb';
  side: 'player' | 'enemy';
  x: number; y: number;
  sx: number; sy: number;
  tx: number; ty: number;
  tid?: string | null;
  dmg: number;
  st: number;
  tt: number;
  splash?: number;
}

interface SpellArea {
  type: 'poison' | 'freeze';
  side: 'player'|'enemy';
  x: number; y: number; radius: number;
  timer: number;
}

// 3D Isometric View Camera Controller
const CameraController = () => {
  const { camera } = useThree();
  useEffect(() => {
    // Look directly down at the heart of the battlefield [0, 0, -1]
    camera.lookAt(0, 0, -0.8);
  }, [camera]);
  return null;
};

export const ClashArenaBattle = ({ deck, cardLevels, onEnd, onExit }: any) => {
  const deploymentOverlayRef = useRef<HTMLDivElement>(null);
  const [elixir, setElixir] = useState(5);
  const [sec, setSec] = useState(180);
  const [x2, setX2] = useState(false);
  const [res, setRes] = useState<'victory'|'defeat'|'draw'|null>(null);

  const [hand, setHand] = useState<Card[]>([]);
  const [nextC, setNextC] = useState<Card | null>(null);
  const rotQ = useRef<Card[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  // Forced tick to update Three.js components outside state loop
  const [tick, setTick] = useState(0);

  const trRef = useRef<Troop[]>([]);
  const prRef = useRef<Proj[]>([]);
  const spRef = useRef<SpellArea[]>([]);
  const txtRef = useRef<{x:number, y:number, t:string, l:number, c:string}[]>([]);
  const twRef = useRef<Tower[]>([
    { id: 'pk', side: 'player', type: 'king', x: 200, y: 550, hp: 4000, maxHp: 4000, damage: 100, range: 7, hitSpeed: 1, lastAttack: 0, isActive: false, isDead: false },
    { id: 'ppl', side: 'player', type: 'princess', x: 70, y: 440, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false },
    { id: 'ppr', side: 'player', type: 'princess', x: 330, y: 440, hp: 2500, maxHp: 2500, damage: 110, range: 7.5, hitSpeed: 0.8, lastAttack: 0, isActive: true, isDead: false },
    { id: 'ek', side: 'enemy', type: 'king', x: 200, y: 50, hp: 4000, maxHp: 4000, damage: 100, range: 7, hitSpeed: 1, lastAttack: 0, isActive: false, isDead: false },
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
    rotQ.current = shuf.slice(5).concat(shuf.length < 8 ? [] : []);
  }, [deck]);

  const lvlMult = (val: number=0, cardId: string, side: string) => {
    const lvl = side === 'player' && cardLevels[cardId] ? cardLevels[cardId].level : 1;
    return val * Math.pow(1.1, lvl - 1);
  };

  const popT = (x:number, y:number, t:string, color='#fff') => txtRef.current.push({x, y, t, l: 1, c: color});

  const getDmg = (t: any, amt: number) => {
    if (t.isDead) return;
    if (t.shieldHp && t.shieldHp > 0) {
      if (t.shieldHp >= amt) t.shieldHp -= amt;
      else { t.shieldHp = 0; popT(t.x, t.y-10, "Schild kaputt!", "#aaa"); }
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

      // 1. Spells (Poison/Freeze)
      for (let i=sp.length-1; i>=0; i--) {
        sp[i].timer -= dt;
        if (sp[i].timer <= 0) { sp.splice(i,1); continue; }
        if (sp[i].type === 'poison') {
           const aff = [...tr, ...tw].filter(x => !x.isDead && Math.hypot(x.x-sp[i].x, x.y-sp[i].y) <= sp[i].radius*20);
           aff.forEach(a => { if(a.side!==sp[i].side) getDmg(a, 30*dt); });
         }
      }

      // 2. Troop AI
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
               if ((u.chargeStart||0) >= ((u.template.chargeDuration||0)/1000)) dmg *= 2; // double dmg on charge hit
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
        const p = pr[i]; const el = (t - p.st)/1000;
        if (el >= p.tt) {
           if (p.splash) {
              [...tr, ...tw].filter(x => !x.isDead && x.side!==p.side && Math.hypot(x.x-p.tx, x.y-p.ty)<=p.splash!).forEach(x => { getDmg(x, p.dmg); if(p.type==='bomb') popT(x.x, x.y, "Knockback!", "#fff"); });
           } else if (p.tid) {
              const tar = [...tr, ...tw].find(x => x.id===p.tid && !x.isDead);
              if (tar) getDmg(tar, p.dmg);
           }
           pr.splice(i,1);
        } else {
           const prog = Math.min(1, el/p.tt);
           p.x = p.sx + (p.tx-p.sx)*prog; p.y = p.sy + (p.ty-p.sy)*prog;
        }
      }

      // 5. Towers
      tw.forEach(tower => {
         if (tower.isDead || !tower.isActive) return;
         if (sp.some(s => s.type === 'freeze' && s.side!==tower.side && Math.hypot(s.x-tower.y, s.y-tower.y)<=s.radius*20)) return;
         
         let bT: any=null, bD = tower.range*20;
         tr.forEach(u => {
            if (u.side === tower.side || u.isDead) return;
            const d = Math.hypot(u.x-tower.x, u.y-tower.y);
            if (d < bD) { bD = d; bT = u; }
         });
         if (bT) {
            tower.lastAttack += dt;
            if (tower.lastAttack >= tower.hitSpeed) {
              tower.lastAttack = 0;
              pr.push({ id: Math.random().toString(), type:'arrow', x:tower.x, y:tower.y, sx:tower.x, sy:tower.y, tx:bT.x, ty:bT.y, tid:bT.id, side:tower.side, dmg:tower.damage, st:Date.now(), tt:bD/400 });
            }
         } else { tower.lastAttack = 0; }
      });

      render(dt);
    };

    const render = (dt: number) => {
      // Force React render tick to update 3D Scene
      setTick(t => t + 1);

      for(let i=txtRef.current.length-1; i>=0; i--) {
        const x = txtRef.current[i];
        x.l -= dt; x.y -= 20*dt;
        if(x.l<=0){ txtRef.current.splice(i,1); }
      }
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

  const handleDeploymentClick = (e: any) => {
    if (!sel || res) return;
    const r = deploymentOverlayRef.current?.getBoundingClientRect(); if (!r) return;
    const x = (e.clientX - r.left)*(400/r.width);
    const y = (e.clientY - r.top)*(600/r.height);
    const c = hand.find(h => h.id===sel);
    if (!c || elixir < (c.cost||0)) return;

    if (spawnUnit(c, x, y, 'player')) {
      setElixir(e => e - (c.cost||0));
      const nH = hand.filter(h => h.id!==sel);
      if (nextC) nH.push(nextC);
      setHand(nH); rotQ.current.push(c);
      const n = rotQ.current.shift(); if(n) setNextC(n);
      setSel(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative w-full overflow-hidden bg-black select-none">
      {/* Top UI */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-between p-3 pointer-events-none items-start max-w-[500px] mx-auto w-full">
        <div className="w-14 h-16 bg-gradient-to-b from-[#477ab3] to-[#254673] rounded-b-full border-[3px] border-[#a0b0c0] flex flex-col items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
          <div className="w-8 h-8 rounded-full border border-blue-300 shadow-inner flex items-center justify-center -mt-2">
             <span className="text-white font-black text-[10px] drop-shadow">lvl</span>
          </div>
        </div>

        <div className="bg-gradient-to-b from-[#b1ada6] via-[#a29e96] to-[#635f5a] px-8 py-1.5 rounded-sm border-y-2 border-[#e6e3e0] shadow-xl flex items-center gap-2 relative mt-2">
          <div className="w-4 h-4 bg-[#c026d3] rotate-45 border-2 border-[#f0abfc] shadow-[0_0_5px_rgba(0,0,0,0.5)] absolute -left-2"></div>
          <div className="w-4 h-4 bg-[#c026d3] rotate-45 border-2 border-[#f0abfc] shadow-[0_0_5px_rgba(0,0,0,0.5)] absolute -right-2"></div>
          <span className="text-white font-black text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest font-sans">Zeit: {Math.floor(sec/60)}:{(sec%60).toString().padStart(2,'0')}</span>
          {x2 && <span className="absolute -bottom-4 inset-x-0 text-center text-fuchsia-400 text-[10px] uppercase font-black animate-pulse drop-shadow-md">2x Elixier!</span>}
        </div>

        <div className="flex gap-2 mt-2">
          <div className="bg-[linear-gradient(to_bottom,#3a3a3a,#1e1e1e)] px-2 py-1 rounded-full border border-[#444] flex items-center gap-1.5 shadow-lg relative overflow-hidden pointer-events-auto">
             <div className="w-4 h-4 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 border border-yellow-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)] bg-yellow-400"></div>
             <span className="text-white font-black text-xs pr-1 drop-shadow-md">1000</span>
          </div>
          <div className="bg-[linear-gradient(to_bottom,#3a3a3a,#1e1e1e)] px-2 py-1 rounded-full border border-[#444] flex items-center gap-1.5 shadow-lg pointer-events-auto">
             <div className="w-4 h-4 bg-gradient-to-b from-emerald-400 to-emerald-600 rotate-45 border border-emerald-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)] ml-0.5 bg-emerald-500"></div>
             <span className="text-white font-black text-xs pr-1 drop-shadow-md">200</span>
          </div>
        </div>
      </div>

      {res && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6 backdrop-blur">
          <h2 className={`text-5xl font-black italic uppercase drop-shadow-xl ${res==='victory'?'text-yellow-400':'text-red-500'}`}>
             {res==='draw'?'Unentschieden':res==='victory'?'SIEG!':'NIEDERLAGE'}
          </h2>
          <button onClick={() => { onEnd(res); onExit(); }} className="mt-8 bg-blue-600 px-10 py-4 rounded-xl text-white font-bold tracking-widest uppercase shadow-xl hover:bg-blue-500 active:translate-y-1 transition border-b-4 border-blue-800 active:border-b-0">Weiter</button>
        </div>
      )}

      {/* 3D Battle Arena Canvas & Deployment Layout */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-black cursor-crosshair">
         <div className="relative w-full max-w-[400px] h-full aspect-[400/600] overflow-hidden rounded-lg shadow-2xl">
           
           {/* React Three Fiber Canvas with full shadows support */}
           <Canvas
             shadows
             camera={{ position: [0, 15, 11], fov: 35 }}
             style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
           >
             <CameraController />
             <ArenaLights />
             <ArenaTerrain3D />
             <River3D />
             
             {/* Render Three.js Kingdoms Towers */}
             {twRef.current.map((t) => (
               <Tower3D
                 key={t.id}
                 id={t.id}
                 side={t.side}
                 type={t.type}
                 x={t.x}
                 y={t.y}
                 hp={t.hp}
                 maxHp={t.maxHp}
                 isDead={t.isDead}
               />
             ))}

             {/* Render Three.js Troops */}
             {trRef.current.map((u) => (
               <Troop3D
                 key={u.id}
                 id={u.id}
                 side={u.side}
                 x={u.x}
                 y={u.y}
                 template={u.template}
                 hp={u.hp}
                 maxHp={u.maxHp}
                 state={u.state}
               />
             ))}

             {/* Render Glowing Spell Areas */}
             {spRef.current.map((s, idx) => {
               const rX = (s.x - 200) / 20;
               const rZ = (s.y - 300) / 20;
               const radius3D = (s.radius * 20) / 20;
               return (
                 <mesh key={idx} position={[rX, 0.05, rZ]} rotation={[-Math.PI / 2, 0, 0]}>
                   <ringGeometry args={[radius3D - 0.15, radius3D, 24]} />
                   <meshBasicMaterial
                     color={s.type === 'poison' ? '#f59e0b' : '#38bdf8'}
                     transparent
                     opacity={0.8}
                   />
                 </mesh>
               );
             })}

             {/* Render Standard Projectiles */}
             {prRef.current.map((p) => {
               const pX = (p.x - 200) / 20;
               const pZ = (p.y - 300) / 20;
               const isArrow = p.type === 'arrow';
               return (
                 <mesh key={p.id} position={[pX, 0.6, pZ]}>
                   <sphereGeometry args={[isArrow ? 0.08 : p.type === 'bomb' ? 0.22 : 0.15, 8, 8]} />
                   <meshStandardMaterial
                     color={isArrow ? '#ffffff' : p.type === 'bomb' ? '#1c1917' : '#ea580c'}
                     emissive={p.type === 'spell' ? '#ea580c' : '#000000'}
                     emissiveIntensity={p.type === 'spell' ? 0.8 : 0}
                     roughness={0.2}
                   />
                 </mesh>
               );
             })}

             {/* Render Floating Popups / Damage Effects */}
             {txtRef.current.map((tx, idx) => {
               const tX = (tx.x - 200) / 20;
               const tZ = (tx.y - 300) / 20;
               return (
                 <group key={idx} position={[tX, 1.8, tZ]}>
                   <ParticleSystem3D position={[0, 0, 0]} color={tx.c} count={8} />
                 </group>
               );
             })}
           </Canvas>

           {/* Transparent Deployment Tap Overlay */}
           <div
             ref={deploymentOverlayRef}
             onClick={handleDeploymentClick}
             className="absolute inset-0 z-30 cursor-crosshair h-full w-full"
             style={{ background: 'transparent' }}
           />

           {/* Deployment placement area visual aid */}
           {sel && (
             <div className="absolute inset-x-0 bottom-0 top-[54%] border-2 border-dashed border-blue-400/40 bg-blue-500/5 pointer-events-none z-20" />
           )}
         </div>
      </div>

      {/* Bottom UI bar */}
      <div className="w-full bg-[#1b262c] pt-10 pb-6 relative z-40 border-t-[3px] border-[#536b7a] drop-shadow-[0_-10px_30px_rgba(0,0,0,0.8)] overflow-visible mx-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b262c]/80 to-[#10171a]"></div>

        {/* Elixir Bar */}
        <div className="absolute -top-4 inset-x-4 max-w-[480px] mx-auto h-8 bg-black/60 rounded-full border-y-[3px] border-[#dec589] shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center z-50">
           <div className="absolute -left-3 w-4 h-10 bg-gradient-to-b from-[#fde68a] via-[#b48e4b] to-[#6d5120] rounded-full border border-[#fef08a] shadow-lg"></div>
           <div className="absolute -right-3 w-4 h-10 bg-gradient-to-b from-[#fde68a] via-[#b48e4b] to-[#6d5120] rounded-full border border-[#fef08a] shadow-lg"></div>
           
           <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#e879f9] via-[#c026d3] to-[#86198f] rounded-l-full rounded-r-md transition-all duration-200 border-r-2 border-fuchsia-300 shadow-[inset_0_4px_10px_rgba(255,255,255,0.4)]" style={{width:`${(elixir/10)*100}%`}}></div>
           
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[#ebd59a] via-[#b48e4b] to-[#6d5120] w-12 h-6 border-[2px] border-[#fde047] flex items-center justify-center shadow-[0_5px_10px_rgba(0,0,0,0.8)] rounded-sm">
              <span className="text-white font-black text-sm drop-shadow-[0_2px_1px_rgba(0,0,0,1)] uppercase">{Math.floor(elixir)}</span>
           </div>
        </div>

        {/* Cards container */}
        <div className="flex gap-2 sm:gap-3 px-2 sm:px-4 justify-center items-end relative z-10 max-w-[500px] mx-auto">
           {/* Next Card */}
           <div className="w-[60px] flex flex-col items-center gap-1 select-none pointer-events-none mt-4">
              <div className="aspect-[3/4.2] w-full rounded border-2 border-purple-400 relative overflow-hidden bg-purple-950 shadow-[0_0_15px_rgba(168,85,247,0.8)] p-0.5">
                 {nextC && <img src={nextC.image} onError={(e) => e.currentTarget.style.display='none'} className="w-full h-full object-cover grayscale brightness-[0.4]" />}
                 <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-900/60 mix-blend-overlay"></div>
              </div>
              <span className="text-blue-200 font-black text-[10px] uppercase tracking-widest drop-shadow-md">Nächst</span>
           </div>

           {/* Hand */}
           <div className="flex-1 flex gap-2">
             {hand.map((c, index) => {
                const ok = elixir >= (c.cost||0);
                const act = sel === c.id;
                return (
                  <button key={c.id + '-' + index} onClick={() => { if(ok||act) setSel(act?null:c.id); }} className={`flex-1 flex flex-col items-center gap-1 transition-all duration-200 ${act ? '-translate-y-6 scale-110 drop-shadow-[0_15px_15px_rgba(59,130,246,0.6)] z-50' : ok ? 'hover:-translate-y-2 hover:scale-105 z-10 drop-shadow-xl' : 'opacity-80 grayscale-[40%] z-0'}`}>
                      <div className={`aspect-[3/4.2] w-full rounded border-[3px] ${act ? 'border-yellow-400' : 'border-[#94a3b8]'} relative overflow-hidden bg-neutral-800 shadow-[0_10px_20px_rgba(0,0,0,0.8)]`}>
                         <img src={c.image} onError={(e) => e.currentTarget.style.display='none'} className="w-full h-[75%] object-cover object-top rounded-t-sm" />
                         
                         <div className="absolute bottom-0 inset-x-0 h-[25%] bg-[linear-gradient(to_bottom,#334155,#0f172a)] border-t-2 border-[#475569] flex flex-col justify-end items-center pb-0.5 shadow-inner">
                            <span className={`text-white font-black text-[7px] sm:text-[9px] uppercase tracking-wider drop-shadow-lg truncate w-full text-center px-0.5 ${act?'text-yellow-300':''}`}>{c.name}</span>
                         </div>

                         <div className="absolute top-[2px] left-[2px] w-3 h-3 bg-[#38bdf8] rotate-45 border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                         
                         <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-7 bg-[linear-gradient(to_bottom,#e879f9,#c026d3)] rounded-t-full rounded-b-full border border-fuchsia-100 flex items-center justify-center shadow-[0_5px_10px_rgba(0,0,0,0.8)] pb-0.5 z-20">
                            <span className="text-white font-black text-[14px] drop-shadow-[0_2px_1px_rgba(0,0,0,1)] uppercase">{c.cost}</span>
                         </div>
                         {!ok && <div className="absolute inset-0 bg-black/50 pointer-events-none" />}
                      </div>
                  </button>
                )
             })}
           </div>
        </div>
      </div>
    </div>
  );
};
