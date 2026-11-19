const fs = require('fs');
const path = require('path');
const docx = require('c:/Users/JOHN LLYOD TESIO/OneDrive/Documents/AppScale-Web-main/backend/node_modules/docx');

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun
} = docx;

const rootDir = 'c:\\Users\\JOHN LLYOD TESIO\\OneDrive\\Documents\\AppScale-Web-main';

// Assets
const headerImgBuf = fs.readFileSync(path.join(rootDir, 'header_banner.jpg'));
const footerImgBuf = fs.readFileSync(path.join(rootDir, 'footer_banner.jpg'));

let img1Buf = null; // Admin Dashboard
let img2Buf = null; // Beneficiary Medical Record
let img3Buf = null; // Mobile App Screen

if (fs.existsSync(path.join(rootDir, 'doc_assets/image1.png'))) {
  img1Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image1.png'));
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image2.png'))) {
  img2Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image2.png'));
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image3.png'))) {
  img3Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image3.png'));
}

console.log('Generating 100% faithful DOCX matching PDF Deliverable 7...');

// Theme Colors
const COLOR_MAROON = '7A1C28';
const COLOR_GOLD = 'D4AF37';
const COLOR_DARK = '1A202C';
const COLOR_GRAY = '4A5568';
const COLOR_LIGHT_BG = 'F8FAFC';
const COLOR_BORDER = 'CBD5E1';

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function h1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_MAROON }
    }
  });
}

function h2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 60 }
  });
}

function h3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 130, after: 40 }
  });
}

function p(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        size: 19, // ~9.5pt
        font: 'Segoe UI',
        color: COLOR_DARK,
        bold: !!options.bold,
        italics: !!options.italics
      })
    ],
    spacing: { before: 30, after: 60, ...options.spacing },
    alignment: options.alignment || AlignmentType.LEFT
  });
}

function step(num, title, desc) {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${num}. ${title}: `,
        bold: true,
        color: COLOR_MAROON,
        font: 'Segoe UI',
        size: 19
      }),
      new TextRun({
        text: desc,
        color: COLOR_DARK,
        font: 'Segoe UI',
        size: 19
      })
    ],
    spacing: { before: 30, after: 50 },
    indent: { left: 300 }
  });
}

function callout(title, text, type = 'info') {
  let borderColor = COLOR_MAROON;
  let bgColor = 'FDF2F4';
  if (type === 'gold') {
    borderColor = COLOR_GOLD;
    bgColor = 'FEF9E7';
  } else if (type === 'danger') {
    borderColor = 'DC2626';
    bgColor = 'FEF2F2';
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[ ${title} ] `,
                    bold: true,
                    color: borderColor,
                    font: 'Segoe UI',
                    size: 18
                  }),
                  new TextRun({
                    text: text,
                    color: COLOR_DARK,
                    font: 'Segoe UI',
                    size: 18
                  })
                ]
              })
            ],
            shading: { fill: bgColor },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE }
            },
            margins: { top: 80, bottom: 80, left: 140, right: 140 }
          })
        ]
      })
    ]
  });
}

function createTable(headers, rows, colWidths = null) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: colWidths ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
      children: [
        new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', font: 'Segoe UI', size: 17 })],
          alignment: AlignmentType.CENTER
        })
      ],
      shading: { fill: COLOR_MAROON },
      borders: cellBorders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 }
    }))
  });

  const bodyRows = rows.map((r, rIdx) => new TableRow({
    children: r.map((c, i) => new TableCell({
      width: colWidths ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
      children: [
        new Paragraph({
          children: [new TextRun({ text: c, font: 'Segoe UI', size: 17, color: COLOR_DARK })]
        })
      ],
      shading: { fill: rIdx % 2 === 1 ? COLOR_LIGHT_BG : 'FFFFFF' },
      borders: cellBorders,
      margins: { top: 50, bottom: 50, left: 70, right: 70 }
    }))
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows]
  });
}

function createTocTable(entries) {
  const noBorder = { style: BorderStyle.NONE };
  const dotBorder = { style: BorderStyle.DOTTED, size: 4, color: 'A0AEC0' };

  const rows = entries.map(item => {
    const isLevel1 = item.level === 1;
    const isLevel2 = item.level === 2;
    const isLevel3 = item.level === 3;

    let indentText = '';
    if (isLevel2) indentText = '    ';
    if (isLevel3) indentText = '        ';

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 88, type: WidthType.PERCENTAGE },
          borders: { top: noBorder, bottom: dotBorder, left: noBorder, right: noBorder },
          margins: { top: 35, bottom: 35, left: 0, right: 30 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: indentText + item.title,
                  font: 'Segoe UI',
                  bold: isLevel1,
                  size: isLevel1 ? 19 : (isLevel2 ? 18 : 17),
                  color: isLevel1 ? COLOR_MAROON : (isLevel2 ? COLOR_DARK : COLOR_GRAY)
                })
              ],
              spacing: { before: isLevel1 ? 40 : 15, after: 15 }
            })
          ]
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          borders: { top: noBorder, bottom: dotBorder, left: noBorder, right: noBorder },
          margins: { top: 35, bottom: 35, left: 30, right: 0 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: item.page,
                  font: 'Segoe UI',
                  bold: isLevel1,
                  size: isLevel1 ? 19 : (isLevel2 ? 18 : 17),
                  color: isLevel1 ? COLOR_MAROON : COLOR_DARK
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: isLevel1 ? 40 : 15, after: 15 }
            })
          ]
        })
      ]
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows
  });
}

