const pool = require('../config/db');

function buildScopedNotificationWhere(userBarangay) {
  const barangayLike = `%${userBarangay}%`;

  return `
    FROM notifications n
    LEFT JOIN schedules s ON n.type = 'schedule' AND n.related_id = s.schedule_id
    LEFT JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
    LEFT JOIN children c ON c.child_id = r.child_id
    LEFT JOIN mothers m ON m.mother_id = r.mother_id
    WHERE (
      (n.type = 'schedule' AND s.barangay = ?)
      OR (n.type = 'referral' AND COALESCE(c.barangay, m.barangay) = ?)
      OR (n.title LIKE ?)
      OR (n.message LIKE ?)
    )
  `;
}

exports.getNotifications = async (req, res) => {
  const userBarangay = req.user?.barangay;

  if (!userBarangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const scopedWhere = buildScopedNotificationWhere(userBarangay);
    const [notifications] = await pool.query(
      `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at
       ${scopedWhere}
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userBarangay, userBarangay, `%${userBarangay}%`, `%${userBarangay}%`]
    );

    const [[{ unreadCount }]] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       ${scopedWhere}`,
      [userBarangay, userBarangay, `%${userBarangay}%`, `%${userBarangay}%`]
    );

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const userBarangay = req.user?.barangay;

  if (!userBarangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    await pool.query(
      `UPDATE notifications n
       LEFT JOIN schedules s ON n.type = 'schedule' AND n.related_id = s.schedule_id
       LEFT JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
       LEFT JOIN children c ON c.child_id = r.child_id
       LEFT JOIN mothers m ON m.mother_id = r.mother_id
       SET n.is_read = TRUE
       WHERE n.notification_id = ?
         AND ((n.type = 'schedule' AND s.barangay = ?)
           OR (n.type = 'referral' AND COALESCE(c.barangay, m.barangay) = ?)
           OR (n.title LIKE ?)
           OR (n.message LIKE ?))`,
      [id, userBarangay, userBarangay, `%${userBarangay}%`, `%${userBarangay}%`]
    );
    return res.status(200).json({ message: 'Marked as read.' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.markAllAsRead = async (req, res) => {
  const userBarangay = req.user?.barangay;

  if (!userBarangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    await pool.query(
      `UPDATE notifications n
       LEFT JOIN schedules s ON n.type = 'schedule' AND n.related_id = s.schedule_id
       LEFT JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
       LEFT JOIN children c ON c.child_id = r.child_id
       LEFT JOIN mothers m ON m.mother_id = r.mother_id
       SET n.is_read = TRUE
       WHERE n.is_read = FALSE
         AND ((n.type = 'schedule' AND s.barangay = ?)
           OR (n.type = 'referral' AND COALESCE(c.barangay, m.barangay) = ?)
           OR (n.title LIKE ?)
           OR (n.message LIKE ?))`,
      [userBarangay, userBarangay, `%${userBarangay}%`, `%${userBarangay}%`]
    );
    return res.status(200).json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};