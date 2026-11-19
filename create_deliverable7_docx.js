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

// Read assets
const headerImgBuf = fs.readFileSync(path.join(rootDir, 'header_banner.jpg'));
const footerImgBuf = fs.readFileSync(path.join(rootDir, 'footer_banner.jpg'));

let img1Buf = null;
let img2Buf = null;
let img3Buf = null;

if (fs.existsSync(path.join(rootDir, 'doc_assets/image1.png'))) {
  img1Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image1.png'));
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image2.png'))) {
  img2Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image2.png'));
}
if (fs.existsSync(path.join(rootDir, 'doc_assets/image3.png'))) {
  img3Buf = fs.readFileSync(path.join(rootDir, 'doc_assets/image3.png'));
}

console.log('Building Deliverable 7 DOCX with polished Table of Contents...');

// Colors
const COLOR_MAROON = '7A1C28';
const COLOR_GOLD = 'D4AF37';
const COLOR_DARK = '1A202C';
const COLOR_GRAY = '4A5568';
const COLOR_LIGHT_BG = 'F8FAFC';
const COLOR_BORDER = 'CBD5E1';

// Helper: standard border
const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: COLOR_BORDER
};

const cellBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder
};

function h1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_MAROON }
    }
  });
}

function h2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 }
  });
}

function h3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 140, after: 50 }
  });
}

function p(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        size: 20, // 10pt
        font: 'Segoe UI',
        color: COLOR_DARK,
        bold: !!options.bold,
        italics: !!options.italics
      })
    ],
    spacing: { before: 40, after: 80, ...options.spacing },
    alignment: options.alignment || AlignmentType.LEFT
  });
}

function step(num, title, desc) {
  return new Paragraph({
    children: [
      new TextRun({
        text: `Step ${num}: ${title} - `,
        bold: true,
        color: COLOR_MAROON,
        font: 'Segoe UI',
        size: 20
      }),
      new TextRun({
        text: desc,
        color: COLOR_DARK,
        font: 'Segoe UI',
        size: 20
      })
    ],
    spacing: { before: 40, after: 60 },
    indent: { left: 360 }
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
                    text: `[${title}] `,
                    bold: true,
                    color: borderColor,
                    font: 'Segoe UI',
                    size: 19
                  }),
                  new TextRun({
                    text: text,
                    color: COLOR_DARK,
                    font: 'Segoe UI',
                    size: 19
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
            margins: { top: 100, bottom: 100, left: 150, right: 150 }
          })
        ]
      })
    ]
  });
}

function createTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', font: 'Segoe UI', size: 18 })],
          alignment: AlignmentType.CENTER
        })
      ],
      shading: { fill: COLOR_MAROON },
      borders: cellBorders,
      margins: { top: 80, bottom: 80, left: 100, right: 100 }
    }))
  });

  const bodyRows = rows.map((r, rIdx) => new TableRow({
    children: r.map(c => new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: c, font: 'Segoe UI', size: 18, color: COLOR_DARK })]
        })
      ],
      shading: { fill: rIdx % 2 === 1 ? COLOR_LIGHT_BG : 'FFFFFF' },
      borders: cellBorders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 }
    }))
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows]
  });
}

