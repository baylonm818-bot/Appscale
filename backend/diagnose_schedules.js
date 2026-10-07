require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSchedulesInDb() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
  });

  const [rows] = await pool.query('SELECT * FROM schedules ORDER BY schedule_id DESC LIMIT 20');
  console.log('\n=== Actual rows in schedules table ===');
  console.log(JSON.stringify(rows, null, 2));

  process.exit(0);
}

checkSchedulesInDb().catch(e => { console.error(e); process.exit(1); });
