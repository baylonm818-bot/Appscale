const pool = require('./config/db');

async function unlockAll() {
  const [locked] = await pool.query(
    "SELECT user_id, email, role, status, failed_attempts FROM users WHERE status = 'locked' AND deleted_at IS NULL"
  );
  console.log('Locked accounts found:', locked.length);
  locked.forEach(u => console.log(' -', u.email, '|', u.role, '| attempts:', u.failed_attempts));

  if (locked.length > 0) {
    await pool.query(
      "UPDATE users SET status = 'active', failed_attempts = 0, deactivation_reason = NULL WHERE status = 'locked' AND deleted_at IS NULL"
    );
    console.log('All locked accounts have been UNLOCKED and failed_attempts reset to 0.');
  } else {
    console.log('No locked accounts found — account may have been locked differently.');
    // Also show all users and their status
    const [all] = await pool.query(
      "SELECT user_id, email, role, status, failed_attempts FROM users WHERE deleted_at IS NULL ORDER BY role"
    );
    console.log('\nAll active users:');
    all.forEach(u => console.log(' -', u.email, '|', u.role, '| status:', u.status, '| attempts:', u.failed_attempts));
  }

  await pool.end();
}

unlockAll().catch(e => { console.error('Error:', e.message); process.exit(1); });
