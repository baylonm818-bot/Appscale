const fs = require('fs');

const html = fs.readFileSync('AppScale_Deliverable7_Manual.html', 'utf8');

const p3Start = html.indexOf('<!-- ================= PAGE 3: TABLE OF CONTENTS ================= -->');
const p3End = html.indexOf('<!-- ================= PAGE 4:', p3Start);

console.log(html.slice(p3Start, p3End));
