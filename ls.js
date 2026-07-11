import fs from 'fs';
const files = fs.readdirSync('.');
files.forEach(f => console.log(JSON.stringify(f)));
