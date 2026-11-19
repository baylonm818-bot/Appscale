const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Deliverable7_DILGWorkMate_UsersManual.pdf');
const latinStr = buf.toString('latin1');

function parseCMap(dec) {
  const map = {};
  const bfcharMatches = dec.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
  for (const m of bfcharMatches) {
    map[parseInt(m[1], 16)] = String.fromCharCode(parseInt(m[2], 16));
  }
  const bfrangeMatches = dec.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
  for (const m of bfrangeMatches) {
    const start = parseInt(m[1], 16);
    const end = parseInt(m[2], 16);
    let tgt = parseInt(m[3], 16);
    for (let i = start; i <= end; i++) {
      map[i] = String.fromCharCode(tgt++);
    }
  }
  return map;
}

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

// Find all font mappings in 3794
const fontObj3794 = latinStr.slice(latinStr.indexOf('3794 0 obj'), latinStr.indexOf('3794 0 obj') + 600);
const fontDict = {};

const fMatches = fontObj3794.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g);
for (const fm of fMatches) {
  const fName = fm[1];
  const fObjId = parseInt(fm[2]);
  // get font object text
  const fPos = latinStr.indexOf(fObjId + ' 0 obj');
  const fText = latinStr.slice(fPos, fPos + 1000);
  const tuMatch = fText.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
  if (tuMatch) {
    const tuId = parseInt(tuMatch[1]);
    const stream = getObjectStream(tuId);
    if (stream) {
      fontDict[fName] = parseCMap(stream.toString('latin1'));
    }
  }
}
console.log('Successfully loaded font CMaps:', Object.keys(fontDict));

// Get page IDs from 3698
const pagesPos = latinStr.indexOf('3698 0 obj');
const pagesObj = latinStr.slice(pagesPos, pagesPos + 4000);
const kidsMatch = pagesObj.match(/\/Kids\[(.*?)\]/s);
const pageIds = [];
if (kidsMatch) {
  const kidRefs = kidsMatch[1].matchAll(/(\d+)\s+0\s+R/g);
  for (const kr of kidRefs) {
    pageIds.push(parseInt(kr[1]));
  }
}
console.log('Total pages in document:', pageIds.length);

// Decode pages 2 to 8 (TOC, Figures, Tables, Glossary)
for (let pNum = 2; pNum <= 8; pNum++) {
  const pId = pageIds[pNum - 1];
  const pPos = latinStr.indexOf(pId + ' 0 obj');
  const pText = latinStr.slice(pPos, pPos + 600);
  const cMatch = pText.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (!cMatch) continue;
  const cId = parseInt(cMatch[1]);
  const stream = getObjectStream(cId);
  if (!stream) continue;

  const cStr = stream.toString('latin1');
  let currentFont = 'F1';
  let decoded = '';

  // Match /F... Tf or TJ or Tj
  // Note: in PDF, text can be inside [ ... ] TJ or <...> Tj or (...) Tj
  const tokenRegex = /(\/F\d+)\s+[\d\.]+\s+Tf|\[(.*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/gs;
  let tm;
  while ((tm = tokenRegex.exec(cStr)) !== null) {
    if (tm[1]) {
      currentFont = tm[1].substring(1);
    } else if (tm[2]) {
      const inside = tm[2];
      const hexes = inside.matchAll(/<([0-9a-fA-F]+)>/g);
      const cmap = fontDict[currentFont] || {};
      for (const h of hexes) {
        const hex = h[1];
        for (let k = 0; k < hex.length; k += 2) {
          const code = parseInt(hex.substring(k, k + 2), 16);
          decoded += cmap[code] !== undefined ? cmap[code] : '';
        }
      }
      decoded += ' ';
    } else if (tm[3]) {
      const hex = tm[3];
      const cmap = fontDict[currentFont] || {};
      for (let k = 0; k < hex.length; k += 2) {
        const code = parseInt(hex.substring(k, k + 2), 16);
        decoded += cmap[code] !== undefined ? cmap[code] : '';
      }
      decoded += ' ';
    }
  }

  console.log(`\n===================== PAGE ${pNum} =====================`);
  console.log(decoded.replace(/[ ]{2,}/g, ' ').trim());
}
