const pool = require('../config/db');

function bhwNotificationExclusionClause(alias = 'n') {
  return `(${alias}.type <> 'system' AND ${alias}.title NOT LIKE 'Data Synced%' AND ${alias}.title NOT LIKE 'Data Synced Automatically%')`;
}

// Ensure table exists on initialization
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'schedule',
        is_read BOOLEAN DEFAULT FALSE,
        related_id INT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error creating notifications table:', err && err.message);
  }
})();

exports.getNotifications = async (req, res) => {
  try {
    // 1. Ensure any existing schedules from schedules table are synced into notifications
    try {
      const [unsyncedSchedules] = await pool.query(`
        SELECT s.schedule_id, s.title, s.schedule_type, s.schedule_date, s.schedule_time, s.venue, s.barangay, s.status
        FROM schedules s
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.related_id = s.schedule_id AND n.type = 'schedule'
        )
      `);

      for (const s of unsyncedSchedules) {
        const dateStr = s.schedule_date
          ? new Date(s.schedule_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Date TBD';
        const loc = [s.venue, s.barangay && s.barangay !== 'All Barangays' ? s.barangay : null].filter(Boolean).join(', ') || 'Municipal Venue';
        await pool.query(
          `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
           VALUES (?, ?, 'schedule', FALSE, ?, NOW())`,
          [
            `Scheduled: ${s.title}`,
            `${(s.schedule_type || 'Activity').toUpperCase()} on ${dateStr} at ${loc}.`,
            s.schedule_id,
          ]
        );
      }
    } catch (syncErr) {
      console.warn('Schedule sync warning (non-fatal):', syncErr && syncErr.message);
    }

    // 2. Fetch notifications. BHW users should NOT see system (auto-sync) notifications.
    const role = String(req.user?.role || '').toLowerCase();

    // Build conditional WHERE clause depending on role. Keep referral/malnutrition/schedule notifications.
    let whereClause = '';
    if (role === 'bhw') {
      whereClause = `WHERE n.type <> 'system' AND n.title NOT LIKE 'Data Synced%' AND n.title NOT LIKE 'Data Synced Automatically%'`;
    }

    const [notifications] = await pool.query(
      `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at
       FROM notifications n
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT 50`
    );

    const [[{ unreadCount }]] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       FROM notifications n
       ${whereClause ? whereClause + ' AND' : 'WHERE'} n.is_read = FALSE`
    );

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error && (error.stack || error));
    return res.status(200).json({ notifications: [], unreadCount: 0 });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [id]);
    return res.status(200).json({ message: 'Marked as read.' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'bhw') {
      await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE is_read = FALSE
           AND type <> 'system'
           AND title NOT LIKE 'Data Synced%'
           AND title NOT LIKE 'Data Synced Automatically%'`
      );
    } else {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE"
      );
    }
    return res.status(200).json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};