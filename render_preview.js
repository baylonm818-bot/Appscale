const { execSync } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = 'C:\\Users\\JOHN LLYOD TESIO\\.gemini\\antigravity\\brain\\ef2f8157-c16a-4d9d-ad00-ac260966fede\\page1_preview.png';

execSync(`"${chromePath}" --headless=new --screenshot="${out}" --window-size=1200,1650 "file:///c:/Users/JOHN%20LLYOD%20TESIO/OneDrive/Documents/AppScale-Web-main/AppScale_Deliverable7_Manual.html"`);
console.log('Success screenshot');