// -------------------------------------------------------------
// SECTION 1: COVER PAGE (Matches DILG WorkMate CICS Template)
// -------------------------------------------------------------
const coverChildren = [
  new Paragraph({
    children: [
      new ImageRun({
        data: headerImgBuf,
        transformation: { width: 540, height: 64 }
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'DELIVERABLE #7',
        font: 'Segoe UI',
        bold: true,
        size: 26,
        color: COLOR_GRAY
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 150 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'APPSCALE',
        font: 'Segoe UI',
        bold: true,
        size: 72,
        color: COLOR_MAROON
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 50, after: 60 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'Barangay Child Nutrition & Maternal Health Information System',
        font: 'Segoe UI',
        bold: true,
        size: 34,
        color: COLOR_DARK
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 200 }
  }),

  // Gold divider
  new Table({
    width: { size: 90, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({})],
            shading: { fill: COLOR_GOLD },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE }
            },
            margins: { top: 20, bottom: 20 }
          })
        ]
      })
    ]
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: "User's Manual of the System",
        font: 'Segoe UI',
        bold: true,
        size: 48,
        color: COLOR_MAROON
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 80 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'For Barangay Nutrition Scholars (BNS), Barangay Health Workers (BHW), and Municipal Health Administrators of Gasan, Marinduque',
        font: 'Segoe UI',
        size: 21,
        color: COLOR_GRAY
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 50, after: 700 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'Marinduque State University\n',
        font: 'Segoe UI',
        bold: true,
        size: 26,
        color: COLOR_DARK
      }),
      new TextRun({
        text: 'College of Information and Computing Sciences',
        font: 'Segoe UI',
        size: 22,
        color: COLOR_GRAY
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 300 }
  }),

  new Paragraph({
    children: [
      new TextRun({
        text: 'APPSCALE - CHILD NUTRITION & MATERNAL HEALTH SYSTEM\n',
        font: 'Segoe UI',
        bold: true,
        size: 22,
        color: COLOR_DARK
      }),
      new TextRun({
        text: 'JANA ROSE P. ROLLE\nMARK JOSEPH J. BAYLON\nCHRISTOPHER C. ARANAS\nJOHN LLOYD S. TESIO',
        font: 'Segoe UI',
        bold: true,
        size: 20,
        color: COLOR_DARK
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 }
  })
];

// -------------------------------------------------------------
// SECTION 2: BODY SECTIONS (Exact 1:1 match with 16-page PDF)
// -------------------------------------------------------------
const bodyChildren = [
  // PAGE 2: REVISION HISTORY & SIGN-OFF
  h1('Document Control & Revision History'),
  p('This document undergoes structured version control to trace iterative developments, stakeholder reviews, and system enhancements for the AppScale platform.'),

  createTable(
    ['Date', 'Version', 'Author / Contributor', 'Summary of Changes / Remarks'],
    [
      ['09/16/2026', 'v1.0', 'Capstone Development Team', 'Initial user manual draft covering core mobile screening and basic web dashboard.'],
      ['10/12/2026', 'v1.5', 'Capstone Development Team', 'Added step-by-step instructions for 120-day feeding program and referral tracking.'],
      ['11/04/2026', 'v2.0', 'Capstone Development Team', 'Integrated WHO Z-score calculation tables, offline Hive sync model, and audit logs.'],
      ['11/18/2026', 'v3.0', 'Capstone Development Team', 'Final comprehensive manual compiled for formal system turnover and capstone defense.']
    ],
    [15, 12, 28, 45]
  ),

  p(''),
  h1('Formal Review & Sign-Off Approvals'),
  p('The undersigned stakeholders have formally reviewed and accepted Deliverable #7 (User\'s Manual of the System) for municipal deployment in Gasan, Marinduque:'),

  createTable(
    ['Signatory Role', 'Representative Name & Title', 'Department / Institution', 'Signature & Endorsement Date'],
    [
      ['Capstone Development Team', 'Jana Rose P. Rolle\nMark Joseph J. Baylon\nChristopher C. Aranas\nJohn Lloyd S. Tesio', 'College of Information and Computing Sciences, MarSU', '[ Signed Electronically ]\nDate: November 18, 2026'],
      ['Capstone Project Adviser', 'Capstone Project Adviser', 'College of Information and Computing Sciences, MarSU', '_____________________\nDate: _______________'],
      ['Client Beneficiary (MHO)', 'Municipal Health Officer (MHO)', 'Rural Health Unit (RHU), Municipality of Gasan', '_____________________\nDate: _______________'],
      ['Nutrition Action Officer', 'Municipal Nutrition Action Officer (MNAO)', 'RHU Gasan, Marinduque', '_____________________\nDate: _______________'],
      ['College Dean', 'Dean, College of Information & Computing Sciences', 'Marinduque State University', '_____________________\nDate: _______________']
    ],
    [22, 28, 28, 22]
  ),

  p(''),
  // PAGE 3: TABLE OF CONTENTS (Exact 1:1 Match with PDF)
  h1('Table of Contents'),
  p('The comprehensive contents of Deliverable #7 (User\'s Manual of the System) are organized as follows:'),

  createTocTable([
    { level: 1, title: 'Document Control & Revision History', page: 'Page 2' },
    { level: 1, title: 'Formal Review & Sign-Off Approvals', page: 'Page 2' },
    { level: 1, title: 'List of Figures & List of Tables', page: 'Page 4' },
    { level: 1, title: 'Operational Glossary of Terms', page: 'Page 4' },
    { level: 1, title: '1 System Overview', page: 'Page 5' },
    { level: 2, title: '1.1 What is AppScale?', page: 'Page 5' },
    { level: 2, title: '1.2 What you can do with AppScale', page: 'Page 5' },
    { level: 2, title: '1.3 Who uses AppScale (User Roles & Access Levels)', page: 'Page 5' },
    { level: 2, title: '1.4 How a Malnutrition Case and Referral Moves (Flowchart)', page: 'Page 6' },
    { level: 2, title: '1.5 System Data Architecture & Synchronization Flow', page: 'Page 6' },
    { level: 1, title: '2 System Requirements and Access', page: 'Page 7' },
    { level: 2, title: '2.1 Hardware and Software Specifications', page: 'Page 7' },
    { level: 2, title: '2.2 How to open AppScale (Web URL and Android APK)', page: 'Page 7' },
    { level: 2, title: '2.3 User Accounts & Provisioning Policy', page: 'Page 7' },
    { level: 1, title: '3 Getting Started', page: 'Page 8' },
    { level: 2, title: '3.1 Logging In and Session Security', page: 'Page 8' },
    { level: 2, title: '3.2 Password Recovery via 6-Digit OTP', page: 'Page 8' },
    { level: 2, title: '3.3 User Interface Orientation (Mobile vs. Web Portal)', page: 'Page 8' },
    { level: 1, title: '4 Step-by-Step User Instructions', page: 'Page 9' },
    { level: 2, title: '4.1 Barangay Nutrition Scholars (BNS) — Mobile App', page: 'Page 9' },
    { level: 3, title: '4.1.1 Child Registration & Purok Profiling', page: 'Page 9' },
    { level: 3, title: '4.1.2 Operation Timbang Plus Anthropometric Recording', page: 'Page 9' },
    { level: 3, title: '4.1.3 Automated WHO Z-Score & Growth Classification Matrix', page: 'Page 10' },
    { level: 3, title: '4.1.4 Immediate Clinical Referral for SAM & Edema', page: 'Page 10' },
    { level: 3, title: '4.1.5 Supplementary Feeding Program & Attendance', page: 'Page 11' },
    { level: 3, title: '4.1.6 Micronutrients (Vitamin A & Deworming)', page: 'Page 11' },
    { level: 3, title: '4.1.7 Offline Operation & Cloud Data Sync', page: 'Page 11' },
    { level: 2, title: '4.2 Barangay Health Workers (BHW) — Web Portal', page: 'Page 12' },
    { level: 3, title: '4.2.1 BHW Health Center Dashboard', page: 'Page 12' },
    { level: 3, title: '4.2.2 Medical Records Management & Longitudinal Curves', page: 'Page 12' },
    { level: 3, title: '4.2.3 Need Attention Module: Automated 3-Tier Triage', page: 'Page 12' },
    { level: 3, title: '4.2.4 Referral Escalations to RHU / Hospital', page: 'Page 13' },
    { level: 2, title: '4.3 Municipal Administrators — Web Command Hub', page: 'Page 13' },
    { level: 3, title: '4.3.1 Executive Analytics & Barangay Rankings', page: 'Page 13' },
    { level: 3, title: '4.3.2 Staff Account Management & Signatories Settings', page: 'Page 14' },
    { level: 3, title: '4.3.3 Masterlist Hub, Excel & Official PDF Reports', page: 'Page 14' },
    { level: 1, title: '5 Error Handling and Troubleshooting', page: 'Page 15' },
    { level: 1, title: '6 Frequently Asked Questions (FAQ)', page: 'Page 15' },
    { level: 1, title: '7 Security and User Reminders (RA 10173 Compliance)', page: 'Page 16' },
    { level: 1, title: '8 Support, Contact Roster & Appendices', page: 'Page 16' }
  ]),

  p(''),
  // PAGE 4: LIST OF FIGURES & TABLES + GLOSSARY
  h1('List of Figures & Tables'),
  h2('List of Figures'),
  createTocTable([
    { level: 1, title: 'Figure 1: Clinical Referral & Malnutrition Escalation Flowchart', page: 'Page 6' },
    { level: 1, title: 'Figure 2: AppScale Offline-to-Cloud Synchronization Architecture', page: 'Page 6' },
    { level: 1, title: 'Figure 3: Mobile Field App User Interface Overview (Flutter)', page: 'Page 8' },
    { level: 1, title: 'Figure 4: Web Management Portal Dashboard Interface (React)', page: 'Page 13' },
    { level: 1, title: 'Figure 5: Supplementary Feeding Attendance & Meal Plan UI', page: 'Page 14' }
  ]),

  p(''),
  h2('List of Tables'),
  createTocTable([
    { level: 1, title: 'Table 1: Document Revision History Table', page: 'Page 2' },
    { level: 1, title: 'Table 2: User Roles and System Access Hierarchy', page: 'Page 5' },
    { level: 1, title: 'Table 3: Hardware and Software Minimum Specifications', page: 'Page 7' },
    { level: 1, title: 'Table 4: WHO Child Growth Standards Classification Matrix', page: 'Page 10' },
    { level: 1, title: 'Table 5: Error Handling and Troubleshooting Matrix', page: 'Page 15' }
  ]),

  p(''),
  h1('Operational Glossary of Terms'),
  createTable(
    ['Acronym / Term', 'Full Operational Definition within AppScale'],
    [
      ['BNS', 'Barangay Nutrition Scholar: Barangay-based volunteer worker responsible for community nutritional assessments, house-to-house weighing, and supplementary feeding.'],
      ['BHW', 'Barangay Health Worker: Health center worker managing beneficiary medical records, health center clinic visits, and referral escalations.'],
      ['OPT+', 'Operation Timbang Plus: Annual/periodic nationwide weighing and height measurement campaign for children aged 0–59 months to identify malnutrition prevalence.'],
      ['SAM', 'Severe Acute Malnutrition: Life-threatening condition characterized by severe wasting (WFL/H < -3 SD) and/or nutritional bilateral pitting edema.'],
      ['MAM', 'Moderate Acute Malnutrition: Moderate wasting (WFL/H between -3 SD and < -2 SD) requiring targeted supplementary feeding intervention.'],
      ['WFA / HFA / WFL/H', 'Weight-for-Age, Height-for-Age, Weight-for-Length/Height: Core anthropometric nutritional indicators referencing the 2006 WHO Child Growth Standards.'],
      ['Z-Score / SD', 'Standard Deviation: Statistical measure quantifying how far a child\'s measurement deviates from the median of the WHO reference population.'],
      ['Hive NoSQL', 'High-performance, lightweight embedded key-value database used in the AppScale mobile app for instant offline data storage.'],
      ['RHU / MNAO / MHO', 'Rural Health Unit, Municipal Nutrition Action Officer, Municipal Health Officer: Primary municipal public health officials directing community nutrition programs in Gasan.']
    ],
    [22, 78]
  ),

  p(''),
  // PAGE 5: 1 SYSTEM OVERVIEW
  h1('1 System Overview'),
  h2('1.1 What is AppScale?'),
  p('AppScale is an offline-first child nutrition monitoring and maternal health management system developed specifically for the Rural Health Unit (RHU), Barangay Nutrition Scholars (BNS), and Barangay Health Workers (BHW) of the Municipality of Gasan, Marinduque.'),
  p('The platform eliminates inaccurate paper registries, automates complex WHO Z-score calculations during Operation Timbang Plus (OPT+), expedites emergency malnutrition referrals, and enforces compliance with the 120-day supplementary feeding program guidelines mandated by the National Nutrition Council (NNC).'),

  h2('1.2 What you can do with AppScale'),
  p('AppScale provides an integrated cross-platform ecosystem serving frontline health workers and executive health decision-makers:'),
  p('• Offline Field Screening: BNS workers record child anthropometrics (weight, height, edema) in remote puroks without active cellular data.'),
  p('• Automated Growth Classifications: Computes Weight-for-Age (WFA), Height-for-Age (HFA), and Weight-for-Length/Height (WFL/H) standard deviations in real time.'),
  p('• 3-Tier Clinical Triage: Instantly triggers Severe Acute Malnutrition (SAM) red alerts, flags Moderate Acute Malnutrition (MAM), and generates standardized digital referral slips for the Rural Health Unit.'),
  p('• 120-Day Feeding Program Tracker: Tracks daily child attendance, logs standardized hot meals served, and evaluates mid-cycle and post-cycle nutritional rehabilitation progress.'),
  p('• NNC/DOH Official Reporting: Generates official OPT+ Form 1A and Form 1B spreadsheets and authenticated PDF summaries ready for municipal submission.'),

  h2('1.3 Who uses AppScale (User Roles & Access Levels)'),
  createTable(
    ['Role', 'Platform', 'Primary Operational Responsibilities', 'Data Scope'],
    [
      ['Barangay Nutrition Scholar (BNS)', 'Mobile (Flutter)', 'Field child registration, door-to-door OPT+ anthropometric measurements, daily 120-day feeding attendance, Vitamin A & deworming logs, maternal counseling.', 'Assigned Barangay Only (Offline Cached)'],
      ['Barangay Health Worker (BHW)', 'Web Portal (React)', 'Barangay health station monitoring, medical history tracking, growth trajectory charts, SAM triage review, and clinical referral routing to RHU.', 'Assigned Barangay Full Masterlist'],
      ['Municipal Health Admin (RHU)', 'Web Command Hub', 'Cross-barangay malnutrition consolidation, staff account management, DOH/NNC Form 1A/1B export, signatories configuration, and security audit logs.', 'Municipal-Wide (All 25 Barangays of Gasan)']
    ],
    [20, 16, 44, 20]
  ),

  p(''),
  // PAGE 6: WORKFLOW FLOWCHARTS
  h2('1.4 How a Malnutrition Case and Referral Moves'),
  p('The lifecycle of an identified malnutrition case demonstrates the seamless handoff between mobile field workers and web health officers:'),
  p('Step 1: Field Weighing (BNS) — Input child Weight & Height on mobile app in remote purok.'),
  p('Step 2: WHO Z-Score Calculation — System auto-flags Severe Acute Malnutrition (SAM), Moderate Acute Malnutrition (MAM), or Bilateral Pitting Edema.'),
  p('Step 3: Web Triage (BHW) — Case appears on the BHW "Need Attention" dashboard with high-priority status.'),
  p('Step 4: Referral Routing (RHU) — BHW generates an authenticated digital Referral Slip forwarded directly to the Municipal Health Officer.'),
  p('Step 5: Clinical Treatment — The child receives specialized RUTF (Ready-to-Use Therapeutic Food) therapy or enrollment in the 120-Day Supplementary Feeding Cycle.'),

  h2('1.5 System Data Architecture & Synchronization Flow'),
  p('AppScale utilizes an enterprise offline-first 3-tier architecture:'),
  p('1. Flutter Mobile Client: Stores child demographic and measurement records in local Hive NoSQL storage with pending sync flags.'),
  p('2. Auto-Reconciliation Engine: As soon as 4G LTE or WiFi connectivity is detected, pending transactions are validated and dispatched via HTTPS REST API.'),
  p('3. Central MySQL Relational Database: Managed through a hardened Express/Node.js API gateway, enforcing foreign key integrity, audit trails, and role-based permissions.'),

  callout('Offline-First Architectural Guarantee', 'Frontline workers can complete hundreds of child measurements in areas with zero cellular reception. No data is lost when the phone powers off. Synchronization occurs transparently in the background upon returning to the health center.', 'gold'),

  p(''),
  // PAGE 7: 2 REQUIREMENTS & ACCESS
  h1('2 System Requirements and Access'),
  h2('2.1 Hardware and Software Specifications'),
  createTable(
    ['Specification', 'Web Management Portal (Admin / BHW)', 'Mobile Field App (BNS / Field Staff)'],
    [
      ['Operating System', 'Windows 10/11, macOS 11+, or Linux', 'Android 8.0 (Oreo) or higher / iOS 12+'],
      ['Web Browser', 'Google Chrome (v90+), Microsoft Edge, Mozilla Firefox', 'Embedded Webview (Android System Webview 95+)'],
      ['Processor (CPU)', 'Dual-Core 2.0 GHz or faster x86/x64 processor', 'Quad-Core 1.8 GHz ARM64 processor'],
      ['Memory (RAM)', 'Minimum 4 GB (8 GB recommended for large masterlists)', 'Minimum 2 GB RAM (3 GB+ recommended)'],
      ['Storage Space', 'At least 500 MB free browser cache space', 'At least 250 MB internal storage for offline database'],
      ['Display Resolution', 'Minimum 1366 x 768 pixels (Full HD 1920x1080 recommended)', 'Minimum 720 x 1280 pixels touch screen'],
      ['Network Connectivity', 'Broadband internet (minimum 5 Mbps)', 'Offline-first (Requires occasional WiFi/data for sync)']
    ],
    [24, 38, 38]
  ),

  h2('2.2 How to open AppScale'),
  p('• Web Portal (LGU Workstations): Open Google Chrome and navigate to the official municipal health address: http://localhost:5173/ or the designated RHU production URL.'),
  p('• Mobile App (Android Devices): Install appscale-field-v3.0.apk. Enable "Install from unknown sources" in device security settings if prompted.'),

  h2('2.3 User Accounts & Provisioning Policy'),
  p('In accordance with municipal health governance, users cannot self-register public accounts. All credentials are created, assigned to specific barangays, and monitored exclusively by the Municipal Administrator at the Rural Health Unit.'),

  p(''),
  // PAGE 8: 3 GETTING STARTED
  h1('3 Getting Started'),
  h2('3.1 Logging In and Session Security'),
  step('1', 'Enter Credentials', 'Input registered email address and secure password.'),
  step('2', 'JWT Authentication', 'On click, the server returns a secure JWT token. Admins are redirected to /admin/dashboard, BHWs to /bhw/dashboard, and mobile users to the mobile home screen.'),
  step('3', 'Session Timeout & Lockout', 'After 5 consecutive failed login attempts, accounts are automatically locked for 15 minutes to prevent unauthorized dictionary intrusions.'),

  h2('3.2 Password Recovery via 6-Digit OTP'),
  step('1', 'Forgot Password', 'Click "Forgot Password?" on the login card and input your registered email address.'),
  step('2', 'Email Delivery', 'The backend dispatches a cryptographically generated 6-digit One-Time PIN (OTP) valid for 10 minutes.'),
  step('3', 'Reset Password', 'Enter the received OTP, type a new strong password (minimum 8 characters with numbers and symbols), and log in.'),

  h2('3.3 User Interface Orientation')
];

// Add Figure 3: Mobile App Screenshot
if (img3Buf) {
  bodyChildren.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img3Buf,
          transformation: { width: 480, height: 250 }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 }
    }),
    p('Figure 3: Mobile Field App User Interface Overview (Flutter)', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  p(''),
  // PAGE 9: 4.1 BNS INSTRUCTIONS
  h1('4 Step-by-Step User Instructions'),
  h2('4.1 Barangay Nutrition Scholars (BNS) — Mobile App'),
  h3('4.1.1 Child Registration & Purok Profiling'),
  step('1', 'Tap "+ Register Beneficiary"', 'On the Masterlist tab or floating center button, tap "+ Register Beneficiary".'),
  step('2', 'Child Demographics', 'Fill in First Name, Middle Name, Last Name, Birthdate (picker calculates age in completed months), and Sex (Male / Female).'),
  step('3', 'Address & Parent Details', 'Specify Assigned Purok (1 to 7), Mother\'s Maiden Name, Father\'s Name, and primary contact phone number.'),
  step('4', 'Socio-Economic Tags', 'Check applicable tags: 4Ps Beneficiary Household, Indigenous Peoples (IP) member.'),
  step('5', 'Save & Commit', 'Tap "Save Profile". The beneficiary record is immediately stored in local Hive NoSQL database storage.'),

  h3('4.1.2 Operation Timbang Plus Anthropometric Recording'),
  step('1', 'Locate Beneficiary', 'Select the child from the offline Masterlist search bar or scan their generated QR card.'),
  step('2', 'Tap "New OPT+ Record"', 'Open the anthropometric measurement dialog.'),
  step('3', 'Enter Weight', 'Record child weight in kilograms using calibrated Salter hanging scale or digital weighing scale (rounded to 0.1 kg).'),
  step('4', 'Enter Height / Length', 'Input child height in centimeters using a wooden height board or infantometer (rounded to 0.1 cm). Indicate measurement posture: Recumbent Length (< 24 months) or Standing Height (>= 24 months).'),
  step('5', 'Assess Bilateral Pitting Edema', 'Check the child\'s feet for nutritional fluid retention. Mark Grade +1, +2, +3, or None.'),
  step('6', 'Instant Calculation', 'Tap "Calculate & Save". The application immediately computes and displays Z-score indicators.'),

  p(''),
  // PAGE 10: 4.1.3 WHO Z-SCORE & SAM
  h3('4.1.3 Automated WHO Z-Score & Growth Classification Matrix'),
  p('The moment weight and height are entered, the built-in algorithmic engine automatically calculates exact standard deviations (z-scores) referencing the WHO Child Growth Standards (2006):'),

  createTable(
    ['Nutritional Indicator', 'Classification Output', 'SD Cut-off Range', 'Automated App Action'],
    [
      ['Weight-for-Age (WFA)', 'Severely Underweight\nUnderweight\nNormal Weight\nOverweight', '< -3.0 SD\n-3.0 to < -2.0 SD\n-2.0 to +2.0 SD\n> +2.0 SD', 'Flags urgent nutrition counseling\nTargeted feeding recommendation\nRoutine monitoring status\nDietary counseling guidance'],
      ['Height-for-Age (HFA)', 'Severely Stunted\nStunted\nNormal Height\nTall', '< -3.0 SD\n-3.0 to < -2.0 SD\n-2.0 to +2.0 SD\n> +2.0 SD', 'Chronic malnutrition warning\nMicronutrient therapy review\nNormal growth milestone\nNo medical intervention'],
      ['Weight-for-Length/Height (WFL/H)', 'Severely Wasted (SAM)\nModerately Wasted (MAM)\nNormal Nutrition\nOverweight\nObese', '< -3.0 SD or Edema\n-3.0 to < -2.0 SD\n-2.0 to +2.0 SD\n> +2.0 to +3.0 SD\n> +3.0 SD', 'EMERGENCY: Immediate Red SAM Alert Modal\nAuto-enrollment in 120-Day Feeding Cycle\nStandard pediatric monitoring\nNutritional counseling\nPediatric assessment referral']
    ],
    [24, 26, 24, 26]
  ),

  h3('4.1.4 Immediate Clinical Referral for SAM & Edema'),
  callout('Severe Acute Malnutrition (SAM) Critical Protocol', 'When a child is diagnosed with WFL/H < -3 SD or Bilateral Pitting Edema, AppScale launches a full-screen red warning modal. Frontline workers are instructed to immediately refer the child to the Gasan RHU to initiate therapeutic feeding.', 'danger'),
  step('1', 'Trigger Referral Modal', 'Tap "Generate Immediate Referral" directly from the SAM warning modal.'),
  step('2', 'Record Symptoms', 'Check observed symptoms: Visible severe wasting, loss of appetite, fever, diarrhea, persistent coughing.'),
  step('3', 'Emergency Dispatch', 'Tap "Forward to RHU & BHW". The system queues a high-priority push notification and marks the referral status as "Pending RHU Acknowledgment".'),

  p(''),
  // PAGE 11: FEEDING, VITAMIN A, OFFLINE
  h3('4.1.5 Supplementary Feeding Program & Attendance'),
  step('1', 'Session Scheduling', 'Navigate to Programs -> Feeding Program. View active 120-day feeding cycles and target purok beneficiaries.'),
  step('2', 'Daily Attendance Logging', 'Tap today\'s session date. Mark enrolled children as Present, Absent, or Excused.'),
  step('3', 'Meal Plan Logging', 'Record prescribed hot meal served (e.g., fortified arroz caldo with egg, monggo with dark green leafy vegetables, or NNC hot meals).'),
  step('4', 'Periodic Weigh-In', 'Record mandatory Day 30, Day 60, Day 90, and Day 120 progress weigh-ins to measure z-score recovery velocity.'),

  h3('4.1.6 Micronutrients (Vitamin A & Deworming)'),
  p('• Vitamin A Dosing: Select child record, tap "Add Supplement", pick 100,000 IU (blue capsule for 6–11 months) or 200,000 IU (red capsule for 12–59 months). Record dosing date.'),
  p('• Semiannual Deworming: Log Albendazole or Mebendazole administration during the National Deworming Months (January and July).'),

  h3('4.1.7 Offline Operation & Cloud Data Sync'),
  p('• Offline Data Queue: All beneficiary additions, OPT+ weighings, and feeding attendances are instantaneously written to local device storage.'),
  p('• Sync Indicator: Top right app bar displays live sync status (Green Check = Synchronized; Orange Cloud = Pending Records queued).'),
  p('• One-Tap Reconciliation: Upon reconnecting to WiFi at the Barangay Health Station or Municipal Hall, tap the "Sync Now" icon to upload records.'),

  p(''),
  // PAGE 12: 4.2 BHW WEB PORTAL
  h2('4.2 Barangay Health Workers (BHW) — Web Portal'),
  h3('4.2.1 BHW Health Center Dashboard (/bhw/dashboard)'),
  p('Displays actionable priorities specifically within the worker\'s assigned barangay:'),
  p('• Need Attention Alert Banner: Highlights children diagnosed with SAM or MAM who require urgent home visits.'),
  p('• Today\'s Clinic Visits & Schedule: Displays scheduled health center consultations and weigh-in appointments.'),
  p('• Feeding Program Cycle Counter: Visual progress bar tracking completion of the 120-day feeding cycle (e.g., Day 45 of 120).'),

  h3('4.2.2 Medical Records Management & Longitudinal Curves (/bhw/medical-records)'),
  step('1', 'Search & Filters', 'Filter masterlist by Purok, Nutritional Status, Sex, or search by child name.'),
  step('2', 'View Growth Trajectory', 'Click on any child row to open the complete longitudinal health chart.'),
  step('3', 'Z-Score Trajectory Graphs', 'Interactive Recharts curves plot measured weight and height points against standard WHO percentiles (Green = Normal, Yellow = MAM, Red = SAM).'),

  h3('4.2.3 Need Attention Module: Automated 3-Tier Triage (/bhw/need-attention)'),
  p('• Red Alert (High Risk - SAM): Children with WFL/H < -3 SD or edema. Requires immediate home visit and clinical referral.'),
  p('• Yellow Alert (Moderate Risk - MAM): Children with -3 SD <= WFL/H < -2 SD. Must be enrolled in the active feeding program.'),
  p('• Blue Alert (Growth Faltering): Children whose weight has stagnated or dropped across two consecutive monthly weigh-ins.'),

  h3('4.2.4 Referral Escalations to RHU / Hospital (/bhw/referrals)'),
  step('1', 'Review Pending Referral', 'Inspect incoming field alerts created by BNS workers.'),
  step('2', 'Add Clinical Observations', 'Document vital signs, temperature, and guardian notes in the clinic assessment box.'),
  step('3', 'Print Official Referral Slip', 'Click "Print Referral Slip" to generate a standardized document containing patient demographics, nutritional indicators, and digital QR verification for the Rural Health Unit physician.'),

  p(''),
  // PAGE 13: 4.3 ADMIN COMMAND HUB
  h2('4.3 Municipal Administrators — Web Command Hub'),
  h3('4.3.1 Executive Analytics & Barangay Rankings (/admin/dashboard)'),
  p('The administrative command hub offers real-time analytics across all 25 barangays of Gasan:'),
  p('• Macro Nutrition Metrics: Total preschool children measured, stunting rate, wasting prevalence, and active feeding participants.'),
  p('• Malnutrition Heatmap & Barangay Rankings: Identifies top priority barangays with the highest concentrations of SAM and MAM cases for targeted budget allocation.'),
  p('• Feeding Program Completion Rate: Evaluates feeding cycle attendance and recovery success rates municipality-wide.')
);

