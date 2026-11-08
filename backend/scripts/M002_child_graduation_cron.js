/**
 * M002 – Child age-out + graduation notification job
 *
 * Run once at startup and then every 24 hours.
 * - Sets children.status = 'inactive' where age_in_months >= 59 AND status = 'active'
 * - Fires a notification to every admin/BNS/BHW in that barangay
 *
 * Usage (called from server.js):
 *   const { startAgeOutCron } = require('./scripts/M002_child_graduation_cron');
 *   startAgeOutCron(pool);
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function runAgeOut(pool) {
  try {
    // 1. Recalculate age_in_months for all active children so the trigger is accurate
    await pool.query(`
      UPDATE children
      SET age_in_months = TIMESTAMPDIFF(MONTH, birth_date, CURDATE())
      WHERE status = 'active' AND birth_date IS NOT NULL
    `);

    // 2. Find children who have just crossed the 59-month threshold
    const [toGraduate] = await pool.query(`
      SELECT child_id, first_name, last_name, barangay, age_in_months
      FROM children
      WHERE status = 'active'
        AND age_in_months >= 59
    `);

    if (toGraduate.length === 0) return;

    for (const child of toGraduate) {
      // 3. Mark as inactive (graduated)
      await pool.query(
        `UPDATE children SET status = 'inactive', updated_at = NOW() WHERE child_id = ?`,
        [child.child_id]
      );

      // 4. Archive snapshot
      try {
        const [[snapshot]] = await pool.query(
          `SELECT * FROM children WHERE child_id = ?`, [child.child_id]
        );
        await pool.query(
          `INSERT INTO archive_records (table_name, record_id, snapshot, reason, archived_at)
           VALUES ('children', ?, ?, 'graduate', NOW())`,
          [child.child_id, JSON.stringify(snapshot)]
        );
      } catch (archErr) {
        console.warn('Archive snapshot warning (non-fatal):', archErr && archErr.message);
      }

      // 5. Notify all admin + BNS/BHW in that barangay
      const childName = `${child.first_name || ''} ${child.last_name || ''}`.trim();
      const title = `Graduation: ${childName}`;
      const message = `${childName} (Barangay ${child.barangay}) has reached 59 months and has graduated from the feeding program.`;

      try {
        // Admin notifications (global)
        const [admins] = await pool.query(
          `SELECT user_id FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL`
        );
        for (const admin of admins) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, is_read, related_id, created_at)
             VALUES (?, ?, ?, 'alert', FALSE, ?, NOW())`,
            [admin.user_id, title, message, child.child_id]
          );
        }

        // BNS / BHW in same barangay
        const [localStaff] = await pool.query(
          `SELECT user_id FROM users
           WHERE role IN ('bns', 'bhw')
             AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))
             AND status = 'active'
             AND deleted_at IS NULL`,
          [child.barangay]
        );
        for (const staff of localStaff) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, is_read, related_id, created_at)
             VALUES (?, ?, ?, 'alert', FALSE, ?, NOW())`,
            [staff.user_id, title, message, child.child_id]
          );
        }
      } catch (notifErr) {
        console.warn('Graduation notification warning (non-fatal):', notifErr && notifErr.message);
      }

      console.log(`[AgeOut] Child ${child.child_id} (${childName}) graduated at ${child.age_in_months} months.`);
    }

    console.log(`[AgeOut] Processed ${toGraduate.length} graduation(s).`);
  } catch (err) {
    console.error('[AgeOut] Job error:', err && err.message);
  }
}

function startAgeOutCron(pool) {
  // Run immediately on startup
  runAgeOut(pool).catch((e) => console.warn('[AgeOut] Initial run warning:', e && e.message));
  // Then every 24 hours
  setInterval(() => {
    runAgeOut(pool).catch((e) => console.warn('[AgeOut] Interval run warning:', e && e.message));
  }, MS_PER_DAY);
}

module.exports = { startAgeOutCron, runAgeOut };
