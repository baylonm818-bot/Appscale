const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Deliverable7_DILGWorkMate_UsersManual.pdf');
const latinStr = buf.toString('latin1');

function parseCMap(str) {
  const map = {};
  const bfcharMatches = str.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
  for (const m of bfcharMatches) {
    const src = parseInt(m[1], 16);
    const tgt = parseInt(m[2], 16);
    map[src] = String.fromCharCode(tgt);
  }
  const bfrangeMatches = str.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
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

// Find object positions
const objPositions = {};
const objRegex = /(\d+)\s+0\s+obj/g;
let m;
while ((m = objRegex.exec(latinStr)) !== null) {
  objPositions[parseInt(m[1])] = m.index;
}

function getObjectStream(id) {
  const pos = objPositions[id];
  if (pos === undefined) return null;
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

function getObjectText(id) {
  const pos = objPositions[id];
  if (pos === undefined) return '';
  const endObj = latinStr.indexOf('endobj', pos);
  return latinStr.substring(pos, endObj);
}

// Map Font object ID -> CMap
const fontCMaps = {};
for (const id in objPositions) {
  const text = getObjectText(id);
  if (text.includes('/Type/Font') || text.includes('/Type /Font')) {
    const tuMatch = text.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (tuMatch) {
      const tuId = parseInt(tuMatch[1]);
      const stream = getObjectStream(tuId);
      if (stream) {
        fontCMaps[id] = parseCMap(stream.toString('latin1'));
      }
    }
  }
}

// Global font mapping from 3794
const fontObj3794 = getObjectText(3794);
const fontDict = {};
const fEntries = fontObj3794.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g);
for (const fe of fEntries) {
  const fName = fe[1];
  const fId = parseInt(fe[2]);
  if (fontCMaps[fId]) {
    fontDict[fName] = fontCMaps[fId];
  }
}
console.log('Mapped font names:', Object.keys(fontDict));

// Get all pages from 3698
const pagesObj = getObjectText(3698);
const kidsMatch = pagesObj.match(/\/Kids\[(.*?)\]/s);
const pageIds = [];
if (kidsMatch) {
  const kidRefs = kidsMatch[1].matchAll(/(\d+)\s+0\s+R/g);
  for (const kr of kidRefs) {
    pageIds.push(parseInt(kr[1]));
  }
}
console.log('Total page IDs in Kids:', pageIds.length);

// Decode pages 1 to 15
for (let pNum = 1; pNum <= 15; pNum++) {
  const pId = pageIds[pNum - 1];
  const pText = getObjectText(pId);
  const cMatch = pText.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (!cMatch) continue;
  const cId = parseInt(cMatch[1]);
  const stream = getObjectStream(cId);
  if (!stream) continue;

  const cStr = stream.toString('latin1');
  let currentFont = 'F1';
  let decoded = '';

  const regex = /(\/F\d+)\s+[\d\.]+\s+Tf|\[(.*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g;
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
          decoded += cmap[code] !== undefined ? cmap[code] : '';
        }
      }
      decoded += ' ';
    } else if (rm[3]) {
      const hex = rm[3];
      const cmap = fontDict[currentFont] || {};
      for (let k = 0; k < hex.length; k += 2) {
        const code = parseInt(hex.substring(k, k + 2), 16);
        decoded += cmap[code] !== undefined ? cmap[code] : '';
      }
      decoded += ' ';
    }
  }

  console.log(`\n===================== PAGE ${pNum} =====================`);
  console.log(decoded.replace(/\s+/g, ' ').trim());
}
