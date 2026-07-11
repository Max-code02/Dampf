import fs from 'fs';
const content = fs.readFileSync('src/components/ClashArenaView.tsx', 'utf-8');
const regex = /image: '\/images\/([^']+)'/g;
let match;
let missing = [];
while ((match = regex.exec(content)) !== null) {
  const filename = match[1];
  missing.push(filename);
}
console.log(`Es fehlen ${missing.length} Bilder.`);
console.log(missing.join(', '));
