require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const email = process.argv[2];
const password = process.argv[3];
const firstName = process.argv[4] || null;
const lastName = process.argv[5] || null;

if (!email || !password) {
  console.error('Usage: node scripts/create_bhw_user.js <email> <password> [firstName] [lastName]');
  process.exit(1);
}

(async () => {
  try {
    const username = email.split('@')[0];
    const [existing] = await pool.query('SELECT user_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1', [email, username]);

    const passwordHash = await bcrypt.hash(password, 10);

    if (existing && existing.length > 0) {
      const id = existing[0].user_id;
      await pool.query('UPDATE users SET password_hash = ?, failed_attempts = 0, status = ?, deleted_at = NULL, first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name) WHERE user_id = ?', [passwordHash, 'active', firstName, lastName, id]);
      console.log('Updated existing user id', id);
      process.exit(0);
    }

    // Fill required NOT NULL fields with safe defaults when not provided
    const municipalityVal = '';
    const barangayVal = '';
    const contactNumberVal = '';

    const [res] = await pool.query('INSERT INTO users (username, email, password_hash, first_name, last_name, role, municipality, barangay, contact_number, status, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [username, email, passwordHash, firstName, lastName, 'bhw', municipalityVal, barangayVal, contactNumberVal, 'active', 0]);
    console.log('Created user id', res.insertId);
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err.stack || err.message);
    process.exit(1);
  }
})();