// Helper: Formatted Academic TOC Entry with Dotted Underline
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
          margins: { top: 40, bottom: 40, left: 0, right: 40 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: indentText + item.title,
                  font: 'Segoe UI',
                  bold: isLevel1,
                  size: isLevel1 ? 20 : (isLevel2 ? 19 : 18),
                  color: isLevel1 ? COLOR_MAROON : (isLevel2 ? COLOR_DARK : COLOR_GRAY)
                })
              ],
              spacing: { before: isLevel1 ? 60 : 20, after: 20 }
            })
          ]
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          borders: { top: noBorder, bottom: dotBorder, left: noBorder, right: noBorder },
          margins: { top: 40, bottom: 40, left: 40, right: 0 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: item.page,
                  font: 'Segoe UI',
                  bold: isLevel1,
                  size: isLevel1 ? 20 : (isLevel2 ? 19 : 18),
                  color: isLevel1 ? COLOR_MAROON : COLOR_DARK
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: isLevel1 ? 60 : 20, after: 20 }
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
// SECTION 1: COVER PAGE
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
        size: 26, // 13pt
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
        size: 72, // 36pt
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
        size: 34, // 17pt
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
        size: 48, // 24pt
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
        size: 21, // 10.5pt
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
        size: 26, // 13pt
        color: COLOR_DARK
      }),
      new TextRun({
        text: 'College of Information and Computing Sciences',
        font: 'Segoe UI',
        size: 22, // 11pt
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
// SECTION 2: BODY SECTIONS
// -------------------------------------------------------------
const bodyChildren = [
  h1('Document Control & Revision History'),
  p('This section establishes formal configuration management and revision tracking for Deliverable #7 (User\'s Manual of the System) of the AppScale platform.'),

  createTable(
    ['Version', 'Release Date', 'Author / Team', 'Summary of Revisions & Enhancements'],
    [
      ['v1.0', 'August 14, 2026', 'Capstone Group 3', 'Initial draft of mobile BNS screening workflow and basic web dashboard setup.'],
      ['v2.0', 'October 02, 2026', 'Capstone Group 3', 'Incorporated 120-day feeding cycle tracking, WHO Z-score auto calculation, and BHW referral slips.'],
      ['v3.0', 'November 18, 2026', 'Capstone Group 3', 'Full integrated manual covering Municipal Admin Web Hub, BHW Portal, and BNS Mobile Field App with offline sync.']
    ]
  ),

  p(''),
  h1('Formal Review & Sign-Off Approvals'),
  p('The undersigned institutional stakeholders have reviewed and formally approved this User\'s Manual for deployment across the Rural Health Unit (RHU) and constituent barangays of Gasan, Marinduque:'),

  createTable(
    ['Stakeholder Role', 'Official Name & Title', 'Institution / Office', 'Signature & Date'],
    [
      ['Capstone Development Team', 'Jana Rose P. Rolle\nMark Joseph J. Baylon\nChristopher C. Aranas\nJohn Lloyd S. Tesio', 'College of Information & Computing Sciences, MarSU', '[ Signed Electronically ]\nNov 18, 2026'],
      ['Capstone Project Adviser', 'Capstone Project Adviser', 'Faculty, CICS, Marinduque State University', '_____________________\nDate: _______________'],
      ['Client Beneficiary (MHO)', 'Municipal Health Officer (MHO)', 'Rural Health Unit (RHU), Municipality of Gasan', '_____________________\nDate: _______________'],
      ['Municipal Nutrition Officer', 'Municipal Nutrition Action Officer (MNAO)', 'RHU / LGU Gasan, Marinduque', '_____________________\nDate: _______________'],
      ['College Dean', 'Dean, College of Information & Computing Sciences', 'Marinduque State University', '_____________________\nDate: _______________']
    ]
  ),

  p(''),
  h1('Table of Contents'),
  p('The comprehensive contents of Deliverable #7 (User\'s Manual of the System) are organized as follows:'),

  createTocTable([
    { level: 1, title: 'Document Control & Revision History', page: 'Page 2' },
    { level: 1, title: 'Formal Review & Sign-Off Approvals', page: 'Page 2' },
    { level: 1, title: 'Table of Contents', page: 'Page 3' },
    { level: 1, title: 'List of Figures', page: 'Page 4' },
    { level: 1, title: 'List of Tables', page: 'Page 4' },
    { level: 1, title: 'Operational Glossary of Terms', page: 'Page 5' },
    { level: 1, title: '1. System Overview', page: 'Page 6' },
    { level: 2, title: '1.1 Project Background & Health Context', page: 'Page 6' },
    { level: 2, title: '1.2 System Architecture & Technology Stack', page: 'Page 6' },
    { level: 2, title: '1.3 Offline-First Cross-Platform Synchronization Paradigm', page: 'Page 6' },
    { level: 2, title: '1.4 Role & Access Privilege Matrix', page: 'Page 7' },
    { level: 1, title: '2. System Requirements and Access', page: 'Page 8' },
    { level: 2, title: '2.1 Hardware & Operating Environment (Web & Mobile)', page: 'Page 8' },
    { level: 2, title: '2.2 Mobile APK Installation & Permissions Setup', page: 'Page 8' },
    { level: 1, title: '3. Getting Started & User Authentication', page: 'Page 9' },
    { level: 2, title: '3.1 Authentication & Account Security', page: 'Page 9' },
    { level: 2, title: '3.2 5-Attempt Lockout Security Policy', page: 'Page 9' },
    { level: 2, title: '3.3 Forgot Password & One-Time PIN (OTP) Recovery', page: 'Page 9' },
    { level: 1, title: '4. Step-by-Step User Instructions', page: 'Page 10' },
    { level: 2, title: '4.1 BNS Mobile Field Application (Offline-First Flutter)', page: 'Page 10' },
    { level: 3, title: '4.1.1 Child Profiling & Registration', page: 'Page 10' },
    { level: 3, title: '4.1.2 Operation Timbang Plus (OPT+) Recording & Automated Z-Score Calculation', page: 'Page 10' },
    { level: 3, title: '4.1.3 120-Day Supplementary Feeding Program Management', page: 'Page 11' },
    { level: 3, title: '4.1.4 Micronutrient Supplementation & Deworming', page: 'Page 11' },
    { level: 3, title: '4.1.5 Maternal Health & Nutrition Counseling', page: 'Page 11' },
    { level: 3, title: '4.1.6 Offline Database & Cloud Synchronization Engine', page: 'Page 11' },
    { level: 2, title: '4.2 BHW Barangay Web Portal', page: 'Page 12' },
    { level: 3, title: '4.2.1 Barangay Health Dashboard', page: 'Page 12' },
    { level: 3, title: '4.2.2 Masterlist Management & Purok Filtering', page: 'Page 12' },
    { level: 3, title: '4.2.3 Medical Records & Growth Trajectory Charts', page: 'Page 12' },
    { level: 3, title: '4.2.4 "Need Attention" High-Risk SAM/MAM Module', page: 'Page 12' },
    { level: 3, title: '4.2.5 Malnutrition Referral Slip Generation & RHU Forwarding', page: 'Page 13' },
    { level: 2, title: '4.3 Municipal Health Office (Admin) Web Hub', page: 'Page 14' },
    { level: 3, title: '4.3.1 Municipal Overview & Malnutrition Analytics', page: 'Page 14' },
    { level: 3, title: '4.3.2 User & Account Management', page: 'Page 14' },
    { level: 3, title: '4.3.3 DOH/NNC OPT+ Form 1A & Form 1B Standard Export', page: 'Page 14' },
    { level: 3, title: '4.3.4 Signatories Management', page: 'Page 14' },
    { level: 3, title: '4.3.5 Security Audit Trail & System Logs', page: 'Page 15' },
    { level: 1, title: '5. Error Handling and Troubleshooting', page: 'Page 16' },
    { level: 1, title: '6. Frequently Asked Questions (FAQ)', page: 'Page 17' },
    { level: 2, title: '6.1 Municipal Administrator FAQs', page: 'Page 17' },
    { level: 2, title: '6.2 Barangay Health Worker (BHW) FAQs', page: 'Page 17' },
    { level: 2, title: '6.3 Barangay Nutrition Scholar (BNS) Mobile FAQs', page: 'Page 17' },
    { level: 1, title: '7. Security and User Reminders (RA 10173 Compliance)', page: 'Page 18' },
    { level: 1, title: '8. Support Roster, Contact Directory & Appendices', page: 'Page 19' },
    { level: 2, title: '8.1 Institutional Contact Roster', page: 'Page 19' },
    { level: 2, title: '8.2 Appendices Index', page: 'Page 19' }
  ]),

  p(''),
  h1('List of Figures'),
  createTocTable([
    { level: 1, title: 'Figure 1: AppScale Municipal Executive Dashboard Interface (Web Admin)', page: 'Page 14' },
    { level: 1, title: 'Figure 2: Masterlist & Beneficiary Growth Trajectory Module (BHW Web)', page: 'Page 13' },
    { level: 1, title: 'Figure 3: AppScale Mobile Field Screening & Operation Timbang Plus Interface (Flutter)', page: 'Page 10' }
  ]),

  p(''),
  h1('List of Tables'),
  createTocTable([
    { level: 1, title: 'Table 1: Document Revision History Table', page: 'Page 2' },
    { level: 1, title: 'Table 2: Formal Review & Sign-Off Approvals Matrix', page: 'Page 2' },
    { level: 1, title: 'Table 3: Operational Glossary of Acronyms and Terms', page: 'Page 5' },
    { level: 1, title: 'Table 4: AppScale Role & Access Privilege Matrix', page: 'Page 7' },
    { level: 1, title: 'Table 5: Hardware & Operating Environment Specifications', page: 'Page 8' },
    { level: 1, title: 'Table 6: WHO Child Growth Standards Z-Score Cutoff Reference', page: 'Page 10' },
    { level: 1, title: 'Table 7: Comprehensive Error Resolution & Troubleshooting Matrix', page: 'Page 16' },
    { level: 1, title: 'Table 8: Institutional Contact Directory & Support Channels', page: 'Page 19' }
  ]),

  p(''),
  h1('Operational Glossary of Terms'),
  createTable(
    ['Acronym / Term', 'Formal Definition & System Context'],
    [
      ['BNS', 'Barangay Nutrition Scholar: Community frontline nutrition volunteer responsible for field Operation Timbang Plus (OPT+) weighing and feeding program logs.'],
      ['BHW', 'Barangay Health Worker: Frontline healthcare provider managing child medical records, growth charts, and clinic referrals at the Barangay Health Station (BHS).'],
      ['RHU', 'Rural Health Unit: Central municipal health office of Gasan, Marinduque supervising clinical interventions, malnutrition referrals, and DOH reporting.'],
      ['OPT+', 'Operation Timbang Plus: Official annual and quarterly nationwide measurement of weight, height, and edema among 0-59 month-old preschool children.'],
      ['WFA', 'Weight-for-Age: Nutritional index comparing child weight against age to detect Underweight or Severe Underweight status.'],
      ['HFA', 'Height-for-Age: Nutritional index measuring linear skeletal growth to identify Stunting or Severe Stunting.'],
      ['WFL/H', 'Weight-for-Length/Height: Body proportion index identifying acute malnutrition (Wasting or Severe Acute Malnutrition / SAM).'],
      ['SAM', 'Severe Acute Malnutrition: Life-threatening condition (WFL/H < -3 SD or bilateral pitting edema) triggering immediate high-priority RHU referral.'],
      ['MAM', 'Moderate Acute Malnutrition: Child with WFL/H between -3 SD and -2 SD requiring 120-day supplementary feeding and micronutrient therapy.'],
      ['Hive DB', 'Fast, lightweight NoSQL offline database embedded within the Flutter mobile client for complete disconnected field operation.'],
      ['JWT', 'JSON Web Token: Cryptographically signed bearer token securing API communications between clients and the Express backend.'],
      ['OTP', 'One-Time PIN: Time-limited numeric security code sent via email to verify identity during password recovery.']
    ]
  ),

  p(''),
  h1('1 System Overview'),
  p('AppScale (Barangay Child Nutrition & Maternal Health Information System) is a dual-platform, offline-first digital healthcare management solution developed for the Rural Health Unit (RHU), Barangay Nutrition Scholars (BNS), and Barangay Health Workers (BHW) of the Municipality of Gasan, Marinduque.'),
  p('The system transitions the municipality from cumbersome paper-based registries (OPT+ Form 1A/1B) to an automated, auditable, and resilient cloud-connected health network. Frontline BNS workers record child anthropometric data in remote puroks even without cellular reception; the mobile app computes WHO z-scores in real time and synchronizes automatically upon reconnecting to the internet.'),

  h2('1.1 Project Background & Health Context'),
  p('In the Municipality of Gasan, monitoring child malnutrition has traditionally relied on paper-based Operation Timbang Plus logs. Delays in manual calculation of WHO z-scores often postponed critical clinical interventions for children suffering from Severe Acute Malnutrition (SAM). AppScale automates this workflow directly at the household level.'),

  h2('1.2 System Architecture & Technology Stack'),
  p('The platform is built on an enterprise 3-tier architecture:'),
  p('1. Presentation Layer: React/Vite responsive Web Hub (Tailwind CSS, Lucide icons, Recharts) and Flutter Mobile Android App with Material 3 styling.'),
  p('2. Application & API Layer: Node.js/Express RESTful API with Helmet security, rate limiting, and JWT bearer authentication.'),
  p('3. Persistence & Sync Layer: Cloud MySQL relational database coupled with an offline-first Hive NoSQL store on mobile devices.'),

  h2('1.3 Offline-First Cross-Platform Synchronization Paradigm'),
  callout('Cross-Platform Sync Model', 'The mobile application functions seamlessly in full offline mode. Measurements are saved locally with pending sync timestamps. When network connectivity is restored, the sync engine validates records, detects potential duplicate entries, and uploads updates to the central MySQL server without disrupting frontline workflow.', 'gold'),

  h2('1.4 Role & Access Privilege Matrix'),
  createTable(
    ['System Module / Action', 'BNS Field Mobile', 'BHW Barangay Web', 'Municipal Admin Hub'],
    [
      ['Child Profiling & Household Registration', 'Full Access (Offline/Online)', 'Read-Only (Barangay)', 'Read-Only (Cross-Barangay)'],
      ['OPT+ Anthropometrics & Z-Score Calc', 'Create / Update / Compute', 'View / Review / Verify', 'Municipal Analytics View'],
      ['120-Day Feeding Cycle & Attendance', 'Daily Meal & Attendance Log', 'Barangay Monitoring', 'Aggregated Municipal Audit'],
      ['High-Risk SAM Alerts & Clinical Referral', 'SAM Alert Prompting', 'Generate & Route RHU Slip', 'Acknowledge & Clinical Triage'],
      ['System Users & Account Management', 'No Access', 'No Access', 'Full Management (Create/Deactivate)'],
      ['Signatories & DOH Official Reports Export', 'No Access', 'Print Barangay Reports', 'Configure Signatories & Export All']
    ]
  ),

  p(''),
  h1('2 System Requirements and Access'),
  h2('2.1 Hardware & Operating Environment (Web & Mobile)'),
  createTable(
    ['Platform', 'Minimum Hardware Requirements', 'Recommended Hardware', 'Supported Software / OS'],
    [
      ['Web Portal (Admin & BHW)', 'Dual-core 2.0 GHz CPU, 4 GB RAM, 1024x768 display resolution, 5 Mbps internet.', 'Quad-core Intel Core i5/Ryzen 5, 8 GB RAM, 1920x1080 display, 10+ Mbps broadband.', 'Windows 10/11, macOS, Chrome 115+, Edge 115+, Firefox 115+.'],
      ['Mobile App (BNS Field)', 'Quad-core 1.5 GHz ARM CPU, 2 GB RAM, 16 GB internal storage, rear camera for QR.', 'Octa-core 2.0 GHz CPU, 4 GB RAM, 64 GB storage, GPS, 4G LTE/WiFi, autofocus camera.', 'Android 8.0 (Oreo) or higher (Android 11, 12, 13, 14 fully tested).']
    ]
  ),

  h2('2.2 Mobile APK Installation & Permissions Setup'),
  step('1', 'Download APK', 'Obtain the official app-release.apk package provided by the Gasan Municipal IT/RHU Admin office.'),
  step('2', 'Enable Unknown Sources', 'Navigate to Android Settings > Security > Install Unknown Apps > Allow for your browser/file manager.'),
  step('3', 'Permissions Setup', 'Upon first launch, accept Camera permission (for QR scanning) and Storage permission (for local database caching).'),
  step('4', 'Server URL Configuration', 'Verify the API endpoint points to the secure municipal backend host.'),

  p(''),
  h1('3 Getting Started & User Authentication'),
  h2('3.1 Authentication & Account Security'),
  p('Every user is assigned a unique username and role-based credential. Security policies enforce data integrity and patient confidentiality:'),
  step('1', 'Navigate to Login', 'Open the Web Portal via browser or launch the AppScale mobile app on Android.'),
  step('2', 'Enter Credentials', 'Type your registered username and password. Password characters are masked for security.'),
  step('3', 'Role Landing', 'Upon successful validation, Municipal Admins are routed to the Executive Overview, BHWs to the Barangay Dashboard, and BNS to the Mobile Field Home.'),

  h2('3.2 5-Attempt Lockout Security Policy'),
  callout('5-Attempt Lockout Security Policy', 'Entering an incorrect password 5 consecutive times triggers an automatic account lockout for 15 minutes to prevent brute-force intrusion. The system records the IP address and event in the security audit logs.', 'danger'),

  h2('3.3 Forgot Password & One-Time PIN (OTP) Recovery'),
  step('1', 'Request Reset', 'Click the "Forgot Password?" link on the login screen and enter your registered email address.'),
  step('2', 'Retrieve OTP', 'Check your email inbox for a 6-digit verification code (valid for 10 minutes).'),
  step('3', 'Set New Password', 'Input the 6-digit OTP and specify a strong password containing at least 8 characters, uppercase and lowercase letters, numbers, and symbols.'),

  p(''),
  h1('4 Step-by-Step User Instructions'),
  h2('4.1 BNS Mobile Field Application (Offline-First Flutter)'),
  p('The BNS Mobile App is designed for rapid household-to-household data collection across rural puroks without requiring active mobile data.')
];

// Add mobile image if available
if (img3Buf) {
  bodyChildren.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img3Buf,
          transformation: { width: 500, height: 260 }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 }
    }),
    p('Figure 3: AppScale Mobile Field Screening & Operation Timbang Plus Interface (Flutter)', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  h3('4.1.1 Child Profiling & Registration'),
  step('1', 'Open Profiling Form', 'Tap the "+ Add Child" floating action button on the Home screen.'),
  step('2', 'Input Demographic Info', 'Enter First Name, Middle Name, Last Name, Birthdate, Sex (Male/Female), and Household Address/Purok.'),
  step('3', 'Parent & Guardian Details', 'Record Mother\'s Full Name, Father\'s Name, contact phone number, and indigenous/4Ps program membership.'),
  step('4', 'Save Record', 'Tap "Save Profile". The beneficiary record is immediately stored in the local Hive database.'),

  h3('4.1.2 Operation Timbang Plus (OPT+) Recording & Automated Z-Score Calculation'),
  step('1', 'Select Beneficiary', 'Search the child by name or scan their unique AppScale QR identification card.'),
  step('2', 'Input Anthropometric Measurements', 'Enter measured Weight (in kilograms, rounded to 0.1 kg) and Height/Length (in centimeters, rounded to 0.1 cm). Indicate measurement position: Recumbent Length (<24 months) or Standing Height (>=24 months). Check for Bilateral Pitting Edema.'),
  step('3', 'Automated Z-Score Processing', 'AppScale automatically references WHO Child Growth Standards tables to calculate WFA, HFA, and WFL/H Z-scores.'),
  step('4', 'Instant SAM/MAM Alerts', 'If WFL/H is below -3 SD or edema is detected, a prominent RED ALERT modal triggers, flagging the child for immediate referral.'),

  createTable(
    ['Nutritional Index', 'Z-Score Range', 'Classification', 'Clinical Action Required'],
    [
      ['Weight-for-Age (WFA)', '< -3 SD\n-3 to -2 SD\n-2 to +2 SD\n> +2 SD', 'Severely Underweight\nUnderweight\nNormal\nOverweight', 'Targeted feeding & home visit\nMonitor & nutritional advice\nRegular OPT+ schedule\nDietary counseling'],
      ['Height-for-Age (HFA)', '< -3 SD\n-3 to -2 SD\n-2 to +2 SD\n> +2 SD', 'Severely Stunted\nStunted\nNormal\nTall', 'Chronic undernutrition review\nNutrient supplementation\nRoutine monitoring\nNo intervention'],
      ['Weight-for-Length/Height (WFL/H)', '< -3 SD or Edema\n-3 to -2 SD\n-2 to +2 SD\n> +2 to +3 SD\n> +3 SD', 'Severe Acute Malnutrition (SAM)\nModerate Acute Malnutrition (MAM)\nNormal\nOverweight\nObese', 'EMERGENCY: Immediate RHU Referral\nEnroll in 120-Day Feeding Cycle\nRoutine health care\nLifestyle & diet counseling\nMedical assessment']
    ]
  ),

  h3('4.1.3 120-Day Supplementary Feeding Program Management'),
  step('1', 'Beneficiary Enrollment', 'Eligible SAM/MAM children are enrolled into the current 120-day feeding program cycle.'),
  step('2', 'Daily Attendance Tracking', 'Open the Feeding Attendance tab, select the active day (Day 1 to 120), and mark Present or Absent.'),
  step('3', 'Meal Log', 'Record the prescribed hot meal served (e.g., fortified arroz caldo with egg, monggo with vegetables).'),

  h3('4.1.4 Micronutrient Supplementation & Deworming'),
  step('1', 'Vitamin A Dosing', 'Log high-dose Vitamin A capsule administration (100,000 IU for 6-11 mos; 200,000 IU for 12-59 mos).'),
  step('2', 'Deworming Semiannual Log', 'Record albendazole or mebendazole tablets given during National Deworming Month.'),

  h3('4.1.5 Maternal Health & Nutrition Counseling'),
  step('1', 'Maternal Profile', 'Register pregnant and lactating mothers within the barangay.'),
  step('2', 'Nutrition Counseling Session', 'Log dietary guidance, IFA (iron-folic acid) intake, and exclusive breastfeeding counseling.'),

  h3('4.1.6 Offline Database & Cloud Synchronization Engine'),
  step('1', 'Inspect Sync Queue', 'The top status bar displays the number of pending unsynchronized records.'),
  step('2', 'Automatic Sync', 'When WiFi or mobile data is detected, AppScale uploads pending records in the background.'),
  step('3', 'Manual Force Sync', 'Users can tap the "Sync Now" icon on the Home dashboard to trigger immediate reconciliation.'),

  p(''),
  h2('4.2 BHW Barangay Web Portal'),
  p('The BHW Web Portal provides Barangay Health Workers with comprehensive workstation tools to monitor malnutrition cases, analyze historical growth trajectories, and coordinate clinical interventions with the Rural Health Unit.')
);

