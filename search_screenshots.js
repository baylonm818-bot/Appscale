const fs = require('fs');
const path = require('path');

const dirs = [
  'C:\\Users\\JOHN LLYOD TESIO\\Downloads',
  'C:\\Users\\JOHN LLYOD TESIO\\Pictures',
  'C:\\Users\\JOHN LLYOD TESIO\\Desktop',
  'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures',
  'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Desktop'
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) return;
  try {
    const list = fs.readdirSync(d);
    list.forEach(f => {
      if (/\.(png|jpe?g)$/i.test(f)) {
        const full = path.join(d, f);
        const stat = fs.statSync(full);
        console.log(full, '(', (stat.size / 1024).toFixed(1), 'KB )');
      }
    });
  } catch(e) {}
});
