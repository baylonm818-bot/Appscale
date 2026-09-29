const pool = require('../config/db');

async function migrate() {
  try {
    console.log('Altering referrals table status column...');
    await pool.query("ALTER TABLE referrals MODIFY COLUMN status VARCHAR(30) DEFAULT 'Pending'");
    await pool.query("UPDATE referrals SET status = 'Pending' WHERE status = 'pending'");
    await pool.query("UPDATE referrals SET status = 'Ongoing' WHERE status = 'responded'");
    await pool.query("UPDATE referrals SET status = 'Completed' WHERE status = 'closed'");
    
    console.log('Creating child_services table...');
    await pool.query(`
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
    `);

    console.log('Creating mother_services table...');
    await pool.query(`
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
    `);

    console.log('Creating medical_records_audit_trail table...');
    await pool.query(`
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
    `);

    console.log('Checking child_services columns...');
    const childChecks = [
      ['notes', 'TEXT'],
      ['dosage', 'VARCHAR(100)'],
      ['service_name', 'VARCHAR(150)'],
      ['next_schedule', 'DATE'],
      ['provided_by', 'VARCHAR(100)'],
    ];
    for (const [columnName, columnType] of childChecks) {
      const [cols] = await pool.query("SHOW COLUMNS FROM child_services LIKE ?", [columnName]);
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE child_services ADD COLUMN ${columnName} ${columnType}`);
      }
    }

    console.log('Checking mother_services columns...');
    const motherChecks = [
      ['notes', 'TEXT'],
      ['dosage', 'VARCHAR(100)'],
      ['service_name', 'VARCHAR(150)'],
      ['next_schedule', 'DATE'],
      ['provided_by', 'VARCHAR(100)'],
    ];
    for (const [columnName, columnType] of motherChecks) {
      const [cols] = await pool.query("SHOW COLUMNS FROM mother_services LIKE ?", [columnName]);
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE mother_services ADD COLUMN ${columnName} ${columnType}`);
      }
    }

    console.log('Checking nutrition_records bmi columns...');
    const [colsBmi] = await pool.query("SHOW COLUMNS FROM nutrition_records LIKE 'bmi'");
    if (colsBmi.length === 0) {
      await pool.query("ALTER TABLE nutrition_records ADD COLUMN bmi DECIMAL(5,2) NULL");
      await pool.query("ALTER TABLE nutrition_records ADD COLUMN bmi_status VARCHAR(50) NULL");
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
