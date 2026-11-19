const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures';
const files = fs.readdirSync(dir).filter(f => f.startsWith('612302397027457'));
console.log('Found', files.length, 'images.');

// Let's create an inventory with size and file path
const inventory = files.map(f => {
  const p = path.join(dir, f);
  const st = fs.statSync(p);
  return { name: f, sizeKB: Math.round(st.size / 1024), path: p };
});
console.log(JSON.stringify(inventory.slice(0, 15), null, 2));
