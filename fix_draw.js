import fs from 'fs';

let content = fs.readFileSync('src/components/ClashArenaView.tsx', 'utf-8');

const drawStart = content.indexOf('  const drawArena = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {');
const drawEnd = content.indexOf('    ctx.restore();\n  };\n\n  // Convert click coordinates');

const newDraw = `  const drawArena = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const W = 400;
    const H = 600;

    // Clear Canvas
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    
    // Background Turf / Checkered Grass Pattern
    const grass1 = '#4ade80';
    const grass2 = '#41c973';
    ctx.fillStyle = grass1;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = grass2;
    for(let i=0; i<W/40; i++) {
       for(let j=0; j<H/40; j++) {
          if((i+j)%2 === 0) ctx.fillRect(i*40, j*40, 40, 40);
       }
    }

    // Grid lines for depth
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
       ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
       ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Shadow Config (for 3D Pop elements)
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 15;

    // 1. Draw River Center (y=280..320)
    ctx.fillStyle = '#2563eb';
    ctx.shadowColor = 'transparent'; // No shadow for ground river
    ctx.fillRect(0, 275, W, 50);

    // River banks details and glow
    ctx.fillStyle = '#60a5fa'; // water rim
    ctx.fillRect(0, 275, W, 4);
    ctx.fillRect(0, 321, W, 4);

    // Flowing Water Lines
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 295); ctx.lineTo(120, 295);
    ctx.moveTo(180, 305); ctx.lineTo(260, 305);
    ctx.moveTo(300, 292); ctx.lineTo(370, 292);
    ctx.stroke();

    // 2. Draw Bridges
    const drawBridge = (bx: number) => {
      // Box shadow layer
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowOffsetY = 10;
      ctx.shadowBlur = 8;
      
      // Plank base
      ctx.fillStyle = '#552a13';
      ctx.fillRect(bx - 25, 270, 50, 60);

      // Reset shadow for inner texture
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#78350f';
      for(let py=272; py<=328; py+=10) {
         ctx.fillRect(bx - 25, py, 50, 8);
      }
      
      // Rope bounds
      ctx.fillStyle = '#d97706';
      ctx.fillRect(bx - 25, 270, 6, 60);
      ctx.fillRect(bx + 19, 270, 6, 60);
    };
    drawBridge(85);
    drawBridge(315);

    // Spawn Safe Zone Indicator
    if (selectedCardId) {
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.fillRect(10, 330, W - 20, H - 330 - 40);
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(10, 330, W - 20, H - 330 - 40);
      ctx.setLineDash([]);
    }

    // Turn 3D shadows on for elements
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 12;

    // 3. Draw Towers (Pseudo 3D blocky towers)
    towersRef.current.forEach(t => {
      const isPlayer = t.side === 'player';
      const r = t.type === 'king' ? 28 : 18;

      if (t.isDead) {
        // Draw ruined debris (No massive shadow)
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#374151'; // rubble
        ctx.beginPath(); ctx.arc(t.x+5, t.y+2, r-6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x-4, t.y-4, r-8, 0, Math.PI*2); ctx.fill();
        return;
      }

      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowOffsetY = 15;
      
      // Tower Body
      ctx.fillStyle = isPlayer ? '#1e40af' : '#991b1b';
      // Fake cylindrical 3d (base)
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
      
      ctx.shadowColor = 'transparent'; // stop shadow for top layers
      // Tower Roof padding
      ctx.fillStyle = isPlayer ? '#3b82f6' : '#dc2626';
      ctx.beginPath(); ctx.arc(t.x, t.y - 4, r-2, 0, Math.PI * 2); ctx.fill();

      // Platform
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath(); ctx.arc(t.x, t.y - 4, r - 6, 0, Math.PI * 2); ctx.fill();

      // Crown / Flag
      ctx.fillStyle = '#fbbf24'; // pure gold
      ctx.beginPath();
      ctx.moveTo(t.x - 8, t.y - 12);
      ctx.lineTo(t.x - 5, t.y - 2);
      ctx.lineTo(t.x + 5, t.y - 2);
      ctx.lineTo(t.x + 8, t.y - 12);
      ctx.lineTo(t.x, t.y - 6);
      ctx.fill();

      // Health Bar
      const pct = t.hp / t.maxHp;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(t.x - 20, t.y + r + 8, 40, 6);
      ctx.fillStyle = isPlayer ? '#22c55e' : '#ef4444';
      ctx.fillRect(t.x - 20, t.y + r + 8, 40 * pct, 6);
    });

    // 4. Draw Active Battle Troops with actual assets clipped beautifully
    troopsRef.current.forEach(t => {
      const isPlayer = t.side === 'player';
      const size = t.type === 'building' ? 24 : (t.name.includes('P.E.K.K.A') || t.name.includes('Golem') || t.name.includes('Giant') ? 22 : 14);

      ctx.save();
      
      // Troop shadow based on flying or ground
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowOffsetY = t.type === 'flying' ? 30 : 8;
      ctx.shadowBlur = t.type === 'flying' ? 15 : 5;

      // Outer Ring for side color
      ctx.fillStyle = isPlayer ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(t.x, t.y, size + 2, 0, Math.PI * 2);
      ctx.fill();

      // Disable shadow for image details
      ctx.shadowColor = 'transparent';

      const loadedImg = imagesRef.current[t.cardId];
      if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(loadedImg, t.x - size, t.y - size, size * 2, size * 2);
        ctx.restore();
      } else {
        // Fallback
        ctx.fillStyle = t.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, size, 0, Math.PI*2); ctx.fill();
      }

      ctx.restore();

      // Flying wings indicator
      if (t.type === 'flying') {
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x - size, t.y); ctx.lineTo(t.x - size - 10, t.y - 8);
        ctx.moveTo(t.x + size, t.y); ctx.lineTo(t.x + size + 10, t.y - 8);
        ctx.stroke();
      }

      // HP Bar
      const pct = t.hp / t.maxHp;
      ctx.fillStyle = '#374151';
      ctx.fillRect(t.x - 14, t.y - size - 10, 28, 5);
      ctx.fillStyle = isPlayer ? '#22c55e' : '#f43f5e';
      ctx.fillRect(t.x - 14, t.y - size - 10, 28 * Math.max(0, pct), 5);
    });

    // 5. Draw Projectiles
    projectilesRef.current.forEach(p => {
      // Visual style based on type
      let color = '#ec4899';
      let rad = 7;
      if (p.type === 'arrow') { color = '#ffffff'; rad = 3; }
      else if (p.type === 'spell_fireball' || p.type === 'fireball' || p.type === 'flame') { color = '#f97316'; rad = 10; }
      else if (p.type === 'spell_barrel') { color = '#b45309'; rad = 12; }
      
      // Shadow layer
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 15; // Projectiles are high up!

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Accents
      if (p.type === 'spell_fireball' || p.type === 'fireball' || p.type === 'flame') {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.arc(p.x - 3, p.y + 3, rad/1.5, 0, Math.PI*2); ctx.fill();
      } else if (p.type === 'spell_barrel') {
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2; ctx.stroke();
      }
    });

    // 6. Floating Texts
    floatingTextsRef.current.forEach(txt => {
       ctx.fillStyle = txt.color;
       ctx.font = '900 16px Arial Black, Impact, sans-serif';
       ctx.lineWidth = 3;
       ctx.strokeStyle = '#000000';
       ctx.textAlign = 'center';
       ctx.strokeText(txt.text, txt.x, txt.y);
       ctx.fillText(txt.text, txt.x, txt.y);
    });

    ctx.restore();`;

content = content.substring(0, drawStart) + newDraw + content.substring(drawEnd);
fs.writeFileSync('src/components/ClashArenaView.tsx', content);
console.log('drawArena injected successfully');
