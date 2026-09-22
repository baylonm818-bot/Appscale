require('dotenv').config();
const pool = require('../config/db');

// Usage: node scripts/reset_admin_password.js [email] [bcryptedHash]
const email = process.argv[2] || 'admin@apscale.local';
const hash = process.argv[3] || '$2b$10$UZauVBB.6iEwVKOnGjrEtuFHOMDivQgKVaMANOugvjjoo1ygU2yYa';

(async () => {
  try {
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ?, failed_attempts = 0, status = ? WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))',
      [hash, 'active', email]
    );
    console.log('Updated rows:', result.affectedRows);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update admin password:', err.stack || err.message);
    process.exit(1);
  }
})();
