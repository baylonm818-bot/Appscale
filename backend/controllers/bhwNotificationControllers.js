const pool = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `SELECT notification_id, title, message, type, is_read, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 50`
    );
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