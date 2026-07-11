import fs from 'fs';
import path from 'path';

const dirsToScan = ['.', './public'];
const targetDir = './public/images/';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

for (const dir of dirsToScan) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      const oldPath = path.join(dir, file);
      const newPath = path.join(targetDir, file);
      
      // Move file
      if (oldPath !== newPath && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`Moved ${oldPath} to ${newPath}`);
      } else if (oldPath !== newPath && fs.existsSync(newPath)) {
        console.log(`File ${newPath} already exists, deleting old file ${oldPath}`);
        fs.unlinkSync(oldPath);
      }
    }
  }
}
