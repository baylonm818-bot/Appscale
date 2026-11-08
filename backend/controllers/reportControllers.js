/**
 * reportControllers.js — Admin-only report signatories management
 *
 * GET  /api/reports/signatories       → fetch all signatories (all roles)
 * PUT  /api/reports/signatories       → replace all signatories (admin only)
 */

const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

// Ensure table exists at startup (defensive; migration should run first)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`report_signatories\` (
        \`id\`         INT AUTO_INCREMENT PRIMARY KEY,
        \`position\`   VARCHAR(150) NOT NULL,
        \`name\`       VARCHAR(150) NOT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`updated_by\` INT NULL,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`updated_by\`) REFERENCES \`users\` (\`user_id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    console.warn('[ReportSignatories] Table init warning:', e && e.message);
  }
})();

/**
 * GET /api/reports/signatories
 * Any authenticated user can fetch signatories for embedding in print views.
 */
exports.getSignatories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, position, name, sort_order
       FROM report_signatories
       ORDER BY sort_order ASC, id ASC`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Get signatories error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * PUT /api/reports/signatories
 * Admin only. Body: [ { position, name, sort_order }, ... ]
 * Replaces all signatories atomically.
 */
exports.updateSignatories = async (req, res) => {
  const signatories = req.body;

  if (!Array.isArray(signatories) || signatories.length === 0) {
    return res.status(400).json({ message: 'Signatories must be a non-empty array.' });
  }

  for (const sig of signatories) {
    if (!sig.position || !sig.position.trim()) {
      return res.status(400).json({ message: 'Each signatory must have a position.' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM report_signatories`);

    for (let i = 0; i < signatories.length; i++) {
      const { position, name, sort_order } = signatories[i];
      await conn.query(
        `INSERT INTO report_signatories (position, name, sort_order, updated_by, updated_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          String(position).trim().slice(0, 150),
          String(name || '').trim().slice(0, 150),
          typeof sort_order === 'number' ? sort_order : i + 1,
          req.user?.user_id || null,
        ]
      );
    }

    await conn.commit();

    await logAction(pool, req, 'UPDATE_SIGNATORIES', 'report_signatories', null, { count: signatories.length });

    const [updated] = await pool.query(
      `SELECT id, position, name, sort_order FROM report_signatories ORDER BY sort_order ASC`
    );
    return res.status(200).json({ message: 'Signatories updated successfully.', signatories: updated });
  } catch (err) {
    await conn.rollback();
    console.error('Update signatories error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  } finally {
    conn.release();
  }
};
