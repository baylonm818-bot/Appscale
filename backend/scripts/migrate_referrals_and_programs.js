const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const pool = require('../config/db');

  console.log('Running migration: referrals, programs, meal plans, attendance, services...');

  // 1. Ensure referrals has referral_type ENUM('child','mother') DEFAULT 'child'
  const [refCols] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrals'`
  );
  const refColMap = new Map(refCols.map(c => [c.COLUMN_NAME, c]));

  if (!refColMap.has('referral_type')) {
    console.log('Adding referral_type to referrals...');
    await pool.query(
      `ALTER TABLE referrals 
       ADD COLUMN referral_type ENUM('child', 'mother') NOT NULL DEFAULT 'child' 
       AFTER referral_id`
    );
  }

  // Ensure child_id is nullable
  const childIdCol = refColMap.get('child_id');
  if (childIdCol && childIdCol.IS_NULLABLE === 'NO') {
    console.log('Making child_id nullable in referrals...');
    await pool.query(`ALTER TABLE referrals MODIFY COLUMN child_id INT NULL`);
  }

  // Ensure mother_id is nullable
  const motherIdCol = refColMap.get('mother_id');
  if (motherIdCol && motherIdCol.IS_NULLABLE === 'NO') {
    console.log('Making mother_id nullable in referrals...');
    await pool.query(`ALTER TABLE referrals MODIFY COLUMN mother_id INT NULL`);
  }

  // Backfill referral_type based on mother_id / child_id
  console.log('Backfilling referral_type in referrals...');
  await pool.query(`
    UPDATE referrals 
    SET referral_type = CASE 
      WHEN mother_id IS NOT NULL AND child_id IS NULL THEN 'mother'
      ELSE 'child'
    END
  `);

  // 2. Create program_enrollments table
  console.log('Creating program_enrollments table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS program_enrollments (
      enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(64) UNIQUE,
      program_type VARCHAR(50) NOT NULL,
      beneficiary_type VARCHAR(20) NOT NULL DEFAULT 'child',
      child_id INT NULL,
      mother_id INT NULL,
      child_external_id VARCHAR(64) NULL,
      mother_external_id VARCHAR(64) NULL,
      beneficiary_name VARCHAR(255) NULL,
      barangay VARCHAR(100) NOT NULL,
      enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT NULL,
      enrolled_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prog_brgy (program_type, barangay),
      INDEX idx_child (child_id),
      INDEX idx_mother (mother_id)
    )
  `);

  // 3. Create meal_plans table
  console.log('Creating meal_plans table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      plan_id INT AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(64) UNIQUE,
      barangay VARCHAR(100) NOT NULL,
      week_number INT DEFAULT 1,
      day_of_week VARCHAR(20) NOT NULL,
      meal_name VARCHAR(255) NOT NULL,
      ingredients TEXT NULL,
      notes TEXT NULL,
      target_group VARCHAR(100) DEFAULT 'Feeding Enrollees',
      created_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_brgy_day (barangay, day_of_week)
    )
  `);

  // 4. Create feeding_attendance table
  console.log('Creating feeding_attendance table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feeding_attendance (
      attendance_id INT AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(64) UNIQUE,
      child_id INT NULL,
      child_external_id VARCHAR(64) NULL,
      barangay VARCHAR(100) NOT NULL,
      attendance_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'present',
      meal_served VARCHAR(255) NULL,
      remarks TEXT NULL,
      recorded_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_brgy_date (barangay, attendance_date),
      INDEX idx_child_date (child_id, attendance_date)
    )
  `);

  // 5. Create feeding_schedules table
  console.log('Creating feeding_schedules table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feeding_schedules (
      schedule_id INT AUTO_INCREMENT PRIMARY KEY,
      barangay VARCHAR(100) NOT NULL UNIQUE,
      feeding_time VARCHAR(20) NULL,
      start_time VARCHAR(20) NULL,
      end_time VARCHAR(20) NULL,
      venue VARCHAR(255) NULL,
      days_of_week VARCHAR(100) NULL,
      target_count INT DEFAULT 0,
      notes TEXT NULL,
      updated_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // 6. Ensure child_services has external_id and dosage
  const [csCols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'child_services'`
  );
  const csColNames = new Set(csCols.map(c => c.COLUMN_NAME));
  if (!csColNames.has('external_id')) {
    console.log('Adding external_id to child_services...');
    await pool.query(`ALTER TABLE child_services ADD COLUMN external_id VARCHAR(64) NULL AFTER service_id`);
    try {
      await pool.query(`CREATE INDEX idx_cs_external_id ON child_services (external_id)`);
    } catch (_) {}
  }
  if (!csColNames.has('dosage')) {
    console.log('Adding dosage to child_services...');
    await pool.query(`ALTER TABLE child_services ADD COLUMN dosage VARCHAR(100) NULL`);
  }

  // 7. Ensure mother_services has external_id
  const [msCols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mother_services'`
  );
  const msColNames = new Set(msCols.map(c => c.COLUMN_NAME));
  if (!msColNames.has('external_id')) {
    console.log('Adding external_id to mother_services...');
    await pool.query(`ALTER TABLE mother_services ADD COLUMN external_id VARCHAR(64) NULL AFTER service_id`);
    try {
      await pool.query(`CREATE INDEX idx_ms_external_id ON mother_services (external_id)`);
    } catch (_) {}
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
