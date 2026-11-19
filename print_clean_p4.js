const fs = require('fs');

const html = fs.readFileSync('AppScale_Deliverable7_Manual.html', 'utf8');

const p4Start = html.indexOf('<!-- ================= PAGE 4: LIST OF FIGURES & GLOSSARY ================= -->');
const p4End = html.indexOf('<!-- ================= PAGE 5:', p4Start);

const p4 = html.slice(p4Start, p4End);
const cleanP4 = p4.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE]');
console.log(cleanP4);
