const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Deliverable7_DILGWorkMate_UsersManual.pdf');

// 1. Build CMap dictionary for each font
// Map font object ID to its ToUnicode map
const fontMaps = {};

function parseCMap(str) {
  const map = {};
  // match bfchar: <0001> <0041>
  const bfcharMatches = str.matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
  for (const m of bfcharMatches) {
    const src = parseInt(m[1], 16);
    // target can be 1 or 2 bytes UTF-16BE
    const tgtCode = parseInt(m[2], 16);
    map[src] = String.fromCharCode(tgtCode);
  }

  // match bfrange: <0001> <0005> <0041> or <0001> <0005> [<0041> ...]
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

// Find all /Font objects and their /ToUnicode reference
let pos = 0;
while ((pos = buf.indexOf('/Font', pos)) !== -1) {
  const slice = buf.subarray(pos, pos + 200).toString('latin1');
  // see if it has /ToUnicode X 0 R
  const tu = slice.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
  if (tu) {
    const tuId = parseInt(tu[1]);
    if (!fontMaps[tuId]) {
      const objHeader = Buffer.from(tuId + ' 0 obj');
      const objPos = buf.indexOf(objHeader);
      if (objPos !== -1) {
        const streamPos = buf.indexOf('stream', objPos);
        let sStart = streamPos + 6;
        while (buf[sStart] === 10 || buf[sStart] === 13) sStart++;
        const sEnd = buf.indexOf('endstream', sStart);
        const dec = zlib.inflateSync(buf.subarray(sStart, sEnd)).toString('latin1');
        fontMaps[tuId] = parseCMap(dec);
      }
    }
  }
  pos += 10;
}

console.log('Parsed CMaps count:', Object.keys(fontMaps).length);

// Also create a combined map across all CMaps for quick decoding
const universalMap = {};
for (const tuId in fontMaps) {
  Object.assign(universalMap, fontMaps[tuId]);
}

// Now let's scan all content streams for pages 1 to 10
pos = 0;
let pageCount = 0;
let pageStreams = [];

while ((pos = buf.indexOf('/Contents', pos)) !== -1) {
  const slice = buf.subarray(pos, pos + 100).toString('latin1');
  const m = slice.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (m) {
    pageStreams.push(parseInt(m[1]));
  }
  pos += 10;
}

console.log('Total content streams found:', pageStreams.length);

// Decode first 10 pages
for (let pIdx = 0; pIdx < Math.min(10, pageStreams.length); pIdx++) {
  const cId = pageStreams[pIdx];
  const objHeader = Buffer.from(cId + ' 0 obj');
  const objPos = buf.indexOf(objHeader);
  if (objPos === -1) continue;
  const streamPos = buf.indexOf('stream', objPos);
  let sStart = streamPos + 6;
  while (buf[sStart] === 10 || buf[sStart] === 13) sStart++;
  const sEnd = buf.indexOf('endstream', sStart);
  try {
    const dec = zlib.inflateSync(buf.subarray(sStart, sEnd)).toString('latin1');
    // Extract text in TJ / Tj
    let decodedText = '';
    // match [ <hex> num <hex> ... ] TJ
    const tjMatches = dec.matchAll(/\[(.*?)\]\s*TJ/gs);
    for (const tm of tjMatches) {
      const inside = tm[1];
      const hexMatches = inside.matchAll(/<([0-9a-fA-F]+)>/g);
      for (const hm of hexMatches) {
        const hex = hm[1];
        // hex could be pairs of bytes or 1 byte
        for (let i = 0; i < hex.length; i += 4) {
          const code = parseInt(hex.substring(i, i + 4), 16);
          decodedText += universalMap[code] || '';
        }
      }
      decodedText += ' ';
    }

    // Also single Tj
    const singleTj = dec.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g);
    for (const sm of singleTj) {
      const hex = sm[1];
      for (let i = 0; i < hex.length; i += 4) {
        const code = parseInt(hex.substring(i, i + 4), 16);
        decodedText += universalMap[code] || '';
      }
      decodedText += ' ';
    }

    console.log(`\n--- PAGE ${pIdx + 1} ---`);
    console.log(decodedText.trim().replace(/\s+/g, ' ').slice(0, 1000));
  } catch(e) {}
}
