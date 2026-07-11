import fs from 'fs';

function findFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git') continue;
    const path = `${dir}/${file}`;
    if (fs.statSync(path).isDirectory()) {
      findFiles(path);
    } else if (file.endsWith('.png')) {
      console.log(path);
    }
  }
}

findFiles('.');