// Add Figure 4: Web Dashboard Screenshot
if (img1Buf) {
  bodyChildren.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img1Buf,
          transformation: { width: 500, height: 260 }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 }
    }),
    p('Figure 4: Web Management Portal Dashboard Interface (React)', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  p(''),
  // PAGE 14: ADMIN STAFF & REPORTS
  h3('4.3.2 Staff Account Management & Signatories Settings'),
  p('• Account Control: Provision, edit, lock, unlock, and deactivate BHW and BNS staff accounts.'),
  p('• Signatories Configuration: Configure authorized names, titles, and scanned signature blocks for the BNS, Midwife, Barangay Captain, and Municipal Health Officer. These automatically populate all exported DOH forms.'),

  h3('4.3.3 Masterlist Hub, Excel & Official PDF Reports'),
  step('1', 'Access Masterlist', 'Click "Consolidated Masterlist" in the admin sidebar.'),
  step('2', 'Select Parameters', 'Choose Target Barangay (or "All Barangays") and reporting year.'),
  step('3', 'Export DOH/NNC OPT+ Form 1A', 'Generates the official preschool child masterlist in Excel format conforming strictly to National Nutrition Council standards.'),
  step('4', 'Export DOH/NNC OPT+ Form 1B', 'Generates the consolidated barangay summary spreadsheet.')
);

