const path = require('path');
// Ensure we load the backend .env (script may be run from repo root)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const pool = require('../config/db');

async function ensureColumn(table, columnDef) {
  const { name, type } = columnDef;
  try {
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, name]
    );
    if (Number(cnt) === 0) {
      console.log(`Adding column ${name} to ${table}`);
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      console.log(`Added ${name} to ${table}`);
    } else {
      console.log(`Column ${name} already exists on ${table}`);
    }
  } catch (err) {
    console.error(`Error ensuring column ${name} on ${table}:`, err && err.message);
    throw err;
  }
}

async function run() {
  try {
    await ensureColumn('children', { name: 'barangay', type: "VARCHAR(255) DEFAULT NULL" });
    await ensureColumn('mothers', { name: 'barangay', type: "VARCHAR(255) DEFAULT NULL" });
    console.log('Migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err && err.message);
    process.exit(2);
  }
}

run();
