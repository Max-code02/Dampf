import fs from 'fs';
import path from 'path';

const filePath = 'src/components/ClashArenaView.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const imagesDir = './public/images';
const files = fs.readdirSync(imagesDir);

let additionalCards = '';

for (const file of files) {
  if (file.endsWith('.png') || file.endsWith('.jpg')) {
    const isAlreadyIn = content.includes(`/images/${file}`);
    if (!isAlreadyIn) {
      const id = file.replace('.png', '').replace('.jpg', '').replace(/-/g, '_');
      const name = id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      additionalCards += `  { id: '${id}', name: '${name}', cost: 3, image: '/images/${file}', hp: 600, damage: 100, range: 40, speed: 1.5, type: 'ground', attackType: 'melee', attackSpeed: 1000, color: '#94a3b8', playType: 'troop' },\n`;
    }
  }
}

if (additionalCards.trim().length > 0) {
  content = content.replace('];\n\ninterface Troop {', additionalCards + '];\n\ninterface Troop {');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Added cards to code.');
} else {
  console.log('No new cards to add.');
}
