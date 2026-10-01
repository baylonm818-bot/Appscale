require('dotenv').config();
// Reuse existing DB pool which already handles URL parsing and SSL config
const pool = require('../config/db');

(async function test() {
  try {
    const [rows] = await pool.query('SELECT 1+1 AS result');
    console.log('DB OK:', rows);
    // do not end the shared pool here; it's managed by the application
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err.message || err.stack);
    process.exit(1);
  }
})();
