import fs from 'fs';

const filePath = 'src/components/ClashArenaView.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add state variable
if (!content.includes('const [selectedTower, setSelectedTower] = useState')) {
  content = content.replace(
    'const [doubleElixir, setDoubleElixir] = useState(false);',
    "const [doubleElixir, setDoubleElixir] = useState(false);\n  const [selectedTower, setSelectedTower] = useState<'princess'|'cannoneer'|'royal_chef'>('princess');\n"
  );
}

// 2. Modify tower generation to use selected tower
content = content.replace(
  "{ id: 'player_left', side: 'player', type: 'princess', x: 85, y: 460, hp: 1800, maxHp: 1800, range: 180, lastAttackTime: 0, isDead: false },",
  "{ id: 'player_left', side: 'player', type: selectedTower === 'princess' ? 'princess' : (selectedTower === 'cannoneer' ? 'cannoneer' : 'cannon'), x: 85, y: 460, hp: selectedTower === 'princess' ? 1800 : (selectedTower === 'cannoneer' ? 1500 : 2000), maxHp: selectedTower === 'princess' ? 1800 : (selectedTower === 'cannoneer' ? 1500 : 2000), range: 180, lastAttackTime: 0, isDead: false },"
);
content = content.replace(
  "{ id: 'player_right', side: 'player', type: 'princess', x: 315, y: 460, hp: 1800, maxHp: 1800, range: 180, lastAttackTime: 0, isDead: false },",
  "{ id: 'player_right', side: 'player', type: selectedTower === 'princess' ? 'princess' : (selectedTower === 'cannoneer' ? 'cannoneer' : 'cannon'), x: 315, y: 460, hp: selectedTower === 'princess' ? 1800 : (selectedTower === 'cannoneer' ? 1500 : 2000), maxHp: selectedTower === 'princess' ? 1800 : (selectedTower === 'cannoneer' ? 1500 : 2000), range: 180, lastAttackTime: 0, isDead: false },"
);

// 3. Enemy Bot AI Logic
const aiLogic = `
  // AI Bot Logic
  useEffect(() => {
    if (!isPlaying || gameResult) return;
    
    const botInterval = setInterval(() => {
      // Small chance to spawn enemy randomly
      if (Math.random() < 0.4) {
         const enemyCards = CARDS_POOL.filter(c => c.playType !== 'spell' && c.playType !== 'building');
         if (enemyCards.length > 0) {
           const randCard = enemyCards[Math.floor(Math.random() * enemyCards.length)];
           const x = Math.random() > 0.5 ? 85 + Math.random() * 40 - 20 : 315 + Math.random() * 40 - 20;
           const y = 200 + Math.random() * 50; // top half
           
           troopsRef.current.push({
             id: Math.random().toString(),
             cardId: randCard.id,
             name: randCard.name,
             side: 'enemy',
             x,
             y,
             hp: randCard.hp,
             maxHp: randCard.hp,
             damage: randCard.damage,
             range: randCard.range,
             speed: randCard.speed,
             attackType: randCard.attackType,
             attackSpeed: randCard.attackSpeed,
             lastAttackTime: 0,
             image: randCard.image,
             color: '#ef4444',
             type: randCard.type,
             targetBuildingOnly: randCard.targetBuildingOnly
           });
         }
      }
    }, 4000);

    return () => clearInterval(botInterval);
  }, [isPlaying, gameResult]);
`;

if (!content.includes('AI Bot Logic')) {
  // insert before render loop
  content = content.replace('const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {', aiLogic + '\n  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {');
}

// 4. Main Menu UI Replacement
// We'll replace the Prompt Overlay string
const oldMenu = `{!isPlaying && !gameResult && (
            <div className="absolute inset-0 bg-black/75 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xs">
               <Crown className="text-yellow-400 mb-2 drop-shadow-lg" size={64} fill="currentColor" />
               <h3 className="text-mc-gold text-2xl font-black uppercase tracking-widest text-yellow-400">Tactical Clash Royale</h3>
               <p className="text-neutral-300 text-xs mt-2 max-w-xs mb-6">
                 Bringe deine Einheiten geschickt ein, verteidige deine eigene Basis und starte zerstörerische Offensiven!
               </p>
               <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={initGame}
                  className="bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 font-black text-xl px-12 py-4 rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.5),_0_0_0_4px_#ca8a04_inset] border-2 border-yellow-200"
               >
                 SPIEL STARTEN ⚔️
               </motion.button>
            </div>
          )}`;

const newMenu = `{!isPlaying && !gameResult && (
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center z-20 flex flex-col justify-between p-6">
               <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-[#121c10] backdrop-blur-sm pointer-events-none" />
               
               <div className="relative z-30 flex flex-col items-center pt-8">
                 <Crown className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" size={64} fill="currentColor" />
                 <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg mt-2 uppercase tracking-widest border-b-4 border-yellow-500/50 pb-2">
                   Clash Arena
                 </h1>
               </div>

               <div className="relative z-30 flex flex-col items-center gap-6 pb-12">
                 <div className="bg-black/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md w-full max-w-sm">
                   <h3 className="text-neutral-300 text-sm font-bold uppercase tracking-wider mb-3 text-center">Wähle deinen Turmtruppen</h3>
                   <div className="grid grid-cols-3 gap-2">
                     <button onClick={() => setSelectedTower('princess')} className={\`p-2 rounded-xl border-2 transition-all \${selectedTower === 'princess' ? 'border-yellow-400 bg-yellow-400/20' : 'border-neutral-700 hover:border-neutral-500'}\`}>
                       <Crown size={24} className="mx-auto mb-1 text-pink-400" />
                       <div className="text-[10px] font-bold text-white text-center leading-tight">Princess</div>
                     </button>
                     <button onClick={() => setSelectedTower('cannoneer')} className={\`p-2 rounded-xl border-2 transition-all \${selectedTower === 'cannoneer' ? 'border-yellow-400 bg-yellow-400/20' : 'border-neutral-700 hover:border-neutral-500'}\`}>
                       <Droplet size={24} className="mx-auto mb-1 text-slate-400" />
                       <div className="text-[10px] font-bold text-white text-center leading-tight">Cannoneer</div>
                     </button>
                     <button onClick={() => setSelectedTower('royal_chef')} className={\`p-2 rounded-xl border-2 transition-all \${selectedTower === 'royal_chef' ? 'border-yellow-400 bg-yellow-400/20' : 'border-neutral-700 hover:border-neutral-500'}\`}>
                       <Swords size={24} className="mx-auto mb-1 text-orange-400" />
                       <div className="text-[10px] font-bold text-white text-center leading-tight">Royal Chef</div>
                     </button>
                   </div>
                 </div>

                 <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={initGame}
                    className="bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black text-2xl px-16 py-4 rounded-2xl shadow-[0_10px_25px_rgba(59,130,246,0.5),_0_0_0_4px_#60a5fa_inset] border-2 border-blue-300 uppercase tracking-wider"
                 >
                   Gefecht
                 </motion.button>
               </div>
            </div>
          )}`;

content = content.replace(oldMenu, newMenu);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Modified UI and logic!');
