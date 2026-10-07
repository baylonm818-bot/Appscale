const assert = require('assert');
const pool = require('../config/db');

async function run() {
  // Insert a parent test child
  const [cRes] = await pool.query("INSERT INTO children (first_name, last_name, birth_date, sex, age_in_months, municipality, barangay, purok, status) VALUES ('DupTest', 'Child', '2020-01-01', 'female', 72, 'Gasan', 'TestBarangay', 'Purok 1', 'active')");
  const childId = cRes.insertId;

  try {
    // First referral
    await pool.query("INSERT INTO referrals (child_id, referred_by, referred_to, reason, status) VALUES (?, 1, 1, 'Test duplicate', 'Pending')", [childId]);

    // Try to insert duplicate via same criteria
    const [existing] = await pool.query(
      `SELECT referral_id FROM referrals WHERE LOWER(status) IN ('pending','ongoing','responded') AND child_id = ? AND LOWER(TRIM(reason)) = LOWER(TRIM(?)) LIMIT 1`,
      [childId, 'Test duplicate']
    );

    assert(existing.length === 1, 'Expected duplicate referral to be detected');
    console.log('Duplicate referral detection: OK');
  } finally {
    // Cleanup
    await pool.query('DELETE FROM referrals WHERE child_id = ?', [childId]);
    await pool.query('DELETE FROM children WHERE child_id = ?', [childId]);
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
