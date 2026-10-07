const pool = require('../config/db');

(async () => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'profile_picture'`
    );
    const exists = rows[0].cnt > 0;
    if (exists) {
      console.log('Column users.profile_picture already exists.');
      process.exit(0);
    }

    console.log('Adding column users.profile_picture ...');
    await pool.query("ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) NULL;");
    console.log('Added users.profile_picture column successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && (err.message || err));
    process.exit(1);
  }
})();