// Add BHW image if available
if (img2Buf) {
  bodyChildren.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img2Buf,
          transformation: { width: 500, height: 260 }
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 }
    }),
    p('Figure 2: Masterlist & Beneficiary Growth Trajectory Module (BHW Web)', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  h3('4.2.1 Barangay Health Dashboard'),
  p('Displays real-time overview cards for Total Registered Children, Severe Acute Malnutrition (SAM) cases, Moderate Acute Malnutrition (MAM) cases, and active feeding participants.'),

  h3('4.2.2 Masterlist Management & Purok Filtering'),
  step('1', 'Open Masterlist', 'Navigate to the "Masterlist" tab from the sidebar navigation menu.'),
  step('2', 'Apply Filters', 'Filter child records by Purok, Nutritional Status (SAM, MAM, Normal), Age Group, or Sex.'),
  step('3', 'Search Record', 'Use the live search bar to locate specific children by First Name or Last Name.'),

  h3('4.2.3 Medical Records & Growth Trajectory Charts'),
  step('1', 'View Medical History', 'Click "View Record" on any beneficiary card to inspect longitudinal health history.'),
  step('2', 'Growth Charts', 'Review interactive Recharts graphs plotting Weight-for-Age and Height-for-Age curves against WHO standard percentiles.'),

  h3('4.2.4 "Need Attention" High-Risk SAM/MAM Module'),
  p('Dedicated triage interface isolating children with critical z-scores (< -3 SD) or deteriorating growth velocities, requiring immediate follow-up.'),

  h3('4.2.5 Malnutrition Referral Slip Generation & RHU Forwarding'),
  step('1', 'Initiate Referral', 'In the Need Attention tab, click "Create Referral Slip" for the designated child.'),
  step('2', 'Clinical Observations', 'Input clinical signs (e.g., bilateral pitting edema, severe visible wasting, loss of appetite, fever).'),
  step('3', 'Route to RHU', 'Click "Submit & Forward to RHU". The slip is electronically dispatched to the Municipal Health Officer.'),
  step('4', 'Print Physical Slip', 'Click "Print Referral Slip" to produce an official hard copy for parents taking the child to the clinic.'),

  p(''),
  h2('4.3 Municipal Health Office (Admin) Web Hub'),
  p('The Municipal Admin Web Hub provides executive health administrators, the Municipal Health Officer (MHO), and the Municipal Nutrition Action Officer (MNAO) with municipal-wide data consolidation, user management, and regulatory compliance reporting.')
);

