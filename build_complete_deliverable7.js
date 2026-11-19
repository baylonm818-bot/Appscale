const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, ImageRun, PageNumber, PageBreak
} = require('./backend/node_modules/docx');

const rootDir = __dirname;
const figuresDir = path.join(rootDir, 'manual_figures');
const docxPath = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale.docx');
const htmlPath = path.join(rootDir, 'AppScale_Deliverable7_Manual.html');
const pdfPath = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale.pdf');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Loading banner and screenshot assets...');
const headerBannerBuf = fs.readFileSync(path.join(rootDir, 'header_banner.jpg'));
const footerBannerBuf = fs.readFileSync(path.join(rootDir, 'footer_banner.jpg'));

// Read all figures
function getImgBuf(filename) {
  const p = path.join(figuresDir, filename);
  if (fs.existsSync(p)) return fs.readFileSync(p);
  console.warn('Image missing:', filename);
  return null;
}

const images = {
  bnsLogin: getImgBuf('fig_bns_login.png'),
  bnsAddChild: getImgBuf('fig_bns_add_child.png'),
  bnsAssessment: getImgBuf('fig_bns_assessment.png'),
  bnsReferral: getImgBuf('fig_bns_referral.png'),
  bnsFeeding: getImgBuf('fig_bns_feeding.png'),
  bnsMicronutrient: getImgBuf('fig_bns_micronutrient.png'),
  bnsSync: getImgBuf('fig_bns_sync.png'),
  bhwLogin: getImgBuf('fig_bhw_login.png'),
  authOtp: getImgBuf('fig_auth_otp.png'),
  bhwDashboard: getImgBuf('fig_bhw_dashboard.png'),
  bhwMedicalRecords: getImgBuf('fig_bhw_medical_records.png'),
  bhwNeedAttention: getImgBuf('fig_bhw_need_attention.png'),
  bhwReferrals: getImgBuf('fig_bhw_referrals.png'),
  adminDashboard: getImgBuf('fig_admin_dashboard.png'),
  adminUsers: getImgBuf('fig_admin_users.png'),
  adminSchedule: getImgBuf('fig_admin_schedule.png'),
  adminLogs: getImgBuf('fig_admin_logs.png'),
  adminSignatories: getImgBuf('fig_admin_signatories.png'),
  adminRegister: getImgBuf('fig_admin_register.png')
};

console.log('All image assets loaded.');

// Document helper styles
const MAROON = '800000';
const GOLD = 'D4AF37';
const DARK_GRAY = '333333';
const LIGHT_BG = 'F8F9FA';
const BORDER_COLOR = 'CCCCCC';

function p(text, options = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({
      text,
      font: options.font || 'Arial',
      size: options.size || 20, // 10pt
      bold: options.bold || false,
      italics: options.italics || false,
      color: options.color || DARK_GRAY
    }));
  } else if (Array.isArray(text)) {
    text.forEach(r => {
      runs.push(new TextRun({
        text: r.text || '',
        font: r.font || 'Arial',
        size: r.size || 20,
        bold: r.bold || false,
        italics: r.italics || false,
        color: r.color || DARK_GRAY
      }));
    });
  }
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: {
      before: options.before !== undefined ? options.before : 100,
      after: options.after !== undefined ? options.after : 100,
      line: options.line || 260
    },
    children: runs
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 26, // 13pt
        bold: true,
        color: MAROON
      })
    ]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 22, // 11pt
        bold: true,
        color: MAROON
      })
    ]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 140, after: 60 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 20, // 10pt
        bold: true,
        color: '1B5E20'
      })
    ]
  });
}

function figureImg(buf, widthPx, heightPx, caption) {
  const elements = [];
  if (buf) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [
        new ImageRun({
          data: buf,
          transformation: { width: widthPx, height: heightPx }
        })
      ]
    }));
  }
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 160 },
    children: [
      new TextRun({
        text: caption,
        font: 'Arial',
        size: 18, // 9pt
        bold: true,
        italics: true,
        color: '444444'
      })
    ]
  }));
  return elements;
}

function createFeatureSection(num, name, purpose, steps, imgBuf, imgWidth, imgHeight, figCaption, expectedResult) {
  const items = [];
  items.push(h3(`${num} ${name}`));
  
  // Purpose
  items.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: '• Purpose: ', font: 'Arial', size: 20, bold: true, color: '1B5E20' }),
      new TextRun({ text: purpose, font: 'Arial', size: 20, color: DARK_GRAY })
    ]
  }));

  // Procedure
  items.push(new Paragraph({
    spacing: { before: 80, after: 40 },
    children: [
      new TextRun({ text: '• Procedure (Step-by-Step Instructions):', font: 'Arial', size: 20, bold: true, color: '1B5E20' })
    ]
  }));

  steps.forEach((step, idx) => {
    items.push(new Paragraph({
      indent: { left: 360 },
      spacing: { before: 40, after: 40, line: 240 },
      children: [
        new TextRun({ text: `${idx + 1}. `, font: 'Arial', size: 20, bold: true, color: MAROON }),
        new TextRun({ text: step, font: 'Arial', size: 20, color: DARK_GRAY })
      ]
    }));
  });

  // Screenshot / Figure
  if (imgBuf) {
    items.push(...figureImg(imgBuf, imgWidth, imgHeight, figCaption));
  }

  // Expected Result
  items.push(new Paragraph({
    spacing: { before: 80, after: 140 },
    children: [
      new TextRun({ text: '• Expected Result: ', font: 'Arial', size: 20, bold: true, color: '1B5E20' }),
      new TextRun({ text: expectedResult, font: 'Arial', size: 20, italics: true, color: DARK_GRAY })
    ]
  }));

  return items;
}

console.log('Building Document sections...');

// We assemble the complete body children
const body = [];

