import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.');
const targetDir = './public/images';

for (const file of files) {
  if (file.endsWith('.png') && !file.startsWith('clash_')) {
    const oldPath = path.join('.', file);
    const newPath = path.join(targetDir, file);
    fs.renameSync(oldPath, newPath);
    console.log(`Moved ${file} to public/images/`);
  }
}
