
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Shield, Swords, X, Droplet, Crown, Settings, Play, Box, Info } from 'lucide-react';
import { Card, CARDS_POOL, Chest } from '../data/cards';
import { ClashArenaBattle } from './ClashArenaBattle';

export interface ClashArenaProps {
  onClose: () => void;
  user: any;
  myProfile: any;
}

export const ClashArenaView: React.FC<ClashArenaProps> = ({ onClose, user, myProfile }) => {
  const [currentScreen, setCurrentScreen] = useState<'menu'|'deck'>('menu');
  
  // Economy & Meta
  const [gold, setGold] = useState(1000);
  const [gems, setGems] = useState(100);
  const [trophies, setTrophies] = useState(0);
  const [chests, setChests] = useState<(Chest|null)[]>([null, null, null, null]);
  const [cardLevels, setCardLevels] = useState<Record<string, {level: number, copies: number}>>({});

  // Deck
  const [userDeck, setUserDeck] = useState<string[]>([]);
  useEffect(() => { setUserDeck(CARDS_POOL.slice(0, 8).map(c => c.id)); }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | 'draw' | null>(null);

  const [chestOpening, setChestOpening] = useState<Chest | null>(null);

  const openChestAnim = (chest: Chest, idx: number) => {
     setChestOpening(chest);
     const newChests = [...chests];
     newChests[idx] = null;
     setChests(newChests);
     setTimeout(() => {
        setGold(g => g + 150);
        setChestOpening(null);
     }, 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg h-[95vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-neutral-700/50">
        
        {!isPlaying && (
          <div className="w-full bg-gradient-to-b from-blue-900 to-blue-950 border-b border-blue-800 p-3 sm:p-4 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-gradient-to-tr from-blue-700 to-blue-500 rounded-xl flex items-center justify-center border-2 border-blue-400 shadow-inner">
                  <Crown size={24} className="text-yellow-400 drop-shadow" />
               </div>
               <div>
                 <h2 className="text-white font-black text-sm sm:text-base leading-tight">Spieler {user?.displayName || '1'}</h2>
                 <div className="flex gap-2 text-xs font-bold mt-0.5">
                   <div className="bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-600/50 flex flex-center gap-1"><Trophy size={10} /> {trophies}</div>
                   <div className="bg-orange-600/30 text-orange-400 px-1.5 py-0.5 rounded border border-orange-600/50 flex flex-center gap-1">🪙 {gold}</div>
                 </div>
               </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-red-500/80 hover:bg-red-500 text-white rounded-lg flex items-center justify-center transition"><X size={18} /></button>
          </div>
        )}

        {chestOpening && (
           <div className="absolute inset-0 z-[200] bg-black/98 flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-md">
              <motion.div initial={{ scale: 0, y: 100 }} animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, -10, 10, 0], y: 0 }} transition={{ duration: 1 }} className="mb-8 relative">
                 <Box size={120} className="text-yellow-400 drop-shadow-[0_0_50px_rgba(250,204,21,1)]" />
                 <div className="absolute inset-0 bg-yellow-400 blur-[80px] opacity-40 z-[-1]" />
              </motion.div>
              <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-4xl font-black text-white italic drop-shadow-xl uppercase mb-2">Truhe Geöffnet!</motion.h2>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }} className="flex flex-col items-center gap-2">
                 <div className="text-yellow-400 font-bold text-2xl flex items-center gap-2">🪙 +150 Gold</div>
                 <div className="text-blue-400 font-bold text-2xl flex items-center gap-2">Karten erhalten...</div>
              </motion.div>
           </div>
        )}

        {!isPlaying && currentScreen === 'menu' && (
          <MenuScreen onPlay={() => setIsPlaying(true)} onDeck={() => setCurrentScreen('deck')} userDeck={userDeck} chests={chests} onOpenChest={openChestAnim} trophies={trophies} />
        )}

        {!isPlaying && currentScreen === 'deck' && (
          <DeckScreen onBack={() => setCurrentScreen('menu')} userDeck={userDeck} setUserDeck={setUserDeck} cardLevels={cardLevels} setCardLevels={setCardLevels} gold={gold} setGold={setGold} />
        )}

        {isPlaying && (
          <ClashArenaBattle 
            deck={userDeck} 
            cardLevels={cardLevels} 
            onEnd={(res: any) => {
              setGameResult(res);
              if (res === 'victory') { setTrophies(t => t + 30); setGold(g => g + 50); } 
              else if (res === 'defeat') { setTrophies(t => Math.max(0, t - 20)); }
            }}
            gameResult={gameResult} 
            onExit={() => { setGameResult(null); setIsPlaying(false); }} 
          />
        )}
      </div>
    </motion.div>
  );
};

