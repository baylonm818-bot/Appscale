const { execSync } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out1 = 'C:\\Users\\JOHN LLYOD TESIO\\.gemini\\antigravity\\brain\\ef2f8157-c16a-4d9d-ad00-ac260966fede\\ref_page1.png';

try {
  execSync(`"${chromePath}" --headless=new --screenshot="${out1}" --virtual-time-budget=5000 --window-size=1200,1650 "file:///C:/Users/JOHN%20LLYOD%20TESIO/OneDrive/Pictures/Deliverable7_DILGWorkMate_UsersManual.pdf"`);
  console.log('Saved ref_page1.png with delay');
} catch(e) {
  console.error(e.message);
}
