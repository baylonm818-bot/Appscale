const pool = require('../config/db');
const { canAccessSchedule } = require('../utils/roleAccess');
const { logAction } = require('../utils/systemLog');


async function createScheduleStatusNotification(scheduleId, statusOverride) {
  try {
    const [[sched]] = await pool.query('SELECT title, barangay FROM schedules WHERE schedule_id = ?', [scheduleId]);
    if (!sched) return;

    const label = statusOverride === 'done' ? 'Completed' : statusOverride === 'cancelled' ? 'Cancelled' : String(statusOverride || 'Updated').toUpperCase();
    await pool.query(
      `INSERT INTO notifications (title, message, type, is_read, related_id, recipient_role, barangay, created_at)
       VALUES (?, ?, 'schedule', FALSE, ?, 'all', ?, NOW())`,
      [
        `Schedule ${label}: ${sched.title}`,
        `"${sched.title}" (${sched.barangay || 'All Barangays'}) was updated to ${statusOverride || 'updated'}.`,
        scheduleId,
        sched.barangay && sched.barangay !== 'All Barangays' ? sched.barangay : null,
      ]
    );
  } catch (notifErr) {
    console.warn('Failed to insert schedule status notification:', notifErr && notifErr.message);
  }
}

// BHW/BNS: Get schedules for their barangay (from admin + their own)
exports.getBhwSchedules = async (req, res) => {
  const user = req.user;

  if (!user?.barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [schedules] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time,
              venue, barangay, assigned_to, target_role, facilitator, notes, status,
              created_by
       FROM schedules
       WHERE status != 'archived'
         AND (
           barangay = ?
           OR barangay = 'All Barangays'
           OR barangay IS NULL
         )
       ORDER BY schedule_date ASC`,
      [user.barangay]
    );

    const allowedSchedules = schedules.filter((schedule) => canAccessSchedule(user, schedule));
    return res.status(200).json(allowedSchedules);
  } catch (error) {
    console.error('Get BHW schedules error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// BHW/BNS: Create a schedule (visible to same barangay only)
exports.createBhwSchedule = async (req, res) => {
  const { title, schedule_type, schedule_date, schedule_time, venue, facilitator, notes } = req.body;
  const user = req.user;

  // Step 6: venue is required
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

  if (!user?.barangay) {
    return res.status(400).json({ message: 'Your account has no barangay assigned.' });
  }

  try {
    const [result] = await pool.query(

      `INSERT INTO schedules
       (title, schedule_type, schedule_date, schedule_time, venue, barangay, assigned_to, target_role, facilitator, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`,
      [
        title,
        schedule_type,
        schedule_date,
        schedule_time || null,
        venue.trim(),
        user.barangay,
        user.role === 'bhw' ? 'bns' : 'bhw',
        facilitator || null,
        notes || null,
        user.user_id,
      ]
    );
    await logAction(pool, req, 'CREATE_SCHEDULE_BHW', 'schedule', result.insertId, {
      title, venue, barangay: user.barangay,
    });
    return res.status(201).json({ message: 'Schedule created successfully.', schedule_id: result.insertId });
  } catch (error) {
    console.error('Create BHW schedule error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// BHW/BNS: Mark schedule as done
exports.markScheduleDone = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE schedules SET status = 'done' WHERE schedule_id = ?`, [id]);
    await createScheduleStatusNotification(id, 'done');
    return res.status(200).json({ message: 'Marked as done.' });
  } catch (error) {
    console.error('Mark schedule done error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// BHW/BNS: Update schedule status
exports.updateBhwScheduleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'done', 'cancelled', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    await pool.query('UPDATE schedules SET status = ? WHERE schedule_id = ?', [status, id]);
    await createScheduleStatusNotification(id, status);
    return res.status(200).json({ message: 'Schedule status updated.' });
  } catch (error) {
    console.error('Update BHW schedule status error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


// ── Step 6: BHW/BNS submit audit evidence for a schedule ─────────────────────
exports.submitBhwScheduleAudit = async (req, res) => {
  const { id } = req.params;
  const { audit_completion_notes } = req.body;

  if (!audit_completion_notes || !audit_completion_notes.trim()) {
    return res.status(400).json({ message: 'audit_completion_notes is required.' });
  }

  try {
    const [[sched]] = await pool.query(
      `SELECT schedule_id, title, barangay, created_by FROM schedules WHERE schedule_id = ?`, [id]
    );
    if (!sched) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    // Only participants or creator should submit audit
    const user = req.user;
    const [participants] = await pool.query(
      `SELECT user_id FROM schedule_participants WHERE schedule_id = ?`, [id]
    );
    const participantIds = participants.map((p) => p.user_id);
    const isParticipant = participantIds.includes(user.user_id) || sched.created_by === user.user_id;
    // Allow if participant OR if barangay matches (assigned implicitly)
    const barangayMatch = sched.barangay && sched.barangay === user.barangay;

    if (!isParticipant && !barangayMatch) {
      return res.status(403).json({ message: 'You are not assigned to this schedule.' });
    }

    await pool.query(
      `UPDATE schedules
       SET audit_completion_notes = ?,
           audit_completed_at = NOW(),
           audit_completed_by = ?
       WHERE schedule_id = ?`,
      [audit_completion_notes.trim(), user.user_id, id]
    );

    await logAction(pool, req, 'SUBMIT_SCHEDULE_AUDIT', 'schedule', Number(id), {
      title: sched.title,
    });

    return res.status(200).json({ message: 'Audit submitted successfully.' });
  } catch (err) {
    console.error('Submit BHW audit error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};