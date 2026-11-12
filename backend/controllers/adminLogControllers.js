/**
 * adminLogControllers.js — Admin-only: read system_logs
 *
 * GET /api/admin/logs?page=1&limit=50&role=bns&action=UPDATE_CHILD&barangay=Antipolo
 */

const pool = require('../config/db');

exports.getSystemLogs = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;

    const { role, action, actor_id, entity_type, from, to, barangay } = req.query;

    const conditions = [];
    const params     = [];

    if (role) {
      conditions.push('s.actor_role = ?');
      params.push(role);
    }
    if (barangay && barangay.toLowerCase() !== 'all') {
      conditions.push('(s.barangay = ? OR u.barangay = ? OR JSON_UNQUOTE(JSON_EXTRACT(s.details, "$.barangay")) = ?)');
      params.push(barangay, barangay, barangay);
    }
    if (action) {
      conditions.push('(s.action LIKE ? OR s.actor_name LIKE ? OR s.details LIKE ? OR s.barangay LIKE ? OR u.barangay LIKE ?)');
      const term = `%${action}%`;
      params.push(term, term, term, term, term);
    }
    if (actor_id) {
      conditions.push('s.actor_id = ?');
      params.push(Number(actor_id));
    }
    if (entity_type) {
      conditions.push('s.entity_type = ?');
      params.push(entity_type);
    }
    if (from) {
      conditions.push('s.created_at >= ?');
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      conditions.push('s.created_at <= ?');
      params.push(`${to} 23:59:59`);
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ tblCnt }]] = await pool.query(
      `SELECT COUNT(*) AS tblCnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_logs'`
    );
    if (Number(tblCnt) === 0) {
      return res.status(200).json({
        logs: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      });
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM system_logs s
       LEFT JOIN users u ON s.actor_id = u.user_id
       ${whereSQL}`,
      params
    );

    const [logs] = await pool.query(
      `SELECT s.log_id, s.actor_id, s.actor_name, s.actor_role,
              COALESCE(s.barangay, u.barangay, JSON_UNQUOTE(JSON_EXTRACT(s.details, '$.barangay')), 'All Barangays') AS barangay,
              s.action, s.entity_type, s.entity_id, s.details, s.ip_address, s.created_at
       FROM system_logs s
       LEFT JOIN users u ON s.actor_id = u.user_id
       ${whereSQL}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      logs,
      pagination: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err) {
    console.error('Get system logs error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
