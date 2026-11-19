const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures';
const files = fs.readdirSync(dir);
const jpgs = files.filter(f => f.startsWith('612302397027457'));
console.log('Total 6123 images:', jpgs.length);
jpgs.forEach(f => {
  const p = path.join(dir, f);
  const st = fs.statSync(p);
  console.log(f, (st.size / 1024).toFixed(1) + ' KB');
});
