require('dotenv').config();
const pool = require('../config/db');

const emailOrUsername = process.argv[2] || process.env.QUERY_EMAIL;
if (!emailOrUsername) {
  console.error('Usage: node scripts/find_user.js <email-or-username>');
  process.exit(1);
}

(async () => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, email, username, password_hash, first_name, last_name, role, status, failed_attempts FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1',
      [emailOrUsername, emailOrUsername]
    );

    if (!rows || rows.length === 0) {
      console.log('No user found for', emailOrUsername);
      process.exit(0);
    }

    console.log(JSON.stringify(rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err.stack || err.message);
    process.exit(1);
  }
})();
