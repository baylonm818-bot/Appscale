/**
 * systemLog.js — write a row to system_logs.
 *
 * Usage:
 *   const { logAction } = require('../utils/systemLog');
 *   await logAction(pool, req, 'CREATE_CHILD', 'child', child_id, { name: 'Juan' });
 *
 * Non-fatal: failures are only warned, never thrown.
 */

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {import('express').Request} req
 * @param {string} action           e.g. 'CREATE_CHILD'
 * @param {string} entityType       e.g. 'child', 'mother', 'schedule'
 * @param {number|null} entityId
 * @param {object|null} details     arbitrary payload (before/after values, etc.)
 * @param {string|null} explicitBarangay
 */
async function logAction(pool, req, action, entityType, entityId, details, explicitBarangay) {
  try {
    const user = req && req.user;
    const actorId   = user ? (user.user_id || null) : null;
    const actorName = user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || null
      : null;
    const actorRole = user ? (user.role || null) : null;
    const actorBarangay = explicitBarangay || (user && user.barangay) || (details && (details.barangay || details.to_barangay)) || null;
    const ip = (req && (req.ip || (req.headers && req.headers['x-forwarded-for']))) || null;

    await pool.query(
      `INSERT INTO system_logs
         (actor_id, actor_name, actor_role, barangay, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        actorId,
        actorName,
        actorRole,
        actorBarangay,
        String(action),
        entityType || null,
        entityId   || null,
        details    ? JSON.stringify(details) : null,
        ip         ? String(ip).slice(0, 50) : null,
      ]
    );
  } catch (err) {
    // Non-fatal — log but never crash the request
    console.warn('[SystemLog] Failed to write log entry:', err && err.message);
  }
}

module.exports = { logAction };
