const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const figuresDir = path.join(rootDir, 'manual_figures');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const hBuf = fs.readFileSync(path.join(rootDir, 'header_banner.jpg'));
const fBuf = fs.readFileSync(path.join(rootDir, 'footer_banner.jpg'));
const headerB64 = 'data:image/jpeg;base64,' + hBuf.toString('base64');
const footerB64 = 'data:image/jpeg;base64,' + fBuf.toString('base64');

function getB64(filename) {
  const p = path.join(figuresDir, filename);
  if (fs.existsSync(p)) {
    const ext = filename.endsWith('.jpg') ? 'jpeg' : 'png';
    return `data:image/${ext};base64,` + fs.readFileSync(p).toString('base64');
  }
  return '';
}

const imgs = {
  bnsLogin: getB64('fig_bns_login.png'),
  bnsAddChild: getB64('fig_bns_add_child.png'),
  bnsAssessment: getB64('fig_bns_assessment.png'),
  bnsReferral: getB64('fig_bns_referral.png'),
  bnsFeeding: getB64('fig_bns_feeding.png'),
  bnsMicronutrient: getB64('fig_bns_micronutrient.png'),
  bnsSync: getB64('fig_bns_sync.png'),
  bhwLogin: getB64('fig_bhw_login.png'),
  authOtp: getB64('fig_auth_otp.png'),
  bhwDashboard: getB64('fig_bhw_dashboard.png'),
  bhwMedicalRecords: getB64('fig_bhw_medical_records.png'),
  bhwNeedAttention: getB64('fig_bhw_need_attention.png'),
  bhwReferrals: getB64('fig_bhw_referrals.png'),
  adminDashboard: getB64('fig_admin_dashboard.png'),
  adminUsers: getB64('fig_admin_users.png'),
  adminSchedule: getB64('fig_admin_schedule.png'),
  adminLogs: getB64('fig_admin_logs.png'),
  adminSignatories: getB64('fig_admin_signatories.png'),
  adminRegister: getB64('fig_admin_register.png')
};