// Add Admin image if available
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
      spacing: { before: 100, after: 60 }
    }),
    p('Figure 1: AppScale Municipal Executive Dashboard Interface (Web Admin)', { bold: true, alignment: AlignmentType.CENTER })
  );
}

bodyChildren.push(
  h3('4.3.1 Municipal Overview & Malnutrition Analytics'),
  p('Consolidates pediatric nutrition statistics across all constituent barangays of Gasan. Interactive bar and pie charts visualize stunting and wasting prevalence by barangay, enabling targeted resource allocation.'),

  h3('4.3.2 User & Account Management'),
  step('1', 'Access Users Tab', 'Click "User Management" on the admin sidebar.'),
  step('2', 'Create New Account', 'Click "+ New User". Enter Name, Username, Role (BNS, BHW, or Admin), and Assigned Barangay.'),
  step('3', 'Account Status', 'Admins can reset passwords, deactivate accounts upon staff turnover, or unlock accounts locked due to failed logins.'),

  h3('4.3.3 DOH/NNC OPT+ Form 1A & Form 1B Standard Export'),
  step('1', 'Navigate to Reports', 'Click "DOH Reports & Masterlist".'),
  step('2', 'Select Reporting Period', 'Specify Year and Weighing Period (Annual OPT+ or Quarterly).'),
  step('3', 'Export File', 'Click "Export to Excel" or "Generate PDF". The file conforms strictly to the National Nutrition Council (NNC) Form 1A and 1B tabular specifications.'),

  h3('4.3.4 Signatories Management'),
  step('1', 'Open Signatories', 'Navigate to System Settings > Signatories.'),
  step('2', 'Configure Officials', 'Specify the active names and titles for Municipal Health Officer, Municipal Nutrition Action Officer, and Barangay Captains.'),
  step('3', 'Auto-Populate', 'Configured signatories appear automatically on all exported official reports and referral slips.'),

  h3('4.3.5 Security Audit Trail & System Logs'),
  p('Maintains an immutable chronological log of every security and administrative event (user logins, data modifications, exports, failed attempts).'),

  p(''),
  h1('5 Error Handling and Troubleshooting'),
  p('The following troubleshooting matrix assists users and IT personnel in resolving common operational, network, and application issues:'),

  createTable(
    ['Error / Problem Description', 'Probable Cause', 'Step-by-Step Resolution'],
    [
      ['"Network Error / Disconnected" alert banner on mobile.', 'Device has no cellular signal or WiFi in remote purok.', 'Continue field work normally! AppScale stores all records in local Hive DB. Data will sync automatically once network returns.'],
      ['"Sync Conflict: Duplicate Record Detected"', 'Child was profiled on two different devices before synchronization.', 'Review conflict resolution modal in BHW Web. Select latest anthropometric measurement or merge matching profiles.'],
      ['"WHO Z-Score Out-of-Range Warning"', 'Typographical error in weight or height input (e.g., 85 kg instead of 8.5 kg).', 'Check physical scale and tape measure. Re-enter valid pediatric measurements within WHO biological range.'],
      ['"Account Locked: 5 Failed Attempts"', 'Security policy triggered due to multiple incorrect password tries.', 'Wait 15 minutes for automatic reset, or contact Municipal Admin to unlock account immediately via User Management.'],
      ['"OTP Code Expired or Invalid"', 'Reset code exceeded 10-minute validity window or typo entered.', 'Click "Resend OTP" on login screen. Retrieve new 6-digit code from email and enter promptly.'],
      ['"Camera Permission Denied on Mobile"', 'Android OS privacy setting blocked camera access for QR scanning.', 'Open Android Settings > Apps > AppScale > Permissions > Camera > Select "Allow only while using the app".']
    ]
  ),

  p(''),
  h1('6 Frequently Asked Questions (FAQ)'),
  h2('6.1 Municipal Administrator FAQs'),
  p('Q1: How do we add a newly appointed Barangay Nutrition Scholar (BNS)?\n' +
    'A1: Log into the Admin Web Hub, open "User Management", click "+ New User", set the role to BNS, select their designated barangay, and provide the initial temporary password.'),
  p('Q2: Can we export data directly into the official DOH Form 1A format?\n' +
    'A2: Yes. Navigate to Reports > DOH Forms, select the desired barangay and year, and click "Export Form 1A" for an Excel-compatible spreadsheet ready for NNC submission.'),

  h2('6.2 Barangay Health Worker (BHW) FAQs'),
  p('Q1: What should I do when a child is marked with a Red SAM Alert?\n' +
    'A1: Open the "Need Attention" tab immediately, click "Create Referral Slip", document clinical symptoms, route the slip to the RHU, and print a copy for the child\'s guardian.'),
  p('Q2: Can I edit a child\'s measurement if an incorrect height was entered?\n' +
    'A2: Yes, authorized BHWs can edit measurements within 24 hours of recording. All adjustments are logged in the audit trail.'),

  h2('6.3 Barangay Nutrition Scholar (BNS) Mobile FAQs'),
  p('Q1: Will my data be lost if my smartphone battery dies while weighing children?\n' +
    'A1: No. Every saved entry is instantly committed to local SQLite/Hive offline storage. Data remains safely preserved upon restarting the phone.'),
  p('Q2: Do I need mobile load or data to conduct Operation Timbang Plus?\n' +
    'A2: No. All profiling, weighing, and WHO z-score calculations work 100% offline. Connect to WiFi at the Barangay Hall later to sync.'),

  p(''),
  h1('7 Security and User Reminders (RA 10173 Compliance)'),
  p('AppScale manages sensitive pediatric health and maternal demographic information governed by Republic Act No. 10173 (Philippine Data Privacy Act of 2012). Every user must uphold strict data ethics:'),
  p('1. Confidentiality of Patient Health Data: Never share child medical records, malnutrition status, or family contact info with unauthorized parties.'),
  p('2. Password Hygiene & Account Sharing Prohibitions: Each account is personal and strictly tied to an individual. Never share credentials with peers.'),
  p('3. Physical Device Security: Mobile devices containing cached health records must be protected by PIN/biometrics. Report lost devices immediately.'),
  p('4. Controlled Printing & Disposal: Printed referral slips and Form 1A reports must be kept in locked filing cabinets at the BHS or RHU.'),

  p(''),
  h1('8 Support Roster, Contact Directory & Appendices'),
  h2('8.1 Institutional Contact Roster'),
  createTable(
    ['Office / Entity', 'Contact Person & Title', 'Contact Channels & Address'],
    [
      ['Municipal Health Office (RHU)', 'Municipal Health Officer (MHO)', 'Gasan RHU Building, Maharlika Highway, Gasan, Marinduque\nEmail: rhu.gasan@marinduque.gov.ph | Tel: (042) 342-1001'],
      ['Municipal Nutrition Office', 'Municipal Nutrition Action Officer (MNAO)', 'RHU Gasan Nutrition Section\nEmail: nutrition.gasan@gmail.com'],
      ['AppScale Technical Support', 'Engr. Capstone Adviser & Development Team', 'College of Information & Computing Sciences, MarSU\nEmail: cics@mscmarinduque.edu.ph | Support: appscale.gasan@gmail.com']
    ]
  ),

  h2('8.2 Appendices Index'),
  p('Appendix A: National Nutrition Council (NNC) Operation Timbang Plus Form 1A & Form 1B Standard Schema.', { bold: true }),
  p('Appendix B: AppScale Malnutrition Clinical Referral Slip Template with Digital Signature Fields.', { bold: true }),
  p('Appendix C: Complete Role-Based Access Control (RBAC) Permission Matrix across Web and Mobile.', { bold: true })
);

// Document Section Setup
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Segoe UI',
          size: 20,
          color: COLOR_DARK
        }
      }
    },
    heading1: {
      run: {
        font: 'Segoe UI',
        size: 32, // 16pt
        bold: true,
        color: COLOR_MAROON
      }
    },
    heading2: {
      run: {
        font: 'Segoe UI',
        size: 24, // 12pt
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
    // 1. Cover Page Section (No running headers or footers)
    {
      properties: {
        page: {
          margin: {
            top: 720,
            bottom: 720,
            left: 1080,
            right: 1080
          }
        }
      },
      children: coverChildren
    },

    // 2. Body Section (With MarSU CICS Header & Footer Banners on every page)
    {
      properties: {
        page: {
          margin: {
            top: 1080,
            bottom: 1080,
            left: 1080,
            right: 1080
          }
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
                  text: 'AppScale System User\'s Manual  |  Page ',
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
  console.log(`Success! DOCX generated (${(buf.length / 1024 / 1024).toFixed(2)} MB) at: ${outPath}`);
}).catch(err => {
  console.error('Error generating DOCX:', err);
});
