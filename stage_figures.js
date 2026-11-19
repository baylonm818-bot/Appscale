const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'manual_figures');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const screenshotsDir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures\\Screenshots';
const picturesDir = 'C:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Pictures';

const copyMap = {
  'fig_bhw_login.png': path.join(screenshotsDir, 'Screenshot 2026-10-27 205549.png'),
  'fig_auth_otp.png': path.join(screenshotsDir, 'Screenshot 2026-10-27 205028.png'),
  'fig_bhw_dashboard.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 085129.png'),
  'fig_bhw_medical_records.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 085412.png'),
  'fig_bhw_need_attention.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 085311.png'),
  'fig_bhw_referrals.png': path.join(screenshotsDir, 'Screenshot 2026-11-12 090842.png'),
  'fig_admin_dashboard.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 084613.png'),
  'fig_admin_users.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 084725.png'),
  'fig_admin_schedule.png': path.join(screenshotsDir, 'Screenshot 2026-10-01 084853.png'),
  'fig_admin_logs.png': path.join(screenshotsDir, 'Screenshot 2026-11-12 092047.png'),
  'fig_admin_signatories.png': path.join(screenshotsDir, 'Screenshot 2026-11-12 092232.png'),
  'fig_admin_register.png': path.join(picturesDir, 'adminn.png')
};

for (const [destName, srcPath] of Object.entries(copyMap)) {
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(targetDir, destName));
    console.log(`Copied ${destName} (${(fs.statSync(srcPath).size / 1024).toFixed(1)} KB)`);
  } else {
    console.warn(`Source not found: ${srcPath}`);
  }
}
