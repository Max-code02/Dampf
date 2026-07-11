import fs from 'fs';

const files = fs.readdirSync('.');
for (const file of files) {
  if (file.startsWith('file:') || file.includes('png')) {
    console.log(JSON.stringify(file));
  }
}
