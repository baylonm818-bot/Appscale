const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
} = require('docx');

const tablesData = [
  {
    tableNum: 'Table 2.1',
    title: 'Users',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['user_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['username', 'VARCHAR(100)', 'UNIQUE NOT NULL'],
      ['email', 'VARCHAR(255)', 'UNIQUE NOT NULL'],
      ['password_hash', 'VARCHAR(255)', 'NOT NULL (bcrypt hashed)'],
      ['first_name', 'VARCHAR(100)', 'NOT NULL'],
      ['middle_initial', 'VARCHAR(5)', 'NULL'],
      ['last_name', 'VARCHAR(100)', 'NOT NULL'],
      ['role', 'ENUM(\'admin\',\'bhw\',\'bns\')', 'DEFAULT \'bhw\' NOT NULL'],
      ['municipality', 'VARCHAR(100)', 'DEFAULT \'Gasan\' NOT NULL'],
      ['barangay', 'VARCHAR(100)', 'NOT NULL'],
      ['purok', 'VARCHAR(50)', 'NULL'],
      ['contact_number', 'VARCHAR(20)', 'NULL'],
      ['profile_picture', 'VARCHAR(255)', 'NULL'],
      ['status', 'ENUM(\'active\',\'inactive\')', 'DEFAULT \'active\''],
      ['failed_attempts', 'INT', 'DEFAULT 0'],
      ['lock_until', 'DATETIME', 'NULL'],
      ['lock_level', 'INT', 'DEFAULT 0'],
      ['deactivation_reason', 'VARCHAR(255)', 'NULL'],
      ['deleted_at', 'DATETIME', 'NULL'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
      ['updated_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.2',
    title: 'Mothers (Lactating & Pregnant Mothers)',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['mother_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['external_id', 'VARCHAR(100)', 'UNIQUE NULL (Mobile Sync UUID)'],
      ['first_name', 'VARCHAR(50)', 'NOT NULL'],
      ['middle_initial', 'VARCHAR(5)', 'NULL'],
      ['last_name', 'VARCHAR(50)', 'NOT NULL'],
      ['birth_date', 'DATE', 'NOT NULL'],
      ['weight_kg', 'DECIMAL(5,2)', 'NULL'],
      ['height_cm', 'DECIMAL(5,2)', 'NULL'],
      ['municipality', 'VARCHAR(50)', 'NOT NULL DEFAULT \'Gasan\''],
      ['barangay', 'VARCHAR(50)', 'NOT NULL'],
      ['purok', 'VARCHAR(20)', 'NOT NULL'],
      ['contact_number', 'VARCHAR(20)', 'NULL'],
      ['status', 'ENUM(\'active\',\'inactive\',\'transfer\',\'move_out\',\'graduate\')', 'DEFAULT \'active\''],
      ['encoded_by', 'INT', 'FK users BNS (user_id)'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
      ['updated_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.3',
    title: 'Children (0 to 59 Months)',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['child_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['external_id', 'VARCHAR(100)', 'UNIQUE NULL (Mobile Sync UUID)'],
      ['mother_id', 'INT', 'FK mothers (mother_id) NULL'],
      ['first_name', 'VARCHAR(50)', 'NOT NULL'],
      ['middle_initial', 'VARCHAR(5)', 'NULL'],
      ['last_name', 'VARCHAR(50)', 'NOT NULL'],
      ['birth_date', 'DATE', 'NOT NULL'],
      ['sex', 'ENUM(\'male\',\'female\')', 'NOT NULL'],
      ['age_in_months', 'INT', 'NOT NULL DEFAULT 0'],
      ['municipality', 'VARCHAR(50)', 'NOT NULL DEFAULT \'Gasan\''],
      ['barangay', 'VARCHAR(50)', 'NOT NULL'],
      ['purok', 'VARCHAR(20)', 'NOT NULL'],
      ['guardian_name', 'VARCHAR(150)', 'NULL'],
      ['guardian_contact', 'VARCHAR(50)', 'NULL'],
      ['status', 'ENUM(\'active\',\'transfer\',\'move_out\',\'dead\',\'graduate\')', 'DEFAULT \'active\''],
      ['encoded_by', 'INT', 'FK users BNS (user_id)'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
      ['updated_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.4',
    title: 'Child Nutrition Record',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['record_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['child_id', 'INT', 'FK children (child_id) NOT NULL'],
      ['record_date', 'DATE', 'NOT NULL'],
      ['age_in_months', 'INT', 'NOT NULL'],
      ['weight_kg', 'DECIMAL(5,2)', 'NOT NULL'],
      ['height_cm', 'DECIMAL(5,2)', 'NOT NULL'],
      ['muac_cm', 'DECIMAL(5,2)', 'NOT NULL'],
      ['bmi', 'DECIMAL(5,2)', 'NULL'],
      ['bmi_status', 'VARCHAR(50)', 'NULL'],
      ['weight_status', 'ENUM(\'normal\',\'underweight\',\'severely_underweight\',\'overweight\',\'obese\')', 'NOT NULL'],
      ['height_status', 'ENUM(\'normal\',\'stunted\',\'severely_stunted\')', 'NOT NULL'],
      ['wasting_status', 'ENUM(\'normal\',\'wasted\',\'severely_wasted\')', 'NULL'],
      ['overall_status', 'VARCHAR(50)', 'NOT NULL (Normal, MAM, SAM, Obese, Overweight)'],
      ['recorded_by', 'INT', 'FK users BNS (user_id)'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.5',
    title: 'Child Services',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['service_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['child_id', 'INT', 'FK children (child_id) NOT NULL'],
      ['service_type', 'VARCHAR(100)', 'NOT NULL (vitamin_a, deworming, feeding, checkup)'],
      ['service_name', 'VARCHAR(150)', 'NULL'],
      ['dosage', 'VARCHAR(100)', 'NULL'],
      ['service_date', 'DATE', 'NOT NULL'],
      ['next_schedule', 'DATE', 'NULL'],
      ['provided_by', 'VARCHAR(100)', 'NULL (FK users BHW)'],
      ['notes', 'TEXT', 'NULL'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.6',
    title: 'Mother Services',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['service_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['mother_id', 'INT', 'FK mothers (mother_id) NOT NULL'],
      ['service_type', 'VARCHAR(100)', 'NOT NULL (iron_folic, checkup, counseling)'],
      ['service_name', 'VARCHAR(150)', 'NULL'],
      ['dosage', 'VARCHAR(100)', 'NULL'],
      ['service_date', 'DATE', 'NOT NULL'],
      ['next_schedule', 'DATE', 'NULL'],
      ['provided_by', 'VARCHAR(100)', 'NULL (FK users BHW)'],
      ['notes', 'TEXT', 'NULL'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.7',
    title: 'Schedules',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['schedule_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['title', 'VARCHAR(150)', 'NOT NULL'],
      ['schedule_type', 'ENUM(\'feeding\',\'home_visit\',\'immunization\',\'checkup\')', 'NOT NULL'],
      ['schedule_date', 'DATE', 'NOT NULL'],
      ['schedule_time', 'TIME', 'NULL'],
      ['barangay', 'VARCHAR(100)', 'NULL'],
      ['assigned_to', 'INT', 'FK users (user_id) NULL'],
      ['status', 'ENUM(\'pending\',\'ongoing\',\'done\',\'cancelled\')', 'DEFAULT \'pending\''],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.8',
    title: 'Referrals',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['referral_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['entity_type', 'ENUM(\'child\',\'mother\')', 'NOT NULL DEFAULT \'child\''],
      ['child_id', 'INT', 'FK children (child_id) NULL'],
      ['mother_id', 'INT', 'FK mothers (mother_id) NULL'],
      ['referred_by', 'INT', 'FK users BNS (user_id) NOT NULL'],
      ['referred_to', 'INT', 'FK users BHW (user_id) NOT NULL'],
      ['reason', 'TEXT', 'NOT NULL'],
      ['priority', 'ENUM(\'low\',\'medium\',\'high\')', 'DEFAULT \'medium\''],
      ['severity', 'VARCHAR(50)', 'DEFAULT \'Moderate\''],
      ['status', 'VARCHAR(30)', 'DEFAULT \'Pending\' (Pending, Ongoing, Completed, Rejected)'],
      ['notes', 'TEXT', 'NULL'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.9',
    title: 'Notifications',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['notification_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['user_id', 'INT', 'FK users (user_id) NULL'],
      ['title', 'VARCHAR(150)', 'NOT NULL'],
      ['message', 'TEXT', 'NOT NULL'],
      ['type', 'ENUM(\'alert\',\'schedule\',\'system\')', 'NOT NULL DEFAULT \'alert\''],
      ['is_read', 'BOOLEAN', 'DEFAULT FALSE'],
      ['related_id', 'INT', 'NULL'],
      ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
  {
    tableNum: 'Table 2.10',
    title: 'Medical Records Audit Trail',
    rows: [
      ['Field', 'Type', 'Constraint'],
      ['audit_id', 'INT', 'PRIMARY KEY AUTO_INCREMENT'],
      ['record_type', 'VARCHAR(50)', 'NOT NULL'],
      ['record_id', 'INT', 'NULL'],
      ['beneficiary_type', 'VARCHAR(20)', 'NOT NULL (child or mother)'],
      ['beneficiary_id', 'INT', 'NOT NULL'],
      ['beneficiary_name', 'VARCHAR(150)', 'NULL'],
      ['action', 'VARCHAR(50)', 'NOT NULL'],
      ['action_details', 'TEXT', 'NULL'],
      ['modified_by', 'INT', 'NULL'],
      ['modifier_name', 'VARCHAR(100)', 'NULL'],
      ['timestamp', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP'],
    ]
  },
];

function buildTable(tData) {
  const tableRows = tData.rows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    return new TableRow({
      children: row.map((cellText, cellIndex) => {
        let widthPct = 25;
        if (cellIndex === 0) widthPct = 25;
        if (cellIndex === 1) widthPct = 30;
        if (cellIndex === 2) widthPct = 45;

        return new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: isHeader ? { fill: 'F2F2F2' } : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: cellText,
                  bold: isHeader,
                  font: 'Times New Roman',
                  size: isHeader ? 22 : 20,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

const docChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'APPENDIX I',
        bold: true,
        font: 'Times New Roman',
        size: 28,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'DATABASE SCHEMA OF PROPOSED SYSTEM',
        bold: true,
        font: 'Times New Roman',
        size: 28,
      }),
    ],
  }),
  new Paragraph({ text: '' }),
];

tablesData.forEach((t) => {
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${t.tableNum}: ${t.title}`,
          bold: true,
          font: 'Times New Roman',
          size: 24,
        }),
      ],
    })
  );
  docChildren.push(buildTable(t));
  docChildren.push(new Paragraph({ text: '' }));
});

const doc = new Document({
  sections: [
    {
      properties: {},
      children: docChildren,
    },
  ],
});

const primaryOutput = path.join(__dirname, '../../AppScale_Database_Schema_Clean.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(primaryOutput, buffer);
  console.log('Successfully written clean Word document at:', primaryOutput);
  
  // Also try writing to AppScale_Database_Schema_Updated.docx if not locked
  try {
    const updatedOutput = path.join(__dirname, '../../AppScale_Database_Schema_Updated.docx');
    fs.writeFileSync(updatedOutput, buffer);
    console.log('Successfully updated:', updatedOutput);
  } catch (e) {
    console.log('AppScale_Database_Schema_Updated.docx is open in Word, created AppScale_Database_Schema_Clean.docx instead.');
  }
});
