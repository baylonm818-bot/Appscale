const fs = require('fs');
const path = require('path');

function getJpegDimensions(buffer) {
  let i = 0;
  if (buffer.readUInt16BE(0) !== 0xFFD8) return null;
  i += 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) return null;
    const marker = buffer[i + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      return {
        height: buffer.readUInt16BE(i + 5),
        width: buffer.readUInt16BE(i + 7)
      };
    }
    const len = buffer.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function getPngDimensions(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const dir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Screenshots';
const files = fs.readdirSync(dir).filter(f => f.startsWith('Screenshot 2026-10-') || f.startsWith('Screenshot 2026-09-'));
console.log('Total files in target period:', files.length);

const portrait = [];
const landscape = [];

files.forEach(f => {
  try {
    const buf = fs.readFileSync(path.join(dir, f));
    const dim = f.endsWith('.png') ? getPngDimensions(buf) : getJpegDimensions(buf);
    if (dim) {
      if (dim.height > dim.width) {
        portrait.push({ file: f, ...dim });
      } else {
        landscape.push({ file: f, ...dim });
      }
    }
  } catch(e) {}
});

console.log('Portrait count (likely mobile):', portrait.length);
console.log('Landscape count (likely desktop):', landscape.length);
console.log('First 5 portrait:', portrait.slice(0, 5));
