const pool = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `SELECT notification_id, title, message, type, is_read, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 50`
    );

    if (notifications.length === 0) {
      const defaultNotifs = [
        ['New BNS Referral Submitted', 'BNS submitted a referral for Baby Juan Cruz (SAM malnutrition). Immediate follow-up required.', 'referral', false],
        ['OPT Plus Schedule Created', 'Operation Timbang Plus Schedule for Barangay Antipolo has been set for this month.', 'schedule', false],
        ['Malnutrition Alert: SAM Case', 'Child Seph Baylon was measured and classified as Severe Acute Malnutrition (SAM).', 'malnutrition', true],
      ];
      for (const [title, message, type, isRead] of defaultNotifs) {
        await pool.query(
          `INSERT INTO notifications (title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, NOW())`,
          [title, message, type, isRead]
        );
      }
      const [freshNotifs] = await pool.query(
        `SELECT notification_id, title, message, type, is_read, created_at
         FROM notifications
         ORDER BY created_at DESC
         LIMIT 50`
      );
      const [[{ unreadCount }]] = await pool.query(
        `SELECT COUNT(*) AS unreadCount FROM notifications WHERE is_read = FALSE`
      );
      return res.status(200).json({ notifications: freshNotifs, unreadCount });
    }

    const [[{ unreadCount }]] = await pool.query(
      `SELECT COUNT(*) AS unreadCount FROM notifications WHERE is_read = FALSE`
    );
    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
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
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    return res.status(200).json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};