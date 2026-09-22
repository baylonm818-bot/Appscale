require('dotenv').config();
const pool = require('../config/db');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error describing users table:', err.stack || err.message);
    process.exit(1);
  }
})();
