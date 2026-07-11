import fs from 'fs';

const files = fs.readdirSync('.');
for (const file of files) {
  if (file.endsWith('.png')) {
    console.log(file);
  }
}
