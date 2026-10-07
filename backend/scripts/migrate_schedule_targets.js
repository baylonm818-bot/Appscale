const pool = require('../config/db');
require('dotenv').config();

async function migrate() {
  try {
    console.log('Creating schedule_targets table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        target_type ENUM('global','barangay','user') NOT NULL DEFAULT 'barangay',
        target_value VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Backfilling schedule_targets from schedules table...');
    // Find schedules that don't have corresponding targets
    const [schedules] = await pool.query(`SELECT schedule_id, barangay, assigned_to FROM schedules`);
    let inserted = 0;
    for (const s of schedules) {
      const [[exists]] = await pool.query('SELECT 1 as cnt FROM schedule_targets WHERE schedule_id = ? LIMIT 1', [s.schedule_id]);
      if (exists && exists.cnt) continue;
      if (!s.barangay || s.barangay.toLowerCase() === 'all barangays') {
        // global target
        await pool.query('INSERT INTO schedule_targets (schedule_id, target_type, target_value) VALUES (?, ?, ?)', [s.schedule_id, 'global', null]);
      } else {
        // barangay target
        await pool.query('INSERT INTO schedule_targets (schedule_id, target_type, target_value) VALUES (?, ?, ?)', [s.schedule_id, 'barangay', s.barangay]);
      }
      inserted++;
    }

    console.log(`Backfill complete. Inserted ${inserted} schedule_targets.`);

  } catch (err) {
    console.error('Schedule targets migration failed:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch(_) {}
  }
}

if (require.main === module) migrate();

module.exports = migrate;
