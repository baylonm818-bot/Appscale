require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
    });

    const [rows] = await pool.query('SELECT 1+1 AS result');
    console.log('DB OK:', rows);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err.message || err.stack);
    process.exit(1);
  }
}

test();
