const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Deliverable7_DILGWorkMate_UsersManual.pdf');
const latinStr = buf.toString('latin1');

function getObjectStream(id) {
  const pos = latinStr.indexOf(id + ' 0 obj');
  if (pos === -1) return null;
  const sStart = latinStr.indexOf('stream', pos);
  if (sStart === -1) return null;
  let dataStart = sStart + 6;
  while (buf[dataStart] === 10 || buf[dataStart] === 13) dataStart++;
  const sEnd = latinStr.indexOf('endstream', dataStart);
  if (sEnd === -1) return null;
  try {
    return zlib.inflateSync(buf.subarray(dataStart, sEnd));
  } catch(e) {
    return null;
  }
}

// 1. Map all font names in 3794 to their parsed CMaps
const fontObj3794 = latinStr.slice(latinStr.indexOf('3794 0 obj'), latinStr.indexOf('3794 0 obj') + 600);
const fontDict = {};

const fMatches = fontObj3794.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g);
for (const fe of fMatches) {
  const fName = fe[1];
  const fObjId = parseInt(fe[2]);
  const fPos = latinStr.indexOf(fObjId + ' 0 obj');
  const fText = latinStr.slice(fPos, fPos + 1000);
  const tuMatch = fText.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
  if (tuMatch) {
    const tuId = parseInt(tuMatch[1]);
    const stream = getObjectStream(tuId);
    if (stream) {
      const dec = stream.toString('latin1');
      const map = {};
      for (const m of dec.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g)) {
        map[parseInt(m[1], 16)] = String.fromCharCode(parseInt(m[2], 16));
      }
      for (const m of dec.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g)) {
        const s = parseInt(m[1], 16), e = parseInt(m[2], 16);
        let t = parseInt(m[3], 16);
        for (let i = s; i <= e; i++) map[i] = String.fromCharCode(t++);
      }
      fontDict[fName] = map;
    }
  }
}

console.log('Loaded fonts:', Object.keys(fontDict));

// 2. Get all page content stream IDs
// In 3698: Kids is list of page objects
const pagesPos = latinStr.indexOf('3698 0 obj');
const pagesObj = latinStr.slice(pagesPos, pagesPos + 4000);
const kidsMatch = pagesObj.match(/\/Kids\[(.*?)\]/s);
const pageIds = [...kidsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map(m => parseInt(m[1]));

function decodePageText(pNum) {
  const pId = pageIds[pNum - 1];
  // Page object might have /Contents X 0 R or the page object IS the stream
  const pPos = latinStr.indexOf(pId + ' 0 obj');
  const pText = latinStr.slice(pPos, pPos + 800);
  let cId = pId;
  const cMatch = pText.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (cMatch) {
    cId = parseInt(cMatch[1]);
  }

  const stream = getObjectStream(cId);
  if (!stream) return '';

  const cStr = stream.toString('latin1');
  let currentFont = 'F1';
  let fullText = '';

  const regex = /(\/F\d+)\s+[\d\.]+\s+Tf|\[(.*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/gs;
  let rm;
  while ((rm = regex.exec(cStr)) !== null) {
    if (rm[1]) {
      currentFont = rm[1].substring(1);
    } else if (rm[2]) {
      const inside = rm[2];
      const hexes = inside.matchAll(/<([0-9a-fA-F]+)>/g);
      const cmap = fontDict[currentFont] || {};
      for (const h of hexes) {
        const hex = h[1];
        for (let k = 0; k < hex.length; k += 2) {
          const code = parseInt(hex.substring(k, k + 2), 16);
          fullText += cmap[code] !== undefined ? cmap[code] : '';
        }
      }
    } else if (rm[3]) {
      const hex = rm[3];
      const cmap = fontDict[currentFont] || {};
      for (let k = 0; k < hex.length; k += 2) {
        const code = parseInt(hex.substring(k, k + 2), 16);
        fullText += cmap[code] !== undefined ? cmap[code] : '';
      }
    }
  }
  return fullText;
}

// Print Pages 1 through 10
for (let i = 1; i <= 10; i++) {
  console.log(`\n============================= PAGE ${i} =============================`);
  console.log(decodePageText(i));
}
