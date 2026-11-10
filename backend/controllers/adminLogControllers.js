/**
 * adminLogControllers.js — Admin-only: read system_logs
 *
 * GET /api/admin/logs?page=1&limit=50&role=bns&action=UPDATE_CHILD&from=2026-01-01&to=2026-12-31
 */

const pool = require('../config/db');

exports.getSystemLogs = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;

    const { role, action, actor_id, entity_type, from, to } = req.query;

    const conditions = [];
    const params     = [];

    if (role) {
      conditions.push('actor_role = ?');
      params.push(role);
    }
    if (action) {
      conditions.push('action LIKE ?');
      params.push(`%${action}%`);
    }
    if (actor_id) {
      conditions.push('actor_id = ?');
      params.push(Number(actor_id));
    }
    if (entity_type) {
      conditions.push('entity_type = ?');
      params.push(entity_type);
    }
    if (from) {
      conditions.push('created_at >= ?');
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      conditions.push('created_at <= ?');
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
      `SELECT COUNT(*) AS total FROM system_logs ${whereSQL}`,
      params
    );

    const [logs] = await pool.query(
      `SELECT log_id, actor_id, actor_name, actor_role, action,
              entity_type, entity_id, details, ip_address, created_at
       FROM system_logs
       ${whereSQL}
       ORDER BY created_at DESC
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