const MenuScreen = ({ onPlay, onDeck, userDeck, chests, trophies, onOpenChest }: any) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
      <div className="relative z-10 w-full text-center mt-4">
        <span className="text-yellow-400 font-bold tracking-widest uppercase bg-black/60 px-5 py-1.5 rounded-full border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)] text-sm backdrop-blur">
          Arena {Math.floor(trophies / 300) + 1}
        </span>
        <h1 className="text-5xl font-black text-white italic drop-shadow-[0_4px_10px_rgba(0,0,0,1)] mt-3 tracking-wide" style={{ WebkitTextStroke: '2px #111' }}>
          SCHLACHT
        </h1>
      </div>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onPlay} className="relative z-10 w-48 h-20 bg-gradient-to-b from-yellow-400 via-yellow-500 to-orange-600 rounded-[2rem] font-black text-3xl text-white shadow-[0_15px_30px_rgba(234,179,8,0.5),0_0_0_6px_#fef08a_inset,0_10px_0_#9a3412] uppercase tracking-wider flex items-center justify-center transform active:translate-y-2 mb-10" style={{ WebkitTextStroke: '1px #7c2d12' }}>
        KAMPF
      </motion.button>

      <div className="relative z-10 w-full flex flex-col gap-5 bg-black/50 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex gap-2 w-full justify-between">
          {chests.map((chest: any, i: number) => (
             <button key={i} onClick={() => chest && onOpenChest(chest, i)} className={`w-1/4 aspect-square bg-gradient-to-br from-neutral-800 to-neutral-950 border-2 rounded-2xl flex flex-col items-center justify-center shadow-[inset_0_4px_15px_rgba(0,0,0,0.8)] transition-all ${chest ? 'border-yellow-500 hover:border-yellow-300 hover:scale-105 cursor-pointer glow-pulse' : 'border-neutral-700 opacity-60'}`}>
               {chest ? <Box className="text-yellow-500 w-8 h-8 drop-shadow-md" /> : <span className="text-neutral-600 text-[10px] font-black uppercase">Leer Slot</span>}
             </button>
          ))}
        </div>
        <div className="w-full">
           <div className="flex justify-between items-end mb-2">
             <h3 className="text-gray-300 font-bold uppercase text-xs tracking-wider">Dein Deck ({userDeck.length}/8)</h3>
             <button onClick={onDeck} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg border-b-2 border-blue-800 active:translate-y-px transition">BEARBEITEN</button>
           </div>
           <div className="grid grid-cols-4 gap-2">
             {userDeck.slice(0, 4).map((id: string) => {
               const c = CARDS_POOL.find(c => c.id === id); if (!c) return null;
               return <div key={id} className="aspect-[3/4.2] bg-neutral-900 rounded-xl border-2 border-neutral-600 overflow-hidden relative shadow-lg"><img src={c.image} className="w-full h-full object-cover" /></div>;
             })}
           </div>
        </div>
      </div>
    </div>
  );
};

