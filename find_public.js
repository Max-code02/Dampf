import fs from 'fs';

const files = fs.readdirSync('./public');
for (const file of files) {
  console.log(JSON.stringify(file));
}
