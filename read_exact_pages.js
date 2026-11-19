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

const fontCMaps = {};
for (const id in objPositions) {
  const text = getObjectText(id);
  if (text.includes('/Type /Font') || text.includes('/Type/Font')) {
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

const pageIds = [];
for (const id in objPositions) {
  const text = getObjectText(id);
  if (text.includes('/Type /Page') || text.includes('/Type/Page')) {
    pageIds.push(parseInt(id));
  }
}

for (let i = 1; i <= Math.min(12, pageIds.length); i++) {
  const pId = pageIds[i - 1];
  const pText = getObjectText(pId);
  const contentsMatch = pText.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (!contentsMatch) continue;
  const cId = parseInt(contentsMatch[1]);
  const cStream = getObjectStream(cId);
  if (!cStream) continue;

  const fontRefs = {};
  const resMatch = pText.match(/\/Resources\s+(\d+)\s+0\s+R/);
  let resText = pText;
  if (resMatch) {
    resText = getObjectText(parseInt(resMatch[1]));
  }
  const fMatches = resText.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g);
  for (const fm of fMatches) {
    const fName = fm[1];
    const fObjId = parseInt(fm[2]);
    if (fontCMaps[fObjId]) {
      fontRefs[fName] = fontCMaps[fObjId];
    }
  }

  const cStr = cStream.toString('latin1');
  let currentFont = null;
  let pageDecoded = '';

  const tokenRegex = /(\/([A-Za-z0-9]+)\s+[\d\.]+\s+Tf)|(\[([^\]]*)\]\s*TJ)|(<([0-9a-fA-F]+)>\s*Tj)/g;
  let tm;
  while ((tm = tokenRegex.exec(cStr)) !== null) {
    if (tm[1]) {
      currentFont = tm[2];
    } else if (tm[3]) {
      const inside = tm[4];
      const hexMatches = inside.matchAll(/<([0-9a-fA-F]+)>/g);
      const cmap = fontRefs[currentFont] || {};
      for (const hm of hexMatches) {
        const hex = hm[1];
        for (let k = 0; k < hex.length; k += 2) {
          const code = parseInt(hex.substring(k, k + 2), 16);
          pageDecoded += cmap[code] !== undefined ? cmap[code] : '';
        }
      }
      pageDecoded += ' ';
    } else if (tm[5]) {
      const hex = tm[6];
      const cmap = fontRefs[currentFont] || {};
      for (let k = 0; k < hex.length; k += 2) {
        const code = parseInt(hex.substring(k, k + 2), 16);
        pageDecoded += cmap[code] !== undefined ? cmap[code] : '';
      }
      pageDecoded += ' ';
    }
  }

  console.log(`\n================== PAGE ${i} ==================`);
  console.log(pageDecoded.trim().replace(/\s+/g, ' '));
}
