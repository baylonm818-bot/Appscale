const fs = require('fs');
const content = fs.readFileSync('build_exact_docx.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('ImageRun') || line.includes('Figure') || line.includes('image') || line.includes('adminn')) {
    console.log((idx + 1) + ': ' + line.trim());
  }
});
