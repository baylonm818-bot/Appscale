require('dotenv').config();
const pool = require('../config/db');

const q = process.argv[2] || process.env.QUERY || '';
if (!q) {
  console.error('Usage: node scripts/find_user_search.js <partial-email-or-username>');
  process.exit(1);
}

(async () => {
  try {
    const like = `%${q}%`;
    const [rows] = await pool.query(
      'SELECT user_id, email, username, first_name, last_name, role, status, failed_attempts FROM users WHERE LOWER(email) LIKE LOWER(?) OR LOWER(username) LIKE LOWER(?) LIMIT 50',
      [like, like]
    );

    if (!rows || rows.length === 0) {
      console.log('No users matched', q);
      process.exit(0);
    }

    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err.stack || err.message);
    process.exit(1);
  }
})();
