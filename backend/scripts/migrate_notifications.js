const pool = require('../config/db');

async function migrate() {
  console.log('Running notifications migration...');
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'"
  );
  const colNames = cols.map(c => c.COLUMN_NAME);

  if (!colNames.includes('recipient_role')) {
    await pool.query("ALTER TABLE notifications ADD COLUMN recipient_role VARCHAR(20) NULL");
    console.log('Added recipient_role column');
  } else {
    console.log('recipient_role already exists');
  }

  if (!colNames.includes('barangay')) {
    await pool.query("ALTER TABLE notifications ADD COLUMN barangay VARCHAR(100) NULL");
    console.log('Added barangay column');
  } else {
    console.log('barangay already exists');
  }

  if (!colNames.includes('recipient_user_id')) {
    await pool.query("ALTER TABLE notifications ADD COLUMN recipient_user_id INT NULL");
    console.log('Added recipient_user_id column');
  } else {
    console.log('recipient_user_id already exists');
  }

  // One-time UPDATE queries to fix existing rows
  // 1. Referral notifications and clinical alerts belong to BHW
  const [resBhw] = await pool.query(`
    UPDATE notifications
    SET recipient_role = 'bhw'
    WHERE type IN ('referral', 'alert', 'visit')
       OR title LIKE '%Referral%'
       OR title LIKE '%Alert%'
  `);
  console.log(`Updated referral/alert rows to recipient_role = 'bhw': ${resBhw.affectedRows} affected`);

  // 2. Try to populate barangay for referral notifications using referrals table
  const [resBarangay] = await pool.query(`
    UPDATE notifications n
    INNER JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
    LEFT JOIN children c ON c.child_id = r.child_id
    LEFT JOIN mothers m ON m.mother_id = r.mother_id
    SET n.barangay = COALESCE(c.barangay, m.barangay)
    WHERE n.barangay IS NULL
  `);
  console.log(`Populated barangay on referrals: ${resBarangay.affectedRows} affected`);

  // 3. New child registrations belong to Admin (and general)
  const [resChild] = await pool.query(`
    UPDATE notifications
    SET recipient_role = 'admin'
    WHERE type = 'child'
      AND (recipient_role IS NULL OR recipient_role = '')
  `);
  console.log(`Updated child registration rows to recipient_role = 'admin': ${resChild.affectedRows} affected`);

  // 4. Schedules belong to both (recipient_role = 'all' or 'admin')
  const [resSched] = await pool.query(`
    UPDATE notifications
    SET recipient_role = 'all'
    WHERE type = 'schedule'
      AND (recipient_role IS NULL OR recipient_role = '')
  `);
  console.log(`Updated schedule rows to recipient_role = 'all': ${resSched.affectedRows} affected`);

  console.log('Notifications migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
