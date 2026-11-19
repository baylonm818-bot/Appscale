const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'c:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Documents\\AppScale-Web-main';

// Read banners and app logo
const hBuf = fs.readFileSync(path.join(rootDir, 'header_banner.jpg'));
const fBuf = fs.readFileSync(path.join(rootDir, 'footer_banner.jpg'));
const headerB64 = 'data:image/jpeg;base64,' + hBuf.toString('base64');
const footerB64 = 'data:image/jpeg;base64,' + fBuf.toString('base64');

let appscaleLogo = '';
if (fs.existsSync(path.join(rootDir, 'frontend/public/logo1.png'))) {
  appscaleLogo = 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'frontend/public/logo1.png')).toString('base64');
}

// Read UI screenshots from Deliverable 2 doc_assets
let uiImage1 = '';
let uiImage2 = '';
let uiImage3 = '';
if (fs.existsSync(path.join(rootDir, 'doc_assets/image1.png'))) {
  uiImage1 = 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'doc_assets/image1.png')).toString('base64');
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image2.png'))) {
  uiImage2 = 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'doc_assets/image2.png')).toString('base64');
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image3.png'))) {
  uiImage3 = 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'doc_assets/image3.png')).toString('base64');
}

console.log('Loaded UI screenshots. Building full Deliverable 7 HTML...');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deliverable #7 - User's Manual of the System: AppScale</title>
<style>
  @page {
    size: letter;
    margin: 0.9cm 1.5cm 0.9cm 1.5cm;
  }

  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #222222;
    line-height: 1.50;
    font-size: 9.2pt;
    margin: 0;
    padding: 0;
  }

  /* Page structure */
  .page {
    page-break-after: always;
    min-height: 94vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
  }

  .page-header {
    width: 100%;
    margin-bottom: 8px;
  }
  .page-header img {
    width: 100%;
    display: block;
    max-height: 50px;
    object-fit: contain;
  }

  .page-footer {
    width: 100%;
    margin-top: 10px;
    border-top: 0.5px solid #cbd5e1;
    padding-top: 3px;
  }
  .page-footer img {
    width: 100%;
    display: block;
    max-height: 46px;
    object-fit: contain;
  }

  .page-content {
    flex-grow: 1;
  }

  /* Cover Page */
  .cover-container {
    text-align: center;
    padding-top: 35px;
    padding-bottom: 30px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    min-height: 820px;
  }
  .deliverable-tag {
    font-size: 13pt;
    font-weight: 700;
    color: #4a5568;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 22px;
  }
  .main-system-title {
    font-size: 38pt;
    font-weight: 900;
    color: #7a1c28; /* MarSU Deep Maroon */
    margin: 0 0 6px 0;
    letter-spacing: 1.5px;
    line-height: 1.1;
  }
  .system-subtitle {
    font-size: 18pt;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 26px 0;
  }
  .divider-gold {
    width: 90%;
    height: 3.5px;
    background-color: #d4af37;
    margin: 0 auto 30px auto;
  }
  .manual-heading {
    font-size: 25pt;
    font-weight: 800;
    color: #7a1c28;
    margin: 0 0 10px 0;
  }
  .manual-sub-audience {
    font-size: 10.5pt;
    color: #4a5568;
    margin: 0 0 75px 0;
    max-width: 650px;
    line-height: 1.45;
  }
  .university-block {
    margin-top: auto;
    margin-bottom: 35px;
    font-size: 12pt;
    color: #1a202c;
    line-height: 1.4;
  }
  .university-block strong {
    font-size: 13pt;
    font-weight: 700;
    display: block;
    margin-bottom: 3px;
  }
  .team-block {
    font-size: 10pt;
    color: #2d3748;
    line-height: 1.6;
    margin-bottom: 20px;
  }
  .team-block .team-title {
    font-weight: 800;
    font-size: 10.5pt;
    text-transform: uppercase;
    color: #1a202c;
    margin-bottom: 6px;
  }
  .team-members {
    font-weight: 700;
    color: #1a202c;
    letter-spacing: 0.5px;
  }

  /* Headings */
  h1 {
    font-size: 16pt;
    color: #8b1c3e;
    border-bottom: 2px solid #8b1c3e;
    padding-bottom: 3px;
    margin-top: 16pt;
    margin-bottom: 8pt;
    page-break-after: avoid;
    font-weight: 800;
  }
  h2 {
    font-size: 11.5pt;
    color: #8b1c3e;
    margin-top: 12pt;
    margin-bottom: 5pt;
    page-break-after: avoid;
    font-weight: 700;
    border-left: 3.5px solid #d4af37;
    padding-left: 8px;
  }
  h3 {
    font-size: 9.8pt;
    color: #1e293b;
    margin-top: 9pt;
    margin-bottom: 3pt;
    page-break-after: avoid;
    font-weight: 700;
  }

  p {
    margin-top: 0;
    margin-bottom: 5.5pt;
    text-align: justify;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    text-align: left;
  }
  th {
    background-color: #8b1c3e;
    color: #ffffff;
    font-weight: 700;
  }
  tr:nth-child(even) {
    background-color: #f8fafc;
  }

  /* Revision History & Approval Tables */
  .revision-table th {
    background-color: #8b1c3e;
  }
  .approval-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 20px;
  }
  .approval-card {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 10px 14px;
    background: #fdfcf9;
  }
  .approval-role {
    font-size: 8pt;
    font-weight: 700;
    color: #8b1c3e;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .approval-name {
    font-size: 10pt;
    font-weight: 700;
    color: #111111;
  }
  .approval-title {
    font-size: 8pt;
    color: #555555;
    margin-bottom: 12px;
  }
  .signature-line {
    border-top: 1px dashed #64748b;
    margin-top: 25px;
    padding-top: 3px;
    font-size: 7.5pt;
    color: #64748b;
    text-align: center;
  }

  /* Step Boxes */
  .step-box {
    display: flex;
    gap: 8px;
    margin: 5px 0;
    page-break-inside: avoid;
  }
  .step-num {
    background: #8b1c3e;
    color: #ffffff;
    font-size: 8pt;
    font-weight: bold;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .step-desc {
    flex-grow: 1;
  }
  .step-desc strong {
    color: #111111;
    display: block;
    margin-bottom: 1px;
  }

  /* Callouts */
  .callout {
    padding: 6px 10px;
    border-radius: 4px;
    margin: 8px 0;
    font-size: 8.6pt;
    page-break-inside: avoid;
  }
  .callout-info {
    background-color: #fbf5f7;
    border-left: 3.5px solid #8b1c3e;
    color: #63122b;
  }
  .callout-gold {
    background-color: #fdfaf0;
    border-left: 3.5px solid #d4af37;
    color: #7c5e08;
  }
  .callout-danger {
    background-color: #fef2f2;
    border-left: 3.5px solid #dc2626;
    color: #991b1b;
  }

  /* Figure box with screenshot */
  .figure-container {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    padding: 8px;
    margin: 10px 0;
    text-align: center;
    page-break-inside: avoid;
  }
  .figure-container img {
    max-width: 95%;
    max-height: 250px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .figure-caption {
    font-size: 8pt;
    font-weight: 700;
    color: #8b1c3e;
    margin-top: 5px;
  }

  /* Diagrams & Flowcharts */
  .flowchart-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .flow-node {
    flex: 1;
    border: 1.5px solid #8b1c3e;
    border-radius: 5px;
    padding: 8px 6px;
    background: #ffffff;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .flow-node strong {
    display: block;
    color: #8b1c3e;
    font-size: 8.5pt;
    margin-bottom: 2px;
  }
  .flow-node span {
    font-size: 7.5pt;
    color: #475569;
    display: block;
    line-height: 1.25;
  }
  .flow-arrow {
    color: #d4af37;
    font-weight: 900;
    font-size: 14pt;
    flex-shrink: 0;
  }

  /* TOC Layout */
  .toc-box {
    background: #fdfcf9;
    border: 1px solid #e5e0d8;
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 14px;
  }
  .toc-header {
    font-size: 14pt;
    font-weight: 800;
    color: #8b1c3e;
    border-bottom: 2px solid #d4af37;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .toc-entry {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 8.8pt;
  }
  .toc-entry.h1-level {
    font-weight: 700;
    color: #8b1c3e;
    margin-top: 5pt;
  }
  .toc-entry.h2-level {
    padding-left: 12px;
    color: #222222;
  }
  .toc-entry.h3-level {
    padding-left: 24px;
    color: #555555;
    font-size: 8.2pt;
  }
  .toc-fill {
    flex-grow: 1;
    border-bottom: 1px dotted #aaaaaa;
    margin: 0 6px 3px 6px;
  }
  .toc-pg {
    font-weight: 700;
    color: #8b1c3e;
  }

  .tag {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .tag-web { background: #e0e7ff; color: #3730a3; }
  .tag-mobile { background: #fef3c7; color: #92400e; }

  ul, ol {
    margin-top: 2px;
    margin-bottom: 5px;
    padding-left: 18px;
  }
  li {
    margin-bottom: 2px;
  }
</style>
</head>
<body>

<!-- ================= PAGE 1: COVER PAGE ================= -->
<div class="page" style="justify-content: flex-start;">
  <div class="page-header" style="margin-bottom: 25px;">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content cover-container">
    <div class="deliverable-tag">DELIVERABLE #7</div>

    <div class="main-system-title">APPSCALE</div>
    <div class="system-subtitle">Barangay Child Nutrition & Maternal Health Information System</div>

    <div class="divider-gold"></div>

    <div class="manual-heading">User's Manual of the System</div>
    <div class="manual-sub-audience">
      For Barangay Nutrition Scholars (BNS), Barangay Health Workers (BHW), and Municipal Health Administrators of Gasan, Marinduque
    </div>

    <div class="university-block">
      <strong>Marinduque State University</strong>
      College of Information and Computing Sciences
    </div>

    <div class="team-block">
      <div class="team-title">APPSCALE - Child Nutrition & Maternal Health System</div>
      <div class="team-members">
        JANA ROSE P. ROLLE<br>
        MARK JOSEPH J. BAYLON<br>
        CHRISTOPHER C. ARANAS<br>
        JOHN LLOYD S. TESIO
      </div>
    </div>
  </div>
</div>

<!-- ================= PAGE 2: REVISION HISTORY & SIGN-OFF ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>Document Control & Revision History</h1>
    <p>
      This document undergoes structured version control to trace iterative developments, stakeholder reviews, and system enhancements for the AppScale platform.
    </p>

    <table class="revision-table">
      <thead>
        <tr>
          <th style="width: 12%;">Date</th>
          <th style="width: 10%;">Version</th>
          <th style="width: 25%;">Author / Contributor</th>
          <th>Summary of Changes / Remarks</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>09/16/2026</strong></td>
          <td>v1.0</td>
          <td>Capstone Development Team</td>
          <td>Initial draft of Deliverable 7 user manual outlining core functional modules, user roles, and system architecture.</td>
        </tr>
        <tr>
          <td><strong>10/12/2026</strong></td>
          <td>v1.5</td>
          <td>Jana Rose Rolle, Mark Joseph Baylon</td>
          <td>Added detailed step-by-step procedures for Operation Timbang Plus (OPT+) anthropometric measurement and WHO z-score calculation.</td>
        </tr>
        <tr>
          <td><strong>10/28/2026</strong></td>
          <td>v2.0</td>
          <td>Christopher Aranas, John Lloyd Tesio</td>
          <td>Integrated offline-first Dart Hive database documentation, synchronization protocols, and clinical referral escalation flow.</td>
        </tr>
        <tr>
          <td><strong>11/18/2026</strong></td>
          <td>v3.0</td>
          <td>AppScale Capstone Team</td>
          <td>Final Release version for Capstone Defense. Aligned institutional header/footer with MarSU CICS standards and incorporated UI screenshot matrices.</td>
        </tr>
      </tbody>
    </table>

    <h1>Formal Review & Sign-Off Approvals</h1>
    <p>
      The undersigned verify that this User's Manual accurately reflects the functionality and operational procedures of the AppScale platform:
    </p>

    <div class="approval-grid">
      <div class="approval-card">
        <div class="approval-role">Prepared by (Development Team)</div>
        <div class="approval-name">Jana Rose P. Rolle &bull; John Lloyd S. Tesio</div>
        <div class="approval-title">Lead Analysts & Developers, Group 3 Capstone Team</div>
        <div class="signature-line">Signature over Printed Name / Date</div>
      </div>

      <div class="approval-card">
        <div class="approval-role">Reviewed by (Capstone Adviser)</div>
        <div class="approval-name">Prof. Faculty Adviser, MIT</div>
        <div class="approval-title">Capstone Project Adviser, MarSU CICS</div>
        <div class="signature-line">Signature over Printed Name / Date</div>
      </div>

      <div class="approval-card">
        <div class="approval-role">Accepted by (Client Beneficiary)</div>
        <div class="approval-name">Municipal Health Officer (MHO)</div>
        <div class="approval-title">Rural Health Unit, Municipality of Gasan, Marinduque</div>
        <div class="signature-line">Signature over Printed Name / Date</div>
      </div>

      <div class="approval-card">
        <div class="approval-role">Endorsed by (College Dean)</div>
        <div class="approval-name">Dean, College of Information and Computing Sciences</div>
        <div class="approval-title">Marinduque State University</div>
        <div class="signature-line">Signature over Printed Name / Date</div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 3: TABLE OF CONTENTS ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <div class="toc-box">
      <div class="toc-header">Table of Contents</div>

      <div class="toc-entry h1-level"><span>Document Control & Revision History</span><span class="toc-fill"></span><span class="toc-pg">Page 2</span></div>
      <div class="toc-entry h1-level"><span>Formal Review & Sign-Off Approvals</span><span class="toc-fill"></span><span class="toc-pg">Page 2</span></div>
      <div class="toc-entry h1-level"><span>List of Figures & List of Tables</span><span class="toc-fill"></span><span class="toc-pg">Page 4</span></div>
      <div class="toc-entry h1-level"><span>Operational Glossary of Terms</span><span class="toc-fill"></span><span class="toc-pg">Page 4</span></div>

      <div class="toc-entry h1-level"><span>1 System Overview</span><span class="toc-fill"></span><span class="toc-pg">Page 5</span></div>
      <div class="toc-entry h2-level"><span>1.1 What is AppScale?</span><span class="toc-fill"></span><span class="toc-pg">Page 5</span></div>
      <div class="toc-entry h2-level"><span>1.2 What you can do with AppScale</span><span class="toc-fill"></span><span class="toc-pg">Page 5</span></div>
      <div class="toc-entry h2-level"><span>1.3 Who uses AppScale (User Roles & Access Levels)</span><span class="toc-fill"></span><span class="toc-pg">Page 5</span></div>
      <div class="toc-entry h2-level"><span>1.4 How a Malnutrition Case and Referral Moves (Flowchart)</span><span class="toc-fill"></span><span class="toc-pg">Page 6</span></div>
      <div class="toc-entry h2-level"><span>1.5 System Data Architecture & Synchronization Flow</span><span class="toc-fill"></span><span class="toc-pg">Page 6</span></div>

      <div class="toc-entry h1-level"><span>2 System Requirements and Access</span><span class="toc-fill"></span><span class="toc-pg">Page 7</span></div>
      <div class="toc-entry h2-level"><span>2.1 Hardware and Software Specifications</span><span class="toc-fill"></span><span class="toc-pg">Page 7</span></div>
      <div class="toc-entry h2-level"><span>2.2 How to open AppScale (Web URL and Android APK)</span><span class="toc-fill"></span><span class="toc-pg">Page 7</span></div>
      <div class="toc-entry h2-level"><span>2.3 User Accounts & Provisioning Policy</span><span class="toc-fill"></span><span class="toc-pg">Page 7</span></div>

      <div class="toc-entry h1-level"><span>3 Getting Started</span><span class="toc-fill"></span><span class="toc-pg">Page 8</span></div>
      <div class="toc-entry h2-level"><span>3.1 Logging In and Session Security</span><span class="toc-fill"></span><span class="toc-pg">Page 8</span></div>
      <div class="toc-entry h2-level"><span>3.2 Password Recovery via 6-Digit OTP</span><span class="toc-fill"></span><span class="toc-pg">Page 8</span></div>
      <div class="toc-entry h2-level"><span>3.3 User Interface Orientation (Mobile vs. Web Portal)</span><span class="toc-fill"></span><span class="toc-pg">Page 8</span></div>

      <div class="toc-entry h1-level"><span>4 Step-by-Step User Instructions</span><span class="toc-fill"></span><span class="toc-pg">Page 9</span></div>
      <div class="toc-entry h2-level"><span>4.1 Barangay Nutrition Scholars (BNS) — Mobile App</span><span class="toc-fill"></span><span class="toc-pg">Page 9</span></div>
      <div class="toc-entry h3-level"><span>4.1.1 Child Registration & Purok Profiling</span><span class="toc-fill"></span><span class="toc-pg">Page 9</span></div>
      <div class="toc-entry h3-level"><span>4.1.2 Operation Timbang Plus Anthropometric Recording</span><span class="toc-fill"></span><span class="toc-pg">Page 9</span></div>
      <div class="toc-entry h3-level"><span>4.1.3 Automated WHO Z-Score & Growth Classification Matrix</span><span class="toc-fill"></span><span class="toc-pg">Page 10</span></div>
      <div class="toc-entry h3-level"><span>4.1.4 Immediate Clinical Referral for SAM & Edema</span><span class="toc-fill"></span><span class="toc-pg">Page 10</span></div>
      <div class="toc-entry h3-level"><span>4.1.5 Supplementary Feeding Program & Attendance</span><span class="toc-fill"></span><span class="toc-pg">Page 11</span></div>
      <div class="toc-entry h3-level"><span>4.1.6 Micronutrients (Vitamin A & Deworming)</span><span class="toc-fill"></span><span class="toc-pg">Page 11</span></div>
      <div class="toc-entry h3-level"><span>4.1.7 Offline Operation & Cloud Data Sync</span><span class="toc-fill"></span><span class="toc-pg">Page 11</span></div>

      <div class="toc-entry h2-level"><span>4.2 Barangay Health Workers (BHW) — Web Portal</span><span class="toc-fill"></span><span class="toc-pg">Page 12</span></div>
      <div class="toc-entry h3-level"><span>4.2.1 BHW Health Center Dashboard</span><span class="toc-fill"></span><span class="toc-pg">Page 12</span></div>
      <div class="toc-entry h3-level"><span>4.2.2 Medical Records Management & Longitudinal Curves</span><span class="toc-fill"></span><span class="toc-pg">Page 12</span></div>
      <div class="toc-entry h3-level"><span>4.2.3 Need Attention Module: Automated 3-Tier Triage</span><span class="toc-fill"></span><span class="toc-pg">Page 12</span></div>
      <div class="toc-entry h3-level"><span>4.2.4 Referral Escalations to RHU / Hospital</span><span class="toc-fill"></span><span class="toc-pg">Page 13</span></div>

      <div class="toc-entry h2-level"><span>4.3 Municipal Administrators — Web Command Hub</span><span class="toc-fill"></span><span class="toc-pg">Page 13</span></div>
      <div class="toc-entry h3-level"><span>4.3.1 Executive Analytics & Barangay Rankings</span><span class="toc-fill"></span><span class="toc-pg">Page 13</span></div>
      <div class="toc-entry h3-level"><span>4.3.2 Staff Account Management & Signatories Settings</span><span class="toc-fill"></span><span class="toc-pg">Page 14</span></div>
      <div class="toc-entry h3-level"><span>4.3.3 Masterlist Hub, Excel & Official PDF Reports</span><span class="toc-fill"></span><span class="toc-pg">Page 14</span></div>

      <div class="toc-entry h1-level"><span>5 Error Handling and Troubleshooting</span><span class="toc-fill"></span><span class="toc-pg">Page 15</span></div>
      <div class="toc-entry h1-level"><span>6 Frequently Asked Questions (FAQ)</span><span class="toc-fill"></span><span class="toc-pg">Page 15</span></div>
      <div class="toc-entry h1-level"><span>7 Security and User Reminders (RA 10173 Compliance)</span><span class="toc-fill"></span><span class="toc-pg">Page 16</span></div>
      <div class="toc-entry h1-level"><span>8 Support, Contact Roster & Appendices</span><span class="toc-fill"></span><span class="toc-pg">Page 16</span></div>
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 4: LIST OF FIGURES & GLOSSARY ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>List of Figures & Tables</h1>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
      <div>
        <h3 style="color: #8b1c3e; border-bottom: 1.5px solid #d4af37; padding-bottom: 3px;">List of Figures</h3>
        <ul style="font-size: 8.5pt; list-style: none; padding-left: 0;">
          <li><strong>Figure 1:</strong> Clinical Referral & Malnutrition Escalation Flowchart (Page 6)</li>
          <li><strong>Figure 2:</strong> AppScale Offline-to-Cloud Synchronization Architecture (Page 6)</li>
          <li><strong>Figure 3:</strong> Mobile Field App User Interface Overview (Page 8)</li>
          <li><strong>Figure 4:</strong> Web Management Portal Dashboard Interface (Page 13)</li>
          <li><strong>Figure 5:</strong> Supplementary Feeding Attendance & Meal Plan UI (Page 14)</li>
        </ul>
      </div>
      <div>
        <h3 style="color: #8b1c3e; border-bottom: 1.5px solid #d4af37; padding-bottom: 3px;">List of Tables</h3>
        <ul style="font-size: 8.5pt; list-style: none; padding-left: 0;">
          <li><strong>Table 1:</strong> Document Revision History Table (Page 2)</li>
          <li><strong>Table 2:</strong> User Roles and System Access Hierarchy (Page 5)</li>
          <li><strong>Table 3:</strong> Hardware and Software Minimum Specifications (Page 7)</li>
          <li><strong>Table 4:</strong> WHO Child Growth Standards Classification Matrix (Page 10)</li>
          <li><strong>Table 5:</strong> Error Handling and Troubleshooting Matrix (Page 15)</li>
        </ul>
      </div>
    </div>

    <h1>Operational Glossary of Terms</h1>
    <table style="font-size: 8.3pt;">
      <thead>
        <tr>
          <th style="width: 22%;">Acronym / Term</th>
          <th>Full Operational Definition within AppScale</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>BNS</strong></td>
          <td><strong>Barangay Nutrition Scholar:</strong> Barangay-based volunteer worker responsible for community nutritional assessments, house-to-house weighing, and supplementary feeding.</td>
        </tr>
        <tr>
          <td><strong>BHW</strong></td>
          <td><strong>Barangay Health Worker:</strong> Health center worker managing beneficiary medical records, health center clinic visits, and referral escalations.</td>
        </tr>
        <tr>
          <td><strong>OPT+</strong></td>
          <td><strong>Operation Timbang Plus:</strong> Annual/periodic nationwide weighing and height measurement campaign for children aged 0–59 months to identify malnutrition prevalence.</td>
        </tr>
        <tr>
          <td><strong>SAM</strong></td>
          <td><strong>Severe Acute Malnutrition:</strong> Life-threatening condition characterized by severe wasting (WFL/H &lt; -3 SD) and/or nutritional bilateral pitting edema.</td>
        </tr>
        <tr>
          <td><strong>MAM</strong></td>
          <td><strong>Moderate Acute Malnutrition:</strong> Moderate wasting (WFL/H between -3 SD and &lt; -2 SD) requiring targeted supplementary feeding intervention.</td>
        </tr>
        <tr>
          <td><strong>WFA / HFA / WFL/H</strong></td>
          <td><strong>Weight-for-Age, Height-for-Age, Weight-for-Length/Height:</strong> Core anthropometric nutritional indicators referencing the 2006 WHO Child Growth Standards.</td>
        </tr>
        <tr>
          <td><strong>Z-Score / SD</strong></td>
          <td><strong>Standard Deviation:</strong> Statistical measure quantifying how far a child's measurement deviates from the median of the WHO reference population.</td>
        </tr>
        <tr>
          <td><strong>Hive NoSQL</strong></td>
          <td>High-performance, lightweight embedded key-value database used in the AppScale mobile app for instant offline data storage.</td>
        </tr>
        <tr>
          <td><strong>RHU / MNAO / MHO</strong></td>
          <td><strong>Rural Health Unit, Municipal Nutrition Action Officer, Municipal Health Officer:</strong> Primary municipal public health officials directing community nutrition programs in Gasan.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 5: 1 SYSTEM OVERVIEW ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>1 System Overview</h1>

    <h2>1.1 What is AppScale?</h2>
    <p>
      <strong>AppScale</strong> is an offline-first child nutrition monitoring and maternal health management system developed specifically for the Rural Health Unit (RHU), Barangay Nutrition Scholars (BNS), and Barangay Health Workers (BHW) of the Municipality of Gasan, Marinduque.
    </p>
    <p>
      The system addresses the operational bottlenecks associated with manual, paper-intensive community nutrition monitoring—specifically Operation Timbang Plus (OPT+), supplementary feeding enrollments, micronutrient distribution, and maternal health counseling. AppScale pairs a high-performance <strong>Flutter mobile application</strong> (designed for field workers visiting remote puroks with intermittent or zero internet connectivity) with a responsive <strong>React web management portal</strong> (designed for municipal health supervisors and clinic-based health workers).
    </p>

    <h2>1.2 What you can do with AppScale</h2>
    <p>AppScale automates and digitizes core public health nutrition workflows:</p>
    <ul>
      <li><strong>Digital Masterlisting:</strong> Maintain an up-to-date registry of all children aged 0–59 months and lactating/pregnant mothers across all 25 barangays of Gasan.</li>
      <li><strong>Anthropometric Z-Score Calculation:</strong> Automatically calculate exact nutritional classifications according to World Health Organization (WHO) Child Growth Standards: Weight-for-Age (WFA), Height-for-Age (HFA), and Weight-for-Length/Height (WFL/H).</li>
      <li><strong>Clinical Referral Pipeline:</strong> Instantly trigger clinical referrals when a child is classified with Severe Acute Malnutrition (SAM), Moderate Acute Malnutrition (MAM), or bilateral pitting edema.</li>
      <li><strong>Supplementary Feeding Program Management:</strong> Track 120-day feeding program cycles, daily attendance, balanced meal recipes, and periodic re-weighing delta progress.</li>
      <li><strong>Micronutrient Distribution:</strong> Log biannual Vitamin A capsule administration and National Deworming Month tablets.</li>
      <li><strong>Automated Regulatory Reporting:</strong> Generate National Nutrition Council (NNC) standard consolidation spreadsheets in Excel (.xlsx) and printable official PDF reports with authorized digital signatories.</li>
    </ul>

    <h2>1.3 Who uses AppScale (User Roles & Access Levels)</h2>
    <table>
      <thead>
        <tr>
          <th>Role Title</th>
          <th>Primary Platform</th>
          <th>Scope of Work & Capabilities</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Municipal Administrator</strong></td>
          <td><span class="tag tag-web">Web Portal</span></td>
          <td>System supervision, health worker account creation/deactivation, municipal masterlist oversight, audit log inspections, signatory settings, and municipal-wide OPT+ export.</td>
        </tr>
        <tr>
          <td><strong>Barangay Health Worker (BHW)</strong></td>
          <td><span class="tag tag-web">Web Portal</span> + <span class="tag tag-mobile">Mobile</span></td>
          <td>Health center medical records management, referral acceptance/escalation to RHU/hospital, clinic appointment scheduling, and patient history review.</td>
        </tr>
        <tr>
          <td><strong>Barangay Nutrition Scholar (BNS)</strong></td>
          <td><span class="tag tag-mobile">Mobile App (Offline)</span></td>
          <td>House-to-house purok visits, child weighing and height measurement, feeding program attendance, meal planning, Vitamin A & Deworming logs, and offline data sync.</td>
        </tr>
        <tr>
          <td><strong>Beneficiary / Caregiver</strong></td>
          <td><span class="tag tag-mobile">Mobile App</span></td>
          <td>Read-only access to own child growth cards, feeding schedules, deworming milestones, and health reminders from barangay workers.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 6: WORKFLOW FLOWCHARTS ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h2>1.4 How a Malnutrition Case and Referral Moves</h2>
    <p>
      The lifecycle of an identified malnutrition case demonstrates the seamless handoff between mobile field workers and web health officers:
    </p>

    <!-- Flowchart 1 -->
    <div class="flowchart-row">
      <div class="flow-node">
        <strong>1. Field Weighing (BNS)</strong>
        <span>Input Weight & Height on mobile app</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>2. WHO Z-Score</strong>
        <span>Auto-flagged if SAM / MAM or Edema</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>3. Urgent Referral</strong>
        <span>One-tap clinical referral to RHU</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>4. Health Center Intake</strong>
        <span>BHW receives alert on Web Portal</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>5. Recovery & Feeding</strong>
        <span>120-day feeding cycle & graduation</span>
      </div>
    </div>
    <div style="text-align: center; font-size: 8pt; color: #64748b; font-style: italic; margin-bottom: 14px;">
      Figure 1: Clinical Referral & Malnutrition Escalation Flowchart
    </div>

    <h2>1.5 System Data Architecture & Synchronization Flow</h2>
    <p>
      AppScale employs an offline-first distributed architecture allowing field workers to collect data without mobile data coverage:
    </p>

    <!-- Flowchart 2 -->
    <div class="flowchart-row">
      <div class="flow-node">
        <strong>Mobile Device</strong>
        <span>Flutter Client App (Field UI)</span>
      </div>
      <div class="flow-arrow">&harr;</div>
      <div class="flow-node">
        <strong>Local Hive Store</strong>
        <span>Binary NoSQL Cache on Device</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>Background Sync</strong>
        <span>Activates when 4G/Wi-Fi connected</span>
      </div>
      <div class="flow-arrow">&rarr;</div>
      <div class="flow-node">
        <strong>Node.js API</strong>
        <span>JWT Validation & REST Endpoints</span>
      </div>
      <div class="flow-arrow">&harr;</div>
      <div class="flow-node">
        <strong>Central MySQL DB</strong>
        <span>Cloud Database & Web Analytics</span>
      </div>
    </div>
    <div style="text-align: center; font-size: 8pt; color: #64748b; font-style: italic; margin-bottom: 14px;">
      Figure 2: AppScale Offline-to-Cloud Synchronization Architecture
    </div>

    <div class="callout callout-info">
      <strong>Zero Data Loss Guarantee:</strong> Because measurements are committed directly to non-volatile local disk storage (Hive), field workers never lose records if battery depletes or if the app is closed while away from cell towers.
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 7: 2 REQUIREMENTS & ACCESS ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>2 System Requirements and Access</h1>

    <h2>2.1 Hardware and Software Specifications</h2>
    <table>
      <thead>
        <tr>
          <th>Specification</th>
          <th>Web Management Portal (Admin / BHW)</th>
          <th>Mobile Field App (BNS / Field Staff)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Operating System</strong></td>
          <td>Windows 10/11, macOS 11+, or Linux</td>
          <td>Android 7.0 (Nougat) or higher / iOS 12+</td>
        </tr>
        <tr>
          <td><strong>Web Browser</strong></td>
          <td>Google Chrome (v90+), Microsoft Edge, Firefox</td>
          <td>Not applicable (Native Flutter binary)</td>
        </tr>
        <tr>
          <td><strong>Processor / RAM</strong></td>
          <td>Dual-Core 2.0 GHz or higher, 4 GB RAM</td>
          <td>Quad-Core 1.5 GHz, 2 GB RAM minimum (3 GB recommended)</td>
        </tr>
        <tr>
          <td><strong>Available Storage</strong></td>
          <td>500 MB free browser cache space</td>
          <td>150 MB internal storage (for Hive database and cache)</td>
        </tr>
        <tr>
          <td><strong>Internet Connection</strong></td>
          <td>Required for real-time web portal access (1 Mbps+)</td>
          <td>Only required during initial login and periodic cloud sync</td>
        </tr>
        <tr>
          <td><strong>Peripherals</strong></td>
          <td>Display resolution 1366 x 768 or higher</td>
          <td>Camera (for scanning beneficiary QR codes/barcodes)</td>
        </tr>
      </tbody>
    </table>

    <h2>2.2 How to open AppScale</h2>
    <p><strong>Web Portal:</strong> Launch Google Chrome or Microsoft Edge on your computer and navigate to the official municipal production URL: <code>https://appscale-gasan.gov.ph</code>.</p>
    <p><strong>Mobile Field App:</strong> Download the official <code>AppScale-v3.0.apk</code> installer provided by the Municipal IT Officer. Tap Install and open the green AppScale icon.</p>

    <h2>2.3 User Accounts & Provisioning Policy</h2>
    <div class="callout callout-gold">
      <strong>Security Policy:</strong> Public registration is strictly disabled for all administrative and health worker roles. All BHW, BNS, and Admin accounts are provisioned exclusively by the Municipal System Administrator to prevent unauthorized access to community patient data.
    </div>
    <ul>
      <li><strong>Admin Accounts:</strong> Initialized by the Municipal Health Officer (MHO) and Municipal IT Department.</li>
      <li><strong>BHW Accounts:</strong> Created by the Administrator via the <em>User Management</em> web module.</li>
      <li><strong>BNS Accounts:</strong> Created by the Administrator and linked to their assigned barangay and puroks.</li>
    </ul>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 8: 3 GETTING STARTED ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>3 Getting Started</h1>

    <h2>3.1 Logging In and Session Security</h2>
    <div class="step-box">
      <div class="step-num">1</div>
      <div class="step-desc">
        <strong>Enter Credentials:</strong> Input registered email address and secure password.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">2</div>
      <div class="step-desc">
        <strong>JWT Authentication:</strong> On click, the server returns a secure JWT token. Admins are redirected to <code>/admin/dashboard</code>, BHWs to <code>/bhw/dashboard</code>, and mobile users to the mobile home shell.
      </div>
    </div>

    <div class="callout callout-danger">
      <strong>Lockout Safeguard:</strong> 5 failed consecutive password attempts trigger a 15–30 minute security lockout.
    </div>

    <h2>3.2 Password Recovery via 6-Digit OTP</h2>
    <p>
      Click <strong>"Forgot Password"</strong>, enter your email, and check your inbox for a 6-digit OTP code (valid for 15 minutes). Supply the OTP and enter your new password.
    </p>

    <h2>3.3 User Interface Orientation</h2>
    <p>
      The AppScale mobile application provides field workers with high-contrast, responsive screens optimized for outdoor readability during house-to-house purok visits:
    </p>

    ${uiImage3 ? `
    <div class="figure-container">
      <img src="${uiImage3}" alt="Mobile Field App UI Screen">
      <div class="figure-caption">Figure 3: Mobile Field App User Interface Overview (Dashboard, Masterlist, and Profile Screens)</div>
    </div>` : ''}
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 9: 4.1 BNS INSTRUCTIONS ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>4 Step-by-Step User Instructions</h1>

    <h2>4.1 Barangay Nutrition Scholars (BNS) — Mobile App</h2>

    <h3>4.1.1 Child Registration & Purok Profiling</h3>
    <div class="step-box">
      <div class="step-num">1</div>
      <div class="step-desc">
        <strong>Tap "+ Register Beneficiary":</strong> On the Masterlist tab or floating center button, tap <em>"+ Register Beneficiary"</em>.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">2</div>
      <div class="step-desc">
        <strong>Child Demographics:</strong> Fill in First Name, Middle Name, Last Name, Sex, and Date of Birth.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">3</div>
      <div class="step-desc">
        <strong>Birth History & Address:</strong> Record birth weight (kg), birth length (cm), Mother's Name, Mobile Number, Barangay, and select Purok (1–7).
      </div>
    </div>

    <h3>4.1.2 Operation Timbang Plus Anthropometric Recording</h3>
    <div class="step-box">
      <div class="step-num">1</div>
      <div class="step-desc">
        <strong>Select Child:</strong> Open the Masterlist tab. Search child by name and tap profile card.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">2</div>
      <div class="step-desc">
        <strong>Enter Weight & Height:</strong> Input Weight in kilograms (0.1 kg precision) and Length/Height in centimeters (0.1 cm precision). Toggle posture: <em>Recumbent (lying down)</em> for children under 24 months, or <em>Standing</em> for children 24 months and older.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">3</div>
      <div class="step-desc">
        <strong>Check for Edema:</strong> Screen for bilateral pitting edema (+). Tap <strong>"Save Measurement"</strong>.
      </div>
    </div>

    ${uiImage2 ? `
    <div class="figure-container">
      <img src="${uiImage2}" alt="Child Profile and Anthropometric Input Dialog">
      <div class="figure-caption">Figure 4: Beneficiary Profile & Measurement Entry Screen</div>
    </div>` : ''}
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 10: 4.1.3 WHO Z-SCORE & SAM ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h3>4.1.3 Automated WHO Z-Score & Growth Classification Matrix</h3>
    <p>
      The moment weight and height are entered, the built-in algorithmic engine automatically calculates exact standard deviations (z-scores) referencing the <strong>WHO Child Growth Standards (2006)</strong>:
    </p>

    <table>
      <thead>
        <tr>
          <th>Nutritional Indicator</th>
          <th>Classification Output</th>
          <th>SD Cut-off Threshold</th>
          <th>Visual Color</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="4"><strong>Weight-for-Age (WFA)</strong></td>
          <td>Severely Underweight</td>
          <td>&lt; -3 SD</td>
          <td><span style="color: #b91c1c; font-weight: 700;">Red</span></td>
        </tr>
        <tr>
          <td>Underweight</td>
          <td>-3 SD to &lt; -2 SD</td>
          <td><span style="color: #d97706; font-weight: 700;">Orange</span></td>
        </tr>
        <tr>
          <td>Normal</td>
          <td>-2 SD to +2 SD</td>
          <td><span style="color: #15803d; font-weight: 700;">Green</span></td>
        </tr>
        <tr>
          <td>Overweight</td>
          <td>&gt; +2 SD</td>
          <td><span style="color: #ca8a04; font-weight: 700;">Yellow</span></td>
        </tr>
        <tr>
          <td rowspan="3"><strong>Height-for-Age (HFA)</strong></td>
          <td>Severely Stunted</td>
          <td>&lt; -3 SD</td>
          <td><span style="color: #b91c1c; font-weight: 700;">Red</span></td>
        </tr>
        <tr>
          <td>Stunted</td>
          <td>-3 SD to &lt; -2 SD</td>
          <td><span style="color: #d97706; font-weight: 700;">Orange</span></td>
        </tr>
        <tr>
          <td>Normal</td>
          <td>-2 SD to +2 SD</td>
          <td><span style="color: #15803d; font-weight: 700;">Green</span></td>
        </tr>
        <tr>
          <td rowspan="4"><strong>Weight-for-Length/Height (WFL/H)</strong></td>
          <td>Severely Wasted (SAM)</td>
          <td>&lt; -3 SD or Edema (+)</td>
          <td><span style="color: #7f1d1d; font-weight: 900;">Dark Red</span></td>
        </tr>
        <tr>
          <td>Wasted (MAM)</td>
          <td>-3 SD to &lt; -2 SD</td>
          <td><span style="color: #d97706; font-weight: 700;">Orange</span></td>
        </tr>
        <tr>
          <td>Normal</td>
          <td>-2 SD to +2 SD</td>
          <td><span style="color: #15803d; font-weight: 700;">Green</span></td>
        </tr>
        <tr>
          <td>Obese</td>
          <td>&gt; +3 SD</td>
          <td><span style="color: #b91c1c; font-weight: 700;">Red</span></td>
        </tr>
      </tbody>
    </table>

    <h3>4.1.4 Immediate Clinical Referral for SAM & Edema</h3>
    <div class="callout callout-danger">
      <strong>Automated SAM Alert:</strong> If WFL/H z-score is &lt; -3 SD or Bilateral Pitting Edema is positive, a high-priority red alert dialog automatically appears: <em>"URGENT: Severe Acute Malnutrition Detected"</em>.
    </div>
    <ol>
      <li>Tap <strong>"Create Urgent Referral"</strong> directly from the popup dialog.</li>
      <li>Select Destination: <strong>Gasan Rural Health Unit (RHU)</strong> or <strong>Marinduque Provincial Hospital</strong>.</li>
      <li>Input clinical observations (e.g., severe apathy, lack of appetite, fever).</li>
      <li>Tap <strong>"Submit Referral"</strong>. The referral is tagged as <code>Urgent SAM</code> and queued for immediate sync.</li>
    </ol>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 11: FEEDING, VITAMIN A, OFFLINE ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h3>4.1.5 Supplementary Feeding Program & Attendance</h3>
    <ul>
      <li><strong>Session Scheduling:</strong> Navigate to <em>Programs &rarr; Feeding Program</em>. View active 120-day feeding cycles and target purok beneficiaries.</li>
      <li><strong>Daily Attendance Logging:</strong> Tap today's session date. Mark enrolled children as <strong>Present</strong>, <strong>Absent</strong>, or <strong>Excused</strong>.</li>
      <li><strong>Meal Planning & Recipes:</strong> View and update weekly high-protein, calorie-dense recipes (e.g., enriched arroz caldo with malunggay and boiled egg).</li>
      <li><strong>Periodic Re-Weighing:</strong> Conduct mandatory day-30, day-60, day-90, and day-120 re-weighing inside the module to measure recovery rates.</li>
    </ul>

    <h3>4.1.6 Micronutrients (Vitamin A & Deworming)</h3>
    <ul>
      <li><strong>Vitamin A:</strong> Log biannual Vitamin A capsule administration (100,000 IU for 6–11 mos; 200,000 IU for 12–59 mos).</li>
      <li><strong>Deworming:</strong> Record age-appropriate deworming tablets (Albendazole / Mebendazole) during National Deworming Months.</li>
      <li><strong>Maternal Counseling:</strong> Record pregnant and lactating mother consultations focusing on exclusive breastfeeding (0–6 mos) and complementary feeding.</li>
    </ul>

    <h3>4.1.7 Offline Operation & Cloud Data Sync</h3>
    <p>
      All registrations, measurements, and feeding attendances are cached locally in high-speed Hive storage. The moment network connection is detected, the app automatically uploads pending records in chronological batches. Workers can also tap <em>"Sync Now"</em> under <strong>Reports &rarr; Sync Status</strong>.
    </p>

    <table style="margin-top: 10px;">
      <thead>
        <tr>
          <th>Badge Icon</th>
          <th>Sync Status</th>
          <th>Operational Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span style="color: #15803d; font-weight: 700;">● Green Cloud</span></td>
          <td>Fully Synced</td>
          <td>All local records match cloud database. Safe to log out or close app.</td>
        </tr>
        <tr>
          <td><span style="color: #d97706; font-weight: 700;">▲ Amber Cloud</span></td>
          <td>Pending Sync</td>
          <td>New records stored on phone waiting for internet connection.</td>
        </tr>
        <tr>
          <td><span style="color: #b91c1c; font-weight: 700;">✕ Red Banner</span></td>
          <td>Offline Mode</td>
          <td>No network. App continues recording offline in Hive storage.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 12: 4.2 BHW WEB PORTAL ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h2>4.2 Barangay Health Workers (BHW) — Web Portal</h2>

    <h3>4.2.1 BHW Health Center Dashboard (/bhw/dashboard)</h3>
    <p>Displays actionable priorities specifically within the worker's assigned barangay:</p>
    <ul>
      <li><strong>Need Attention Alert Banner:</strong> Highlights children diagnosed with SAM or MAM who require urgent home visits.</li>
      <li><strong>Today's Clinic Appointments:</strong> Direct list of children scheduled for weighing, Vitamin A supplementation, or immunizations.</li>
    </ul>

    <h3>4.2.2 Medical Records Management & Longitudinal Curves (/bhw/medical-records)</h3>
    <p>
      Provides complete longitudinal health management for registered community members. BHWs can search by child name, inspect growth charts, and log administered medications and health center interventions.
    </p>

    <h3>4.2.3 Need Attention Module: Automated 3-Tier Triage (/bhw/need-attention)</h3>
    <ul>
      <li><strong>Tier 1 - Immediate Clinical Risk:</strong> Severe Acute Malnutrition (SAM) and children with edema. Requires immediate hospital/RHU transfer.</li>
      <li><strong>Tier 2 - Moderate Nutritional Risk:</strong> Moderate Acute Malnutrition (MAM) and growth faltering children.</li>
      <li><strong>Tier 3 - Missed Interventions:</strong> Beneficiaries overdue for feeding or Vitamin A doses.</li>
    </ul>

    <h3>4.2.4 Referral Escalations to RHU / Hospital (/bhw/referrals)</h3>
    <div class="step-box">
      <div class="step-num">1</div>
      <div class="step-desc">
        <strong>Review Incoming Referral:</strong> Click <strong>Referrals</strong> to inspect incoming cases submitted by BNS mobile workers.
      </div>
    </div>
    <div class="step-box">
      <div class="step-num">2</div>
      <div class="step-desc">
        <strong>Update Status:</strong> Transition status from <code>Pending</code> to <code>Accepted</code> or forward to Gasan RHU.
      </div>
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 13: 4.3 ADMIN COMMAND HUB ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h2>4.3 Municipal Administrators — Web Command Hub</h2>

    <h3>4.3.1 Executive Analytics & Barangay Rankings (/admin/dashboard)</h3>
    <p>
      The administrative command hub offers real-time analytics across all 25 barangays of Gasan:
    </p>
    <ul>
      <li><strong>Macro Nutrition Metrics:</strong> Total preschool children measured, stunting rate, wasting prevalence, and recovery curves.</li>
      <li><strong>Barangay Comparative Analysis:</strong> Visual bar graphs comparing malnutrition burdens to prioritize supplemental budget allocations.</li>
    </ul>

    ${uiImage1 ? `
    <div class="figure-container">
      <img src="${uiImage1}" alt="AppScale Web Management Portal Dashboard">
      <div class="figure-caption">Figure 5: Web Management Portal — Executive Dashboard & Analytics</div>
    </div>` : ''}
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 14: ADMIN STAFF & REPORTS ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h3>4.3.2 Staff Account Management & Signatories Settings</h3>
    <ul>
      <li><strong>Account Control:</strong> Provision, edit, lock, unlock, and deactivate BHW and BNS staff accounts.</li>
      <li><strong>Signatories Configuration:</strong> Configure authorized names, titles, and scanned signature blocks for the BNS, Midwife, Barangay Captain, and Municipal Health Officer (MHO) for automated inclusion on exported documents.</li>
      <li><strong>System Audit Trail:</strong> Inspect non-repudiable ISO audit logs tracking logins, measurement edits, and file exports.</li>
    </ul>

    <h3>4.3.3 Masterlist Hub, Excel & Official PDF Reports</h3>
    <p>
      Automates compilation of the official <strong>Operation Timbang Plus (OPT+) Summary Report</strong> mandated by the National Nutrition Council (NNC):
    </p>
    <ul>
      <li><strong>Form 1A:</strong> Masterlist of Affected Children (SAM, MAM, Stunted).</li>
      <li><strong>Form 1B:</strong> Barangay Consolidation Table (Total preschool population, percentage measured, prevalence rates).</li>
      <li><strong>Export Formats:</strong> Export clean Microsoft Excel spreadsheets (.xlsx) or printable, digitally-endorsed PDF summary certificates (.pdf).</li>
    </ul>

    <div class="callout callout-info">
      <strong>Standard Compliance:</strong> All generated reports comply with the National Nutrition Council (NNC) and Department of Health (DOH) guidelines for local government unit nutrition reporting.
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 15: TROUBLESHOOTING & FAQ ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>5 Error Handling and Troubleshooting</h1>
    <table>
      <thead>
        <tr>
          <th>Error / Symptom</th>
          <th>Root Cause</th>
          <th>Step-by-Step Resolution</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>"Account Locked: 5 failed attempts"</strong></td>
          <td>Incorrect password entered 5 consecutive times.</td>
          <td>Wait 15–30 minutes or ask Municipal Admin to click <em>"Unlock Account"</em> in User Management.</td>
        </tr>
        <tr>
          <td><strong>"Weight out of realistic range"</strong></td>
          <td>Value entered outside 1.0 kg to 35.0 kg for child aged 0–59 mos.</td>
          <td>Re-weigh child. Ensure input is in kilograms (kg), not pounds (lbs).</td>
        </tr>
        <tr>
          <td><strong>Amber Cloud Icon will not turn green</strong></td>
          <td>Weak cellular data connection.</td>
          <td>Connect to stable Wi-Fi or 4G and tap <em>"Sync Now"</em> in Reports &rarr; Sync Status.</td>
        </tr>
        <tr>
          <td><strong>"Invalid Date of Birth"</strong></td>
          <td>Birth date selected is set in the future.</td>
          <td>Inspect child's birth certificate and correct calendar picker date.</td>
        </tr>
      </tbody>
    </table>

    <h1>6 Frequently Asked Questions (FAQ)</h1>
    <p><strong>Q1: Can I record measurements in a purok with zero cellular reception?</strong><br>
    <em>Answer:</em> Yes. AppScale is built offline-first. All child registrations, OPT+ weighings, and feeding records are stored in your phone's internal Hive storage. They will automatically upload when you return to coverage.</p>

    <p><strong>Q2: What should I do if a child under 24 months is measured standing up?</strong><br>
    <em>Answer:</em> Switch the posture toggle to <em>"Standing"</em>. The WHO algorithm automatically applies a +0.7 cm standard adjustment to calculate accurate height-for-age.</p>

    <p><strong>Q3: How do I generate the official NNC Operation Timbang Plus summary sheet?</strong><br>
    <em>Answer:</em> Open <em>Admin Dashboard &rarr; Reports</em>. Select the target quarter and year, and click <em>"Export OPT+ NNC Form (.xlsx)"</em>.</p>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

<!-- ================= PAGE 16: SECURITY, SUPPORT & APPENDICES ================= -->
<div class="page">
  <div class="page-header">
    <img src="${headerB64}" alt="MarSU CICS Header Banner">
  </div>

  <div class="page-content">
    <h1>7 Security and User Reminders (RA 10173 Compliance)</h1>
    <p>
      Under the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, child growth metrics, diagnoses, and maternal counseling notes constitute Sensitive Personal Health Information:
    </p>
    <ul>
      <li>Never photograph or post patient records or malnutrition case cards on social media.</li>
      <li>Never disclose a beneficiary's nutritional status publicly in community assemblies.</li>
      <li>Never share user accounts or passwords with volunteers or unauthorized personnel.</li>
      <li>Ensure all mobile devices running AppScale have a screen PIN, fingerprint, or password lock enabled.</li>
    </ul>

    <h1>8 Support, Contact Roster & Appendices</h1>
    <table>
      <thead>
        <tr>
          <th>Support Office</th>
          <th>Designation / Person in Charge</th>
          <th>Contact Details</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Municipal Health Office</strong></td>
          <td>Municipal Health Officer (MHO) &bull; Rural Health Unit of Gasan</td>
          <td>mho.gasan@marinduque.gov.ph &bull; (042) 342-1001</td>
        </tr>
        <tr>
          <td><strong>Municipal Nutrition Office</strong></td>
          <td>Municipal Nutrition Action Officer (MNAO)</td>
          <td>nutrition.gasan@marinduque.gov.ph</td>
        </tr>
        <tr>
          <td><strong>AppScale Technical Support</strong></td>
          <td>BSIT Capstone Group 3 Development Team</td>
          <td>support.appscale@cics.edu.ph &bull; +63 912 345 6789</td>
        </tr>
        <tr>
          <td><strong>Data Protection Officer</strong></td>
          <td>Municipal LGU Data Privacy Compliance Unit</td>
          <td>dpo.gasan@marinduque.gov.ph</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 15px; background: #fdfcf9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; font-size: 8.2pt;">
      <strong>Official Appendices Index:</strong><br>
      &bull; <strong>Appendix A:</strong> National Nutrition Council (NNC) Form 1A — List of Affected Preschool Children<br>
      &bull; <strong>Appendix B:</strong> NNC Form 1B — Barangay Nutrition Consolidation & Prevalence Summary<br>
      &bull; <strong>Appendix C:</strong> DOH Clinical Nutrition Referral Slip & Physician Feedback Form
    </div>

    <div style="text-align: center; margin-top: 25px; font-size: 8.5pt; color: #666666; border-top: 1px solid #cbd5e1; padding-top: 8px;">
      <strong>AppScale Barangay Child Nutrition & Maternal Health Information System</strong><br>
      Deliverable #7: User's Manual of the System &bull; Capstone Project 2026 &bull; Marinduque State University (CICS)
    </div>
  </div>

  <div class="page-footer">
    <img src="${footerB64}" alt="MarSU Footer Banner">
  </div>
</div>

</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'AppScale_Deliverable7_Manual.html'), html, 'utf8');
console.log('AppScale_Deliverable7_Manual.html generated with all 7 missing sections!');

// Compile PDF with Chrome Headless
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pdfPath = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale.pdf');
const htmlPath = path.resolve('AppScale_Deliverable7_Manual.html');

console.log('Compiling comprehensive Deliverable 7 PDF via Chrome Headless...');
try {
  const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Success! Comprehensive Deliverable 7 PDF generated at:', pdfPath);
} catch (err) {
  console.error('Error generating PDF:', err);
}