// ================= PAGE 1: COVER PAGE =================
body.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [
      new ImageRun({
        data: headerBannerBuf,
        transformation: { width: 520, height: 85 }
      })
    ]
  }),
  p('DELIVERABLE #7', { font: 'Arial', size: 24, bold: true, color: '666666', alignment: AlignmentType.CENTER, before: 180, after: 60 }),
  p('APPSCALE', { font: 'Arial', size: 48, bold: true, color: MAROON, alignment: AlignmentType.CENTER, before: 60, after: 60 }),
  p('Barangay Child Nutrition & Maternal Health Information System', { font: 'Arial', size: 22, bold: true, color: '2E7D32', alignment: AlignmentType.CENTER, before: 40, after: 120 }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 },
    children: [
      new TextRun({ text: '—'.repeat(40), font: 'Arial', size: 18, color: GOLD, bold: true })
    ]
  }),
  p('USER\'S MANUAL OF THE SYSTEM', { font: 'Arial', size: 30, bold: true, color: MAROON, alignment: AlignmentType.CENTER, before: 100, after: 80 }),
  p('A Comprehensive Multi-Platform Operational Guide for Barangay Nutrition Scholars (BNS), Barangay Health Workers (BHW), and Municipal Health Administrators', { font: 'Arial', size: 20, italics: true, color: '444444', alignment: AlignmentType.CENTER, before: 40, after: 300 }),
  p('Target Beneficiaries & Partner Institution:', { font: 'Arial', size: 20, bold: true, color: DARK_GRAY, alignment: AlignmentType.CENTER, before: 100, after: 40 }),
  p('Rural Health Unit (RHU) & Municipal Health Office (MHO)\nMunicipality of Gasan, Province of Marinduque', { font: 'Arial', size: 20, color: '444444', alignment: AlignmentType.CENTER, before: 20, after: 260 }),
  p('Capstone Project Research Team (Group 3):', { font: 'Arial', size: 20, bold: true, color: MAROON, alignment: AlignmentType.CENTER, before: 100, after: 40 }),
  p('Jana Rose P. Rolle  |  Mark Joseph J. Baylon  |  Christopher C. Aranas  |  John Lloyd S. Tesio', { font: 'Arial', size: 20, bold: true, color: DARK_GRAY, alignment: AlignmentType.CENTER, before: 20, after: 40 }),
  p('College of Information and Computing Sciences (CICS)\nMarinduque State University — Main Campus, Boac, Marinduque\nAcademic Year 2026 – 2027', { font: 'Arial', size: 18, color: '666666', alignment: AlignmentType.CENTER, before: 40, after: 100 }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 2: DOCUMENT CONTROL & SIGN-OFF =================
body.push(
  h1('Document Control & Revision History'),
  p('This document undergoes structured version control to trace iterative developments, stakeholder reviews, and system enhancements for the AppScale multi-platform nutrition system.'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Date', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Version', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Author / Contributor', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Summary of Changes & Enhancements', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('09/16/2026')] }),
          new TableCell({ children: [p('v1.0')] }),
          new TableCell({ children: [p('Capstone Dev Team')] }),
          new TableCell({ children: [p('Initial user manual draft covering core mobile screening and web portal prototype.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('10/12/2026')] }),
          new TableCell({ children: [p('v1.5')] }),
          new TableCell({ children: [p('Capstone Dev Team')] }),
          new TableCell({ children: [p('Added 120-day supplementary feeding procedures and clinical referral protocol.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('11/04/2026')] }),
          new TableCell({ children: [p('v2.0')] }),
          new TableCell({ children: [p('Capstone Dev Team')] }),
          new TableCell({ children: [p('Integrated DOH/NNC OPT+ Form 1A/1B export, audit logging, and offline Hive sync.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('11/18/2026')] }),
          new TableCell({ children: [p('v3.0')] }),
          new TableCell({ children: [p('Capstone Dev Team')] }),
          new TableCell({ children: [p('Complete Deliverable #7 User\'s Manual featuring comprehensive 5-point instructions for all 18 features across BNS, BHW, and Admin roles with high-resolution UI screenshots.')] })
        ]
      })
    ]
  }),
  h2('Formal Review & Institutional Sign-Off Approvals'),
  p('The undersigned institutional advisors, academic panelists, and municipal health stakeholders have examined and formally approved this operational manual for field deployment:'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, children: [p('Role / Stakeholder', { bold: true, color: MAROON })] }),
          new TableCell({ shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, children: [p('Designated Official & Department', { bold: true, color: MAROON })] }),
          new TableCell({ shading: { fill: LIGHT_BG, type: ShadingType.CLEAR }, children: [p('Signature & Date of Approval', { bold: true, color: MAROON })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Capstone Project Adviser')] }),
          new TableCell({ children: [p('Engr. / Prof. Faculty Adviser\nMarSU College of Information and Computing Sciences')] }),
          new TableCell({ children: [p('_______________________  |  Date: ___/___/2026')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Technical Panel Reviewer')] }),
          new TableCell({ children: [p('Lead Systems Evaluator\nMarSU CICS Capstone Evaluation Committee')] }),
          new TableCell({ children: [p('_______________________  |  Date: ___/___/2026')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Municipal Health Stakeholder')] }),
          new TableCell({ children: [p('Municipal Health Officer (MHO) / MNAO\nRural Health Unit, Municipality of Gasan')] }),
          new TableCell({ children: [p('_______________________  |  Date: ___/___/2026')] })
        ]
      })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 3: TABLE OF CONTENTS =================
body.push(
  h1('Table of Contents'),
  p('The document is organized systematically into the following major chapters and sub-sections:'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [new TableCell({ children: [p('1. System Overview', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 5', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   1.1 Description of the System')] }), new TableCell({ children: [p('Page 5', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   1.2 Purpose, Objectives, and Expected Impact')] }), new TableCell({ children: [p('Page 5', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   1.3 Intended User Roles & Hierarchy (BNS, BHW, Admin)')] }), new TableCell({ children: [p('Page 5', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   1.4 Clinical Referral & Malnutrition Escalation Protocol')] }), new TableCell({ children: [p('Page 6', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   1.5 Offline-to-Cloud Data Synchronization Architecture')] }), new TableCell({ children: [p('Page 6', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('2. System Requirements & Operational Access', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 7', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   2.1 Hardware, Software, and Network Specifications')] }), new TableCell({ children: [p('Page 7', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   2.2 Access URLs, Mobile APK, and Cloud Deployment')] }), new TableCell({ children: [p('Page 7', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   2.3 User Account Provisioning & Password Security')] }), new TableCell({ children: [p('Page 7', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('3. Getting Started & User Authentication', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 8', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   3.1 Web & Mobile Portal Authentication')] }), new TableCell({ children: [p('Page 8', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   3.2 Password Reset & 6-Digit OTP Verification Flow')] }), new TableCell({ children: [p('Page 8', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   3.3 Multi-Platform Navigation & UI Layout')] }), new TableCell({ children: [p('Page 8', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('4. Operational Glossary of Health & Technical Terms', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 9', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('5. Step-by-Step User Instructions (Core Manual)', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 10', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   5.1 Role 1: Barangay Nutrition Scholar (BNS) — Mobile App (7 Features)', { bold: true, color: '1B5E20' })] }), new TableCell({ children: [p('Pages 10–13', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   5.2 Role 2: Barangay Health Worker (BHW) — Web Portal (5 Features)', { bold: true, color: '1B5E20' })] }), new TableCell({ children: [p('Pages 14–16', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('   5.3 Role 3: Municipal Health Administrator — Central Portal (6 Features)', { bold: true, color: '1B5E20' })] }), new TableCell({ children: [p('Pages 17–19', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('6. System Error Handling & Troubleshooting Matrix', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 20', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('7. Frequently Asked Questions (FAQ)', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 20', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('8. Security, Data Privacy (RA 10173), & Ethical Guidelines', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 21', { bold: true, alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('9. Support Roster, Project Directory, & Appendices', { bold: true, color: MAROON })] }), new TableCell({ children: [p('Page 21', { bold: true, alignment: AlignmentType.RIGHT })] })] })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 4: LIST OF FIGURES & LIST OF TABLES =================
body.push(
  h1('List of Figures & Tables'),
  h2('List of Figures'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [new TableCell({ children: [p('Figure 1: Clinical Referral & Malnutrition Escalation Flowchart', { bold: true })] }), new TableCell({ children: [p('Page 6', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 2: AppScale Offline-to-Cloud Data Synchronization Architecture', { bold: true })] }), new TableCell({ children: [p('Page 6', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 3: Mobile Authentication & Offline Field PIN Access Interface', { bold: true })] }), new TableCell({ children: [p('Page 10', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 4: Child Demographic Profiling & Household Registration Interface', { bold: true })] }), new TableCell({ children: [p('Page 11', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 5: OPT+ Anthropometric Assessment & Auto WHO Z-Score Interface', { bold: true })] }), new TableCell({ children: [p('Page 11', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 6: Immediate Red-Flag SAM Clinical Referral Trigger Interface', { bold: true })] }), new TableCell({ children: [p('Page 12', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 7: 120-Day Supplementary Feeding Program Attendance Interface', { bold: true })] }), new TableCell({ children: [p('Page 12', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 8: Micronutrient Supplementation & Deworming Record Interface', { bold: true })] }), new TableCell({ children: [p('Page 13', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 9: Local Hive Cache to Central Server Synchronization Interface', { bold: true })] }), new TableCell({ children: [p('Page 13', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 10: Barangay Health Worker Web Portal Login Interface', { bold: true })] }), new TableCell({ children: [p('Page 14', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 11: BHW Dashboard & Barangay Nutrition KPI Overview Interface', { bold: true })] }), new TableCell({ children: [p('Page 14', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 12: Child Medical Records, Growth History & BMI Interface', { bold: true })] }), new TableCell({ children: [p('Page 15', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 13: "Need Attention" High-Risk Malnutrition Triage Interface', { bold: true })] }), new TableCell({ children: [p('Page 15', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 14: Barangay Referral Lifecycle & Case Management Interface', { bold: true })] }), new TableCell({ children: [p('Page 16', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 15: Municipal Executive Nutrition Dashboard & Analytics Interface', { bold: true })] }), new TableCell({ children: [p('Page 17', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 16: Healthcare Personnel User Management & Role Provisioning Interface', { bold: true })] }), new TableCell({ children: [p('Page 17', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 17: Municipal Health Activity & Feeding Program Scheduler Interface', { bold: true })] }), new TableCell({ children: [p('Page 18', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 18: System Activity Audit Trail & Data Security Logs Interface', { bold: true })] }), new TableCell({ children: [p('Page 18', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 19: Official Report Signatories & Governance Configuration Interface', { bold: true })] }), new TableCell({ children: [p('Page 19', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Figure 20: Municipal Nutrition Officer Registration & Role Delegation Interface', { bold: true })] }), new TableCell({ children: [p('Page 19', { alignment: AlignmentType.RIGHT })] })] })
    ]
  }),
  h2('List of Tables'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [new TableCell({ children: [p('Table 1: User Roles and Access Privilege Hierarchy Matrix', { bold: true })] }), new TableCell({ children: [p('Page 5', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Table 2: Minimum and Recommended System Hardware/Software Specifications', { bold: true })] }), new TableCell({ children: [p('Page 7', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Table 3: Operational Glossary of Health, Nutrition & Technical Terms', { bold: true })] }), new TableCell({ children: [p('Page 9', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Table 4: World Health Organization (WHO) Child Growth Cut-Off Classification Matrix', { bold: true })] }), new TableCell({ children: [p('Page 12', { alignment: AlignmentType.RIGHT })] })] }),
      new TableRow({ children: [new TableCell({ children: [p('Table 5: System Error Codes, Diagnostic Causes, and Actionable Troubleshooting Matrix', { bold: true })] }), new TableCell({ children: [p('Page 20', { alignment: AlignmentType.RIGHT })] })] })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 5: 1. SYSTEM OVERVIEW =================
body.push(
  h1('1. System Overview'),
  h2('1.1 Description of the System'),
  p('AppScale is an enterprise-grade, offline-first multi-platform healthcare and nutrition information system specifically engineered for the Municipality of Gasan, Province of Marinduque. Combining a cross-platform Flutter mobile field application with a robust React web management portal and a secure Node.js/PostgreSQL cloud backend, AppScale modernizes community nutrition monitoring, eliminating manual paper ledger backlogs and empowering grassroots healthcare workers with automated clinical decision support.'),
  h2('1.2 Purpose, Objectives, and Expected Impact'),
  p('The primary objective of AppScale is to radically eliminate child malnutrition and enhance maternal care in grassroots communities through the following pillars:'),
  p('• Automated Clinical Precision: Replaces error-prone manual paper lookup tables with instant, automated WHO Child Growth Standards z-score computations for Weight-for-Age (WFA), Height-for-Age (HFA), and Weight-for-Length/Height (WFL/H).'),
  p('• Offline-First Field Resiliency: Enables Barangay Nutrition Scholars (BNS) to conduct complete house-to-house screening and feeding logs in remote rural areas with zero internet connectivity using encrypted local SQLite/Hive caching.'),
  p('• Streamlined Clinical Escalation: Automatically triggers immediate red-flag referral alerts for Severely Acutely Malnourished (SAM) children, notifying Barangay Health Workers (BHW) and the Rural Health Unit (RHU) for prompt therapeutic intervention.'),
  p('• Automated Institutional Reporting: Generates official National Nutrition Council (NNC) and Department of Health (DOH) Operation Timbang Plus Form 1A and Form 1B consolidated municipal reports in one click.'),
  h2('1.3 Intended User Roles & Hierarchy'),
  p('AppScale enforces a strict Role-Based Access Control (RBAC) hierarchy tailored to community health governance:'),
  p('Table 1: User Roles and Access Privilege Hierarchy Matrix', { bold: true, color: MAROON }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('User Role', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Primary Platform', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Target Personnel', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Authorized Core Capabilities', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Barangay Nutrition Scholar (BNS)', { bold: true })] }),
          new TableCell({ children: [p('Android Mobile App (Flutter)')] }),
          new TableCell({ children: [p('Assigned Barangay Field Nutritionist')] }),
          new TableCell({ children: [p('Offline child profiling, OPT+ anthropometrics, automated WHO z-scores, 120-day feeding tracking, SAM referrals, and Hive-to-Cloud sync.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Barangay Health Worker (BHW)', { bold: true })] }),
          new TableCell({ children: [p('Barangay Web Portal (React)')] }),
          new TableCell({ children: [p('Health Center Staff / Midwife')] }),
          new TableCell({ children: [p('Barangay dashboard monitoring, child medical histories, "Need Attention" high-risk triage, referral case management, and RHU clinic coordination.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Municipal Health Administrator (Admin)', { bold: true })] }),
          new TableCell({ children: [p('Central Web Portal (React)')] }),
          new TableCell({ children: [p('MHO, MNAO, Municipal Supervisors')] }),
          new TableCell({ children: [p('Executive cross-barangay analytics, user account provisioning, DOH/NNC Form 1A/1B export, schedule planning, audit logs, and signatories setup.')] })
        ]
      })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 6: 1.4 FLOWCHART & 1.5 ARCHITECTURE =================
body.push(
  h2('1.4 Clinical Referral & Malnutrition Escalation Protocol'),
  p('When a child undergoes screening, the embedded algorithm classifies anthropometric indices against WHO standards. Any diagnosis of Severe Acute Malnutrition (SAM) or bilateral edema immediately activates the automated clinical escalation protocol.'),
  p('[Flowchart Representation: BNS Field Screening -> Automated WHO Computation -> Status Check: Normal / MAM / SAM -> If SAM: Immediate Emergency Referral Alert to BHW Portal -> BHW Coordinates Clinical Assessment -> RHU Medical Officer Evaluates & Initiates RUTF Therapy -> Case Status Updated to Ongoing / Completed].'),
  p('Figure 1: Clinical Referral & Malnutrition Escalation Flowchart', { bold: true, italics: true, alignment: AlignmentType.CENTER }),
  h2('1.5 Offline-to-Cloud Data Synchronization Architecture'),
  p('AppScale utilizes an advanced offline-first architecture powered by Flutter and the Hive encrypted local key-value store. Field workers capture hundreds of household assessments without internet. When connectivity is re-established, the sync engine transmits compressed JSON payloads via REST APIs with JWT bearer authentication, resolving UUID collisions and guaranteeing zero data loss.'),
  p('[Architecture Diagram: Field Tablets (Hive Local Cache) <---> Secure HTTPS/REST API Gate <---> Node.js/Express Backend Server <---> PostgreSQL Relational Database & Cloud Storage <---> Web Portals (Admin & BHW React Clients)].'),
  p('Figure 2: AppScale Offline-to-Cloud Data Synchronization Architecture', { bold: true, italics: true, alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 7: 2. SYSTEM REQUIREMENTS & ACCESS =================
body.push(
  h1('2. System Requirements & Operational Access'),
  h2('2.1 Hardware, Software, and Network Specifications'),
  p('Table 2: Minimum and Recommended System Hardware/Software Specifications', { bold: true, color: MAROON }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Component', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Mobile Field App (BNS)', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Web Portals (BHW & Admin)', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Operating System', { bold: true })] }),
          new TableCell({ children: [p('Android 8.0 (Oreo) or higher (Android 11+ recommended)')] }),
          new TableCell({ children: [p('Windows 10/11, macOS Monterey+, or Ubuntu 20.04+')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Processor / RAM', { bold: true })] }),
          new TableCell({ children: [p('Quad-Core 1.8 GHz CPU, 2 GB RAM (3 GB+ recommended)')] }),
          new TableCell({ children: [p('Intel Core i3 / AMD Ryzen 3, 4 GB RAM (8 GB recommended)')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Storage Space', { bold: true })] }),
          new TableCell({ children: [p('150 MB free internal flash storage for Hive local cache')] }),
          new TableCell({ children: [p('500 MB free disk space for browser caching and PDF exports')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Network / Display', { bold: true })] }),
          new TableCell({ children: [p('Offline-capable; 3G/4G/Wi-Fi needed only for sync; 720x1280 screen')] }),
          new TableCell({ children: [p('Stable broadband (1 Mbps+); 1366x768 screen (1080p recommended)')] })
        ]
      })
    ]
  }),
  h2('2.2 Access URLs, Mobile APK, and Cloud Deployment'),
  p('• Official Central Web Management Portal: https://appscale-two.vercel.app/admin'),
  p('• Official Barangay Health Worker (BHW) Portal: https://appscale-two.vercel.app/bhw'),
  p('• Mobile Android Field APK Package: AppScale-Field-v3.0.apk (Distributed via Municipal Health IT)'),
  h2('2.3 User Account Provisioning & Password Security'),
  p('All BNS and BHW accounts are strictly created and provisioned by the Municipal Health Administrator. Passwords must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special symbol. Passwords expire periodically to uphold health data compliance.'),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 8: 3. GETTING STARTED & AUTHENTICATION =================
body.push(
  h1('3. Getting Started & User Authentication'),
  h2('3.1 Web & Mobile Portal Authentication'),
  p('Users sign in to their respective portals using their municipal email and assigned password. Upon successful verification, the backend issues an industry-standard JSON Web Token (JWT) with encrypted role claims. Sessions remain active for 8 hours on desktop workstations and persist securely in local encrypted storage on mobile field devices.'),
  h2('3.2 Password Reset & 6-Digit OTP Verification Flow'),
  p('In the event of forgotten credentials, health personnel can trigger the self-service password recovery protocol:'),
  p('1. Click "Forgot password" on the web login screen.'),
  p('2. Enter your registered health worker email address and click "Send OTP".'),
  p('3. Retrieve the 6-digit one-time verification code delivered to your registered email inbox via secure SMTP.'),
  p('4. Input the OTP and establish a new compliant password to instantly restore system access.'),
  h2('3.3 Multi-Platform Navigation & UI Layout'),
  p('The system interface is standardized with intuitive green-and-white theme accents, collapsible navigation drawers, breadcrumbs, and prominent action buttons ensuring optimal ergonomics during busy clinic hours and field visits.'),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 9: 4. GLOSSARY OF TERMS =================
body.push(
  h1('4. Operational Glossary of Health & Technical Terms'),
  p('Table 3: Operational Glossary of Health, Nutrition & Technical Terms', { bold: true, color: MAROON }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Term / Acronym', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Domain', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Operational Definition & Context within AppScale', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('BNS', { bold: true })] }),
          new TableCell({ children: [p('Health Personnel')] }),
          new TableCell({ children: [p('Barangay Nutrition Scholar: Grassroots worker tasked with household profiling, OPT+ screening, and feeding programs.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('BHW', { bold: true })] }),
          new TableCell({ children: [p('Health Personnel')] }),
          new TableCell({ children: [p('Barangay Health Worker: Health center staff managing medical records, high-risk triage, and referral coordination.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('OPT+', { bold: true })] }),
          new TableCell({ children: [p('DOH Protocol')] }),
          new TableCell({ children: [p('Operation Timbang Plus: National annual mass weighing and height measurement of children aged 0–59 months.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('SAM', { bold: true })] }),
          new TableCell({ children: [p('Clinical Diagnosis')] }),
          new TableCell({ children: [p('Severe Acute Malnutrition: Life-threatening condition (WFL/H < -3 SD or Edema) requiring urgent clinical referral.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('MAM', { bold: true })] }),
          new TableCell({ children: [p('Clinical Diagnosis')] }),
          new TableCell({ children: [p('Moderate Acute Malnutrition: WFL/H between -3 SD and -2 SD; prioritized for 120-day supplementary feeding.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('WFA / HFA / WFL/H', { bold: true })] }),
          new TableCell({ children: [p('WHO Indices')] }),
          new TableCell({ children: [p('Weight-for-Age (Underweight), Height-for-Age (Stunting), and Weight-for-Length/Height (Wasting/Thinness).')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Hive / SQLite', { bold: true })] }),
          new TableCell({ children: [p('Technical System')] }),
          new TableCell({ children: [p('Embedded, lightweight encrypted mobile databases enabling complete offline data entry and storage.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('RHU / MNAO', { bold: true })] }),
          new TableCell({ children: [p('Governance')] }),
          new TableCell({ children: [p('Rural Health Unit and Municipal Nutrition Action Officer governing health policies in Gasan.')] })
        ]
      })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGES 10–13: 5.1 BNS MOBILE INSTRUCTIONS (7 FEATURES) =================
body.push(
  h1('5. Step-by-Step User Instructions'),
  p('This chapter serves as the definitive, comprehensive operational manual for each major feature of the AppScale platform. For every feature, the user is provided with its Purpose, numbered step-by-step Procedure, official Screenshot with Figure Label, and the Expected Result.'),
  h2('5.1 Role 1: Barangay Nutrition Scholar (BNS) — Field Mobile Application'),
  p('The BNS mobile app is optimized for rapid, touch-friendly field screening with full offline resiliency.')
);

// Feature 5.1.1
body.push(...createFeatureSection(
  '5.1.1',
  'Feature Name: Mobile Authentication & Offline Field PIN Access',
  'Allows the BNS to securely log in to the AppScale mobile application on field devices, establish local encrypted credentials, and enable Quick-PIN offline authentication during field screening.',
  [
    'Launch the AppScale Field Mobile Application from your Android home screen or app launcher.',
    'Enter your assigned municipal email address (e.g., bns.cabugao@gasan.gov.ph) and password.',
    'Check the "Keep logged in offline" checkbox to cache your encrypted credentials locally in Hive storage.',
    'Optionally set up a 6-digit Quick-PIN for instant re-authentication during field visits.',
    'Tap the green "AUTHENTICATE & LOAD HIVE CACHE" button.'
  ],
  images.bnsLogin, 240, 450,
  'Figure 3: Mobile Authentication & Offline Field PIN Access Interface',
  'The app validates credentials, initializes the local encrypted Hive database, loads assigned barangay records, and navigates directly to the BNS Field Home Dashboard.'
));

// Feature 5.1.2
body.push(...createFeatureSection(
  '5.1.2',
  'Feature Name: Child Demographic Profiling & Household Registration',
  'Registers new child beneficiaries (0 to 59 months) into the official barangay masterlist, capturing demographic, residential, and 4Ps socioeconomic data.',
  [
    'From the BNS Field Home Screen, tap the "+ New Child Registration" floating action button.',
    'Input the child\'s complete legal name: First Name, Middle Name, and Last Name.',
    'Select the biological sex (Male or Female) using the radio selector.',
    'Tap the Date of Birth field and select the exact birthdate from the calendar picker (the system automatically calculates exact age in months).',
    'Specify the residential Barangay and Sitio / Purok address.',
    'Enter the primary Mother / Guardian full legal name and mobile contact number.',
    'Toggle the "4Ps Beneficiary Household" switch to YES or NO.',
    'Tap the green "SAVE PROFILE TO LOCAL HIVE" button.'
  ],
  images.bnsAddChild, 240, 450,
  'Figure 4: Child Demographic Profiling & Household Registration Interface',
  'A success confirmation banner appears, the child beneficiary is permanently recorded in the local Hive storage, and their profile is instantly queued for Operation Timbang Plus screening.'
));

// Feature 5.1.3
body.push(...createFeatureSection(
  '5.1.3',
  'Feature Name: OPT+ Anthropometric Assessment & Auto Z-Scores',
  'Captures physical weight and height measurements during mass OPT+ campaigns, automatically computing WHO Child Growth Standards z-scores and nutritional statuses.',
  [
    'Select the child beneficiary profile from your local masterlist and tap "New OPT+ Assessment".',
    'Calibrate the scale, weigh the child wearing minimal clothing, and enter Weight in kilograms to two decimal places (e.g., 8.90 kg).',
    'Measure Length (recumbent for children < 24 months) or Height (standing for children >= 24 months) using an approved stadiometer, and enter Height in centimeters (e.g., 79.5 cm).',
    'Select the measurement position (Lying Down / Recumbent or Standing Height).',
    'Examine both feet for fluid swelling and select Bilateral Pitting Edema (Present or Absent).',
    'Review the automatically computed WHO Child Growth Z-Scores displayed in real-time (WFA, HFA, and WFL/H).',
    'Tap "SAVE & TRIGGER CLINICAL REFERRAL" or "SAVE MEASUREMENT RECORD".'
  ],
  images.bnsAssessment, 240, 450,
  'Figure 5: OPT+ Anthropometric Assessment & Auto WHO Z-Score Interface',
  'The system assigns official DOH color-coded classifications (Normal [Green], Underweight/Stunted [Orange], SAM [Red]), saves the measurement record in local storage, and prompts for immediate referral if acute malnutrition is detected.'
));

// WHO Table 4
body.push(
  p('Table 4: World Health Organization (WHO) Child Growth Cut-Off Classification Matrix', { bold: true, color: MAROON }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Nutritional Index', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Z-Score Cut-Off', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Official Classification', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Mandatory Health Action', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Weight-for-Age (WFA)')] }),
          new TableCell({ children: [p('< -3 SD\n-3 SD to < -2 SD\n-2 SD to +1 SD')] }),
          new TableCell({ children: [p('Severely Underweight (SUW)\nUnderweight (UW)\nNormal')] }),
          new TableCell({ children: [p('Nutrition counseling, high-calorie meal plan, and monthly weighing follow-up.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Height-for-Age (HFA)')] }),
          new TableCell({ children: [p('< -3 SD\n-3 SD to < -2 SD\n-2 SD to +3 SD')] }),
          new TableCell({ children: [p('Severely Stunted (SSt)\nStunted (St)\nNormal')] }),
          new TableCell({ children: [p('Chronic stunting intervention, micronutrient supplementation, and dietary diversity education.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('Weight-for-Length/Height (WFL/H)')] }),
          new TableCell({ children: [p('< -3 SD or Edema\n-3 SD to < -2 SD\n-2 SD to +2 SD')] }),
          new TableCell({ children: [p('Severely Wasted (SAM)\nModerately Wasted (MAM)\nNormal')] }),
          new TableCell({ children: [p('SAM: Immediate clinical referral to RHU & RUTF therapy. MAM: 120-day feeding program enrollment.')] })
        ]
      })
    ]
  })
);

// Feature 5.1.4
body.push(...createFeatureSection(
  '5.1.4',
  'Feature Name: Immediate Red-Flag SAM Clinical Referral Trigger',
  'Automatically initiates an urgent clinical referral notification to the Barangay Health Center and RHU Gasan whenever severe acute malnutrition (SAM) or bilateral pitting edema is identified.',
  [
    'When an anthropometric assessment evaluates WFL/H below -3 SD or bilateral pitting edema is marked Present, the red "RED FLAG ALERT TRIGGERED" interface activates.',
    'Confirm the Severity Level pre-selected as "HIGH SEVERITY (SAM CLINICAL)".',
    'Verify the Receiving Health Facility defaulted to "Gasan Rural Health Unit (RHU Clinic)".',
    'Enter clinical remarks, observed symptoms, appetite test findings, and family background.',
    'Select the assigned BHW case manager for the respective community cluster.',
    'Tap the red "SUBMIT EMERGENCY REFERRAL TO BHW" button.'
  ],
  images.bnsReferral, 240, 450,
  'Figure 6: Immediate Red-Flag SAM Clinical Referral Trigger Interface',
  'An emergency referral record is immediately generated, flagged with highest priority, and queued for real-time notification on the BHW Barangay Web Portal upon sync.'
));

// Feature 5.1.5
body.push(...createFeatureSection(
  '5.1.5',
  'Feature Name: 120-Day Supplementary Feeding Program (SFP) Attendance',
  'Records daily meal attendance, dietary intake, and ration collection for targeted undernourished children enrolled in the standard 120-day supplementary feeding cycle.',
  [
    'Navigate to the "Feeding Program" module from the mobile bottom navigation bar.',
    'Select the active feeding cycle (e.g., Cycle Day 45 of 120).',
    'Review the scheduled daily menu (e.g., Iron-Fortified Lugaw + Boiled Egg + Malunggay).',
    'For each enrolled beneficiary attending at the center, tap to toggle status to "PRESENT (Fed)".',
    'If a parent collects the meal for home feeding, select "RATION PICKUP".',
    'If the child is absent due to illness, mark "EXCUSED / SICK" and enter brief medical notes.',
    'Tap "SUBMIT DAILY FEEDING ATTENDANCE".'
  ],
  images.bnsFeeding, 240, 450,
  'Figure 7: 120-Day Supplementary Feeding Program Attendance Interface',
  'Daily attendance metrics and ration distribution logs are saved in the local database, updating the child\'s 120-day compliance percentage.'
));

// Feature 5.1.6
body.push(...createFeatureSection(
  '5.1.6',
  'Feature Name: Micronutrient Supplementation & Deworming Health Entry',
  'Documents the administration of high-dose Vitamin A capsules and Deworming chemotherapy (Albendazole) under national Garantisadong Pambata campaigns.',
  [
    'Open the child beneficiary\'s profile and select the "Programs & Interventions" tab.',
    'Tap "Record Micronutrient Dose".',
    'Select the supplement administered: Vitamin A (Blue Capsule 100,000 IU for 6–11 mos, or Red Capsule 200,000 IU for 12–59 mos).',
    'Select the campaign round (e.g., Garantisadong Pambata Round 2 - 2026).',
    'If the child is 12 months or older, check the Deworming Dose (Albendazole 400mg) administration status.',
    'Enter the pharmaceutical batch and lot tracking number for DOH audit compliance.',
    'Tap "RECORD TO MEDICAL PROFILE".'
  ],
  images.bnsMicronutrient, 240, 450,
  'Figure 8: Micronutrient Supplementation & Deworming Record Interface',
  'The health intervention is permanently logged to the patient\'s health card, and the next semi-annual due date is automatically scheduled.'
));

// Feature 5.1.7
body.push(...createFeatureSection(
  '5.1.7',
  'Feature Name: Local Hive Cache to Central Server Synchronization (One-Tap Sync)',
  'Synchronizes all offline screening records, anthropometric assessments, and feeding logs cached in mobile Hive storage to the central AppScale PostgreSQL database.',
  [
    'Verify that the mobile device has acquired an active Wi-Fi or cellular mobile data connection.',
    'Tap the "Cloud Sync" icon on the top navigation bar or select "Offline Sync Status" from the side drawer.',
    'Inspect the pending synchronization queue (e.g., 6 Assessments, 45 Feeding Records, 1 Emergency Referral).',
    'Tap the prominent button "SYNC ALL RECORDS NOW".',
    'Maintain connectivity while the progress bar uploads encrypted data chunks to the central API.',
    'Verify the appearance of the green "INTERNET CONNECTED" checkmark and confirmation message.'
  ],
  images.bnsSync, 240, 450,
  'Figure 9: Local Hive Cache to Central Server Synchronization Interface',
  'All local records are merged into the central database with timestamps preserved, UUID collisions are resolved, and the local pending queue count resets to 0.'
));

// ================= PAGES 14–16: 5.2 BHW WEB PORTAL INSTRUCTIONS (5 FEATURES) =================
body.push(
  new Paragraph({ children: [new PageBreak()] }),
  h2('5.2 Role 2: Barangay Health Worker (BHW) — Barangay Web Portal'),
  p('The BHW web portal enables health center staff to review demographic masterlists, monitor community nutrition statuses, triage high-risk malnutrition, and manage clinical referrals.')
);

// Feature 5.2.1
body.push(...createFeatureSection(
  '5.2.1',
  'Feature Name: BHW Web Portal Login & Password Recovery',
  'Provides secure, authenticated web access for Barangay Health Workers to manage health records, monitor community malnutrition, and process clinical referrals.',
  [
    'Open Google Chrome or Mozilla Firefox and navigate to the portal URL: https://appscale-two.vercel.app/login.',
    'Enter your authorized BHW email address (e.g., baylonmark194@gmail.com) and password.',
    'Check "Remember me" on health center workstations to maintain active credentials.',
    'If you have forgotten your password, click "Forgot Password?", input your registered email, and retrieve the 6-digit OTP code sent via SMTP to reset credentials.',
    'Click the green "Sign in" button.'
  ],
  images.bhwLogin, 480, 270,
  'Figure 10: Barangay Health Worker Web Portal Login Interface',
  'The backend verifies the credentials, issues a JWT token with BHW claims, and redirects the user directly to the Barangay Health Worker Dashboard.'
));

// Feature 5.2.2
body.push(...createFeatureSection(
  '5.2.2',
  'Feature Name: Barangay Health Worker Dashboard Overview',
  'Displays comprehensive real-time community nutrition metrics, active case tallies, upcoming clinic schedules, and monthly health monitoring trends for the assigned barangay.',
  [
    'After signing in, click "Dashboard" in the left-hand navigation sidebar.',
    'Review the top KPI summary cards: Total Children Registered, Total Mothers (Lactating & Postpartum), At-Risk Children, and At-Risk Mothers.',
    'Inspect the "Children Nutrition Status" panel breaking down cases into Normal (Green), Stunted (Orange), Wasted (Pink), and Underweight (Yellow).',
    'Review the "Upcoming Schedule" card listing immunization days, weighing sessions, and supplementary feeding dates.',
    'Examine the "Monthly Health Visits & Monitoring" chart tracking barangay screening coverage over the past 6 months.'
  ],
  images.bhwDashboard, 480, 270,
  'Figure 11: BHW Dashboard & Barangay Nutrition KPI Overview Interface',
  'The BHW obtains instant situational awareness of community nutritional health and upcoming clinical appointments in their assigned barangay.'
));

// Feature 5.2.3
body.push(...createFeatureSection(
  '5.2.3',
  'Feature Name: Child Health Masterlist & Medical Growth Monitoring',
  'Enables detailed examination of registered children\'s historical health dossiers, longitudinal BMI calculations, and dispensing of clinical medications.',
  [
    'Click "Medical Records" in the left sidebar navigation menu.',
    'Use the real-time search field to filter records by child name or guardian name (e.g., Carlo Santos).',
    'Filter by nutritional status (All Statuses, Normal, Underweight, Stunted, SAM) or Age Groups.',
    'Click on a child\'s record card in the directory list to load their full dossier in the right pane.',
    'Review the "Growth History & BMI" tab showing chronological dates, ages, weights, heights, computed BMI (kg/m²), and WHO statuses.',
    'Click "+ Record Medication / Intervention" to log newly administered vitamins, deworming pills, or clinical treatments.'
  ],
  images.bhwMedicalRecords, 480, 270,
  'Figure 12: Child Medical Records, Growth History & BMI Interface',
  'The patient\'s longitudinal growth history is displayed with tabular precision, enabling the health worker to detect growth faltering and initiate prompt interventions.'
));

// Feature 5.2.4
body.push(...createFeatureSection(
  '5.2.4',
  'Feature Name: "Need Attention" High-Risk Malnutrition Triage Filter',
  'Isolates severely and moderately malnourished children and overdue health checkups into an urgent triage queue for prioritized home visits and feeding program enrollment.',
  [
    'Click the "Need Attention" tab in the left sidebar navigation menu.',
    'Review the triage KPI cards: Total At-Risk, Severe (SAM), Moderate (MAM), and Overdue (>30D).',
    'Examine the prioritized beneficiary queue displaying child name, guardian, age in months, current weight/height, and specific malnutrition diagnosis.',
    'Click "Log Visit" to document a clinical home visit, dietary assessment, or parental counseling session.',
    'Click "Refer" to escalate the child\'s case directly to the Rural Health Unit or Municipal Doctor for specialized care.'
  ],
  images.bhwNeedAttention, 480, 270,
  'Figure 13: "Need Attention" High-Risk Malnutrition Triage Interface',
  'Health center staff quickly prioritize the most vulnerable children, preventing dropouts and ensuring timely clinical care.'
));

// Feature 5.2.5
body.push(...createFeatureSection(
  '5.2.5',
  'Feature Name: Multi-Stage Referral Management & Case Status Escalation',
  'Tracks the full lifecycle of clinical referrals forwarded by BNS field workers, coordinating patient transfers, clinical feedback, and rehabilitation tracking.',
  [
    'Click "Referrals" in the left sidebar navigation menu.',
    'Switch between status tabs: All Referrals, Pending (awaiting action), Received (acknowledged by clinic), Ongoing (under treatment), Completed (rehabilitated), or Archived.',
    'Filter by beneficiary type (Child or Lactating Mother) or search by patient name.',
    'Locate a specific referral card (e.g., Elai Habal - Bilateral Pitting Edema, HIGH SEVERITY).',
    'Click the green "Update Status" button on the referral card.',
    'Update the status dropdown, document clinical notes or treatments administered, select the receiving facility, and save changes.'
  ],
  images.bhwReferrals, 480, 270,
  'Figure 14: Barangay Referral Lifecycle & Case Management Interface',
  'The referral status updates in real-time across both web and mobile platforms, maintaining complete transparency between community workers and RHU clinicians.'
));

// ================= PAGES 17–19: 5.3 MUNICIPAL ADMIN INSTRUCTIONS (6 FEATURES) =================
body.push(
  new Paragraph({ children: [new PageBreak()] }),
  h2('5.3 Role 3: Municipal Health Administrator (MHO / Admin) — Central Web Portal'),
  p('The Central Web Portal provides the Municipal Health Officer (MHO) and Municipal Nutrition Action Officer (MNAO) with high-level epidemiological analytics, staff provisioning, reporting tools, and audit logs.')
);

// Feature 5.3.1
body.push(...createFeatureSection(
  '5.3.1',
  'Feature Name: Municipal Nutrition Executive Dashboard & Cross-Barangay Analytics',
  'Provides municipal executives with comprehensive real-time nutrition epidemiology, prevalence metrics, and cross-barangay comparative analytics across Gasan.',
  [
    'Sign in to the Central Web Portal with administrator credentials at https://appscale-two.vercel.app/login.',
    'Click "Dashboard" in the municipal admin navigation menu.',
    'Examine municipal-wide KPI cards: Total Health Workers, Registered Children, Registered Mothers, and Monitored Barangays.',
    'Analyze the "Municipal Nutrition Breakdown" progress bars showing exact percentage distributions for Normal, Underweight, Severely Underweight, Stunted, and Wasted children.',
    'Inspect the "Malnutrition Cases by Barangay" comparative bar chart with timeframe filters (3M, 6M, 1Y) to identify high-burden barangays.'
  ],
  images.adminDashboard, 480, 270,
  'Figure 15: Municipal Executive Nutrition Dashboard & Analytics Interface',
  'Municipal executives obtain clear epidemiological evidence to strategically target nutrition budgets, supplementary food rations, and medical resources.'
));

// Feature 5.3.2
body.push(...createFeatureSection(
  '5.3.2',
  'Feature Name: Healthcare Personnel User Management & Role Provisioning',
  'Allows administrators to create, verify, manage, lock, and archive user accounts for all Barangay Nutrition Scholars (BNS) and Barangay Health Workers (BHW).',
  [
    'Click "User Management" in the admin sidebar navigation menu.',
    'Review summary tallies: Total Users, Total BNS, Total BHW, and Locked Accounts.',
    'Click the green "+ Add User" button in the upper-right corner to provision a new health worker.',
    'Fill in the required fields: Full Name, Official Email, Assigned Barangay (e.g., Cabugao, Antipolo), Role (BNS or BHW), and initial temporary password.',
    'To manage existing personnel, search by name or filter by barangay and status.',
    'Click "View" to inspect activity, "Lock" to temporarily suspend access, or "Archive" upon personnel reassignment.'
  ],
  images.adminUsers, 480, 270,
  'Figure 16: Healthcare Personnel User Management & Role Provisioning Interface',
  'New health personnel receive activated system credentials, enforce strict role-based access control, and are scoped strictly to their assigned barangay.'
));

// Feature 5.3.3
body.push(...createFeatureSection(
  '5.3.3',
  'Feature Name: Municipal Health Activity & Supplementary Feeding Scheduler',
  'Plans, schedules, and publishes municipal-wide health campaigns, including Operation Timbang schedules, immunization rounds, and 120-day feeding program milestones.',
  [
    'Click "Schedule" in the sidebar navigation menu.',
    'Review activity statistics cards: Total Activities, Upcoming, Completed, and Archived.',
    'Click "+ Add Activity" to schedule a new health or nutrition event.',
    'Enter Event Title (e.g., Feeding Program Cycle 2 Launch), select Category (Feeding, Weighing / OPT+, Immunization, Mother Visitation), select Venue, and target Date/Time.',
    'Select target barangays (All Barangays or specific barangays) and assigned personnel roles.',
    'Click "Save Activity".'
  ],
  images.adminSchedule, 480, 270,
  'Figure 17: Municipal Health Activity & Feeding Program Scheduler Interface',
  'The event is published to the central municipal calendar, synchronizing automatically to the mobile calendars of assigned BNS workers.'
));

// Feature 5.3.4
body.push(...createFeatureSection(
  '5.3.4',
  'Feature Name: System Activity Audit Trail & Data Security Logs',
  'Maintains an immutable, timestamped audit log of all system activities, data changes, and clinical referrals in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).',
  [
    'Click "System Logs" in the sidebar navigation menu.',
    'Use the search bar to filter logs by specific keywords, patient ID, or worker name.',
    'Filter logs by Barangay (e.g., Antipolo, Cabugao, All Barangays) and Role (BNS only, BHW only, All Roles).',
    'Inspect the chronological log table: Timestamp, Barangay, Actor / Worker, Role, Action (e.g., RECORD_NUTRITION_ASSESSMENT, SUBMIT_REFERRAL), Entity ID, and Changes Summary.',
    'Click the green "Inspect" button on any record to view the raw JSON diff and payload metadata.'
  ],
  images.adminLogs, 480, 270,
  'Figure 18: System Activity Audit Trail & Data Security Logs Interface',
  'Administrators verify data integrity, trace user actions for forensic auditing, and ensure patient health records remain secure.'
));

// Feature 5.3.5
body.push(...createFeatureSection(
  '5.3.5',
  'Feature Name: Official Report Signatories & Governance Configuration',
  'Configures authorized municipal and barangay certifying signatories appearing on generated DOH/NNC Operation Timbang Plus summary reports (Form 1A and Form 1B).',
  [
    'Click "Signatories" in the sidebar navigation menu.',
    'Select the configuration scope using the Barangay dropdown (All Barangays or individual barangays).',
    'In Position Slot 1, specify the title (e.g., Municipal Nutrition Action Officer) and full name of the officer.',
    'In Position Slot 2, specify the medical director title (e.g., Municipal Health Officer) and full physician name.',
    'In Position Slot 3, specify the barangay representative title (e.g., Barangay Nutrition Scholar) and name.',
    'Click "+ Add Signatory" to append additional certifying officials if required.',
    'Click the green "Save Changes" button.'
  ],
  images.adminSignatories, 480, 270,
  'Figure 19: Official Report Signatories & Governance Configuration Interface',
  'Official signatures and titles are embedded into the footer certification blocks of exported DOH/NNC PDF and Excel reports.'
));

// Feature 5.3.6
body.push(...createFeatureSection(
  '5.3.6',
  'Feature Name: Municipal Nutrition Officer Registration & Role Delegation',
  'Allows authorized municipal health supervisors to register new administrative accounts with elevated credentials.',
  [
    'Navigate to the Admin Registration interface at /register or via administrative delegation.',
    'Enter the official Full Name of the municipal supervisor (e.g., Dr. Maria Santos).',
    'Specify the Municipality / Office jurisdiction (e.g., Municipality of Gasan — Municipal Health Office).',
    'Select the official Position / Title (e.g., Municipal Nutrition Officer or Municipal Health Officer).',
    'Choose a secure administrative username and strong password (minimum 8 characters with alphanumeric and special characters).',
    'Confirm the password and click "Create Admin Account".'
  ],
  images.adminRegister, 480, 270,
  'Figure 20: Municipal Nutrition Officer Registration & Role Delegation Interface',
  'The new administrative account is created with encrypted credentials, assigned top-tier municipal management permissions, and logged in the audit trail.'
));

// ================= PAGE 20: 6. ERROR HANDLING & 7. FAQ =================
body.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1('6. System Error Handling & Troubleshooting Matrix'),
  p('Table 5: System Error Codes, Diagnostic Causes, and Actionable Troubleshooting Matrix', { bold: true, color: MAROON }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Error Code / Alert', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Probable Technical Cause', { bold: true, color: 'FFFFFF' })] }),
          new TableCell({ shading: { fill: MAROON, type: ShadingType.CLEAR }, children: [p('Actionable User Resolution & Remedy', { bold: true, color: 'FFFFFF' })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('ERR_AUTH_EXPIRED (401)', { bold: true })] }),
          new TableCell({ children: [p('JWT session token has expired after 8 hours of inactivity.')] }),
          new TableCell({ children: [p('Log out and log back in with your authorized email and password to refresh the security token.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('ERR_SYNC_NETWORK_TIMEOUT', { bold: true })] }),
          new TableCell({ children: [p('Weak or dropped cellular connection during mobile cloud sync.')] }),
          new TableCell({ children: [p('Records remain safely cached in Hive storage. Move to an area with reliable signal and tap Sync again.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('ERR_WHO_INVALID_RANGE', { bold: true })] }),
          new TableCell({ children: [p('Entered weight or height falls outside biological feasibility (e.g., 90 kg for 2-year-old).')] }),
          new TableCell({ children: [p('Re-calibrate scale and stadiometer, re-measure child, and verify correct decimal placement.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('ERR_DUPLICATE_BENEFICIARY', { bold: true })] }),
          new TableCell({ children: [p('Child with identical name and birthdate already registered in the barangay.')] }),
          new TableCell({ children: [p('Search masterlist first. If updating records, open existing profile rather than creating a new entry.')] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p('ERR_SMTP_OTP_FAILED', { bold: true })] }),
          new TableCell({ children: [p('SMTP email relay failure during password recovery code dispatch.')] }),
          new TableCell({ children: [p('Check spam folder, verify registered email address, or contact Municipal Health Admin for manual reset.')] })
        ]
      })
    ]
  }),
  h1('7. Frequently Asked Questions (FAQ)'),
  p('Q: Can I use the mobile application in remote sitios with zero mobile reception?'),
  p('A: Yes! AppScale is built offline-first. All demographic entries, anthropometric measurements, and feeding logs are stored locally in Hive storage and will synchronize automatically when internet connectivity is restored.'),
  p('Q: How are WHO Z-scores calculated? Does the BNS need manual lookup charts?'),
  p('A: No manual lookup is required. AppScale embeds the exact World Health Organization Child Growth Standards LMS parameters. The system automatically computes WFA, HFA, and WFL/H z-scores in milliseconds upon entering weight and height.'),
  p('Q: Who can export the official DOH / NNC Form 1A and Form 1B reports?'),
  p('A: Only authorized Municipal Health Administrators (MHO and MNAO) have permissions to generate and export official consolidated municipal reports with embedded legal signatories.'),
  new Paragraph({ children: [new PageBreak()] })
);

// ================= PAGE 21: 8. SECURITY & 9. SUPPORT ROSTER =================
body.push(
  h1('8. Security, Data Privacy (RA 10173), & Ethical Guidelines'),
  p('In strict compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), AppScale enforces rigorous security safeguards to protect sensitive pediatric health records and maternal demographic data:'),
  p('• Data Encryption in Transit & Rest: All network transmissions use Transport Layer Security (TLS 1.3/HTTPS). Local databases on field tablets are encrypted using AES-256.'),
  p('• Strict Role-Based Scoping: BNS and BHW workers have access strictly limited to their assigned barangay jurisdiction, preventing unauthorized cross-barangay data access.'),
  p('• Mandatory Tamper-Evident Audit Logging: Every clinical modification, assessment record, and user access is permanently recorded in the system audit trail.'),
  h1('9. Support Roster, Project Directory, & Appendices'),
  p('For technical assistance, system onboarding, bug reports, or administrative credentials, contact the AppScale Capstone Development Team or the Municipal Health Office:'),
  p('• Capstone Development Team (Group 3):', { bold: true }),
  p('  - Jana Rose P. Rolle (Project Lead / Health Systems Coordinator)'),
  p('  - Mark Joseph J. Baylon (Mobile Application Developer & Flutter Engineer)'),
  p('  - Christopher C. Aranas (Backend & Database Architecture Engineer)'),
  p('  - John Lloyd S. Tesio (Full-Stack Web Portal Developer & QA Lead)'),
  p('• Institutional Partner & Health Authority:', { bold: true }),
  p('  - Rural Health Unit (RHU) & Municipal Health Office (MHO), Municipality of Gasan, Marinduque'),
  p('  - College of Information and Computing Sciences (CICS), Marinduque State University, Boac, Marinduque'),
  p('• Technical Support Helpline & Email:', { bold: true }),
  p('  - Email: support.appscale@gasan.gov.ph  |  cics@mscmarinduque.edu.ph'),
  p('  - Hotlines: (042) 332-1000 / 0912-345-6789')
);

console.log('Building Document sections completed. Creating Docx object...');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Arial', size: 20, color: DARK_GRAY }
      }
    }
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 } // 0.5 in top/bottom, 0.75 in left/right
        },
        differentFirstPage: true
      },
      headers: {
        first: new Header({ children: [] }),
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 80 },
              children: [
                new ImageRun({
                  data: headerBannerBuf,
                  transformation: { width: 520, height: 75 }
                })
              ]
            })
          ]
        })
      },
      footers: {
        first: new Footer({ children: [] }),
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 0 },
              children: [
                new ImageRun({
                  data: footerBannerBuf,
                  transformation: { width: 520, height: 50 }
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 0 },
              children: [
                new TextRun({
                  text: 'Deliverable #7: User\'s Manual of the System  |  Page ',
                  font: 'Arial',
                  size: 16,
                  color: '666666'
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: 'Arial',
                  size: 16,
                  bold: true,
                  color: MAROON
                })
              ]
            })
          ]
        })
      },
      children: body
    }
  ]
});

console.log('Packing Word Document (.docx)...');
Packer.toBuffer(doc).then(buffer => {
  const v3Path = path.join(rootDir, 'Deliverable_No_7_-_User\'s_Manual_AppScale_v3.docx');
  fs.writeFileSync(v3Path, buffer);
  console.log(`Word Document saved successfully at: ${v3Path} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  try {
    fs.writeFileSync(docxPath, buffer);
    console.log(`Word Document also updated at: ${docxPath}`);
  } catch (err) {
    console.warn(`Note: Could not overwrite ${docxPath} because it is currently open in Word/another app. Saved as ${v3Path}`);
  }
}).catch(err => {
  console.error('Error generating docx:', err);
});
