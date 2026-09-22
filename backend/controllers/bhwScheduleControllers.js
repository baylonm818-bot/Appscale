const pool = require('../config/db');

exports.getBhwSchedules = async (req, res) => {
  const { barangay, user_id } = req.query;

  if (!barangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const [schedules] = await pool.query(
      `SELECT schedule_id, title, schedule_type, schedule_date, schedule_time,
              venue, barangay, assigned_to, facilitator, notes, status
       FROM schedules
      WHERE (barangay = ? OR barangay = 'All Barangays')
        AND (assigned_to IS NULL OR assigned_to = ?)
        AND status != 'archived'
       ORDER BY schedule_date ASC`,
          [barangay, user_id || 0]
    );
    return res.status(200).json(schedules);
  } catch (error) {
    console.error('Get BHW schedules error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.markScheduleDone = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE schedules SET status = 'done' WHERE schedule_id = ?`, [id]);
    return res.status(200).json({ message: 'Marked as done.' });
  } catch (error) {
    console.error('Mark schedule done error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};