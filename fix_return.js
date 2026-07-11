import fs from 'fs';

let content = fs.readFileSync('src/components/ClashArenaView.tsx', 'utf-8');

const returnStart = content.indexOf('  return (\n    <motion.div');
const newReturn = `  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg h-[92vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col border border-neutral-700/50">
        
        {/* Main Header shared across all screens */}
        <div className="w-full bg-gradient-to-b from-blue-900 to-blue-950 border-b border-blue-800/50 p-4 flex items-center justify-between z-50 shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center border-2 border-blue-300 shadow-inner">
                <Crown size={24} className="text-yellow-300" />
             </div>
             <div>
               <h2 className="text-white font-black text-lg leading-tight drop-shadow-md">König {myProfile?.displayName || user?.displayName || 'Spieler'}</h2>
               <div className="flex items-center gap-2">
                 <span className="text-blue-300 text-xs font-bold bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">XP 14</span>
                 <span className="text-yellow-400 text-xs font-bold flex items-center gap-0.5"><Crown size={10} /> 5420</span>
               </div>
             </div>
           </div>
           <div className="flex gap-2">
             <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-yellow-700/50 text-white font-bold text-sm">
               <span className="text-yellow-400">🪙</span> 14.502
             </div>
             <button onClick={onClose} className="bg-red-500/80 hover:bg-red-500 text-white w-8 h-8 rounded-lg flex items-center justify-center transition ml-2">
               <X size={18} />
             </button>
           </div>
        </div>

        {/* --- MENU SCREEN --- */}
        {!isPlaying && currentScreen === 'menu' && (
          <div className="flex-1 overflow-y-auto bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070')] bg-cover bg-center bg-fixed relative flex flex-col items-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            <div className="relative z-10 w-full flex-1 flex flex-col p-4 items-center gap-6">
               <div className="mt-4 text-center">
                 <span className="text-yellow-400 text-sm font-black tracking-widest uppercase bg-black/50 px-4 py-1 rounded-full border border-yellow-500/30">Arena 15</span>
                 <h1 className="text-5xl font-black text-white italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mt-2" style={{ WebkitTextStroke: '1px black' }}>LEGENDARY</h1>
               </div>

               {/* BATTLE BUTTON */}
               <motion.button
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 onClick={() => { setIsPlaying(true); initGame(); }}
                 className="mt-6 bg-gradient-to-b from-yellow-400 via-yellow-500 to-orange-500 text-white font-black text-4xl px-16 py-6 rounded-3xl shadow-[0_15px_35px_rgba(234,179,8,0.4),_0_0_0_6px_#fef08a_inset,0_10px_0_#9a3412] active:translate-y-2 active:shadow-[0_5px_15px_rgba(234,179,8,0.4),_0_0_0_6px_#fef08a_inset,0_0px_0_#9a3412] uppercase tracking-wider relative overflow-hidden"
               >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  <span className="drop-shadow-lg relative z-10 block" style={{ WebkitTextStroke: '2px #7c2d12' }}>KAMPF</span>
               </motion.button>

               {/* Deck Preview Mini */}
               <div className="w-full mt-auto mb-6 bg-black/60 p-4 rounded-3xl border-t-2 border-white/10 backdrop-blur-md">
                 <div className="flex justify-between items-end mb-3">
                   <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                     <Swords size={16} className="text-blue-400" /> Aktuelles Deck
                   </h3>
                   <button onClick={() => setCurrentScreen('deck')} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow">
                     DECK BEARBEITEN
                   </button>
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                   {userDeck.map(id => {
                     const card = CARDS_POOL.find(c => c.id === id);
                     if (!card) return null;
                     return (
                       <div key={id} className="aspect-[3/4] bg-neutral-800 rounded-xl border-2 border-neutral-700 overflow-hidden relative shadow-lg">
                         <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                         <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent h-1/2" />
                         <div className="absolute bottom-1 w-full text-center text-white font-black text-[9px] drop-shadow-md leading-tight px-1 uppercase truncate">
                           {card.name}
                         </div>
                         <div className="absolute top-1 left-1 bg-fuchsia-600 border border-fuchsia-300 text-white text-[8px] font-black rounded px-1.5 py-0.5" style={{ WebkitTextStroke: '0.5px black'}}>
                           {card.cost}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* --- DECK BUILDER SCREEN --- */}
        {!isPlaying && currentScreen === 'deck' && (
          <div className="flex-1 bg-[#1e293b] flex flex-col overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-black pointer-events-none" />
            <div className="relative z-10 p-4 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setCurrentScreen('menu')} className="bg-neutral-800 hover:bg-neutral-700 text-white p-2 rounded-xl shadow">
                  <X size={20} />
                </button>
                <h1 className="text-2xl font-black text-white italic drop-shadow" style={{ WebkitTextStroke: '1px black' }}>DECK ÄNDERN</h1>
                <div className="ml-auto text-yellow-400 font-bold bg-black/40 px-3 py-1 rounded-full border border-yellow-500/30">
                  {userDeck.length} / 8
                </div>
              </div>

              {/* Chosen Deck Area */}
              <div className="grid grid-cols-4 gap-2 bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner mb-6 shrink-0">
                 {Array.from({ length: 8 }).map((_, i) => {
                   const cardId = userDeck[i];
                   const card = cardId ? CARDS_POOL.find(c => c.id === cardId) : null;
                   return (
                     <div key={i} className="aspect-[3/4.2] bg-black/50 rounded-xl border-2 border-dashed border-neutral-700 flex items-center justify-center overflow-hidden relative">
                       {card ? (
                         <>
                           <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                           <div className="absolute top-1 left-1 bg-fuchsia-600 border border-fuchsia-300 text-white text-[9px] font-black rounded shadow px-1.5" style={{ WebkitTextStroke: '0.5px black'}}>
                             {card.cost}
                           </div>
                           <button 
                             onClick={() => setUserDeck(prev => prev.filter(id => id !== card.id))}
                             className="absolute inset-0 bg-red-500/80 items-center justify-center opacity-0 hover:opacity-100 flex transition font-black text-white cursor-pointer"
                           >
                             <X size={32} />
                           </button>
                         </>
                       ) : (
                         <span className="text-neutral-600 text-2xl font-black">?</span>
                       )}
                     </div>
                   );
                 })}
              </div>

              {/* All Cards Scroll */}
              <div className="flex-1 overflow-y-auto pb-8 pr-2">
                <h3 className="text-neutral-400 font-bold uppercase text-xs mb-3 pl-1">Alle Karten ({CARDS_POOL.length})</h3>
                <div className="grid grid-cols-4 gap-2">
                  {CARDS_POOL.map(card => {
                    const isSelected = userDeck.includes(card.id);
                    return (
                       <button
                         key={card.id}
                         onClick={() => {
                           if (isSelected) setUserDeck(prev => prev.filter(id => id !== card.id));
                           else if (userDeck.length < 8) setUserDeck(prev => [...prev, card.id]);
                         }}
                         className={\`aspect-[3/4.2] rounded-xl overflow-hidden relative border-2 transition-all \${isSelected ? 'border-yellow-400 opacity-50 grayscale' : 'border-neutral-700 hover:border-blue-400 hover:scale-105 shadow-md'}\`}
                       >
                         <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                         <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1 pt-4 text-center">
                           <div className="text-white font-black text-[9px] leading-tight uppercase truncate">{card.name}</div>
                         </div>
                         <div className="absolute top-1 left-1 bg-fuchsia-600 border border-fuchsia-300 text-white text-[9px] font-black rounded px-1.5" style={{ WebkitTextStroke: '0.5px black'}}>
                           {card.cost}
                         </div>
                         {isSelected && (
                           <div className="absolute inset-0 flex items-center justify-center">
                             <div className="bg-yellow-400 text-black font-black px-2 py-0.5 rounded text-xs -rotate-12 border-2 border-black">IM DECK</div>
                           </div>
                         )}
                       </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- BATTLE SCREEN (The Arena) --- */}
        {isPlaying && (
          <div className="flex-1 flex flex-col relative w-full overflow-hidden bg-black">
            
            {/* Top Battle Header */}
            <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-2 pointer-events-none">
               <div className="flex items-center gap-3 bg-black/70 backdrop-blur px-4 py-1.5 rounded-full border border-neutral-700/50 shadow-lg">
                 <div className="flex items-center gap-1.5">
                   <Crown className="text-blue-500 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" size={18} fill="#3b82f6" />
                   <span className="text-white font-black text-xl drop-shadow">{playerCrowns}</span>
                 </div>
                 <span className="text-neutral-500 font-bold text-xs uppercase tracking-widest px-2">Time: {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}</span>
                 <div className="flex items-center gap-1.5">
                   <span className="text-white font-black text-xl drop-shadow">{enemyCrowns}</span>
                   <Crown className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" size={18} fill="#ef4444" />
                 </div>
               </div>
               
               <div className="flex flex-col items-end gap-1 pointer-events-auto">
                  {doubleElixir && (
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="bg-fuchsia-600 text-white font-black text-[10px] px-2 py-0.5 rounded border border-fuchsia-300 uppercase tracking-widest shadow-lg"
                    >2x Elixier!</motion.div>
                  )}
                  <button onClick={() => setIsMuted(!isMuted)} className="bg-black/60 p-2 rounded-full text-white/50 hover:text-white backdrop-blur">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
               </div>
            </div>

            {/* 3D Canvas Container */}
            <div 
              ref={containerRef}
              className="relative flex-1 w-full bg-[#1b3310] overflow-hidden select-none cursor-crosshair flex items-center justify-center p-4 pt-16"
              style={{ perspective: '1200px' }}
            >
              <div 
                className="w-[400px] h-[600px] max-w-full max-h-full transition-transform duration-700 relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] border-8 border-emerald-950/80 rounded-sm"
                style={{ 
                  transform: gameResult ? 'rotateX(0deg) scale(1)' : 'rotateX(25deg) scale(1.1) translateY(-20px)',
                  transformStyle: 'preserve-3d'
                }}
              >
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={600}
                  onClick={handleCanvasClick}
                  className="w-full h-full block touch-none pointer-events-auto bg-[#34621c]"
                />
                
                {/* Visual Fake Depth Layers for the Arena Board edges */}
                <div className="absolute inset-x-0 -bottom-6 h-6 bg-emerald-950 origin-top transform rotateX(-90deg) border-b-2 border-emerald-900" />
                <div className="absolute inset-y-0 -right-6 w-6 bg-emerald-900 origin-left transform rotateY(90deg) border-r-2 border-emerald-800" />
                
                {/* End Match Overlay over Canvas */}
                {gameResult && (
                  <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md rounded-lg transform translate-z-10">
                     <motion.div
                       initial={{ scale: 0.5, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       className="flex flex-col items-center"
                     >
                       {gameResult === 'victory' ? (
                         <>
                           <Trophy className="text-yellow-400 w-24 h-24 mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]" />
                           <h2 className="text-yellow-400 text-5xl font-black italic uppercase tracking-wider drop-shadow-lg" style={{ WebkitTextStroke: '1px #854d0e' }}>SIEG!</h2>
                         </>
                       ) : (
                         <>
                           <Shield className="text-red-500 w-24 h-24 mb-4 animate-pulse drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]" />
                           <h2 className="text-red-500 text-5xl font-black italic uppercase tracking-wider drop-shadow-lg" style={{ WebkitTextStroke: '1px #7f1d1d' }}>NIEDERLAGE</h2>
                         </>
                       )}

                       <div className="flex gap-4 mt-12 w-full max-w-xs">
                         <button onClick={initGame} className="flex-1 bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black text-xl py-4 rounded-2xl shadow-[0_5px_15px_rgba(59,130,246,0.5),_0_0_0_4px_#60a5fa_inset] border-2 border-blue-300 uppercase transform hover:scale-105 active:scale-95 transition">
                           NOCHMAL
                         </button>
                         <button onClick={() => { setGameResult(null); setIsPlaying(false); setCurrentScreen('menu'); }} className="flex-1 bg-gradient-to-b from-neutral-600 to-neutral-800 text-white font-black text-xl py-4 rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.5),_0_0_0_4px_#9ca3af_inset] border-2 border-neutral-400 uppercase transform hover:scale-105 active:scale-95 transition">
                           MENÜ
                         </button>
                       </div>
                     </motion.div>
                  </div>
                )}
              </div>
            </div>

            {/* Hand / Deck Footer Area */}
            <div className="w-full bg-[#121c10] border-t-2 border-neutral-700/60 p-4 pt-5 relative z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
              {/* Elixir Management Bar */}
              <div className="h-5 w-full bg-black/80 rounded-full mb-5 overflow-hidden border-2 border-fuchsia-950 relative shadow-inner isolate">
                 <div 
                   className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-fuchsia-600 to-purple-500 transition-all duration-[600ms] ease-linear"
                   style={{ width: \`\${(elixir / 10) * 100}%\` }}
                 >
                    {/* Gloss / Shine effect on liquid */}
                    <div className="absolute top-0 inset-x-0 h-1/2 bg-white/20" />
                 </div>
                 
                 {/* Fill ticks */}
                 <div className="absolute inset-0 flex justify-between px-0 pointer-events-none opacity-30">
                   {Array.from({length: 10}).map((_, i) => <div key={i} className="h-full w-px bg-black" />)}
                 </div>

                 <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
                     <div className="flex items-center gap-1.5">
                       <Droplet className="text-fuchsia-300 fill-fuchsia-300 drop-shadow animate-pulse" size={14} />
                       <span className="text-white font-black text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{Math.floor(elixir)}</span>
                     </div>
                 </div>
              </div>
              
              {/* Deck Choices (Hand) */}
              <div className="flex gap-3 w-full items-end select-none">
                
                {/* Next Card Slot */}
                <div className="w-12 flex flex-col items-center gap-1 opacity-80 shrink-0">
                  <span className="text-neutral-400 text-[9px] font-black uppercase tracking-widest">Nächste</span>
                  <div className="aspect-[3/4.2] w-full bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden relative shadow-inner">
                     <img src={nextCard.image} className="w-full h-full object-cover grayscale-[30%]" />
                  </div>
                </div>

                <div className="w-px h-16 bg-neutral-800 shrink-0" />

                {/* Hand Cards */}
                {deck.map((card) => {
                  const affordable = elixir >= card.cost;
                  const isSelected = selectedCardId === card.id;

                  return (
                    <motion.button 
                      key={card.id + Math.random()} // Force unique animation rendering
                      disabled={!isPlaying || gameResult !== null}
                      onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                      whileHover={{ y: affordable ? -15 : 0 }}
                      className={\`flex-1 aspect-[3/4.2] max-w-[80px] rounded-xl border-2 overflow-hidden relative flex flex-col transition-all duration-200 \${
                        isSelected 
                          ? 'border-yellow-400 ring-4 ring-yellow-400/50 -translate-y-6 shadow-[0_20px_40px_rgba(234,179,8,0.4)] scale-110 z-10'
                          : affordable 
                            ? 'border-neutral-500 hover:border-blue-400 bg-neutral-900 shadow-xl z-0' 
                            : 'border-neutral-800 bg-black/80 opacity-60 grayscale-[50%] z-0'
                      }\`}
                    >
                      <img 
                        src={card.image} 
                        alt={card.name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover relative z-10"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4 text-center z-20">
                         <div className="text-white font-black text-[9px] leading-none uppercase truncate">{card.name}</div>
                      </div>
                      <div className="absolute top-1 left-1 bg-fuchsia-600 border border-fuchsia-300 text-white text-[10px] font-black rounded px-1.5 z-20 shadow-lg" style={{ WebkitTextStroke: '0.5px black'}}>
                        {card.cost}
                      </div>
                      {!affordable && <div className="absolute inset-0 bg-black/40 z-30 pointer-events-none" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
`;

content = content.substring(0, returnStart) + newReturn + '\n};\n';
fs.writeFileSync('src/components/ClashArenaView.tsx', content);
console.log('Return injected successfully');
