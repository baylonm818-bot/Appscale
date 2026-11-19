const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetDir = path.join(__dirname, 'manual_figures');
const tempDir = path.join(__dirname, 'temp_screens');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
body { background: #f8fafc; margin: 0; padding: 0; width: 400px; height: 750px; overflow: hidden; display: flex; justify-content: center; align-items: center; }
.phone-frame {
  width: 380px;
  height: 720px;
  background: #ffffff;
  border-radius: 36px;
  border: 10px solid #1e293b;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.status-bar {
  height: 28px;
  background: #1b5e20;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  font-size: 11px;
  font-weight: 600;
}
.app-bar {
  background: #2e7d32;
  color: white;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.app-bar h2 { font-size: 17px; font-weight: 700; flex: 1; }
.screen-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8fafc;
}
.card {
  background: white;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 5px rgba(0,0,0,0.03);
}
.form-group { margin-bottom: 12px; }
.form-label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; display: block; }
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
  color: #1e293b;
}
.btn-primary {
  width: 100%;
  background: #2e7d32;
  color: white;
  padding: 12px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  margin-top: 10px;
  cursor: pointer;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}
.badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
.badge-green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.badge-orange { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
.badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
`;

const screens = [
  {
    name: 'fig_bns_login.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:41</span><span>4G 📶 98%</span></div>
      <div style="background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 40px 20px 24px; text-align: center; color: white;">
        <div style="width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 30px;">🌱</div>
        <h2 style="font-size: 20px; font-weight: 800;">AppScale Field</h2>
        <p style="font-size: 11px; opacity: 0.9; margin-top: 3px;">Barangay Nutrition Scholar Mobile App</p>
        <div style="margin-top: 8px;"><span class="badge" style="background: rgba(255,255,255,0.2); color: white;">Municipality of Gasan</span></div>
      </div>
      <div class="screen-content" style="padding-top: 20px;">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 700; color: #1e293b;">BNS Offline Sign In</span>
            <span class="badge badge-green">Hive Offline Ready</span>
          </div>
          <div class="form-group">
            <label class="form-label">BNS Username / Email</label>
            <input class="form-input" type="text" value="bns.cabugao@gasan.gov.ph" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Password / 6-Digit PIN</label>
            <input class="form-input" type="password" value="••••••••" readonly>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin: 8px 0 12px;">
            <label style="color: #64748b;"><input type="checkbox" checked> Keep logged in</label>
            <span style="color: #2e7d32; font-weight: 600;">Forgot PIN?</span>
          </div>
          <button class="btn-primary">AUTHENTICATE &amp; LOAD HIVE</button>
        </div>
        <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 15px;">
          Local encrypted database active.<br>Syncs automatically when online.
        </div>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_add_child.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:42</span><span>📶 98%</span></div>
      <div class="app-bar"><span>←</span><h2>New Child Registration</h2><span>💾</span></div>
      <div class="screen-content">
        <div class="card">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">Demographic Information</div>
          <div class="form-group">
            <label class="form-label">Full Child Name</label>
            <input class="form-input" type="text" value="Mark Joshua B. Alcantara" readonly>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="form-group">
              <label class="form-label">Sex</label>
              <input class="form-input" type="text" value="Male" readonly>
            </div>
            <div class="form-group">
              <label class="form-label">Date of Birth</label>
              <input class="form-input" type="text" value="2024-03-15" readonly>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Age in Months</label>
            <input class="form-input" type="text" value="24 months (Auto-calculated)" readonly style="background:#f1f5f9; font-weight:600; color:#1b5e20;">
          </div>
        </div>
        <div class="card">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">Household &amp; Location</div>
          <div class="form-group">
            <label class="form-label">Barangay &amp; Sitio</label>
            <input class="form-input" type="text" value="Barangay Cabugao — Sitio Ilaya" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Mother / Guardian Name</label>
            <input class="form-input" type="text" value="Elena B. Alcantara" readonly>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 600; color: #475569;">4Ps Beneficiary Household</span>
            <span class="badge badge-green">YES (Active)</span>
          </div>
        </div>
        <button class="btn-primary">SAVE PROFILE TO LOCAL HIVE</button>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_assessment.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:44</span><span>📶 98%</span></div>
      <div class="app-bar"><span>←</span><h2>OPT+ Growth Assessment</h2><span>📋</span></div>
      <div class="screen-content">
        <div class="card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <div style="font-size: 12px; color: #166534; font-weight: 700;">Mark Joshua B. Alcantara (24 mos)</div>
          <div style="font-size: 11px; color: #15803d;">Date: Nov 18, 2026 | BNS: Jana Rolle</div>
        </div>
        <div class="card">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Physical Measurements</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="form-group">
              <label class="form-label">Weight (kg)</label>
              <input class="form-input" type="text" value="8.90 kg" readonly style="font-size:14px; font-weight:700;">
            </div>
            <div class="form-group">
              <label class="form-label">Height (cm)</label>
              <input class="form-input" type="text" value="79.5 cm" readonly style="font-size:14px; font-weight:700;">
            </div>
          </div>
        </div>
        <div class="card" style="border: 2px solid #ef4444; background: #fffaf0;">
          <div style="font-size: 12px; font-weight: 800; color: #991b1b; margin-bottom: 8px;">Automated WHO Z-Scores</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px;">
            <span style="color: #475569;">Weight-for-Age (WFA):</span>
            <span class="badge badge-orange">Underweight (UW)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px;">
            <span style="color: #475569;">Height-for-Age (HFA):</span>
            <span class="badge badge-orange">Stunted (St)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <span style="color: #475569;">Weight-for-Length/Height:</span>
            <span class="badge badge-red">Severely Wasted (SAM)</span>
          </div>
        </div>
        <button class="btn-primary" style="background: #dc2626;">SAVE &amp; TRIGGER CLINICAL REFERRAL</button>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_referral.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:45</span><span>📶 98%</span></div>
      <div class="app-bar" style="background: #b91c1c;"><span>←</span><h2>Immediate Referral</h2><span>⚠️</span></div>
      <div class="screen-content">
        <div class="card" style="border-left: 4px solid #b91c1c;">
          <div style="font-size: 11px; font-weight: 800; color: #b91c1c;">RED FLAG ALERT TRIGGERED</div>
          <p style="font-size: 11px; color: #64748b; margin-top: 3px;">Severely Wasted (SAM) detected. Protocol mandates clinical referral to Gasan RHU.</p>
        </div>
        <div class="card">
          <div class="form-group">
            <label class="form-label">Severity Level</label>
            <span class="badge badge-red">HIGH SEVERITY (SAM CLINICAL)</span>
          </div>
          <div class="form-group">
            <label class="form-label">Receiving Facility</label>
            <input class="form-input" type="text" value="Gasan Rural Health Unit (RHU Clinic)" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Clinical Indication / Reason</label>
            <textarea class="form-input" style="height: 55px;" readonly>Weight-for-Length &lt; -3 SD. Child needs immediate clinical evaluation and RUTF initiation.</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned BHW Case Worker</label>
            <input class="form-input" type="text" value="Maria Santos (Cabugao BHW)" readonly>
          </div>
        </div>
        <button class="btn-primary" style="background: #b91c1c;">SUBMIT REFERRAL TO BHW PORTAL</button>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_feeding.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:47</span><span>📶 98%</span></div>
      <div class="app-bar"><span>←</span><h2>Supplementary Feeding</h2><span>🍲</span></div>
      <div class="screen-content">
        <div class="card" style="background: #f0fdf4; border-color: #86efac;">
          <div style="font-size: 11px; font-weight: 700; color: #166534;">120-DAY CYCLE LOG</div>
          <div style="font-size: 15px; font-weight: 800; color: #14532d; margin: 3px 0;">Cycle Day 45 of 120</div>
          <div style="font-size: 11px; color: #166534;">Menu: Fortified Lugaw + Boiled Egg + Malunggay</div>
        </div>
        <div class="card">
          <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Attendance &amp; Ration Sheet</div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            <span>Mark Joshua Alcantara</span>
            <span class="badge badge-green">PRESENT (Fed)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            <span>Carlo D. Santos</span>
            <span class="badge badge-green">PRESENT (Fed)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            <span>Althea Marie Reyes</span>
            <span class="badge badge-orange">RATION PICKUP</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 11px;">
            <span>John Paul Mendoza</span>
            <span class="badge badge-red">EXCUSED / SICK</span>
          </div>
        </div>
        <button class="btn-primary">SUBMIT DAILY FEEDING ATTENDANCE</button>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_micronutrient.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:48</span><span>📶 98%</span></div>
      <div class="app-bar"><span>←</span><h2>Micronutrient Supplement</h2><span>💊</span></div>
      <div class="screen-content">
        <div class="card">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Intervention Entry</div>
          <div class="form-group">
            <label class="form-label">Supplement Given</label>
            <input class="form-input" type="text" value="Vitamin A (Blue Capsule 100,000 IU)" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">DOH Program Round</label>
            <input class="form-input" type="text" value="Garantisadong Pambata Round 2 (2026)" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Deworming Dose (Albendazole 400mg)</label>
            <input class="form-input" type="text" value="Administered with food (Observed)" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Batch / Lot Tracking</label>
            <input class="form-input" type="text" value="DOH-LOT-2026-X981" readonly>
          </div>
        </div>
        <button class="btn-primary">RECORD TO MEDICAL PROFILE</button>
      </div>
    </div>`
  },
  {
    name: 'fig_bns_sync.png',
    body: `
    <div class="phone-frame">
      <div class="status-bar"><span>09:50</span><span>📶 4G 98%</span></div>
      <div class="app-bar"><span>←</span><h2>Offline-to-Cloud Sync</h2><span>🔄</span></div>
      <div class="screen-content">
        <div class="card" style="text-align: center; padding: 20px 14px;">
          <div style="font-size: 36px; margin-bottom: 6px;">☁️</div>
          <div style="font-size: 15px; font-weight: 800; color: #1e293b;">Central Cloud Sync</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">appscale-two.vercel.app</div>
          <div style="margin-top: 10px;"><span class="badge badge-green">INTERNET CONNECTED</span></div>
        </div>
        <div class="card">
          <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Pending Hive Cache Queue</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 7px;">
            <span>Anthropometric Assessments:</span>
            <span style="font-weight: 700; color: #c2410c;">6 records</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 7px;">
            <span>Supplementary Feeding Attendance:</span>
            <span style="font-weight: 700; color: #c2410c;">45 records</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 7px;">
            <span>Emergency Referral:</span>
            <span style="font-weight: 700; color: #b91c1c;">1 urgent</span>
          </div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 6px; font-size: 10px; color: #64748b;">
            Last sync: Today at 07:15 AM
          </div>
        </div>
        <button class="btn-primary" style="background: #1b5e20;">SYNC ALL RECORDS NOW</button>
      </div>
    </div>`
  }
];

screens.forEach((sc, idx) => {
  const html = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>${css}</style>
  </head>
  <body>
    ${sc.body}
  </body>
  </html>`;
  const htmlPath = path.join(tempDir, `screen_${idx + 1}.html`);
  const outPng = path.join(targetDir, sc.name);
  fs.writeFileSync(htmlPath, html);

  const cmd = `"${chromePath}" --headless --disable-gpu --window-size=400,750 --screenshot="${outPng}" "file://${htmlPath.replace(/\\/g, '/')}"`;
  try {
    execSync(cmd);
    console.log(`Rendered ${sc.name} (${(fs.statSync(outPng).size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`Error rendering ${sc.name}:`, err);
  }
});
