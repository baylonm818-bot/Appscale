function normalizeFieldValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function getAvailableColumnsForInsert(payload, allowedColumns) {
  return allowedColumns.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
}

function buildInsertForTable(tableName, payload, availableColumns) {
  const allowedColumns = {
    child_services: ['child_id', 'service_type', 'service_name', 'dosage', 'service_date', 'next_schedule', 'provided_by', 'notes'],
    mother_services: ['mother_id', 'service_type', 'service_name', 'dosage', 'service_date', 'next_schedule', 'provided_by', 'notes'],
  }[tableName];

  if (!allowedColumns) {
    throw new Error(`Unsupported medical table: ${tableName}`);
  }

  const fields = allowedColumns.filter((field) => availableColumns.includes(field) && Object.prototype.hasOwnProperty.call(payload, field));

  if (!fields.length) {
    throw new Error(`No valid columns available for ${tableName} insert.`);
  }

  const values = fields.map((field) => normalizeFieldValue(payload[field]));

  return {
    sql: `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    values,
  };
}

function buildChildServiceInsert(payload, availableColumns) {
  return buildInsertForTable('child_services', payload, availableColumns);
}

function buildMotherServiceInsert(payload, availableColumns) {
  return buildInsertForTable('mother_services', payload, availableColumns);
}

async function ensureMedicalRecordTables(pool) {
  const tableDefinitions = [
    {
      name: 'child_services',
      sql: `
        CREATE TABLE IF NOT EXISTS child_services (
          service_id INT AUTO_INCREMENT PRIMARY KEY,
          child_id INT NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          service_name VARCHAR(150),
          dosage VARCHAR(100),
          service_date DATE NOT NULL,
          next_schedule DATE,
          provided_by VARCHAR(100),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'mother_services',
      sql: `
        CREATE TABLE IF NOT EXISTS mother_services (
          service_id INT AUTO_INCREMENT PRIMARY KEY,
          mother_id INT NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          service_name VARCHAR(150),
          dosage VARCHAR(100),
          service_date DATE NOT NULL,
          next_schedule DATE,
          provided_by VARCHAR(100),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'medical_records_audit_trail',
      sql: `
        CREATE TABLE IF NOT EXISTS medical_records_audit_trail (
          audit_id INT AUTO_INCREMENT PRIMARY KEY,
          record_type VARCHAR(50) NOT NULL,
          record_id INT,
          beneficiary_type VARCHAR(20) NOT NULL,
          beneficiary_id INT NOT NULL,
          beneficiary_name VARCHAR(150),
          action VARCHAR(50) NOT NULL,
          action_details TEXT,
          modified_by INT,
          modifier_name VARCHAR(100),
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'referral_items',
      sql: `
        CREATE TABLE IF NOT EXISTS referral_items (
          referral_item_id INT AUTO_INCREMENT PRIMARY KEY,
          referral_id INT NOT NULL,
          item_name VARCHAR(150) NOT NULL,
          quantity DECIMAL(10,2) DEFAULT 1,
          unit VARCHAR(50) NULL,
          given_by INT NULL,
          given_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT NULL,
          FOREIGN KEY (referral_id) REFERENCES referrals (referral_id) ON DELETE CASCADE,
          FOREIGN KEY (given_by) REFERENCES users (user_id) ON DELETE SET NULL
        )
      `,
    },
    {
      name: 'transfer_history',
      sql: `
        CREATE TABLE IF NOT EXISTS transfer_history (
          transfer_id INT AUTO_INCREMENT PRIMARY KEY,
          entity_type VARCHAR(20) NOT NULL,
          entity_id INT NOT NULL,
          from_barangay VARCHAR(100) NULL,
          to_barangay VARCHAR(100) NOT NULL,
          transferred_by INT NULL,
          transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT NULL,
          notes TEXT NULL,
          FOREIGN KEY (transferred_by) REFERENCES users (user_id) ON DELETE SET NULL
        )
      `,
    },
  ];

  for (const table of tableDefinitions) {
    await pool.query(table.sql);

    const [columns] = await pool.query(`SHOW COLUMNS FROM ${table.name}`);
    const columnNames = columns.map((column) => column.Field);

    const additions = {
      child_services: [
        ['service_name', 'VARCHAR(150)'],
        ['dosage', 'VARCHAR(100)'],
        ['next_schedule', 'DATE'],
        ['provided_by', 'VARCHAR(100)'],
        ['notes', 'TEXT'],
      ],
      mother_services: [
        ['service_name', 'VARCHAR(150)'],
        ['dosage', 'VARCHAR(100)'],
        ['next_schedule', 'DATE'],
        ['provided_by', 'VARCHAR(100)'],
        ['notes', 'TEXT'],
      ],
      medical_records_audit_trail: [
        ['beneficiary_name', 'VARCHAR(150)'],
        ['action_details', 'TEXT'],
        ['modified_by', 'INT'],
        ['modifier_name', 'VARCHAR(100)'],
      ],
    }[table.name] || [];

    for (const [columnName, columnType] of additions) {
      if (!columnNames.includes(columnName)) {
        await pool.query(`ALTER TABLE ${table.name} ADD COLUMN ${columnName} ${columnType}`);
      }
    }
  }

  // Ensure nutrition_records has bmi/bmi_status columns (added after initial schema)
  try {
    const [nrCols] = await pool.query('SHOW COLUMNS FROM nutrition_records');
    const nrColNames = nrCols.map((c) => c.Field);
    if (!nrColNames.includes('bmi')) {
      await pool.query('ALTER TABLE nutrition_records ADD COLUMN bmi DECIMAL(5,2) NULL');
    }
    if (!nrColNames.includes('bmi_status')) {
      await pool.query('ALTER TABLE nutrition_records ADD COLUMN bmi_status VARCHAR(50) NULL');
    }
  } catch (nrErr) {
    // nutrition_records table may not exist yet — non-fatal
    console.warn('ensureMedicalRecordTables: could not check nutrition_records:', nrErr.message);
  }
}

module.exports = {
  ensureMedicalRecordTables,
  buildChildServiceInsert,
  buildMotherServiceInsert,
  getAvailableColumnsForInsert,
  buildInsertForTable,
};
