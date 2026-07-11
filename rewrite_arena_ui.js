import fs from 'fs';

let content = fs.readFileSync('src/components/ClashArenaBattle.tsx', 'utf-8');

const returnRegex = /return \([\s\S]*?\);\n\};\n/m;
const renderRegex = /const render = \(\) => \{[\s\S]*?(?=raf\.current = requestAnimationFrame)/;

const newRender = `const render = () => {
      const cv = canvasRef.current; if(!cv) return;
      const ctx = cv.getContext('2d'); if(!ctx) return;
      ctx.clearRect(0,0,400,600);
      
      // Board (transparent so the CSS background img shows)
      ctx.fillStyle = 'rgba(89, 132, 44, 0.4)'; ctx.fillRect(0,0,400,600); // base green tint
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for(let x=0;x<40;x++) for(let y=0;y<60;y++) if((x+y)%2===0) { ctx.fillRect(x*10,y*10,10,10); }

      // Draw stone pathways
      ctx.fillStyle = 'rgba(122, 122, 122, 0.6)';
      ctx.fillRect(70, 50, 60, 230); // left path top
      ctx.fillRect(270, 50, 60, 230); // right path top
      ctx.fillRect(70, 320, 60, 230); // left path bot
      ctx.fillRect(270, 320, 60, 230); // right path bot
      
      // Add stone texture to paths
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for(let y=50;y<280;y+=10) { ctx.fillRect(70, y, 60, 1); ctx.fillRect(270, y, 60, 1); }
      for(let y=320;y<550;y+=10) { ctx.fillRect(70, y, 60, 1); ctx.fillRect(270, y, 60, 1); }

      // River
      const gradRiver = ctx.createLinearGradient(0, 275, 0, 325);
      gradRiver.addColorStop(0, '#2b84a9');
      gradRiver.addColorStop(0.5, '#41c9f4');
      gradRiver.addColorStop(1, '#1b6488');
      ctx.fillStyle = gradRiver;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 275, 400, 50);
      ctx.globalAlpha = 1;

      // Bridges
      ctx.fillStyle = '#654832'; 
      ctx.fillRect(75, 275, 50, 50); 
      ctx.fillRect(275, 275, 50, 50);
      // Bridge planks
      ctx.fillStyle = '#3a2718';
      for(let y=275; y<=325; y+=10) {
         ctx.fillRect(75, y, 50, 2);
         ctx.fillRect(275, y, 50, 2);
      }

      if (sel) { ctx.fillStyle = 'rgba(59,130,246,0.25)'; ctx.fillRect(0,325,400,275); }

      spRef.current.forEach(s => {
         ctx.fillStyle = s.type==='poison' ? 'rgba(217,119,6,0.4)': 'rgba(125,211,252,0.4)';
         ctx.beginPath(); ctx.arc(s.x, s.y, s.radius*20, 0, Math.PI*2); ctx.fill();
      });

      twRef.current.forEach(t => {
         if(t.isDead) { ctx.fillStyle='#4b5563'; ctx.beginPath(); ctx.arc(t.x, t.y, 25, 0, Math.PI*2); ctx.fill(); return; }
         ctx.fillStyle = t.side==='player' ? '#2563eb' : '#dc2626';
         ctx.beginPath(); ctx.arc(t.x, t.y, t.type==='king'?30:20, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#22c55e'; ctx.fillRect(t.x-20, t.y-35, 40*(t.hp/t.maxHp), 4);
      });

      trRef.current.forEach(u => {
         ctx.save();
         const mass = u.template.mass || 3;
         if (u.template.isFlying) { ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(u.x, u.y+30, 8, 0, Math.PI*2); ctx.fill(); }
         
         ctx.fillStyle = u.side==='player' ? '#3b82f6' : '#ef4444';
         ctx.beginPath(); ctx.arc(u.x, u.y, mass*1.5 + 6, 0, Math.PI*2); ctx.fill();

         const img = new Image(); img.src = u.template.image;
         if (img.complete && img.naturalWidth) {
           ctx.save(); ctx.beginPath(); ctx.arc(u.x, u.y, mass*1.5+4, 0, Math.PI*2); ctx.clip();
           ctx.drawImage(img, u.x-15, u.y-15, 30, 30); ctx.restore();
         } else {
           ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(u.x, u.y, mass*1.5+4, 0, Math.PI*2); ctx.fill();
         }
         
         ctx.fillStyle='#ef4444'; ctx.fillRect(u.x-10, u.y-25, 20, 3);
         ctx.fillStyle='#22c55e'; ctx.fillRect(u.x-10, u.y-25, 20*(u.hp/u.maxHp), 3);
         if (u.maxShield) { ctx.fillStyle='#a8a29e'; ctx.fillRect(u.x-10, u.y-29, 20*(u.shieldHp/u.maxShield), 2); }
         if (u.chargeStart && (u.chargeStart >= (u.template.chargeDuration||0)/1000)) {
           ctx.fillStyle='#fef08a'; ctx.fillRect(u.x-12, u.y-10, 4, 10); ctx.fillRect(u.x+8, u.y-10, 4, 10);
         }
         ctx.restore();
      });

      prRef.current.forEach(p => {
         ctx.fillStyle = p.type==='arrow' ? '#fff' : p.type==='bomb' ? '#111' : '#f97316';
         ctx.beginPath(); ctx.arc(p.x, p.y, p.type==='arrow'?3:8, 0, Math.PI*2); ctx.fill();
      });

      for(let i=txtRef.current.length-1; i>=0; i--) {
        const x = txtRef.current[i];
        x.l -= dt; x.y -= 20*dt;
        if(x.l<=0){ txtRef.current.splice(i,1); continue; }
        ctx.fillStyle=x.c; ctx.globalAlpha=x.l; ctx.font='14px bold Arial'; ctx.fillText(x.t, x.x-10, x.y); ctx.globalAlpha=1;
      }
    };

    `;

const newReturn = `return (
    <div className="flex-1 flex flex-col relative w-full overflow-hidden bg-black select-none">
      {/* Top UI */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-between p-3 pointer-events-none items-start max-w-[500px] mx-auto w-full">
        {/* Left Shield */}
        <div className="w-14 h-16 bg-gradient-to-b from-[#477ab3] to-[#254673] rounded-b-full border-[3px] border-[#a0b0c0] flex flex-col items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
          <div className="w-8 h-8 rounded-full border border-blue-300 shadow-inner flex items-center justify-center -mt-2">
            <span className="text-white font-black text-[10px] drop-shadow">lvl</span>
          </div>
        </div>

        {/* Center Timer */}
        <div className="bg-gradient-to-b from-[#b1ada6] via-[#a29e96] to-[#635f5a] px-8 py-1.5 rounded-sm border-y-2 border-[#e6e3e0] shadow-xl flex items-center gap-2 relative mt-2">
          <div className="w-4 h-4 bg-[#c026d3] rotate-45 border-2 border-[#f0abfc] shadow-[0_0_5px_rgba(0,0,0,0.5)] absolute -left-2"></div>
          <div className="w-4 h-4 bg-[#c026d3] rotate-45 border-2 border-[#f0abfc] shadow-[0_0_5px_rgba(0,0,0,0.5)] absolute -right-2"></div>
          <span className="text-white font-black text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest font-sans">Zeit: {Math.floor(sec/60)}:{(sec%60).toString().padStart(2,'0')}</span>
          {x2 && <span className="absolute -bottom-4 inset-x-0 text-center text-fuchsia-400 text-[10px] uppercase font-black animate-pulse drop-shadow-md">2x Elixier!</span>}
        </div>

        {/* Right Gold & Gems */}
        <div className="flex gap-2 mt-2">
          <div className="bg-[linear-gradient(to_bottom,#3a3a3a,#1e1e1e)] px-2 py-1 rounded-full border border-[#444] flex items-center gap-1.5 shadow-lg relative overflow-hidden pointer-events-auto">
             <div className="w-4 h-4 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 border border-yellow-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)]"></div>
             <span className="text-white font-black text-xs pr-1 drop-shadow-md">1000</span>
          </div>
          <div className="bg-[linear-gradient(to_bottom,#3a3a3a,#1e1e1e)] px-2 py-1 rounded-full border border-[#444] flex items-center gap-1.5 shadow-lg pointer-events-auto">
             <div className="w-4 h-4 bg-gradient-to-b from-emerald-400 to-emerald-600 rotate-45 border border-emerald-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.5)] ml-0.5"></div>
             <span className="text-white font-black text-xs pr-1 drop-shadow-md">200</span>
          </div>
        </div>
      </div>

      {res && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6 backdrop-blur">
          <h2 className={\`text-5xl font-black italic uppercase drop-shadow-xl \${res==='victory'?'text-yellow-400':'text-red-500'}\`}>
             {res==='draw'?'Unentschieden':res==='victory'?'SIEG!':'NIEDERLAGE'}
          </h2>
          <button onClick={() => { onEnd(res); onExit(); }} className="mt-8 bg-blue-600 px-10 py-4 rounded-xl text-white font-bold tracking-widest uppercase shadow-xl hover:bg-blue-500 active:translate-y-1 transition border-b-4 border-blue-800 active:border-b-0">Weiter</button>
        </div>
      )}

      {/* Realistic Background Arena Image */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-black perspective-1200 cursor-crosshair">
         <div className="absolute inset-x-0 h-full max-w-[500px] mx-auto opacity-70 border-x-4 border-[#333]" style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1599557457850-2fb563914946?q=80&w=600')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'contrast(1.2) sepia(0.3) hue-rotate(60deg) saturate(1.5)'
         }}></div>
         <canvas ref={canvasRef} width={400} height={600} onClick={handleCanvasClick} className="relative z-20 w-full max-w-[400px] h-full object-contain touch-none" style={{ transform: 'rotateX(20deg) scale(1.05)' }} />
      </div>

      {/* Bottom UI */}
      <div className="w-full bg-[#1b262c] pt-10 pb-6 relative z-40 border-t-[3px] border-[#536b7a] drop-shadow-[0_-10px_30px_rgba(0,0,0,0.8)] overflow-visible mx-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b262c]/80 to-[#10171a]"></div>

        {/* Elixir Bar */}
        <div className="absolute -top-4 inset-x-4 max-w-[480px] mx-auto h-8 bg-black/60 rounded-full border-y-[3px] border-[#dec589] shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center z-50">
           <div className="absolute -left-3 w-4 h-10 bg-gradient-to-b from-[#fde68a] via-[#b48e4b] to-[#6d5120] rounded-full border border-[#fef08a] shadow-lg"></div>
           <div className="absolute -right-3 w-4 h-10 bg-gradient-to-b from-[#fde68a] via-[#b48e4b] to-[#6d5120] rounded-full border border-[#fef08a] shadow-lg"></div>
           
           <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#e879f9] via-[#c026d3] to-[#86198f] rounded-l-full rounded-r-md transition-all duration-200 border-r-2 border-fuchsia-300 shadow-[inset_0_4px_10px_rgba(255,255,255,0.4)]" style={{width:\`\${(elixir/10)*100}%\`}}></div>
           
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
             {hand.map(c => {
                const ok = elixir >= (c.cost||0);
                const act = sel === c.id;
                return (
                  <button key={c.id+Math.random()} onClick={() => { if(ok||act) setSel(act?null:c.id); }} className={\`flex-1 flex flex-col items-center gap-1 transition-all duration-200 \${act ? '-translate-y-6 scale-110 drop-shadow-[0_15px_15px_rgba(59,130,246,0.6)] z-50' : ok ? 'hover:-translate-y-2 hover:scale-105 z-10 drop-shadow-xl' : 'opacity-80 grayscale-[40%] z-0'}\`}>
                     <div className={\`aspect-[3/4.2] w-full rounded border-[3px] \${act ? 'border-yellow-400' : 'border-[#94a3b8]'} relative overflow-hidden bg-neutral-800 shadow-[0_10px_20px_rgba(0,0,0,0.8)]\`}>
                        <img src={c.image} onError={(e) => e.currentTarget.style.display='none'} className="w-full h-[75%] object-cover object-top rounded-t-sm" />
                        
                        <div className="absolute bottom-0 inset-x-0 h-[25%] bg-[linear-gradient(to_bottom,#334155,#0f172a)] border-t-2 border-[#475569] flex flex-col justify-end items-center pb-0.5 shadow-inner">
                           <span className={\`text-white font-black text-[7px] sm:text-[9px] uppercase tracking-wider drop-shadow-lg truncate w-full text-center px-0.5 \${act?'text-yellow-300':''}\`}>{c.name}</span>
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
};`;

content = content.replace(renderRegex, newRender);
content = content.replace(returnRegex, newReturn);
fs.writeFileSync('src/components/ClashArenaBattle.tsx', content);
