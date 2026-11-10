/**
 * reportControllers.js — Admin-only report signatories management
 *
 * GET  /api/reports/signatories       → fetch all signatories (all roles)
 * PUT  /api/reports/signatories       → replace all signatories (admin only)
 */

const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

// Ensure table exists and has barangay column at startup
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`report_signatories\` (
        \`id\`         INT AUTO_INCREMENT PRIMARY KEY,
        \`barangay\`   VARCHAR(100) NOT NULL DEFAULT 'All Barangays',
        \`position\`   VARCHAR(150) NOT NULL,
        \`name\`       VARCHAR(150) NOT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`updated_by\` INT NULL,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`updated_by\`) REFERENCES \`users\` (\`user_id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Defensive migration: ensure barangay column exists if table was already created
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`report_signatories\` LIKE 'barangay'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`report_signatories\` ADD COLUMN \`barangay\` VARCHAR(100) NOT NULL DEFAULT 'All Barangays' AFTER \`id\``);
    }
  } catch (e) {
    console.warn('[ReportSignatories] Table init warning:', e && e.message);
  }
})();

/**
 * GET /api/reports/signatories
 * Any authenticated user can fetch signatories for embedding in print views.
 * Query param: ?barangay=Antipolo (defaults to 'All Barangays')
 */
exports.getSignatories = async (req, res) => {
  try {
    const barangay = (req.query.barangay || 'All Barangays').trim();
    let [rows] = await pool.query(
      `SELECT id, barangay, position, name, sort_order
       FROM report_signatories
       WHERE barangay = ?
       ORDER BY sort_order ASC, id ASC`,
      [barangay]
    );

    // If no signatories saved yet for this specific barangay, fallback to 'All Barangays'
    if (rows.length === 0 && barangay !== 'All Barangays') {
      const [defaults] = await pool.query(
        `SELECT id, ? AS barangay, position, name, sort_order
         FROM report_signatories
         WHERE barangay = 'All Barangays'
         ORDER BY sort_order ASC, id ASC`,
        [barangay]
      );
      if (defaults.length > 0) {
        rows = defaults;
      }
    }

    // Default template if table is empty
    if (rows.length === 0) {
      rows = [
        { barangay, position: 'Municipal Nutrition Action Officer', name: '', sort_order: 1 },
        { barangay, position: 'Municipal Health Officer', name: '', sort_order: 2 },
        { barangay, position: 'Barangay Nutrition Scholar', name: '', sort_order: 3 },
      ];
    }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('Get signatories error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

/**
 * PUT /api/reports/signatories
 * Admin only.
 * Body can be either:
 *   [ { position, name, sort_order }, ... ] (with ?barangay= query param)
 *   OR { barangay: 'Antipolo', signatories: [ ... ] }
 * Replaces signatories for that specific barangay atomically.
 */
exports.updateSignatories = async (req, res) => {
  let signatories = req.body;
  let targetBarangay = (req.query.barangay || 'All Barangays').trim();

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Array.isArray(req.body.signatories)) {
    signatories = req.body.signatories;
    if (req.body.barangay) {
      targetBarangay = String(req.body.barangay).trim();
    }
  }

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

    await conn.query(`DELETE FROM report_signatories WHERE barangay = ?`, [targetBarangay]);

    for (let i = 0; i < signatories.length; i++) {
      const { position, name, sort_order } = signatories[i];
      await conn.query(
        `INSERT INTO report_signatories (barangay, position, name, sort_order, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          targetBarangay,
          String(position).trim().slice(0, 150),
          String(name || '').trim().slice(0, 150),
          typeof sort_order === 'number' ? sort_order : i + 1,
          req.user?.user_id || null,
        ]
      );
    }

    await conn.commit();

    await logAction(pool, req, 'UPDATE_SIGNATORIES', 'report_signatories', null, { barangay: targetBarangay, count: signatories.length });

    const [updated] = await pool.query(
      `SELECT id, barangay, position, name, sort_order FROM report_signatories WHERE barangay = ? ORDER BY sort_order ASC`,
      [targetBarangay]
    );
    return res.status(200).json({ message: `Signatories for ${targetBarangay} updated successfully.`, signatories: updated, barangay: targetBarangay });
  } catch (err) {
    await conn.rollback();
    console.error('Update signatories error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  } finally {
    conn.release();
  }
};
