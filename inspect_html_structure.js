const fs = require('fs');

const html = fs.readFileSync('AppScale_Deliverable7_Manual.html', 'utf8');

// Find all occurrences of class="page"
const pageMatches = [...html.matchAll(/<!-- ================= PAGE (\d+)[^=]*================= -->/g)];
console.log('Pages marked with comments:', pageMatches.length);
pageMatches.forEach(m => console.log('Page:', m[0]));
