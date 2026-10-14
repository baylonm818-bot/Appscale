const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const { purgeExpiredUsers } = require('../controllers/userControllers');

test('A6: Retention purge removes accounts deactivated >= 3 years and preserves accounts < 3 years', async () => {
  const ts = Date.now();
  const oldEmail = `old_deactivated_${ts}@example.com`;
  const recentEmail = `recent_deactivated_${ts}@example.com`;

  // 1. Insert test user deactivated 4 years ago
  const [resOld] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, username, password_hash, role, municipality, barangay, contact_number, status, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'bhw', 'Gasan', 'Antipolo', '09123456789', 'inactive', DATE_SUB(NOW(), INTERVAL 4 YEAR), DATE_SUB(NOW(), INTERVAL 5 YEAR))`,
    ['OldTest', 'Deactivated', oldEmail, `user_old_${ts}`, 'hash123']
  );
  const oldUserId = resOld.insertId;

  // 2. Insert test user deactivated 1 year ago
  const [resRecent] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, username, password_hash, role, municipality, barangay, contact_number, status, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'bhw', 'Gasan', 'Antipolo', '09123456788', 'inactive', DATE_SUB(NOW(), INTERVAL 1 YEAR), DATE_SUB(NOW(), INTERVAL 2 YEAR))`,
    ['RecentTest', 'Deactivated', recentEmail, `user_rec_${ts}`, 'hash456']
  );
  const recentUserId = resRecent.insertId;

  try {
    // Run the purge logic
    const purgeResult = await purgeExpiredUsers();
    assert.ok(purgeResult.purgedCount >= 1, 'Should have purged at least the 4-year-old deactivated account');

    // 3. Verify old user was permanently deleted
    const [[checkOld]] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [oldUserId]);
    assert.equal(checkOld, undefined, 'Old user deactivated >= 3 years must be permanently removed');

    // 4. Verify recent user was preserved
    const [[checkRecent]] = await pool.query('SELECT user_id, status FROM users WHERE user_id = ?', [recentUserId]);
    assert.ok(checkRecent, 'Recent user deactivated < 3 years must be preserved');
    assert.equal(checkRecent.user_id, recentUserId);
  } finally {
    // Cleanup
    await pool.query('DELETE FROM users WHERE user_id IN (?, ?)', [oldUserId, recentUserId]).catch(() => {});
  }
});
