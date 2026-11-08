/**
 * scheduleControllers.js — Admin schedule management
 *
 * Step 6 changes:
 *  - Removed runtime ALTER TABLE (use migrations instead)
 *  - venue is now REQUIRED on create/update
 *  - Multi-participant support (schedule_participants junction table)
 *  - Audit: BHW/BNS can submit completion evidence per schedule
 *  - System log on every write
 */

const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

// ── Ensure extra columns exist safely at startup (idempotent) ─────────────────
// Step 6: replaces the old runtime ALTER TABLE with a safe, non-blocking check
(async () => {
  const needed = [
    'target_role VARCHAR(20)',
    'created_by INT',
    'venue VARCHAR(255)',
    'facilitator VARCHAR(255)',
    'notes TEXT',
    'audit_completion_notes TEXT',
    'audit_completed_at DATETIME',
    'audit_completed_by INT',
  ];
  for (const col of needed) {
    const colName = col.split(' ')[0];
    try {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = ?`,
        [colName]
      );
      if (Number(cnt) === 0) {
        await pool.query(`ALTER TABLE schedules ADD COLUMN ${col} NULL DEFAULT NULL`);
        console.log(`[Schedules] Added missing column: ${colName}`);
      }
    } catch (e) {
      console.warn(`[Schedules] Column check warning for ${colName}:`, e && e.message);
    }
  }
  // Ensure schedule_participants table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`schedule_participants\` (
        \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
        \`schedule_id\` INT NOT NULL,
        \`user_id\`     INT NOT NULL,
        \`role\`        VARCHAR(20) NULL,
        \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_sched_user\` (\`schedule_id\`, \`user_id\`),
        FOREIGN KEY (\`schedule_id\`) REFERENCES \`schedules\` (\`schedule_id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`user_id\`)     REFERENCES \`users\` (\`user_id\`)     ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    console.warn('[Schedules] schedule_participants table init warning:', e && e.message);
  }
})();

// ── Helper: resolve participant list from schedule_participants ────────────────
async function getParticipants(scheduleId) {
  const [rows] = await pool.query(
    `SELECT sp.user_id, sp.role,
            CONCAT(u.first_name, ' ', u.last_name) AS name, u.role AS user_role
     FROM schedule_participants sp
     JOIN users u ON u.user_id = sp.user_id
     WHERE sp.schedule_id = ?`,
    [scheduleId]
  );
  return rows;
}

// ── Helper: set participants for a schedule (replace all) ─────────────────────
async function setParticipants(conn, scheduleId, participantIds) {
  if (!Array.isArray(participantIds)) return;
  await conn.query(`DELETE FROM schedule_participants WHERE schedule_id = ?`, [scheduleId]);
  for (const uid of participantIds) {
    if (!uid) continue;
    try {
      const [[user]] = await conn.query(`SELECT role FROM users WHERE user_id = ?`, [uid]);
      await conn.query(
        `INSERT IGNORE INTO schedule_participants (schedule_id, user_id, role) VALUES (?, ?, ?)`,
        [scheduleId, uid, user ? user.role : null]
      );
    } catch (_) {}
  }
}

// ── GET /api/schedule/stats ───────────────────────────────────────────────────
exports.getScheduleStats = async (req, res) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS totalActivities,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS upcoming,
         SUM(CASE WHEN status = 'done'    THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
       FROM schedules s
       WHERE s.created_by IS NULL
          OR s.created_by IN (SELECT user_id FROM users WHERE LOWER(role) = 'admin')`
    );
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Get schedule stats error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── GET /api/schedule ─────────────────────────────────────────────────────────
exports.getSchedules = async (req, res) => {
  try {
    const [schedules] = await pool.query(
      `SELECT s.schedule_id, s.title, s.schedule_type, s.schedule_date, s.schedule_time,
              s.venue, s.barangay, s.assigned_to, s.target_role, s.facilitator, s.notes, s.status,
              s.audit_completion_notes, s.audit_completed_at, s.audit_completed_by,
              CONCAT(u.first_name, ' ', u.last_name) AS assigned_name
       FROM schedules s
       LEFT JOIN users u ON u.user_id = s.assigned_to
       WHERE s.created_by IS NULL
          OR s.created_by IN (SELECT user_id FROM users WHERE LOWER(role) = 'admin')
       ORDER BY s.schedule_date ASC`
    );

    // Attach participant lists
    for (const sched of schedules) {
      sched.participants = await getParticipants(sched.schedule_id);
    }

    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── POST /api/schedule ────────────────────────────────────────────────────────
exports.createSchedule = async (req, res) => {
  const {
    title, schedule_type, schedule_date, schedule_time,
    venue, barangay, assigned_to, target_role, facilitator, notes,
    participant_ids,  // Step 6: array of user_id integers
  } = req.body;

  // Required field validation — Step 6: venue is now required
  const missing = [];
  if (!title || !title.trim())         missing.push('title');
  if (!schedule_type)                  missing.push('schedule_type');
  if (!schedule_date)                  missing.push('schedule_date');
  if (!venue || !venue.trim())         missing.push('venue');

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Please fill in all required fields: ${missing.join(', ')}.`,
      missing,
    });
  }

  if (!barangay && !assigned_to && !target_role && (!participant_ids || participant_ids.length === 0)) {
    return res.status(400).json({ message: 'Please select at least one recipient — barangay, role, or participant.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const adminUserId = req.user?.user_id || null;
    const [result] = await conn.query(
      `INSERT INTO schedules
       (title, schedule_type, schedule_date, schedule_time, venue, barangay,
        assigned_to, target_role, facilitator, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        title.trim(), schedule_type, schedule_date, schedule_time || null,
        venue.trim(), barangay || null, assigned_to || null,
        target_role || null, facilitator || null, notes || null, adminUserId,
      ]
    );

    const scheduleId = result.insertId;

    // Step 6: set multi-participants
    if (participant_ids && participant_ids.length > 0) {
      await setParticipants(conn, scheduleId, participant_ids);
    }

    await conn.commit();

    // Notification
    try {
      const formattedDate = new Date(schedule_date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const location = [venue, barangay && barangay !== 'All Barangays' ? barangay : null]
        .filter(Boolean).join(', ');
      await pool.query(
        `INSERT INTO notifications (title, message, type, is_read, related_id, recipient_role, barangay, created_at)
         VALUES (?, ?, 'schedule', FALSE, ?, 'all', ?, NOW())`,
        [
          `New Schedule: ${title}`,
          `${schedule_type.toUpperCase()} on ${formattedDate} at ${location}.`,
          scheduleId,
          barangay && barangay !== 'All Barangays' ? barangay : null,
        ]
      );
    } catch (notifErr) {
      console.warn('Schedule notification warning:', notifErr && notifErr.message);
    }

    await logAction(pool, req, 'CREATE_SCHEDULE', 'schedule', scheduleId, { title, schedule_type, venue });

    return res.status(201).json({ message: 'Schedule created successfully.', schedule_id: scheduleId });
  } catch (error) {
    await conn.rollback();
    console.error('Create schedule error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  } finally {
    conn.release();
  }
};

// ── PATCH /api/schedule/:id/status ───────────────────────────────────────────
exports.updateScheduleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'done', 'cancelled', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    await pool.query('UPDATE schedules SET status = ? WHERE schedule_id = ?', [status, id]);

    try {
      const [[sched]] = await pool.query('SELECT title, barangay FROM schedules WHERE schedule_id = ?', [id]);
      if (sched) {
        const statusLabel = status === 'done' ? 'Completed'
          : status === 'cancelled' ? 'Cancelled'
          : status.toUpperCase();
        await pool.query(
          `INSERT INTO notifications (title, message, type, is_read, related_id, recipient_role, barangay, created_at)
           VALUES (?, ?, 'schedule', FALSE, ?, 'all', ?, NOW())`,
          [
            `Schedule ${statusLabel}: ${sched.title}`,
            `"${sched.title}" (${sched.barangay || 'All Barangays'}) was updated to ${status}.`,
            id,
            sched.barangay && sched.barangay !== 'All Barangays' ? sched.barangay : null,
          ]
        );
      }
    } catch (_) {}

    await logAction(pool, req, 'UPDATE_SCHEDULE_STATUS', 'schedule', Number(id), { status });

    return res.status(200).json({ message: 'Schedule status updated successfully.' });
  } catch (error) {
    console.error('Update schedule status error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── PUT /api/schedule/:id ─────────────────────────────────────────────────────
exports.updateSchedule = async (req, res) => {
  const { id } = req.params;
  const {
    title, schedule_type, schedule_date, schedule_time,
    venue, barangay, assigned_to, target_role, facilitator, notes,
    participant_ids,
  } = req.body;

  // venue required (Step 6)
  const missing = [];
  if (!title || !title.trim())   missing.push('title');
  if (!schedule_type)            missing.push('schedule_type');
  if (!schedule_date)            missing.push('schedule_date');
  if (!venue || !venue.trim())   missing.push('venue');

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Please fill in all required fields: ${missing.join(', ')}.`,
      missing,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query('SELECT schedule_id FROM schedules WHERE schedule_id = ?', [id]);
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    await conn.query(
      `UPDATE schedules
       SET title = ?, schedule_type = ?, schedule_date = ?, schedule_time = ?,
           venue = ?, barangay = ?, assigned_to = ?, target_role = ?, facilitator = ?, notes = ?
       WHERE schedule_id = ?`,
      [
        title.trim(), schedule_type, schedule_date, schedule_time || null,
        venue.trim(), barangay || null, assigned_to || null,
        target_role || null, facilitator || null, notes || null,
        id,
      ]
    );

    if (participant_ids !== undefined) {
      await setParticipants(conn, Number(id), participant_ids || []);
    }

    await conn.commit();

    await logAction(pool, req, 'UPDATE_SCHEDULE', 'schedule', Number(id), { title, venue });

    return res.status(200).json({ message: 'Schedule updated successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Update schedule error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  } finally {
    conn.release();
  }
};

// ── DELETE /api/schedule/:id ──────────────────────────────────────────────────
exports.deleteSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const [[existing]] = await pool.query('SELECT schedule_id FROM schedules WHERE schedule_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }
    await pool.query('DELETE FROM schedules WHERE schedule_id = ?', [id]);
    await logAction(pool, req, 'DELETE_SCHEDULE', 'schedule', Number(id), {});
    return res.status(200).json({ message: 'Schedule deleted successfully.' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── GET /api/schedule/:id/participants ────────────────────────────────────────
exports.getScheduleParticipants = async (req, res) => {
  const { id } = req.params;
  try {
    const participants = await getParticipants(id);
    return res.status(200).json(participants);
  } catch (err) {
    console.error('Get participants error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ── POST /api/schedule/:id/audit ─────────────────────────────────────────────
// BHW/BNS submit audit evidence; Admin can also call this.
exports.submitScheduleAudit = async (req, res) => {
  const { id } = req.params;
  const { audit_completion_notes } = req.body;

  if (!audit_completion_notes || !audit_completion_notes.trim()) {
    return res.status(400).json({ message: 'audit_completion_notes is required.' });
  }

  try {
    const [[existing]] = await pool.query(
      `SELECT schedule_id, title FROM schedules WHERE schedule_id = ?`, [id]
    );
    if (!existing) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    await pool.query(
      `UPDATE schedules
       SET audit_completion_notes = ?,
           audit_completed_at = NOW(),
           audit_completed_by = ?
       WHERE schedule_id = ?`,
      [audit_completion_notes.trim(), req.user?.user_id || null, id]
    );

    await logAction(pool, req, 'SUBMIT_SCHEDULE_AUDIT', 'schedule', Number(id), {
      title: existing.title, notes_length: audit_completion_notes.length,
    });

    return res.status(200).json({ message: 'Audit submitted successfully.' });
  } catch (err) {
    console.error('Submit audit error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};