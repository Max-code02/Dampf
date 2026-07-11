import fs from 'fs';

const filePath = 'src/components/ClashArenaView.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace("playType: 'troop' }\n  { id: 'archers'", "playType: 'troop' },\n  { id: 'archers'");
fs.writeFileSync(filePath, content, 'utf-8');
