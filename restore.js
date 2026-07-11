import fs from 'fs';
import path from 'path';

const imgDir = './public/images';
const files = fs.readdirSync(imgDir);

for (const file of files) {
  if (file.endsWith('.png') && !file.startsWith('clash_')) {
    const originalName = file.replace(/_/g, '-');
    const oldPath = path.join(imgDir, file);
    const newPath = path.join('.', originalName);
    fs.renameSync(oldPath, newPath);
    console.log(`Restored ${originalName}`);
  }
}
