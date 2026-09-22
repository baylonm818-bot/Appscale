require('dotenv').config();
const pool = require('../config/db');

(async () => {
  try {
    // Add lock_until if missing
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until DATETIME NULL AFTER failed_attempts");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_level INT DEFAULT 0 AFTER lock_until");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(255) NULL AFTER lock_level");

    console.log('Checked/added missing columns on users table.');
    process.exit(0);
  } catch (err) {
    // Some MySQL versions don't support IF NOT EXISTS in ALTER TABLE for columns
    if (err && err.errno) {
      try {
        const queries = [];
        queries.push("ALTER TABLE users ADD COLUMN lock_until DATETIME NULL AFTER failed_attempts");
        queries.push("ALTER TABLE users ADD COLUMN lock_level INT DEFAULT 0 AFTER lock_until");
        queries.push("ALTER TABLE users ADD COLUMN deactivation_reason VARCHAR(255) NULL AFTER lock_level");
        for (const q of queries) {
          try {
            await pool.query(q);
          } catch (e) {
            // ignore if column exists
            if (!(e && /Duplicate column name/.test(e.message))) {
              console.error('Error running:', q, e.message || e);
            }
          }
        }
        console.log('Attempted fallback ALTERs; check table for columns.');
        process.exit(0);
      } catch (e) {
        console.error('Fallback alter failed:', e.message || e.stack);
        process.exit(1);
      }
    }
    console.error('add_missing_columns failed:', err.message || err.stack);
    process.exit(1);
  }
})();
