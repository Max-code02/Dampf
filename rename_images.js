import fs from 'fs';
import path from 'path';

const targetDir = './public/images/';

const files = fs.readdirSync(targetDir);
for (const file of files) {
  if (file.endsWith('.png') || file.endsWith('.jpg')) {
    const oldPath = path.join(targetDir, file);
    const newName = file.replace(/-/g, '_');
    const newPath = path.join(targetDir, newName);
    
    // Move file
    if (oldPath !== newPath && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed ${oldPath} to ${newPath}`);
    } else if (oldPath !== newPath && fs.existsSync(newPath)) {
      console.log(`File ${newPath} already exists, deleting old file ${oldPath}`);
      fs.unlinkSync(oldPath);
    }
  }
}
