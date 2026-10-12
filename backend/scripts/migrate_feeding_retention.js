const pool = require('../config/db');

async function run() {
  try {
    console.log('Running Feeding Program Retention Migration...');

    // 1. Alter program_enrollments table
    const [cols] = await pool.query('DESCRIBE program_enrollments');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('unenrolled_at')) {
      await pool.query('ALTER TABLE program_enrollments ADD COLUMN unenrolled_at DATETIME NULL AFTER enrolled_by');
      console.log('Added unenrolled_at');
    }
    if (!colNames.includes('unenrolled_by')) {
      await pool.query('ALTER TABLE program_enrollments ADD COLUMN unenrolled_by INT NULL AFTER unenrolled_at');
      console.log('Added unenrolled_by');
    }
    if (!colNames.includes('unenroll_reason')) {
      await pool.query('ALTER TABLE program_enrollments ADD COLUMN unenroll_reason VARCHAR(255) NULL AFTER unenrolled_by');
      console.log('Added unenroll_reason');
    }
    if (!colNames.includes('unenroll_notes')) {
      await pool.query('ALTER TABLE program_enrollments ADD COLUMN unenroll_notes TEXT NULL AFTER unenroll_reason');
      console.log('Added unenroll_notes');
    }
    if (!colNames.includes('cycle_number')) {
      await pool.query('ALTER TABLE program_enrollments ADD COLUMN cycle_number INT NOT NULL DEFAULT 1 AFTER unenroll_notes');
      console.log('Added cycle_number');
    }

    await pool.query("ALTER TABLE program_enrollments MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'enrolled'");
    console.log('Updated status column');

    // 2. Create feeding_enrollment_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feeding_enrollment_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        enrollment_id INT NOT NULL,
        child_id INT NULL,
        child_external_id VARCHAR(64) NULL,
        barangay VARCHAR(100) NOT NULL,
        action VARCHAR(30) NOT NULL,
        action_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        action_by INT NULL,
        reason VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_enr_hist (enrollment_id),
        INDEX idx_child_hist (child_id),
        INDEX idx_brgy_action (barangay, action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created feeding_enrollment_history table');

    // 3. Ensure deleted_at on children and mothers
    const [cCols] = await pool.query('DESCRIBE children');
    if (!cCols.map(c => c.Field).includes('deleted_at')) {
      await pool.query('ALTER TABLE children ADD COLUMN deleted_at DATETIME NULL AFTER updated_at');
      console.log('Added deleted_at to children');
    }
    const [mCols] = await pool.query('DESCRIBE mothers');
    if (!mCols.map(c => c.Field).includes('deleted_at')) {
      await pool.query('ALTER TABLE mothers ADD COLUMN deleted_at DATETIME NULL AFTER updated_at');
      console.log('Added deleted_at to mothers');
    }

    // 4. Backfill existing status values
    await pool.query("UPDATE program_enrollments SET status = 'enrolled' WHERE status IN ('active', 'enrolled', '') OR status IS NULL");
    await pool.query("UPDATE program_enrollments SET status = 'unenrolled', unenrolled_at = COALESCE(updated_at, NOW()), unenroll_reason = 'Migrated legacy inactive status' WHERE status IN ('inactive', 'removed', 'completed')");
    console.log('Backfilled existing statuses');

    // 5. Seed initial history for any enrollments without history
    await pool.query(`
      INSERT INTO feeding_enrollment_history (
        enrollment_id, child_id, child_external_id, barangay, action, action_date, reason, notes
      )
      SELECT 
        pe.enrollment_id,
        pe.child_id,
        pe.child_external_id,
        pe.barangay,
        'enrolled',
        pe.enrolled_at,
        'Initial program enrollment',
        pe.notes
      FROM program_enrollments pe
      WHERE NOT EXISTS (
        SELECT 1 FROM feeding_enrollment_history h WHERE h.enrollment_id = pe.enrollment_id
      )
    `);
    console.log('Seeded initial enrollment history');

    console.log('✅ Feeding Program Retention Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
