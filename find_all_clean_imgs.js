const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const full = path.join(dir, file);
      if (['node_modules', '.git', 'build', '.dart_tool', 'android', 'ios', 'windows', 'linux'].some(x => full.includes(x))) return;
      const stat = fs.statSync(full);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(full));
      } else if (/\.(png|jpg|jpeg)$/i.test(file)) {
        results.push(full);
      }
    });
  } catch(e) {}
  return results;
}

const found = walk('.');
console.log('Found images in workspace:');
found.forEach(f => console.log(f));
