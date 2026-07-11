const fs = require('fs');
let c = fs.readFileSync('src/components/ClashArenaBattle.tsx', 'utf8');
c = c.split('\\`').join('`');
c = c.split('\\$').join('$');
fs.writeFileSync('src/components/ClashArenaBattle.tsx', c);
