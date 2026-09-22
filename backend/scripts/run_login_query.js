require('dotenv').config();
const pool = require('../config/db');

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node scripts/run_login_query.js <identifier>');
  process.exit(1);
}

(async () => {
  try {
    const loginIdentifier = String(identifier || '').trim();
    const identifierVariants = Array.from(new Set([
      loginIdentifier,
      loginIdentifier.toLowerCase(),
      loginIdentifier.toLowerCase().replace(/\s+/g, ''),
    ])).filter(Boolean);

    const normalizedEmailCandidates = identifierVariants.map((v) => v.toLowerCase());
    const normalizedUsernameCandidates = identifierVariants.map((v) => v.toLowerCase());
    const placeholders = normalizedEmailCandidates.map(() => '?').join(', ');
    const usernamePlaceholders = normalizedUsernameCandidates.map(() => '?').join(', ');

    const [rows] = await pool.query(
      `SELECT * FROM users WHERE (
        LOWER(TRIM(email)) IN (${placeholders}) OR
        LOWER(TRIM(username)) IN (${usernamePlaceholders})
      ) AND deleted_at IS NULL LIMIT 5`,
      [...normalizedEmailCandidates, ...normalizedUsernameCandidates]
    );

    console.log('Query returned', rows.length, 'rows');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Query failed:', e && (e.stack || e.message));
    process.exit(1);
  }
})();
