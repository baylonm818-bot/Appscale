const pool = require('../config/db');
const { canAccessSchedule } = require('../utils/roleAccess');

async function createScheduleStatusNotification(scheduleId, statusOverride) {
  try {
    const [[sched]] = await pool.query('SELECT title, barangay FROM schedules WHERE schedule_id = ?', [scheduleId]);
    if (!sched) return;

    const label = statusOverride === 'done' ? 'Completed' : statusOverride === 'cancelled' ? 'Cancelled' : String(statusOverride || 'Updated').toUpperCase();
    await pool.query(
      `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
       VALUES (?, ?, 'schedule', FALSE, ?, NOW())`,
      [
        `Schedule ${label}: ${sched.title}`,
        `"${sched.title}" (${sched.barangay || 'All Barangays'}) was updated to ${statusOverride || 'updated'}.`,
        scheduleId,
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
       WHERE barangay = ?
         AND status != 'archived'
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

  if (!title || !schedule_type || !schedule_date) {
    return res.status(400).json({ message: 'Title, type, and date are required.' });
  }

  if (!user?.barangay) {
    return res.status(400).json({ message: 'Your account has no barangay assigned.' });
  }

  try {
    await pool.query(
      `INSERT INTO schedules
       (title, schedule_type, schedule_date, schedule_time, venue, barangay, assigned_to, target_role, facilitator, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`,
      [
        title,
        schedule_type,
        schedule_date,
        schedule_time || null,
        venue || null,
        user.barangay,
        user.role,          // target_role = role of creator so same-role same-barangay sees it
        facilitator || null,
        notes || null,
        user.user_id,
      ]
    );
    return res.status(201).json({ message: 'Schedule created successfully.' });
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