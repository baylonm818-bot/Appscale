const fs = require('fs');

const html = fs.readFileSync('AppScale_Deliverable7_Manual.html', 'utf8');

// Find all pages
const pages = html.split(/<!-- ================= PAGE \d+:[^=]*================= -->/);

for (let i = 1; i < pages.length; i++) {
  const pHtml = pages[i];
  // extract h1, h2, h3, tables, callouts
  const titleMatch = html.match(new RegExp(`<!-- ================= PAGE ${i}: ([^=]*) ================= -->`));
  const title = titleMatch ? titleMatch[1].trim() : `PAGE ${i}`;
  
  // clean tags to get snippet
  const text = pHtml.replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
  console.log(`\n--- PAGE ${i}: ${title} ---`);
  console.log(text.slice(0, 300) + '...');
}
