const pool = require('../config/db');

// Ensure target_role and created_by columns exist (safe to run every startup)
(async () => {
  const cols = ['target_role VARCHAR(20)', 'created_by INT'];
  for (const col of cols) {
    const colName = col.split(' ')[0];
    try {
      await pool.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS ${col} NULL DEFAULT NULL`);
    } catch (e) {
      try {
        const [[{ cnt }]] = await pool.query(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = ?`,
          [colName]
        );
        if (Number(cnt) === 0) {
          await pool.query(`ALTER TABLE schedules ADD COLUMN ${col} NULL DEFAULT NULL`);
        }
      } catch (_) {}
    }
  }
})();

exports.getScheduleStats = async (req, res) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS totalActivities,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS upcoming,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
       FROM schedules`
    );
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Get schedule stats error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getSchedules = async (req, res) => {
  try {
    const [schedules] = await pool.query(
      `SELECT s.schedule_id, s.title, s.schedule_type, s.schedule_date, s.schedule_time,
              s.venue, s.barangay, s.assigned_to, s.target_role, s.facilitator, s.notes, s.status,
              CONCAT(u.first_name, ' ', u.last_name) AS assigned_name
       FROM schedules s
       LEFT JOIN users u ON u.user_id = s.assigned_to
       ORDER BY s.schedule_date ASC`
    );
    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.createSchedule = async (req, res) => {
  const { title, schedule_type, schedule_date, schedule_time, venue, barangay, assigned_to, target_role, facilitator, notes } = req.body;

  if (!title || !schedule_type || !schedule_date) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }

  // Validate: one of barangay, assigned_to, or target_role must be provided
  if (!barangay && !assigned_to && !target_role) {
    return res.status(400).json({ message: 'Please select a recipient — municipality, barangay, role, or specific user.' });
  }

  try {
    await pool.query(
      `INSERT INTO schedules
       (title, schedule_type, schedule_date, schedule_time, venue, barangay, assigned_to, target_role, facilitator, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [title, schedule_type, schedule_date, schedule_time || null, venue || null,
       barangay || null, assigned_to || null, target_role || null, facilitator || null, notes || null]
    );
    return res.status(201).json({ message: 'Schedule created successfully.' });
  } catch (error) {
    console.error('Create schedule error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.updateScheduleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'done', 'cancelled', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    await pool.query('UPDATE schedules SET status = ? WHERE schedule_id = ?', [status, id]);
    return res.status(200).json({ message: 'Schedule status updated successfully.' });
  } catch (error) {
    console.error('Update schedule status error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};