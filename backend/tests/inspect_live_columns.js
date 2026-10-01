const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  const [cols] = await connection.query('SHOW COLUMNS FROM referrals');
  console.log('REFERRALS COLUMNS:', cols.map(c => c.Field));
  await connection.end();
})();
