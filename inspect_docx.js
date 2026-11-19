const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docxPath = 'C:\\Users\\JOHN LLYOD TESIO\\.gemini\\antigravity\\brain\\ef2f8157-c16a-4d9d-ad00-ac260966fede\\.user_uploaded\\media_1795014589589_26dddc33.docx';
const outDir = 'C:\\Users\\JOHN LLYOD TESIO\\.gemini\\antigravity\\brain\\ef2f8157-c16a-4d9d-ad00-ac260966fede\\extracted_docx';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy docx to .zip and extract using tar
const zipPath = path.join(outDir, 'temp.zip');
fs.copyFileSync(docxPath, zipPath);
try {
  execSync(`tar -xf "${zipPath}" -C "${outDir}"`);
  console.log('Extracted successfully!');
  const mediaDir = path.join(outDir, 'word', 'media');
  if (fs.existsSync(mediaDir)) {
    const files = fs.readdirSync(mediaDir);
    console.log('Media files:', files);
  } else {
    console.log('No media dir found');
  }

  // Also read document.xml text
  const docXml = path.join(outDir, 'word', 'document.xml');
  if (fs.existsSync(docXml)) {
    const xml = fs.readFileSync(docXml, 'utf8');
    // strip tags to see text
    const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    console.log('Document text preview (first 1000 chars):', text.slice(0, 1000));
    fs.writeFileSync(path.join(outDir, 'extracted_text.txt'), text);
  }
} catch (e) {
  console.error(e);
}
