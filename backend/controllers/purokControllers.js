const pool = require('../config/db');
const { logAction } = require('../utils/systemLog');

// ── GET /api/puroks ────────────────────────────────────────────────────────────
// Query parameters:
//   barangay_id      — Filter by numeric barangay id
//   barangay         — Filter by barangay name (e.g. 'Antipolo')
//   include_inactive — 'true' | '1' to include deactivated puroks (Admin view)
exports.getPuroks = async (req, res) => {
  try {
    const { barangay_id, barangay, include_inactive } = req.query;
    const includeInactive = include_inactive === 'true' || include_inactive === '1';

    let query = `
      SELECT p.id, p.barangay_id, b.name AS barangay_name, p.name, p.is_active, p.created_at, p.updated_at
      FROM puroks p
      JOIN barangays b ON p.barangay_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (!includeInactive) {
      query += ' AND p.is_active = 1';
    }

    if (barangay_id) {
      query += ' AND p.barangay_id = ?';
      params.push(Number(barangay_id));
    } else if (barangay && String(barangay).trim() !== '' && String(barangay).toLowerCase() !== 'all' && String(barangay).toLowerCase() !== 'all barangays') {
      query += ' AND LOWER(TRIM(b.name)) = LOWER(TRIM(?))';
      params.push(String(barangay).trim());
    }

    query += ' ORDER BY b.name ASC, p.name ASC';

    const [rows] = await pool.query(query, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Get puroks error:', err);
    return res.status(500).json({ message: 'Server error retrieving puroks.' });
  }
};

// ── POST /api/puroks (Admin only) ─────────────────────────────────────────────
// Body: { barangay_id or barangay, name }
exports.createPurok = async (req, res) => {
  try {
    const { barangay_id, barangay, name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Purok name is required.' });
    }

    const trimmedName = String(name).trim();

    let targetBarangayId = barangay_id ? Number(barangay_id) : null;
    let barangayName = '';

    if (!targetBarangayId && barangay) {
      const [[bRow]] = await pool.query(
        'SELECT id, name FROM barangays WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [String(barangay).trim()]
      );
      if (bRow) {
        targetBarangayId = bRow.id;
        barangayName = bRow.name;
      } else {
        const [insertB] = await pool.query(
          'INSERT INTO barangays (name, municipality) VALUES (?, "Gasan")',
          [String(barangay).trim()]
        );
        targetBarangayId = insertB.insertId;
        barangayName = String(barangay).trim();
      }
    } else if (targetBarangayId) {
      const [[bRow]] = await pool.query('SELECT name FROM barangays WHERE id = ?', [targetBarangayId]);
      if (bRow) barangayName = bRow.name;
    }

    if (!targetBarangayId) {
      return res.status(400).json({ message: 'Barangay is required.' });
    }

    // Check duplicate in same barangay
    const [[existing]] = await pool.query(
      'SELECT id, is_active FROM puroks WHERE barangay_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
      [targetBarangayId, trimmedName]
    );

    if (existing) {
      if (!existing.is_active) {
        // Re-activate
        await pool.query('UPDATE puroks SET is_active = 1 WHERE id = ?', [existing.id]);
        return res.status(200).json({
          message: 'Purok was previously deactivated and has now been reactivated.',
          id: existing.id,
          name: trimmedName,
          barangay_id: targetBarangayId,
          is_active: 1,
        });
      }
      return res.status(409).json({ message: 'A purok with this name already exists in this barangay.' });
    }

    const [result] = await pool.query(
      'INSERT INTO puroks (barangay_id, name, is_active) VALUES (?, ?, 1)',
      [targetBarangayId, trimmedName]
    );

    await logAction(pool, req, 'CREATE_PUROK', 'purok', result.insertId, {
      name: trimmedName,
      barangay_id: targetBarangayId,
      barangay_name: barangayName,
    }, barangayName);

    return res.status(201).json({
      message: 'Purok created successfully.',
      id: result.insertId,
      barangay_id: targetBarangayId,
      barangay_name: barangayName,
      name: trimmedName,
      is_active: 1,
    });
  } catch (err) {
    console.error('Create purok error:', err);
    return res.status(500).json({ message: 'Server error creating purok.' });
  }
};

// ── PUT /api/puroks/:id (Admin only) ──────────────────────────────────────────
// Body: { name, is_active }
exports.updatePurok = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const [[existing]] = await pool.query(
      `SELECT p.id, p.barangay_id, p.name, p.is_active, b.name AS barangay_name
       FROM puroks p
       JOIN barangays b ON p.barangay_id = b.id
       WHERE p.id = ?`,
      [Number(id)]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Purok not found.' });
    }

    const newName = name !== undefined && String(name).trim() ? String(name).trim() : existing.name;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await pool.query(
      'UPDATE puroks SET name = ?, is_active = ? WHERE id = ?',
      [newName, newActive, Number(id)]
    );

    await logAction(pool, req, 'UPDATE_PUROK', 'purok', Number(id), {
      old_name: existing.name,
      new_name: newName,
      old_active: existing.is_active,
      new_active: newActive,
      barangay: existing.barangay_name,
    }, existing.barangay_name);

    return res.status(200).json({
      message: 'Purok updated successfully.',
      id: Number(id),
      name: newName,
      is_active: newActive,
      barangay_id: existing.barangay_id,
      barangay_name: existing.barangay_name,
    });
  } catch (err) {
    console.error('Update purok error:', err);
    return res.status(500).json({ message: 'Server error updating purok.' });
  }
};

// ── PATCH /api/puroks/:id/status (Admin only) ──────────────────────────────────
// Body: { is_active: boolean/number }
exports.togglePurokStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const [[existing]] = await pool.query(
      `SELECT p.id, p.name, p.is_active, b.name AS barangay_name
       FROM puroks p
       JOIN barangays b ON p.barangay_id = b.id
       WHERE p.id = ?`,
      [Number(id)]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Purok not found.' });
    }

    const targetActive = is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ? 0 : 1);

    await pool.query('UPDATE puroks SET is_active = ? WHERE id = ?', [targetActive, Number(id)]);

    await logAction(pool, req, targetActive ? 'ACTIVATE_PUROK' : 'DEACTIVATE_PUROK', 'purok', Number(id), {
      name: existing.name,
      is_active: targetActive,
      barangay: existing.barangay_name,
    }, existing.barangay_name);

    return res.status(200).json({
      message: `Purok ${targetActive ? 'activated' : 'deactivated'} successfully.`,
      id: Number(id),
      is_active: targetActive,
    });
  } catch (err) {
    console.error('Toggle purok status error:', err);
    return res.status(500).json({ message: 'Server error updating purok status.' });
  }
};