console.log('Generating complete HTML manual...');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deliverable #7 - User's Manual of the System: AppScale</title>
<style>
  @page {
    size: letter portrait;
    margin: 0.8cm 1.2cm 0.8cm 1.2cm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #222222;
    line-height: 1.45;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  .page {
    page-break-after: always;
    min-height: 98vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    padding-bottom: 10px;
  }
  .page:last-child { page-break-after: avoid; }
  .header-banner img, .footer-banner img {
    width: 100%;
    display: block;
  }
  .header-banner { margin-bottom: 12px; }
  .footer-banner { margin-top: 10px; }
  .page-footer-text {
    text-align: right;
    font-size: 8pt;
    color: #666666;
    margin-top: 3px;
    font-weight: 500;
  }
  .page-footer-text span {
    color: #800000;
    font-weight: 700;
  }
  .content { flex: 1; }
  
  h1 {
    font-size: 13pt;
    font-weight: 800;
    color: #800000;
    margin: 10px 0 6px 0;
    text-transform: uppercase;
    border-bottom: 2px solid #800000;
    padding-bottom: 3px;
  }
  h2 {
    font-size: 11pt;
    font-weight: 700;
    color: #800000;
    margin: 10px 0 4px 0;
  }
  h3 {
    font-size: 10pt;
    font-weight: 700;
    color: #1b5e20;
    margin: 8px 0 4px 0;
  }
  p { margin: 4px 0 6px 0; }
  
  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 8.5pt;
  }
  th {
    background: #800000;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 5px 8px;
    border: 1px solid #660000;
  }
  td {
    padding: 5px 8px;
    border: 1px solid #cccccc;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #fafafa; }
  
  /* Figures */
  .figure-box {
    text-align: center;
    margin: 8px 0 12px 0;
  }
  .figure-box img {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }
  .figure-caption {
    font-size: 8.5pt;
    font-weight: 700;
    font-style: italic;
    color: #444444;
    margin-top: 4px;
  }
  
  /* Feature block */
  .feature-block {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e2e8f0;
  }
  .feature-block:last-child { border-bottom: none; }
  .feature-label {
    font-weight: 700;
    color: #1b5e20;
  }
  .procedure-list {
    margin: 3px 0 6px 0;
    padding-left: 18px;
  }
  .procedure-list li {
    margin-bottom: 2px;
  }
</style>
</head>
<body>

  <!-- PAGE 1: COVER PAGE -->
  <div class="page" style="justify-content: flex-start; text-align: center;">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div style="margin-top: 25px; font-size: 13pt; font-weight: 700; color: #555555; letter-spacing: 1px;">DELIVERABLE #7</div>
    <div style="font-size: 32pt; font-weight: 900; color: #800000; margin-top: 6px; letter-spacing: 1px;">APPSCALE</div>
    <div style="font-size: 12pt; font-weight: 700; color: #2e7d32; margin-top: 2px;">Barangay Child Nutrition &amp; Maternal Health Information System</div>
    <div style="width: 70%; height: 3px; background: #D4AF37; margin: 15px auto;"></div>
    <div style="font-size: 18pt; font-weight: 800; color: #800000; margin-top: 10px;">USER'S MANUAL OF THE SYSTEM</div>
    <div style="font-size: 10pt; font-style: italic; color: #444444; margin: 10px auto; max-width: 80%;">
      A Comprehensive Multi-Platform Operational Guide for Barangay Nutrition Scholars (BNS), Barangay Health Workers (BHW), and Municipal Health Administrators
    </div>
    
    <div style="margin-top: 35px;">
      <div style="font-size: 10.5pt; font-weight: 700; color: #222222;">Target Beneficiaries &amp; Partner Institution:</div>
      <div style="font-size: 10pt; color: #444444; margin-top: 3px;">Rural Health Unit (RHU) &amp; Municipal Health Office (MHO)</div>
      <div style="font-size: 10pt; color: #444444;">Municipality of Gasan, Province of Marinduque</div>
    </div>
    
    <div style="margin-top: 35px;">
      <div style="font-size: 10.5pt; font-weight: 700; color: #800000;">Capstone Project Research Team (Group 3):</div>
      <div style="font-size: 10pt; font-weight: 700; color: #222222; margin-top: 4px;">
        Jana Rose P. Rolle &nbsp;|&nbsp; Mark Joseph J. Baylon &nbsp;|&nbsp; Christopher C. Aranas &nbsp;|&nbsp; John Lloyd S. Tesio
      </div>
      <div style="font-size: 9.5pt; color: #555555; margin-top: 6px;">
        College of Information and Computing Sciences (CICS)<br>
        Marinduque State University — Main Campus, Boac, Marinduque<br>
        Academic Year 2026 – 2027
      </div>
    </div>
  </div>

  <!-- PAGE 2: DOCUMENT CONTROL & SIGN-OFF -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>Document Control &amp; Revision History</h1>
      <p>This document undergoes structured version control to trace iterative developments, stakeholder reviews, and system enhancements for the AppScale multi-platform nutrition system.</p>
      <table>
        <thead>
          <tr><th style="width:12%">Date</th><th style="width:10%">Version</th><th style="width:25%">Author / Contributor</th><th>Summary of Changes &amp; Remarks</th></tr>
        </thead>
        <tbody>
          <tr><td>09/16/2026</td><td>v1.0</td><td>Capstone Dev Team</td><td>Initial user manual draft covering core mobile screening and web portal prototype.</td></tr>
          <tr><td>10/12/2026</td><td>v1.5</td><td>Capstone Dev Team</td><td>Added 120-day supplementary feeding procedures and clinical referral protocol.</td></tr>
          <tr><td>11/04/2026</td><td>v2.0</td><td>Capstone Dev Team</td><td>Integrated DOH/NNC OPT+ Form 1A/1B export, audit logging, and offline Hive sync.</td></tr>
          <tr><td>11/18/2026</td><td>v3.0</td><td>Capstone Dev Team</td><td>Complete Deliverable #7 User's Manual featuring comprehensive 5-point instructions for all 18 features across BNS, BHW, and Admin roles with high-resolution UI screenshots.</td></tr>
        </tbody>
      </table>

      <h2>Formal Review &amp; Institutional Sign-Off Approvals</h2>
      <p>The undersigned institutional advisors, academic panelists, and municipal health stakeholders have examined and formally approved this operational manual for field deployment:</p>
      <table>
        <thead>
          <tr style="background:#f4f4f4; color:#800000;"><th style="color:#800000; background:#f4f4f4;">Role / Stakeholder</th><th style="color:#800000; background:#f4f4f4;">Designated Official &amp; Department</th><th style="color:#800000; background:#f4f4f4;">Signature &amp; Date of Approval</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Capstone Project Adviser</strong></td><td>Engr. / Prof. Faculty Adviser<br>MarSU College of Information and Computing Sciences</td><td>_______________________ | Date: ___/___/2026</td></tr>
          <tr><td><strong>Technical Panel Reviewer</strong></td><td>Lead Systems Evaluator<br>MarSU CICS Capstone Evaluation Committee</td><td>_______________________ | Date: ___/___/2026</td></tr>
          <tr><td><strong>Municipal Health Stakeholder</strong></td><td>Municipal Health Officer (MHO) / MNAO<br>Rural Health Unit, Municipality of Gasan</td><td>_______________________ | Date: ___/___/2026</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>2</span></div>
    </div>
  </div>

  <!-- PAGE 3: TABLE OF CONTENTS -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>Table of Contents</h1>
      <p>The document is organized systematically into the following major chapters and sub-sections:</p>
      <table>
        <tbody>
          <tr><td><strong>1. System Overview</strong></td><td style="text-align:right; font-weight:700;">Page 5</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;1.1 Description of the System</td><td style="text-align:right;">Page 5</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;1.2 Purpose, Objectives, and Expected Impact</td><td style="text-align:right;">Page 5</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;1.3 Intended User Roles &amp; Hierarchy (BNS, BHW, Admin)</td><td style="text-align:right;">Page 5</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;1.4 Clinical Referral &amp; Malnutrition Escalation Protocol</td><td style="text-align:right;">Page 6</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;1.5 Offline-to-Cloud Data Synchronization Architecture</td><td style="text-align:right;">Page 6</td></tr>
          <tr><td><strong>2. System Requirements &amp; Operational Access</strong></td><td style="text-align:right; font-weight:700;">Page 7</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;2.1 Hardware, Software, and Network Specifications</td><td style="text-align:right;">Page 7</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;2.2 Access URLs, Mobile APK, and Cloud Deployment</td><td style="text-align:right;">Page 7</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;2.3 User Account Provisioning &amp; Password Security</td><td style="text-align:right;">Page 7</td></tr>
          <tr><td><strong>3. Getting Started &amp; User Authentication</strong></td><td style="text-align:right; font-weight:700;">Page 8</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;3.1 Web &amp; Mobile Portal Authentication</td><td style="text-align:right;">Page 8</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;3.2 Password Reset &amp; 6-Digit OTP Verification Flow</td><td style="text-align:right;">Page 8</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;3.3 Multi-Platform Navigation &amp; UI Layout</td><td style="text-align:right;">Page 8</td></tr>
          <tr><td><strong>4. Operational Glossary of Health &amp; Technical Terms</strong></td><td style="text-align:right; font-weight:700;">Page 9</td></tr>
          <tr><td><strong>5. Step-by-Step User Instructions (Core Manual)</strong></td><td style="text-align:right; font-weight:700;">Page 10</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<strong>5.1 Role 1: Barangay Nutrition Scholar (BNS) — Mobile App (7 Features)</strong></td><td style="text-align:right; color:#1b5e20; font-weight:700;">Pages 10–13</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<strong>5.2 Role 2: Barangay Health Worker (BHW) — Web Portal (5 Features)</strong></td><td style="text-align:right; color:#1b5e20; font-weight:700;">Pages 14–16</td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<strong>5.3 Role 3: Municipal Health Administrator — Central Portal (6 Features)</strong></td><td style="text-align:right; color:#1b5e20; font-weight:700;">Pages 17–19</td></tr>
          <tr><td><strong>6. System Error Handling &amp; Troubleshooting Matrix</strong></td><td style="text-align:right; font-weight:700;">Page 20</td></tr>
          <tr><td><strong>7. Frequently Asked Questions (FAQ)</strong></td><td style="text-align:right; font-weight:700;">Page 20</td></tr>
          <tr><td><strong>8. Security, Data Privacy (RA 10173), &amp; Ethical Guidelines</strong></td><td style="text-align:right; font-weight:700;">Page 21</td></tr>
          <tr><td><strong>9. Support Roster, Project Directory, &amp; Appendices</strong></td><td style="text-align:right; font-weight:700;">Page 21</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>3</span></div>
    </div>
  </div>

  <!-- PAGE 4: LIST OF FIGURES & TABLES -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>List of Figures &amp; Tables</h1>
      <h2>List of Figures</h2>
      <table>
        <tbody>
          <tr><td>Figure 1: Clinical Referral &amp; Malnutrition Escalation Flowchart</td><td style="text-align:right;">Page 6</td></tr>
          <tr><td>Figure 2: AppScale Offline-to-Cloud Data Synchronization Architecture</td><td style="text-align:right;">Page 6</td></tr>
          <tr><td>Figure 3: Mobile Authentication &amp; Offline Field PIN Access Interface</td><td style="text-align:right;">Page 10</td></tr>
          <tr><td>Figure 4: Child Demographic Profiling &amp; Household Registration Interface</td><td style="text-align:right;">Page 11</td></tr>
          <tr><td>Figure 5: OPT+ Anthropometric Assessment &amp; Auto WHO Z-Score Interface</td><td style="text-align:right;">Page 11</td></tr>
          <tr><td>Figure 6: Immediate Red-Flag SAM Clinical Referral Trigger Interface</td><td style="text-align:right;">Page 12</td></tr>
          <tr><td>Figure 7: 120-Day Supplementary Feeding Program Attendance Interface</td><td style="text-align:right;">Page 12</td></tr>
          <tr><td>Figure 8: Micronutrient Supplementation &amp; Deworming Record Interface</td><td style="text-align:right;">Page 13</td></tr>
          <tr><td>Figure 9: Local Hive Cache to Central Server Synchronization Interface</td><td style="text-align:right;">Page 13</td></tr>
          <tr><td>Figure 10: Barangay Health Worker Web Portal Login Interface</td><td style="text-align:right;">Page 14</td></tr>
          <tr><td>Figure 11: BHW Dashboard &amp; Barangay Nutrition KPI Overview Interface</td><td style="text-align:right;">Page 14</td></tr>
          <tr><td>Figure 12: Child Medical Records, Growth History &amp; BMI Interface</td><td style="text-align:right;">Page 15</td></tr>
          <tr><td>Figure 13: "Need Attention" High-Risk Malnutrition Triage Interface</td><td style="text-align:right;">Page 15</td></tr>
          <tr><td>Figure 14: Barangay Referral Lifecycle &amp; Case Management Interface</td><td style="text-align:right;">Page 16</td></tr>
          <tr><td>Figure 15: Municipal Executive Nutrition Dashboard &amp; Analytics Interface</td><td style="text-align:right;">Page 17</td></tr>
          <tr><td>Figure 16: Healthcare Personnel User Management &amp; Role Provisioning Interface</td><td style="text-align:right;">Page 17</td></tr>
          <tr><td>Figure 17: Municipal Health Activity &amp; Feeding Program Scheduler Interface</td><td style="text-align:right;">Page 18</td></tr>
          <tr><td>Figure 18: System Activity Audit Trail &amp; Data Security Logs Interface</td><td style="text-align:right;">Page 18</td></tr>
          <tr><td>Figure 19: Official Report Signatories &amp; Governance Configuration Interface</td><td style="text-align:right;">Page 19</td></tr>
          <tr><td>Figure 20: Municipal Nutrition Officer Registration &amp; Role Delegation Interface</td><td style="text-align:right;">Page 19</td></tr>
        </tbody>
      </table>

      <h2>List of Tables</h2>
      <table>
        <tbody>
          <tr><td>Table 1: User Roles and Access Privilege Hierarchy Matrix</td><td style="text-align:right;">Page 5</td></tr>
          <tr><td>Table 2: Minimum and Recommended System Hardware/Software Specifications</td><td style="text-align:right;">Page 7</td></tr>
          <tr><td>Table 3: Operational Glossary of Health, Nutrition &amp; Technical Terms</td><td style="text-align:right;">Page 9</td></tr>
          <tr><td>Table 4: World Health Organization (WHO) Child Growth Cut-Off Classification Matrix</td><td style="text-align:right;">Page 12</td></tr>
          <tr><td>Table 5: System Error Codes, Diagnostic Causes, and Actionable Troubleshooting Matrix</td><td style="text-align:right;">Page 20</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>4</span></div>
    </div>
  </div>

  <!-- PAGE 5: 1. SYSTEM OVERVIEW -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>1. System Overview</h1>
      <h2>1.1 Description of the System</h2>
      <p>AppScale is an enterprise-grade, offline-first multi-platform healthcare and nutrition information system specifically engineered for the Municipality of Gasan, Province of Marinduque. Combining a cross-platform Flutter mobile field application with a robust React web management portal and a secure Node.js/PostgreSQL cloud backend, AppScale modernizes community nutrition monitoring, eliminating manual paper ledger backlogs and empowering grassroots healthcare workers with automated clinical decision support.</p>
      
      <h2>1.2 Purpose, Objectives, and Expected Impact</h2>
      <p>The primary objective of AppScale is to radically eliminate child malnutrition and enhance maternal care in grassroots communities through the following pillars:</p>
      <p>• <strong>Automated Clinical Precision:</strong> Replaces error-prone manual paper lookup tables with instant, automated WHO Child Growth Standards z-score computations for Weight-for-Age (WFA), Height-for-Age (HFA), and Weight-for-Length/Height (WFL/H).<br>
      • <strong>Offline-First Field Resiliency:</strong> Enables Barangay Nutrition Scholars (BNS) to conduct complete house-to-house screening and feeding logs in remote rural areas with zero internet connectivity using encrypted local SQLite/Hive caching.<br>
      • <strong>Streamlined Clinical Escalation:</strong> Automatically triggers immediate red-flag referral alerts for Severely Acutely Malnourished (SAM) children, notifying Barangay Health Workers (BHW) and the Rural Health Unit (RHU) for prompt therapeutic intervention.<br>
      • <strong>Automated Institutional Reporting:</strong> Generates official National Nutrition Council (NNC) and Department of Health (DOH) Operation Timbang Plus Form 1A and Form 1B consolidated municipal reports in one click.</p>

      <h2>1.3 Intended User Roles &amp; Hierarchy</h2>
      <p><strong>Table 1: User Roles and Access Privilege Hierarchy Matrix</strong></p>
      <table>
        <thead>
          <tr><th style="width:22%">User Role</th><th style="width:20%">Primary Platform</th><th style="width:22%">Target Personnel</th><th>Authorized Core Capabilities</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Barangay Nutrition Scholar (BNS)</strong></td><td>Android Mobile App (Flutter)</td><td>Assigned Barangay Field Nutritionist</td><td>Offline child profiling, OPT+ anthropometrics, automated WHO z-scores, 120-day feeding tracking, SAM referrals, and Hive-to-Cloud sync.</td></tr>
          <tr><td><strong>Barangay Health Worker (BHW)</strong></td><td>Barangay Web Portal (React)</td><td>Health Center Staff / Midwife</td><td>Barangay dashboard monitoring, child medical histories, "Need Attention" high-risk triage, referral case management, and RHU clinic coordination.</td></tr>
          <tr><td><strong>Municipal Health Administrator (Admin)</strong></td><td>Central Web Portal (React)</td><td>MHO, MNAO, Municipal Supervisors</td><td>Executive cross-barangay analytics, user account provisioning, DOH/NNC Form 1A/1B export, schedule planning, audit logs, and signatories setup.</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>5</span></div>
    </div>
  </div>

  <!-- PAGE 6: 1.4 FLOWCHART & 1.5 ARCHITECTURE -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h2>1.4 Clinical Referral &amp; Malnutrition Escalation Protocol</h2>
      <p>When a child undergoes screening, the embedded algorithm classifies anthropometric indices against WHO standards. Any diagnosis of Severe Acute Malnutrition (SAM) or bilateral edema immediately activates the automated clinical escalation protocol.</p>
      
      <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:8px; padding:12px; margin:10px 0; font-size:8.5pt;">
        <div style="display:flex; justify-content:space-between; align-items:center; text-align:center;">
          <div style="background:#e2e8f0; padding:8px 12px; border-radius:6px; font-weight:700;">1. BNS Field Screening<br><span style="font-weight:normal; font-size:7.5pt;">OPT+ Height &amp; Weight</span></div>
          <div>➔</div>
          <div style="background:#e2e8f0; padding:8px 12px; border-radius:6px; font-weight:700;">2. WHO Calculation<br><span style="font-weight:normal; font-size:7.5pt;">Auto Z-Score Engine</span></div>
          <div>➔</div>
          <div style="background:#fee2e2; border:1px solid #ef4444; padding:8px 12px; border-radius:6px; font-weight:700; color:#b91c1c;">3. Red-Flag SAM<br><span style="font-weight:normal; font-size:7.5pt;">WFL/H &lt; -3 SD / Edema</span></div>
          <div>➔</div>
          <div style="background:#dcfce7; border:1px solid #22c55e; padding:8px 12px; border-radius:6px; font-weight:700; color:#15803d;">4. RHU Clinic Care<br><span style="font-weight:normal; font-size:7.5pt;">RUTF / Doctor Eval</span></div>
        </div>
      </div>
      <div class="figure-caption" style="text-align:center;">Figure 1: Clinical Referral &amp; Malnutrition Escalation Flowchart</div>

      <h2>1.5 Offline-to-Cloud Data Synchronization Architecture</h2>
      <p>AppScale utilizes an advanced offline-first architecture powered by Flutter and the Hive encrypted local key-value store. Field workers capture hundreds of household assessments without internet. When connectivity is re-established, the sync engine transmits compressed JSON payloads via REST APIs with JWT bearer authentication, resolving UUID collisions and guaranteeing zero data loss.</p>
      
      <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:8px; padding:12px; margin:10px 0; font-size:8.5pt;">
        <div style="display:flex; justify-content:space-around; align-items:center; text-align:center;">
          <div style="background:#f1f5f9; padding:8px 14px; border-radius:6px; border:1px solid #94a3b8;"><strong>Mobile App (Flutter)</strong><br><span style="font-size:7.5pt; color:#64748b;">Hive Cache (Local Offline)</span></div>
          <div style="color:#1b5e20; font-weight:700;">⇄ REST API / HTTPS ⇄</div>
          <div style="background:#f1f5f9; padding:8px 14px; border-radius:6px; border:1px solid #94a3b8;"><strong>Node.js Backend</strong><br><span style="font-size:7.5pt; color:#64748b;">PostgreSQL Database</span></div>
          <div style="color:#1b5e20; font-weight:700;">⇄ Cloud State ⇄</div>
          <div style="background:#f1f5f9; padding:8px 14px; border-radius:6px; border:1px solid #94a3b8;"><strong>Web Portals (React)</strong><br><span style="font-size:7.5pt; color:#64748b;">Admin &amp; BHW Clients</span></div>
        </div>
      </div>
      <div class="figure-caption" style="text-align:center;">Figure 2: AppScale Offline-to-Cloud Data Synchronization Architecture</div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>6</span></div>
    </div>
  </div>

  <!-- PAGE 7: 2. SYSTEM REQUIREMENTS & ACCESS -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>2. System Requirements &amp; Operational Access</h1>
      <h2>2.1 Hardware, Software, and Network Specifications</h2>
      <p><strong>Table 2: Minimum and Recommended System Hardware/Software Specifications</strong></p>
      <table>
        <thead>
          <tr><th style="width:25%">Component</th><th style="width:37%">Mobile Field App (BNS)</th><th>Web Portals (BHW &amp; Admin)</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Operating System</strong></td><td>Android 8.0 (Oreo) or higher (Android 11+ recommended)</td><td>Windows 10/11, macOS Monterey+, or Ubuntu 20.04+</td></tr>
          <tr><td><strong>Processor / RAM</strong></td><td>Quad-Core 1.8 GHz CPU, 2 GB RAM (3 GB+ recommended)</td><td>Intel Core i3 / AMD Ryzen 3, 4 GB RAM (8 GB recommended)</td></tr>
          <tr><td><strong>Storage Space</strong></td><td>150 MB free internal flash storage for Hive local cache</td><td>500 MB free disk space for browser caching and PDF exports</td></tr>
          <tr><td><strong>Network / Display</strong></td><td>Offline-capable; 3G/4G/Wi-Fi needed only for sync; 720x1280 screen</td><td>Stable broadband (1 Mbps+); 1366x768 screen (1080p recommended)</td></tr>
        </tbody>
      </table>

      <h2>2.2 Access URLs, Mobile APK, and Cloud Deployment</h2>
      <p>• <strong>Official Central Web Management Portal:</strong> <a href="https://appscale-two.vercel.app/admin" style="color:#1b5e20; text-decoration:none;">https://appscale-two.vercel.app/admin</a><br>
      • <strong>Official Barangay Health Worker (BHW) Portal:</strong> <a href="https://appscale-two.vercel.app/bhw" style="color:#1b5e20; text-decoration:none;">https://appscale-two.vercel.app/bhw</a><br>
      • <strong>Mobile Android Field APK Package:</strong> AppScale-Field-v3.0.apk (Distributed via Municipal Health IT)</p>

      <h2>2.3 User Account Provisioning &amp; Password Security</h2>
      <p>All BNS and BHW accounts are strictly created and provisioned by the Municipal Health Administrator. Passwords must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special symbol. Passwords expire periodically to uphold health data compliance.</p>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>7</span></div>
    </div>
  </div>

  <!-- PAGE 8: 3. GETTING STARTED & AUTHENTICATION -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>3. Getting Started &amp; User Authentication</h1>
      <h2>3.1 Web &amp; Mobile Portal Authentication</h2>
      <p>Users sign in to their respective portals using their municipal email and assigned password. Upon successful verification, the backend issues an industry-standard JSON Web Token (JWT) with encrypted role claims. Sessions remain active for 8 hours on desktop workstations and persist securely in local encrypted storage on mobile field devices.</p>

      <h2>3.2 Password Reset &amp; 6-Digit OTP Verification Flow</h2>
      <p>In the event of forgotten credentials, health personnel can trigger the self-service password recovery protocol:</p>
      <ol style="margin:4px 0 8px 0; padding-left:20px;">
        <li>Click "Forgot password" on the web login screen.</li>
        <li>Enter your registered health worker email address and click "Send OTP".</li>
        <li>Retrieve the 6-digit one-time verification code delivered to your registered email inbox via secure SMTP.</li>
        <li>Input the OTP and establish a new compliant password to instantly restore system access.</li>
      </ol>

      <h2>3.3 Multi-Platform Navigation &amp; UI Layout</h2>
      <p>The system interface is standardized with intuitive green-and-white theme accents, collapsible navigation drawers, breadcrumbs, and prominent action buttons ensuring optimal ergonomics during busy clinic hours and field visits.</p>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>8</span></div>
    </div>
  </div>

  <!-- PAGE 9: 4. GLOSSARY OF TERMS -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>4. Operational Glossary of Health &amp; Technical Terms</h1>
      <p><strong>Table 3: Operational Glossary of Health, Nutrition &amp; Technical Terms</strong></p>
      <table>
        <thead>
          <tr><th style="width:20%">Term / Acronym</th><th style="width:18%">Domain</th><th>Operational Definition &amp; Context within AppScale</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>BNS</strong></td><td>Health Personnel</td><td>Barangay Nutrition Scholar: Grassroots worker tasked with household profiling, OPT+ screening, and feeding programs.</td></tr>
          <tr><td><strong>BHW</strong></td><td>Health Personnel</td><td>Barangay Health Worker: Health center staff managing medical records, high-risk triage, and referral coordination.</td></tr>
          <tr><td><strong>OPT+</strong></td><td>DOH Protocol</td><td>Operation Timbang Plus: National annual mass weighing and height measurement of children aged 0–59 months.</td></tr>
          <tr><td><strong>SAM</strong></td><td>Clinical Diagnosis</td><td>Severe Acute Malnutrition: Life-threatening condition (WFL/H &lt; -3 SD or Edema) requiring urgent clinical referral.</td></tr>
          <tr><td><strong>MAM</strong></td><td>Clinical Diagnosis</td><td>Moderate Acute Malnutrition: WFL/H between -3 SD and -2 SD; prioritized for 120-day supplementary feeding.</td></tr>
          <tr><td><strong>WFA / HFA / WFL/H</strong></td><td>WHO Indices</td><td>Weight-for-Age (Underweight), Height-for-Age (Stunting), and Weight-for-Length/Height (Wasting/Thinness).</td></tr>
          <tr><td><strong>Hive / SQLite</strong></td><td>Technical System</td><td>Embedded, lightweight encrypted mobile databases enabling complete offline data entry and storage.</td></tr>
          <tr><td><strong>RHU / MNAO</strong></td><td>Governance</td><td>Rural Health Unit and Municipal Nutrition Action Officer governing health policies in Gasan.</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>9</span></div>
    </div>
  </div>

  <!-- PAGE 10: 5.1 BNS INSTRUCTIONS (Feature 5.1.1) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>5. Step-by-Step User Instructions</h1>
      <p>This chapter serves as the definitive, comprehensive operational manual for each major feature of the AppScale platform. For every feature, the user is provided with its Purpose, numbered step-by-step Procedure, official Screenshot with Figure Label, and the Expected Result.</p>
      
      <h2>5.1 Role 1: Barangay Nutrition Scholar (BNS) — Field Mobile Application</h2>
      
      <div class="feature-block">
        <h3>5.1.1 Feature Name: Mobile Authentication &amp; Offline Field PIN Access</h3>
        <p><span class="feature-label">• Purpose:</span> Allows the BNS to securely log in to the AppScale mobile application on field devices, establish local encrypted credentials, and enable Quick-PIN offline authentication during field screening.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Launch the AppScale Field Mobile Application from your Android home screen or app launcher.</li>
          <li>Enter your assigned municipal email address (e.g., <code>bns.cabugao@gasan.gov.ph</code>) and password.</li>
          <li>Check the "Keep logged in offline" checkbox to cache your encrypted credentials locally in Hive storage.</li>
          <li>Optionally set up a 6-digit Quick-PIN for instant re-authentication during field visits.</li>
          <li>Tap the green <strong>"AUTHENTICATE &amp; LOAD HIVE CACHE"</strong> button.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsLogin}" style="max-height: 250px;" alt="BNS Login">
          <div class="figure-caption">Figure 3: Mobile Authentication &amp; Offline Field PIN Access Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The app validates credentials, initializes the local encrypted Hive database, loads assigned barangay records, and navigates directly to the BNS Field Home Dashboard.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>10</span></div>
    </div>
  </div>

  <!-- PAGE 11: BNS INSTRUCTIONS (Features 5.1.2 & 5.1.3) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.1.2 Feature Name: Child Demographic Profiling &amp; Household Registration</h3>
        <p><span class="feature-label">• Purpose:</span> Registers new child beneficiaries (0 to 59 months) into the official barangay masterlist, capturing demographic, residential, and 4Ps socioeconomic data.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>From the BNS Field Home Screen, tap the <strong>"+ New Child Registration"</strong> floating action button.</li>
          <li>Input the child's complete legal name: First Name, Middle Name, and Last Name.</li>
          <li>Select biological sex (Male or Female) using the radio selector.</li>
          <li>Tap the Date of Birth field and select birthdate from calendar picker (age in months is auto-calculated).</li>
          <li>Specify the residential Barangay and Sitio / Purok address.</li>
          <li>Enter the primary Mother / Guardian full legal name and mobile contact number.</li>
          <li>Toggle the "4Ps Beneficiary Household" switch to YES or NO.</li>
          <li>Tap the green <strong>"SAVE PROFILE TO LOCAL HIVE"</strong> button.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsAddChild}" style="max-height: 230px;" alt="Add Child">
          <div class="figure-caption">Figure 4: Child Demographic Profiling &amp; Household Registration Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>A success confirmation banner appears, the child beneficiary is permanently recorded in local Hive storage, and their profile is instantly queued for Operation Timbang Plus screening.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.1.3 Feature Name: OPT+ Anthropometric Assessment &amp; Auto Z-Scores</h3>
        <p><span class="feature-label">• Purpose:</span> Captures physical weight and height measurements during mass OPT+ campaigns, automatically computing WHO Child Growth Standards z-scores and nutritional statuses.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Select the child beneficiary profile from your local masterlist and tap "New OPT+ Assessment".</li>
          <li>Weigh the child on a calibrated scale and enter Weight in kg to two decimal places (e.g., <code>8.90 kg</code>).</li>
          <li>Measure Length or Height with an approved stadiometer, and enter Height in cm (e.g., <code>79.5 cm</code>).</li>
          <li>Select measurement position (Lying Down / Recumbent or Standing Height).</li>
          <li>Examine both feet for fluid swelling and select Bilateral Pitting Edema (Present or Absent).</li>
          <li>Review automatically computed WHO Child Growth Z-Scores (WFA, HFA, WFL/H) displayed in real-time.</li>
          <li>Tap <strong>"SAVE &amp; TRIGGER CLINICAL REFERRAL"</strong> or <strong>"SAVE MEASUREMENT RECORD"</strong>.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsAssessment}" style="max-height: 230px;" alt="Assessment">
          <div class="figure-caption">Figure 5: OPT+ Anthropometric Assessment &amp; Auto WHO Z-Score Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The system assigns official DOH color-coded classifications (Normal [Green], Underweight/Stunted [Orange], SAM [Red]), saves the measurement record in local storage, and prompts for immediate referral if acute malnutrition is detected.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>11</span></div>
    </div>
  </div>

  <!-- PAGE 12: WHO MATRIX & BNS INSTRUCTIONS (Features 5.1.4 & 5.1.5) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <p><strong>Table 4: World Health Organization (WHO) Child Growth Cut-Off Classification Matrix</strong></p>
      <table>
        <thead>
          <tr><th style="width:25%">Nutritional Index</th><th style="width:25%">Z-Score Cut-Off</th><th style="width:25%">Official Classification</th><th>Mandatory Health Action</th></tr>
        </thead>
        <tbody>
          <tr><td>Weight-for-Age (WFA)</td><td>&lt; -3 SD<br>-3 SD to &lt; -2 SD<br>-2 SD to +1 SD</td><td>Severely Underweight (SUW)<br>Underweight (UW)<br>Normal</td><td>Nutrition counseling, high-calorie meal plan, and monthly weighing follow-up.</td></tr>
          <tr><td>Height-for-Age (HFA)</td><td>&lt; -3 SD<br>-3 SD to &lt; -2 SD<br>-2 SD to +3 SD</td><td>Severely Stunted (SSt)<br>Stunted (St)<br>Normal</td><td>Chronic stunting intervention, micronutrient supplementation, and dietary diversity education.</td></tr>
          <tr><td>Weight-for-Length/Height (WFL/H)</td><td>&lt; -3 SD or Edema<br>-3 SD to &lt; -2 SD<br>-2 SD to +2 SD</td><td>Severely Wasted (SAM)<br>Moderately Wasted (MAM)<br>Normal</td><td>SAM: Immediate clinical referral to RHU &amp; RUTF therapy. MAM: 120-day feeding program enrollment.</td></tr>
        </tbody>
      </table>

      <div class="feature-block">
        <h3>5.1.4 Feature Name: Immediate Red-Flag SAM Clinical Referral Trigger</h3>
        <p><span class="feature-label">• Purpose:</span> Automatically initiates an urgent clinical referral notification to the Barangay Health Center and RHU Gasan whenever severe acute malnutrition (SAM) or bilateral pitting edema is identified.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>When an assessment evaluates WFL/H below -3 SD or edema is marked Present, the red alert activates.</li>
          <li>Confirm Severity Level pre-selected as "HIGH SEVERITY (SAM CLINICAL)".</li>
          <li>Verify Receiving Health Facility defaulted to "Gasan Rural Health Unit (RHU Clinic)".</li>
          <li>Enter clinical remarks, observed symptoms, appetite test findings, and family background.</li>
          <li>Select the assigned BHW case manager and tap the red <strong>"SUBMIT EMERGENCY REFERRAL TO BHW"</strong> button.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsReferral}" style="max-height: 220px;" alt="Referral">
          <div class="figure-caption">Figure 6: Immediate Red-Flag SAM Clinical Referral Trigger Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>An emergency referral record is immediately generated, flagged with highest priority, and queued for real-time notification on the BHW Barangay Web Portal upon sync.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.1.5 Feature Name: 120-Day Supplementary Feeding Program (SFP) Attendance</h3>
        <p><span class="feature-label">• Purpose:</span> Records daily meal attendance, dietary intake, and ration collection for targeted undernourished children enrolled in the standard 120-day supplementary feeding cycle.</p>
        <div class="figure-box">
          <img src="${imgs.bnsFeeding}" style="max-height: 200px;" alt="Feeding">
          <div class="figure-caption">Figure 7: 120-Day Supplementary Feeding Program Attendance Interface</div>
        </div>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>12</span></div>
    </div>
  </div>

  <!-- PAGE 13: BNS INSTRUCTIONS (Features 5.1.6 & 5.1.7) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.1.6 Feature Name: Micronutrient Supplementation &amp; Deworming Health Entry</h3>
        <p><span class="feature-label">• Purpose:</span> Documents the administration of high-dose Vitamin A capsules and Deworming chemotherapy (Albendazole) under national Garantisadong Pambata campaigns.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Open the child beneficiary's profile and select the "Programs &amp; Interventions" tab.</li>
          <li>Tap "Record Micronutrient Dose".</li>
          <li>Select the supplement: Vitamin A (Blue Capsule 100,000 IU or Red Capsule 200,000 IU).</li>
          <li>Select the campaign round (e.g., Garantisadong Pambata Round 2 - 2026).</li>
          <li>Check Deworming Dose (Albendazole 400mg) status for children >= 12 months.</li>
          <li>Enter pharmaceutical batch and lot tracking number and tap <strong>"RECORD TO MEDICAL PROFILE"</strong>.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsMicronutrient}" style="max-height: 230px;" alt="Micronutrient">
          <div class="figure-caption">Figure 8: Micronutrient Supplementation &amp; Deworming Record Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The health intervention is permanently logged to the patient's health card, and the next semi-annual due date is automatically scheduled.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.1.7 Feature Name: Local Hive Cache to Central Server Synchronization (One-Tap Sync)</h3>
        <p><span class="feature-label">• Purpose:</span> Synchronizes all offline screening records, anthropometric assessments, and feeding logs cached in mobile Hive storage to the central AppScale PostgreSQL database.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Verify that the mobile device has acquired an active Wi-Fi or cellular mobile data connection.</li>
          <li>Tap the "Cloud Sync" icon on the top navigation bar or select "Offline Sync Status" from the drawer.</li>
          <li>Inspect pending synchronization queue (e.g., 6 Assessments, 45 Feeding Records, 1 Emergency Referral).</li>
          <li>Tap the prominent button <strong>"SYNC ALL RECORDS NOW"</strong>.</li>
          <li>Maintain connectivity while progress bar uploads encrypted data chunks to the central API.</li>
          <li>Verify the appearance of the green "INTERNET CONNECTED" checkmark and confirmation message.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bnsSync}" style="max-height: 230px;" alt="Sync">
          <div class="figure-caption">Figure 9: Local Hive Cache to Central Server Synchronization Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>All local records are merged into the central database with timestamps preserved, UUID collisions are resolved, and the local pending queue count resets to 0.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>13</span></div>
    </div>
  </div>

  <!-- PAGE 14: 5.2 BHW INSTRUCTIONS (Features 5.2.1 & 5.2.2) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h2>5.2 Role 2: Barangay Health Worker (BHW) — Barangay Web Portal</h2>
      <p>The BHW web portal enables health center staff to review demographic masterlists, monitor community nutrition statuses, triage high-risk malnutrition, and manage clinical referrals.</p>

      <div class="feature-block">
        <h3>5.2.1 Feature Name: BHW Web Portal Login &amp; Password Recovery</h3>
        <p><span class="feature-label">• Purpose:</span> Provides secure, authenticated web access for Barangay Health Workers to manage health records, monitor community malnutrition, and process clinical referrals.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Open Google Chrome or Mozilla Firefox and navigate to: <code>https://appscale-two.vercel.app/login</code>.</li>
          <li>Enter your authorized BHW email address (e.g., <code>baylonmark194@gmail.com</code>) and password.</li>
          <li>Check "Remember me" on health center workstations to maintain active credentials.</li>
          <li>If forgotten, click "Forgot Password?", enter email, and use the 6-digit OTP code sent via SMTP.</li>
          <li>Click the green <strong>"Sign in"</strong> button.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bhwLogin}" style="max-width: 90%; max-height: 200px;" alt="BHW Login">
          <div class="figure-caption">Figure 10: Barangay Health Worker Web Portal Login Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The backend verifies credentials, issues a JWT token with BHW claims, and redirects the user directly to the Barangay Health Worker Dashboard.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.2.2 Feature Name: Barangay Health Worker Dashboard Overview</h3>
        <p><span class="feature-label">• Purpose:</span> Displays comprehensive real-time community nutrition metrics, active case tallies, upcoming clinic schedules, and monthly health monitoring trends for the assigned barangay.</p>
        <div class="figure-box">
          <img src="${imgs.bhwDashboard}" style="max-width: 90%; max-height: 200px;" alt="BHW Dashboard">
          <div class="figure-caption">Figure 11: BHW Dashboard &amp; Barangay Nutrition KPI Overview Interface</div>
        </div>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>14</span></div>
    </div>
  </div>

  <!-- PAGE 15: BHW INSTRUCTIONS (Features 5.2.3 & 5.2.4) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.2.3 Feature Name: Child Health Masterlist &amp; Medical Growth Monitoring</h3>
        <p><span class="feature-label">• Purpose:</span> Enables detailed examination of registered children's historical health dossiers, longitudinal BMI calculations, and dispensing of clinical medications.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click "Medical Records" in the left sidebar navigation menu.</li>
          <li>Use the real-time search field to filter records by child or guardian name (e.g., <code>Carlo Santos</code>).</li>
          <li>Filter by nutritional status (All Statuses, Normal, Underweight, Stunted, SAM) or Age Groups.</li>
          <li>Click on a child's record card in the directory list to load their full dossier in the right pane.</li>
          <li>Review the "Growth History &amp; BMI" tab showing dates, ages, weights, heights, computed BMI, and WHO status.</li>
          <li>Click <strong>"+ Record Medication / Intervention"</strong> to log dispensed vitamins or clinical treatments.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bhwMedicalRecords}" style="max-width: 90%; max-height: 220px;" alt="Medical Records">
          <div class="figure-caption">Figure 12: Child Medical Records, Growth History &amp; BMI Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The patient's longitudinal growth history is displayed with tabular precision, enabling the health worker to detect growth faltering and initiate prompt interventions.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.2.4 Feature Name: "Need Attention" High-Risk Malnutrition Triage Filter</h3>
        <p><span class="feature-label">• Purpose:</span> Isolates severely and moderately malnourished children and overdue health checkups into an urgent triage queue for prioritized home visits and feeding program enrollment.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click the "Need Attention" tab in the left sidebar navigation menu.</li>
          <li>Review triage KPI cards: Total At-Risk, Severe (SAM), Moderate (MAM), and Overdue (>30D).</li>
          <li>Examine prioritized beneficiary queue displaying child name, guardian, age, measurements, and diagnosis.</li>
          <li>Click "Log Visit" to document a clinical home visit or parental counseling session.</li>
          <li>Click "Refer" to escalate the child's case directly to the Rural Health Unit or Municipal Doctor.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bhwNeedAttention}" style="max-width: 90%; max-height: 220px;" alt="Need Attention">
          <div class="figure-caption">Figure 13: "Need Attention" High-Risk Malnutrition Triage Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>Health center staff quickly prioritize the most vulnerable children, preventing dropouts and ensuring timely clinical care.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>15</span></div>
    </div>
  </div>

  <!-- PAGE 16: BHW INSTRUCTIONS (Feature 5.2.5) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.2.5 Feature Name: Multi-Stage Referral Management &amp; Case Status Escalation</h3>
        <p><span class="feature-label">• Purpose:</span> Tracks the full lifecycle of clinical referrals forwarded by BNS field workers, coordinating patient transfers, clinical feedback, and rehabilitation tracking.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click "Referrals" in the left sidebar navigation menu.</li>
          <li>Switch between status tabs: All Referrals, Pending (awaiting action), Received (acknowledged by clinic), Ongoing (under treatment), Completed (rehabilitated), or Archived.</li>
          <li>Filter by beneficiary type (Child or Lactating Mother) or search by patient name.</li>
          <li>Locate a specific referral card (e.g., <code>Elai Habal - Bilateral Pitting Edema, HIGH SEVERITY</code>).</li>
          <li>Click the green <strong>"Update Status"</strong> button on the referral card.</li>
          <li>Update status dropdown, document clinical notes or treatments administered, select receiving facility, and save.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.bhwReferrals}" style="max-width: 90%; max-height: 250px;" alt="Referrals">
          <div class="figure-caption">Figure 14: Barangay Referral Lifecycle &amp; Case Management Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The referral status updates in real-time across both web and mobile platforms, maintaining complete transparency between community workers and RHU clinicians.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>16</span></div>
    </div>
  </div>

  <!-- PAGE 17: 5.3 ADMIN INSTRUCTIONS (Features 5.3.1 & 5.3.2) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h2>5.3 Role 3: Municipal Health Administrator (MHO / Admin) — Central Web Portal</h2>
      <p>The Central Web Portal provides the Municipal Health Officer (MHO) and Municipal Nutrition Action Officer (MNAO) with high-level epidemiological analytics, staff provisioning, reporting tools, and audit logs.</p>

      <div class="feature-block">
        <h3>5.3.1 Feature Name: Municipal Nutrition Executive Dashboard &amp; Cross-Barangay Analytics</h3>
        <p><span class="feature-label">• Purpose:</span> Provides municipal executives with comprehensive real-time nutrition epidemiology, prevalence metrics, and cross-barangay comparative analytics across Gasan.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Sign in to Central Web Portal with admin credentials at: <code>https://appscale-two.vercel.app/login</code>.</li>
          <li>Click "Dashboard" in the municipal admin navigation menu.</li>
          <li>Examine municipal-wide KPI cards: Total Health Workers, Registered Children, Registered Mothers, and Monitored Barangays.</li>
          <li>Analyze "Municipal Nutrition Breakdown" progress bars showing exact percentage distributions for Normal, Underweight, SUW, Stunted, and Wasted.</li>
          <li>Inspect "Malnutrition Cases by Barangay" comparative bar chart with timeframe filters (3M, 6M, 1Y).</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.adminDashboard}" style="max-width: 90%; max-height: 200px;" alt="Admin Dashboard">
          <div class="figure-caption">Figure 15: Municipal Executive Nutrition Dashboard &amp; Analytics Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>Municipal executives obtain clear epidemiological evidence to strategically target nutrition budgets, supplementary food rations, and medical resources.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.3.2 Feature Name: Healthcare Personnel User Management &amp; Role Provisioning</h3>
        <p><span class="feature-label">• Purpose:</span> Allows administrators to create, verify, manage, lock, and archive user accounts for all Barangay Nutrition Scholars (BNS) and Barangay Health Workers (BHW).</p>
        <div class="figure-box">
          <img src="${imgs.adminUsers}" style="max-width: 90%; max-height: 200px;" alt="Admin Users">
          <div class="figure-caption">Figure 16: Healthcare Personnel User Management &amp; Role Provisioning Interface</div>
        </div>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>17</span></div>
    </div>
  </div>

  <!-- PAGE 18: ADMIN INSTRUCTIONS (Features 5.3.3 & 5.3.4) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.3.3 Feature Name: Municipal Health Activity &amp; Supplementary Feeding Scheduler</h3>
        <p><span class="feature-label">• Purpose:</span> Plans, schedules, and publishes municipal-wide health campaigns, including Operation Timbang schedules, immunization rounds, and 120-day feeding program milestones.</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click "Schedule" in the sidebar navigation menu.</li>
          <li>Review activity statistics cards: Total Activities, Upcoming, Completed, and Archived.</li>
          <li>Click <strong>"+ Add Activity"</strong> to schedule a new health or nutrition event.</li>
          <li>Enter Event Title, select Category (Feeding, Weighing / OPT+, Immunization), select Venue, and target Date/Time.</li>
          <li>Select target barangays (All Barangays or specific barangays) and assigned personnel roles.</li>
          <li>Click <strong>"Save Activity"</strong>.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.adminSchedule}" style="max-width: 90%; max-height: 220px;" alt="Admin Schedule">
          <div class="figure-caption">Figure 17: Municipal Health Activity &amp; Feeding Program Scheduler Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>The event is published to the central municipal calendar, synchronizing automatically to the mobile calendars of assigned BNS workers.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.3.4 Feature Name: System Activity Audit Trail &amp; Data Security Logs</h3>
        <p><span class="feature-label">• Purpose:</span> Maintains an immutable, timestamped audit log of all system activities, data changes, and clinical referrals in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click "System Logs" in the sidebar navigation menu.</li>
          <li>Use the search bar to filter logs by specific keywords, patient ID, or worker name.</li>
          <li>Filter logs by Barangay and Role (BNS only, BHW only, All Roles).</li>
          <li>Inspect chronological log table: Timestamp, Barangay, Worker, Role, Action, Entity ID, and Summary.</li>
          <li>Click the green <strong>"Inspect"</strong> button on any record to view raw JSON diff and payload metadata.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.adminLogs}" style="max-width: 90%; max-height: 220px;" alt="Admin Logs">
          <div class="figure-caption">Figure 18: System Activity Audit Trail &amp; Data Security Logs Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>Administrators verify data integrity, trace user actions for forensic auditing, and ensure patient health records remain secure.</em></p>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>18</span></div>
    </div>
  </div>

  <!-- PAGE 19: ADMIN INSTRUCTIONS (Features 5.3.5 & 5.3.6) -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <div class="feature-block">
        <h3>5.3.5 Feature Name: Official Report Signatories &amp; Governance Configuration</h3>
        <p><span class="feature-label">• Purpose:</span> Configures authorized municipal and barangay certifying signatories appearing on generated DOH/NNC Operation Timbang Plus summary reports (Form 1A and Form 1B).</p>
        <p class="feature-label">• Procedure (Step-by-Step Instructions):</p>
        <ol class="procedure-list">
          <li>Click "Signatories" in the sidebar navigation menu.</li>
          <li>Select configuration scope using the Barangay dropdown (All Barangays or individual barangays).</li>
          <li>In Position Slot 1, specify title (e.g., Municipal Nutrition Action Officer) and full name of officer.</li>
          <li>In Position Slot 2, specify medical director title (e.g., Municipal Health Officer) and physician name.</li>
          <li>In Position Slot 3, specify barangay representative title (e.g., Barangay Nutrition Scholar) and name.</li>
          <li>Click <strong>"+ Add Signatory"</strong> to append additional certifying officials if required.</li>
          <li>Click the green <strong>"Save Changes"</strong> button.</li>
        </ol>
        <div class="figure-box">
          <img src="${imgs.adminSignatories}" style="max-width: 90%; max-height: 220px;" alt="Signatories">
          <div class="figure-caption">Figure 19: Official Report Signatories &amp; Governance Configuration Interface</div>
        </div>
        <p><span class="feature-label">• Expected Result:</span> <em>Official signatures and titles are embedded into the footer certification blocks of exported DOH/NNC PDF and Excel reports.</em></p>
      </div>

      <div class="feature-block">
        <h3>5.3.6 Feature Name: Municipal Nutrition Officer Registration &amp; Role Delegation</h3>
        <p><span class="feature-label">• Purpose:</span> Allows authorized municipal health supervisors to register new administrative accounts with elevated credentials.</p>
        <div class="figure-box">
          <img src="${imgs.adminRegister}" style="max-width: 90%; max-height: 220px;" alt="Admin Register">
          <div class="figure-caption">Figure 20: Municipal Nutrition Officer Registration &amp; Role Delegation Interface</div>
        </div>
      </div>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>19</span></div>
    </div>
  </div>

  <!-- PAGE 20: 6. ERROR HANDLING & 7. FAQ -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>6. System Error Handling &amp; Troubleshooting Matrix</h1>
      <p><strong>Table 5: System Error Codes, Diagnostic Causes, and Actionable Troubleshooting Matrix</strong></p>
      <table>
        <thead>
          <tr><th style="width:25%">Error Code / Alert</th><th style="width:35%">Probable Technical Cause</th><th>Actionable User Resolution &amp; Remedy</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>ERR_AUTH_EXPIRED (401)</strong></td><td>JWT session token has expired after 8 hours of inactivity.</td><td>Log out and log back in with your authorized email and password to refresh the security token.</td></tr>
          <tr><td><strong>ERR_SYNC_NETWORK_TIMEOUT</strong></td><td>Weak or dropped cellular connection during mobile cloud sync.</td><td>Records remain safely cached in Hive storage. Move to an area with reliable signal and tap Sync again.</td></tr>
          <tr><td><strong>ERR_WHO_INVALID_RANGE</strong></td><td>Entered weight or height falls outside biological feasibility (e.g., 90 kg for 2-year-old).</td><td>Re-calibrate scale and stadiometer, re-measure child, and verify correct decimal placement.</td></tr>
          <tr><td><strong>ERR_DUPLICATE_BENEFICIARY</strong></td><td>Child with identical name and birthdate already registered in the barangay.</td><td>Search masterlist first. If updating records, open existing profile rather than creating a new entry.</td></tr>
          <tr><td><strong>ERR_SMTP_OTP_FAILED</strong></td><td>SMTP email relay failure during password recovery code dispatch.</td><td>Check spam folder, verify registered email address, or contact Municipal Health Admin for manual reset.</td></tr>
        </tbody>
      </table>

      <h1>7. Frequently Asked Questions (FAQ)</h1>
      <p><strong>Q: Can I use the mobile application in remote sitios with zero mobile reception?</strong><br>
      A: Yes! AppScale is built offline-first. All demographic entries, anthropometric measurements, and feeding logs are stored locally in Hive storage and will synchronize automatically when internet connectivity is restored.</p>
      
      <p><strong>Q: How are WHO Z-scores calculated? Does the BNS need manual lookup charts?</strong><br>
      A: No manual lookup is required. AppScale embeds the exact World Health Organization Child Growth Standards LMS parameters. The system automatically computes WFA, HFA, and WFL/H z-scores in milliseconds upon entering weight and height.</p>

      <p><strong>Q: Who can export the official DOH / NNC Form 1A and Form 1B reports?</strong><br>
      A: Only authorized Municipal Health Administrators (MHO and MNAO) have permissions to generate and export official consolidated municipal reports with embedded legal signatories.</p>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>20</span></div>
    </div>
  </div>

  <!-- PAGE 21: 8. SECURITY & 9. SUPPORT ROSTER -->
  <div class="page">
    <div class="header-banner"><img src="${headerB64}" alt="Header"></div>
    <div class="content">
      <h1>8. Security, Data Privacy (RA 10173), &amp; Ethical Guidelines</h1>
      <p>In strict compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), AppScale enforces rigorous security safeguards to protect sensitive pediatric health records and maternal demographic data:</p>
      <p>• <strong>Data Encryption in Transit &amp; Rest:</strong> All network transmissions use Transport Layer Security (TLS 1.3/HTTPS). Local databases on field tablets are encrypted using AES-256.<br>
      • <strong>Strict Role-Based Scoping:</strong> BNS and BHW workers have access strictly limited to their assigned barangay jurisdiction, preventing unauthorized cross-barangay data access.<br>
      • <strong>Mandatory Tamper-Evident Audit Logging:</strong> Every clinical modification, assessment record, and user access is permanently recorded in the system audit trail.</p>

      <h1>9. Support Roster, Project Directory, &amp; Appendices</h1>
      <p>For technical assistance, system onboarding, bug reports, or administrative credentials, contact the AppScale Capstone Development Team or the Municipal Health Office:</p>
      
      <p><strong>• Capstone Development Team (Group 3):</strong><br>
      &nbsp;&nbsp;- <strong>Jana Rose P. Rolle</strong> (Project Lead / Health Systems Coordinator)<br>
      &nbsp;&nbsp;- <strong>Mark Joseph J. Baylon</strong> (Mobile Application Developer &amp; Flutter Engineer)<br>
      &nbsp;&nbsp;- <strong>Christopher C. Aranas</strong> (Backend &amp; Database Architecture Engineer)<br>
      &nbsp;&nbsp;- <strong>John Lloyd S. Tesio</strong> (Full-Stack Web Portal Developer &amp; QA Lead)</p>

      <p><strong>• Institutional Partner &amp; Health Authority:</strong><br>
      &nbsp;&nbsp;- Rural Health Unit (RHU) &amp; Municipal Health Office (MHO), Municipality of Gasan, Marinduque<br>
      &nbsp;&nbsp;- College of Information and Computing Sciences (CICS), Marinduque State University, Boac, Marinduque</p>

      <p><strong>• Technical Support Helpline &amp; Email:</strong><br>
      &nbsp;&nbsp;- Email: <code>support.appscale@gasan.gov.ph</code> &nbsp;|&nbsp; <code>cics@mscmarinduque.edu.ph</code><br>
      &nbsp;&nbsp;- Hotlines: (042) 332-1000 / 0912-345-6789</p>
    </div>
    <div>
      <div class="footer-banner"><img src="${footerB64}" alt="Footer"></div>
      <div class="page-footer-text">Deliverable #7: User's Manual of the System | Page <span>21</span></div>
    </div>
  </div>

</body>
</html>`;

const outHtml = path.join(rootDir, 'AppScale_Deliverable7_Manual_v3.html');
fs.writeFileSync(outHtml, html);
console.log(`Saved HTML manual at: ${outHtml} (${(html.length / (1024 * 1024)).toFixed(2)} MB)`);

const outPdf = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale_v3.pdf');
console.log('Compiling PDF via Chrome headless...');
const cmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${outPdf}" --include-background "file://${outHtml.replace(/\\/g, '/')}"`;

try {
  execSync(cmd);
  const pdfSizeMB = (fs.statSync(outPdf).size / (1024 * 1024)).toFixed(2);
  console.log(`PDF successfully generated at: ${outPdf} (${pdfSizeMB} MB)`);

  // Attempt to overwrite primary pdf if not locked
  const primaryPdf = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale.pdf');
  try {
    fs.copyFileSync(outPdf, primaryPdf);
    console.log(`Primary PDF also updated at: ${primaryPdf}`);
  } catch(e) {
    console.warn('Could not copy to primary PDF, v3 PDF is available.');
  }
} catch (err) {
  console.error('Error compiling PDF:', err);
}
