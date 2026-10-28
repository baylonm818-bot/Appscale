const pool = require('../config/db');

function bhwNotificationExclusionClause(alias = 'n') {
  return `(${alias}.type <> 'system' AND ${alias}.title NOT LIKE 'Data Synced%' AND ${alias}.title NOT LIKE 'Data Synced Automatically%')`;
}

// Ensure table exists on initialization and columns exist
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
        recipient_role VARCHAR(20) NULL,
        recipient_user_id INT NULL,
        barangay VARCHAR(100) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Verify columns exist on legacy tables
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'`
    );
    const colNames = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!colNames.has('recipient_role')) {
      await pool.query('ALTER TABLE notifications ADD COLUMN recipient_role VARCHAR(20) NULL');
    }
    if (!colNames.has('recipient_user_id')) {
      await pool.query('ALTER TABLE notifications ADD COLUMN recipient_user_id INT NULL');
    }
    if (!colNames.has('barangay')) {
      await pool.query('ALTER TABLE notifications ADD COLUMN barangay VARCHAR(100) NULL');
    }
  } catch (err) {
    console.error('Error ensuring notifications table schema:', err && err.message);
  }
})();

function buildRoleNotificationWhere(role, userBarangay, alias = 'n') {
  const normRole = String(role || '').toLowerCase();
  if (normRole === 'admin') {
    // Admin only sees: new children added, upcoming events/schedules.
    // Explicitly excludes referral notifications and clinical alerts (which belong to BHW) and auto-sync logs.
    return {
      clause: `WHERE (
        (${alias}.recipient_role = 'admin' AND ${alias}.type <> 'referral')
        OR (${alias}.recipient_role IN ('admin', 'all') AND ${alias}.type IN ('child', 'schedule'))
        OR (${alias}.recipient_role IS NULL AND ${alias}.type IN ('child', 'schedule'))
      ) AND ${alias}.type NOT IN ('referral', 'alert', 'system')`,
      params: [],
    };
  }

  if (normRole === 'bhw') {
    if (userBarangay) {
      return {
        clause: `WHERE (
          (${alias}.recipient_role = 'bhw' AND (${alias}.barangay = ? OR ${alias}.barangay IS NULL))
          OR (${alias}.recipient_role IN ('bhw', 'all') AND (${alias}.barangay = ? OR ${alias}.barangay IS NULL))
          OR (${alias}.recipient_role IS NULL AND (${alias}.barangay = ? OR ${alias}.barangay IS NULL))
        ) AND ${alias}.type <> 'system' AND ${alias}.title NOT LIKE 'Data Synced%' AND ${alias}.title NOT LIKE 'Data Synced Automatically%'`,
        params: [userBarangay, userBarangay, userBarangay],
      };
    }
    return {
      clause: `WHERE (${alias}.recipient_role IN ('bhw', 'all') OR ${alias}.recipient_role IS NULL)
        AND ${alias}.type <> 'system' AND ${alias}.title NOT LIKE 'Data Synced%' AND ${alias}.title NOT LIKE 'Data Synced Automatically%'`,
      params: [],
    };
  }

  return {
    clause: `WHERE ${alias}.type <> 'system'`,
    params: [],
  };
}

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
          `INSERT INTO notifications (title, message, type, is_read, related_id, recipient_role, barangay, created_at)
           VALUES (?, ?, 'schedule', FALSE, ?, 'all', ?, NOW())`,
          [
            `Scheduled: ${s.title}`,
            `${(s.schedule_type || 'Activity').toUpperCase()} on ${dateStr} at ${loc}.`,
            s.schedule_id,
            s.barangay && s.barangay !== 'All Barangays' ? s.barangay : null,
          ]
        );
      }
    } catch (syncErr) {
      console.warn('Schedule sync warning (non-fatal):', syncErr && syncErr.message);
    }

    // 2. Fetch notifications filtered strictly by recipient role and barangay
    const role = String(req.user?.role || '').toLowerCase();
    const userBarangay = req.user?.barangay;
    const { clause: whereClause, params } = buildRoleNotificationWhere(role, userBarangay, 'n');

function normalizeNotificationToEnglish(notif) {
  if (!notif) return notif;
  let title = notif.title || '';
  let message = notif.message || '';

  if (message.includes(' ay Completed') || message.includes('Referral ni ')) {
    message = message.replace(/Referral ni (.*?) ay Completed\./gi, 'Referral completed for $1.');
    message = message.replace(/Referral ni (.*?) ay (.*?)\./gi, 'Referral for $1 is now $2.');
  }

  title = title
    .replace(/^Bagong Referral/i, 'New Referral')
    .replace(/^Bagong Iskedyul/i, 'New Schedule')
    .replace(/^Paalala/i, 'Reminder');

  let createdAt = notif.created_at;
  if (createdAt instanceof Date) {
    createdAt = createdAt.toISOString();
  } else if (createdAt && typeof createdAt === 'string' && !createdAt.endsWith('Z')) {
    createdAt = new Date(createdAt).toISOString();
  }

  return { ...notif, title, message, created_at: createdAt };
}

    const [rawNotifications] = await pool.query(
      `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at
       FROM notifications n
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT 50`,
      params
    );

    const notifications = (rawNotifications || []).map(normalizeNotificationToEnglish);

    const [[{ unreadCount }]] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       FROM notifications n
       ${whereClause} AND n.is_read = FALSE`,
      params
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
    const userBarangay = req.user?.barangay;

    if (role === 'admin') {
      await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE is_read = FALSE
           AND (
             (recipient_role = 'admin' AND type <> 'referral')
             OR (recipient_role IN ('admin', 'all') AND type IN ('child', 'schedule'))
             OR (recipient_role IS NULL AND type IN ('child', 'schedule'))
           )
           AND type NOT IN ('referral', 'alert', 'system')`
      );
    } else if (role === 'bhw') {
      if (userBarangay) {
        await pool.query(
          `UPDATE notifications
           SET is_read = TRUE
           WHERE is_read = FALSE
             AND (
               (recipient_role = 'bhw' AND (barangay = ? OR barangay IS NULL))
               OR (recipient_role IN ('bhw', 'all') AND (barangay = ? OR barangay IS NULL))
               OR (recipient_role IS NULL AND (barangay = ? OR barangay IS NULL))
             )
             AND type <> 'system'
             AND title NOT LIKE 'Data Synced%'
             AND title NOT LIKE 'Data Synced Automatically%'`,
          [userBarangay, userBarangay, userBarangay]
        );
      } else {
        await pool.query(
          `UPDATE notifications
           SET is_read = TRUE
           WHERE is_read = FALSE
             AND (recipient_role IN ('bhw', 'all') OR recipient_role IS NULL)
             AND type <> 'system'
             AND title NOT LIKE 'Data Synced%'
             AND title NOT LIKE 'Data Synced Automatically%'`
        );
      }
    } else {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE AND type <> 'system'"
      );
    }
    return res.status(200).json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};