// Add Figure 5: Feeding / Beneficiary Screenshot if available
if (img2Buf) {
  bodyChildren.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img2Buf,
          transformation: { width: 500, height: 250 }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 }
    }),
    p('Figure 5: Supplementary Feeding Attendance & Meal Plan UI', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  p(''),
  // PAGE 15: TROUBLESHOOTING & FAQ
  h1('5 Error Handling and Troubleshooting'),
  p('The following troubleshooting matrix assists health workers and municipal technical staff in diagnosing and resolving application errors:'),

  createTable(
    ['Error / Symptom', 'Root Cause', 'Step-by-Step Resolution'],
    [
      ['"Account Locked: 5 failed attempts"', 'Incorrect password entered 5 consecutive times.', 'Wait 15–30 minutes for automatic unlock or ask Municipal Admin to click "Unlock Account" in User Management.'],
      ['"Weight out of realistic range"', 'Value entered below 1.5 kg or above 45.0 kg.', 'Re-check scale reading. Confirm entry is in kilograms (e.g., 9.2 kg, not 92 kg).'],
      ['"Network Error / Pending Sync"', 'Mobile device is operating in remote purok with zero cellular coverage.', 'Normal behavior! Data is preserved in local Hive NoSQL database. Syncs automatically upon reaching WiFi or 4G reception.'],
      ['"Duplicate Child Registration"', 'Child with matching first name, last name, and birthdate already exists.', 'Search masterlist to view existing profile. Update current profile instead of creating a duplicate entry.'],
      ['"Camera Permission Denied"', 'Android system permission for camera was declined.', 'Navigate to Android Settings -> Apps -> AppScale -> Permissions -> Camera -> Select "Allow while using app".'],
      ['"Invalid / Expired OTP"', 'Password reset PIN code was entered after 10-minute expiry window.', 'Click "Resend OTP" on login screen to request a fresh 6-digit code.']
    ],
    [24, 28, 48]
  ),

  p(''),
  h1('6 Frequently Asked Questions (FAQ)'),
  p('Q1: Can the BNS mobile application be used if there is completely no cellular signal in the purok?\n' +
    'A1: Yes! AppScale is an offline-first application. All registration, weighing, and feeding attendances are saved to local device storage and automatically synchronize once internet connectivity is restored.'),
  p('Q2: How are Z-Scores calculated?\n' +
    'A2: AppScale implements the official 2006 World Health Organization (WHO) Child Growth Standards LMS statistical tables, comparing child weight, height, and age to standard deviation medians.'),
  p('Q3: What happens when Severe Acute Malnutrition (SAM) is flagged?\n' +
    'A3: The mobile app launches an immediate Red Alert modal, logs the emergency in the BHW "Need Attention" triage dashboard, and generates a pre-formatted referral slip for the Gasan Rural Health Unit.'),
  p('Q4: Who can edit masterlist records?\n' +
    'A4: BNS workers can edit records within 24 hours of field entry. Beyond 24 hours, modifications require approval and authorization from the BHW or Municipal Health Administrator.'),

  p(''),
  // PAGE 16: SECURITY, SUPPORT & APPENDICES
  h1('7 Security and User Reminders (RA 10173 Compliance)'),
  p('Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), child growth metrics, diagnoses, and maternal counseling notes constitute Sensitive Personal Health Information:'),
  p('1. Confidentiality: Never photograph or post patient records or malnutrition case histories to social media or personal messaging groups.'),
  p('2. Credential Security: Do not write down or share staff account passwords. Log out of shared health center desktop workstations immediately after use.'),
  p('3. Mobile Device Custody: Ensure field smartphones with cached pediatric databases have PIN or fingerprint lock screens enabled.'),
  p('4. Data Retention & Destruction: Official exported Excel and PDF masterlists must be stored on encrypted municipal drives or shredded if printed.'),

  h1('8 Support, Contact Roster & Appendices'),
  h2('Support & Contact Roster'),
  createTable(
    ['Entity / Office', 'Designation / Contact Person', 'Contact Channels'],
    [
      ['Rural Health Unit (RHU)', 'Municipal Health Officer (MHO) / Dr. Clinic Supervisor', 'RHU Main Building, Gasan, Marinduque\nEmail: rhu.gasan@marinduque.gov.ph | Tel: (042) 342-1001'],
      ['Nutrition Office', 'Municipal Nutrition Action Officer (MNAO)', 'RHU Gasan Nutrition Section\nEmail: mnao.gasan@gmail.com'],
      ['Capstone Technical Support', 'Engr. Capstone Project Adviser & Group 3 Development Team', 'College of Information and Computing Sciences, MarSU\nEmail: cics@mscmarinduque.edu.ph | Dev Team: appscale.gasan@gmail.com']
    ],
    [24, 38, 38]
  ),

  h2('Appendices Index'),
  p('• Appendix A: Standard National Nutrition Council (NNC) Form 1A & Form 1B Schema Structure.'),
  p('• Appendix B: Standardized AppScale Clinical Malnutrition Referral Slip with QR Verification.'),
  p('• Appendix C: Complete Role-Based Access Control (RBAC) Permission Matrix Table.')
);

