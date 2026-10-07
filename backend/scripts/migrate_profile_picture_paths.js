const pool = require('../config/db');
require('dotenv').config();

const base = process.env.APP_BASE_URL || 'https://appscale-1.onrender.com';

async function migrate() {
  try {
    console.log('Scanning users for relative profile_picture paths...');
    const [rows] = await pool.query("SELECT user_id, profile_picture FROM users WHERE profile_picture IS NOT NULL AND profile_picture <> ''");
    console.log(`Found ${rows.length} rows to inspect.`);
    let updated = 0;
    for (const r of rows) {
      const p = r.profile_picture;
      if (!p) continue;
      const trimmed = p.trim();
      if (/^https?:\/\//i.test(trimmed)) continue; // already absolute
      if (!trimmed.startsWith('/')) continue; // unexpected format, skip
      const newUrl = `${base}${trimmed}`;
      await pool.query('UPDATE users SET profile_picture = ? WHERE user_id = ?', [newUrl, r.user_id]);
      updated++;
      console.log(`Updated user_id=${r.user_id} -> ${newUrl}`);
    }
    console.log(`Migration complete. Updated ${updated} rows.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