const DeckScreen = ({ onBack, userDeck, setUserDeck, cardLevels, setCardLevels, gold, setGold }: any) => {
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const swapToDeck = (cardId: string) => {
     if (userDeck.includes(cardId)) { setUserDeck((prev: string[]) => prev.filter((id) => id !== cardId)); setActiveCard(null); return; }
     if (userDeck.length < 8) { setUserDeck((prev: string[]) => [...prev, cardId]); setActiveCard(null); return; }
     
     // Simple auto-swap logic replacing the first card for UX simplicity if full
     const newD = [...userDeck]; newD[0] = cardId;
     setUserDeck(newD);
     setActiveCard(null);
  };

  const tryUpgrade = (card: Card) => {
     const lvl = cardLevels[card.id]?.level || 1;
     const cost = lvl * 50;
     if (gold >= cost) {
       setGold((g: number) => g - cost);
       setCardLevels((p: any) => ({ ...p, [card.id]: { level: lvl + 1, copies: 0 } }));
     }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 relative">
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-black pointer-events-none" />
       
       {activeCard && (
         <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
           <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-neutral-900 w-full max-w-sm rounded-3xl border border-neutral-700 shadow-2xl p-4 flex flex-col items-center">
              <button onClick={() => setActiveCard(null)} className="self-end bg-neutral-800 p-2 rounded-full mb-2"><X size={16} className="text-white"/></button>
              <div className="w-32 aspect-[3/4.2] rounded-xl overflow-hidden shadow-2xl border-2 border-neutral-500 mb-4 relative">
                <img src={activeCard.image} className="w-full h-full object-cover"/>
                <div className="absolute top-2 left-2 bg-fuchsia-600 border-2 border-fuchsia-300 text-white font-black px-2 py-0.5 rounded shadow">{activeCard.cost}</div>
              </div>
              <h2 className="text-2xl font-black text-white italic uppercase">{activeCard.name}</h2>
              <div className="text-blue-400 font-bold mb-4 uppercase text-xs tracking-widest">{activeCard.rarity} - {activeCard.playType}</div>
              
              <div className="w-full grid grid-cols-2 gap-2 mb-6">
                 <div className="bg-neutral-800 p-2 rounded-lg text-center"><div className="text-neutral-400 text-[10px] font-black uppercase">Leben</div><div className="text-white font-bold text-sm">{activeCard.hp || '-'}</div></div>
                 <div className="bg-neutral-800 p-2 rounded-lg text-center"><div className="text-neutral-400 text-[10px] font-black uppercase">Schaden</div><div className="text-white font-bold text-sm">{activeCard.damage || '-'}</div></div>
                 <div className="bg-neutral-800 p-2 rounded-lg text-center"><div className="text-neutral-400 text-[10px] font-black uppercase">Tempo</div><div className="text-white font-bold text-sm">{activeCard.speed || '-'}</div></div>
                 <div className="bg-neutral-800 p-2 rounded-lg text-center"><div className="text-neutral-400 text-[10px] font-black uppercase">Ziel</div><div className="text-white font-bold text-sm">{activeCard.targetType === 'buildings' ? 'Gebäude' : 'Alle'}</div></div>
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={() => swapToDeck(activeCard.id)} className="flex-1 bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black py-3 rounded-xl shadow border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition uppercase">
                  {userDeck.includes(activeCard.id) ? 'Entfernen' : 'Nutzen'}
                </button>
                <button onClick={() => tryUpgrade(activeCard)} className="flex-1 bg-gradient-to-b from-green-500 to-green-700 text-white font-black py-3 rounded-xl shadow border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition uppercase flex flex-col items-center justify-center">
                  <span className="text-[10px]">Upgrade</span>
                  <span className="flex items-center gap-1 text-xs">🪙 {(cardLevels[activeCard.id]?.level || 1)*50}</span>
                </button>
              </div>
           </motion.div>
         </div>
       )}

       <div className="relative z-10 p-3 sm:p-4 flex flex-col h-full">
         <div className="flex items-center justify-between mb-4">
           <button onClick={onBack} className="bg-neutral-800 p-2.5 rounded-2xl text-white shadow hover:bg-neutral-700 transition"><X size={20}/></button>
           <h2 className="text-2xl font-black text-white italic drop-shadow" style={{ WebkitTextStroke: '1px black' }}>DECK ( {userDeck.length}/8 )</h2>
           <div className="bg-orange-600/30 text-orange-400 px-3 py-1 rounded-xl border border-orange-600/50 font-black text-sm flex items-center gap-1">🪙 {gold}</div>
         </div>

         <div className="grid grid-cols-4 gap-2 bg-gradient-to-b from-black/80 to-black/40 p-3 rounded-2xl mb-4 shrink-0 shadow-inner border border-white/5">
           {Array.from({length: 8}).map((_, idx) => {
             const id = userDeck[idx]; const card = id ? CARDS_POOL.find(c => c.id === id) : null;
             return (
               <div key={idx} onClick={() => card && setActiveCard(card)} className="aspect-[3/4.2] bg-neutral-900 rounded-xl border-2 border-neutral-700 flex items-center justify-center relative overflow-hidden cursor-pointer hover:border-blue-400 transition">
                 {card ? (
                   <>
                     <img src={card.image} className="w-full h-full object-cover" />
                     <div className="absolute top-1 left-1 bg-fuchsia-600 border border-fuchsia-300 text-white text-[9px] font-black leading-none px-1.5 rounded shadow">{card.cost}</div>
                     <div className="absolute bottom-1 right-1 bg-yellow-500/90 backdrop-blur text-black text-[9px] font-black leading-none px-1.5 rounded shadow border border-yellow-600">Lvl {cardLevels[card.id]?.level || 1}</div>
                   </>
                 ) : (
                   <span className="text-neutral-700 font-bold opacity-50">Leer</span>
                 )}
               </div>
             );
           })}
         </div>

         <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
           <h3 className="text-neutral-400 font-black text-xs uppercase mb-3 px-1 sticky top-0 bg-slate-900/90 py-2 backdrop-blur z-10">Sammlung</h3>
           <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-10">
             {CARDS_POOL.map(card => {
               const isSelected = userDeck.includes(card.id);
               let rCol = 'border-neutral-500';
               if (card.rarity === 'Rare') rCol = 'border-orange-400';
               if (card.rarity === 'Epic') rCol = 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]';
               if (card.rarity === 'Legendary') rCol = 'border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.6)] animate-pulse';

               return (
                 <div key={card.id} onClick={() => setActiveCard(card)} className={`aspect-[3/4.2] rounded-xl relative overflow-hidden transition cursor-pointer hover:-translate-y-1 ${isSelected ? 'opacity-40 grayscale border-2 border-neutral-700' : 'border-2 ' + rCol}`}>
                   <img src={card.image} className="w-full h-full object-cover" />
                   <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent h-1/2" />
                   <div className="absolute bottom-1.5 inset-x-1 text-center text-white text-[8px] sm:text-[9px] font-black uppercase truncate drop-shadow-md">{card.name}</div>
                   <div className="absolute top-1 left-1 bg-fuchsia-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-fuchsia-300" style={{ WebkitTextStroke: '0.5px black'}}>{card.cost}</div>
                   <div className="absolute bottom-6 right-1 bg-yellow-500/90 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">Lvl {cardLevels[card.id]?.level || 1}</div>
                 </div>
               )
             })}
           </div>
         </div>
       </div>
    </div>
  );
};
