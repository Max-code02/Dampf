const fs = require('fs');
let c = fs.readFileSync('src/components/ClashArenaBattle.tsx', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/ClashArenaBattle.tsx', c);
