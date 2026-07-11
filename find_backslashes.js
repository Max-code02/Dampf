import fs from 'fs';

const files = fs.readdirSync('.');
for (const file of files) {
  if (file.includes('\\') || file.includes('public')) {
    console.log(JSON.stringify(file));
  }
}
