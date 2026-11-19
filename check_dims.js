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

const dir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures';
const files = fs.readdirSync(dir).filter(f => f.startsWith('612302397027457'));
files.forEach(f => {
  const buf = fs.readFileSync(path.join(dir, f));
  const dim = getJpegDimensions(buf);
  if (dim) {
    const isPortrait = dim.height > dim.width;
    console.log(`${f}: ${dim.width}x${dim.height} (${isPortrait ? 'MOBILE/PORTRAIT' : 'DESKTOP/LANDSCAPE'})`);
  }
});
