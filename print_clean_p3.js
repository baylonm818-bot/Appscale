const fs = require('fs');

const html = fs.readFileSync('AppScale_Deliverable7_Manual.html', 'utf8');

const p3Start = html.indexOf('<!-- ================= PAGE 3: TABLE OF CONTENTS ================= -->');
const p3End = html.indexOf('<!-- ================= PAGE 4:', p3Start);

const p3 = html.slice(p3Start, p3End);
// remove base64 images
const cleanP3 = p3.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE]');
console.log(cleanP3);
