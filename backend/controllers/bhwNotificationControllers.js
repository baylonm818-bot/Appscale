const pool = require('../config/db');

function bhwNotificationExclusionClause(alias = 'n') {
  return `(${alias}.type <> 'system' AND ${alias}.title NOT LIKE 'Data Synced%' AND ${alias}.title NOT LIKE 'Data Synced Automatically%')`;
}

function buildScopedNotification(userBarangay) {
  const barangayLike = `%${userBarangay}%`;
  return {
    fromWhere: `
      FROM notifications n
      LEFT JOIN schedules s ON n.type = 'schedule' AND n.related_id = s.schedule_id
      LEFT JOIN referrals r ON n.type = 'referral' AND n.related_id = r.referral_id
      LEFT JOIN children c ON c.child_id = r.child_id
      LEFT JOIN mothers m ON m.mother_id = r.mother_id
      WHERE (
        (n.type = 'schedule' AND (s.barangay = ? OR s.barangay = 'All Barangays' OR s.barangay IS NULL OR n.barangay = ?))
        OR (n.type = 'referral' AND (n.barangay = ? OR COALESCE(c.barangay, m.barangay) = ?))
        OR (n.barangay = ?)
        OR (n.title LIKE ?)
        OR (n.message LIKE ?)
      )
    `,
    params: [userBarangay, userBarangay, userBarangay, userBarangay, userBarangay, barangayLike, barangayLike],
  };
}

function normalizeNotificationToEnglish(notif) {
  if (!notif) return notif;
  let title = notif.title || '';
  let message = notif.message || '';

  // Translate Tagalog referral patterns
  if (message.includes(' ay Completed') || message.includes('Referral ni ')) {
    message = message.replace(/Referral ni (.*?) ay Completed\./gi, 'Referral completed for $1.');
    message = message.replace(/Referral ni (.*?) ay (.*?)\./gi, 'Referral for $1 is now $2.');
  }
  if (message.includes(' ay Ongoing') || message.includes(' ay In Progress')) {
    message = message.replace(/Referral ni (.*?) ay (Ongoing|In Progress)\./gi, 'Referral in progress for $1.');
  }
  if (message.includes(' ay Pending')) {
    message = message.replace(/Referral ni (.*?) ay Pending\./gi, 'Referral pending for $1.');
  }
  if (message.includes(' ay Cancelled')) {
    message = message.replace(/Referral ni (.*?) ay Cancelled\./gi, 'Referral cancelled for $1.');
  }

  // Common phrases
  title = title
    .replace(/^Bagong Referral/i, 'New Referral')
    .replace(/^Bagong Iskedyul/i, 'New Schedule')
    .replace(/^Paalala/i, 'Reminder');

  message = message
    .replace(/\bKailangan ng agarang aksyon\b/gi, 'Immediate action required.')
    .replace(/\bnaitala para kay\b/gi, 'recorded for')
    .replace(/\bnaitala para sa\b/gi, 'recorded for')
    .replace(/\bKasulukuyang ginagamot\b/gi, 'Currently receiving treatment')
    .replace(/\bTapos na ang serbisyo\b/gi, 'Service completed');

  let createdAt = notif.created_at;
  if (createdAt instanceof Date) {
    createdAt = createdAt.toISOString();
  } else if (createdAt && typeof createdAt === 'string' && !createdAt.endsWith('Z')) {
    createdAt = new Date(createdAt).toISOString();
  }

  return { ...notif, title, message, created_at: createdAt };
}

exports.getNotifications = async (req, res) => {
  const userBarangay = req.user?.barangay;

  if (!userBarangay) {
    return res.status(400).json({ message: 'Barangay is required.' });
  }

  try {
    const { fromWhere, params } = buildScopedNotification(userBarangay);
    const [rawNotifications] = await pool.query(
      `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at
       ${fromWhere} AND ${bhwNotificationExclusionClause()}
       ORDER BY n.created_at DESC
       LIMIT 50`,
      params
    );

    const notifications = (rawNotifications || []).map(normalizeNotificationToEnglish);

    const [[{ unreadCount }]] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       ${fromWhere} AND n.is_read = FALSE AND ${bhwNotificationExclusionClause()}`,
      params
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
      `UPDATE notifications SET is_read = TRUE WHERE notification_id = ?`,
      [id]
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
    const { fromWhere, params } = buildScopedNotification(userBarangay);
    const [unreadRows] = await pool.query(
      `SELECT n.notification_id
       ${fromWhere} AND n.is_read = FALSE AND ${bhwNotificationExclusionClause()}`,
      params
    );

    if (unreadRows && unreadRows.length > 0) {
      const ids = unreadRows.map((r) => r.notification_id);
      await pool.query(
        `UPDATE notifications SET is_read = TRUE WHERE notification_id IN (?)`,
        [ids]
      );
    }

    return res.status(200).json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};