// Document Setup
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Segoe UI',
          size: 19,
          color: COLOR_DARK
        }
      }
    },
    heading1: {
      run: {
        font: 'Segoe UI',
        size: 30, // 15pt
        bold: true,
        color: COLOR_MAROON
      }
    },
    heading2: {
      run: {
        font: 'Segoe UI',
        size: 23, // 11.5pt
        bold: true,
        color: COLOR_MAROON
      }
    },
    heading3: {
      run: {
        font: 'Segoe UI',
        size: 20, // 10pt
        bold: true,
        color: COLOR_DARK
      }
    }
  },
  sections: [
    // 1. Cover Page Section
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 }
        }
      },
      children: coverChildren
    },

    // 2. Body Section (Pages 2 through 16 with running MarSU CICS header and footer)
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: headerImgBuf,
                  transformation: { width: 520, height: 60 }
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 }
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: footerImgBuf,
                  transformation: { width: 520, height: 50 }
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Deliverable #7: User\'s Manual of the System  |  AppScale  |  Page ',
                  font: 'Segoe UI',
                  size: 16,
                  color: COLOR_GRAY
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: 'Segoe UI',
                  size: 16,
                  bold: true,
                  color: COLOR_MAROON
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 20 }
            })
          ]
        })
      },
      children: bodyChildren
    }
  ]
});

// Output path
const outPath = path.join(rootDir, "Deliverable_No_7_-_User's_Manual_AppScale.docx");

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log(`Success! 100% faithful DOCX compiled (${(buf.length / 1024 / 1024).toFixed(2)} MB) at: ${outPath}`);
}).catch(err => {
  console.error('Error generating DOCX:', err);
});
