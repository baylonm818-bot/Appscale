const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { canViewUserList, canEditUser, ensureSingleActiveRolePerBarangay } = require('../utils/roleAccess');
const { validateContactNumber } = require('../utils/contactValidation');

exports.getUsers = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const role = String(req.user?.role || '').toLowerCase();
    const barangay = req.user?.barangay;

    // Exclude common test accounts from regular listings unless explicitly requesting archived/test entries
    const testFilter = "AND LOWER(TRIM(email)) NOT LIKE '%@example.com' AND LOWER(TRIM(username)) NOT LIKE 'test%' AND LOWER(TRIM(email)) NOT LIKE 'test%'";
    let baseQuery = `SELECT user_id, first_name, middle_initial, last_name, email, username, role, municipality, barangay, purok, contact_number, status, created_at, deleted_at 
      FROM users 
      WHERE ${includeArchived ? '1 = 1' : 'deleted_at IS NULL'} AND role IN ('bhw', 'bns') ${includeArchived ? '' : testFilter}`;
    const params = [];

    if (role === 'bhw' && barangay) {
      baseQuery += ' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))';
      params.push(barangay);
    }

    const [users] = await pool.query(`${baseQuery} ORDER BY created_at DESC`, params);

    if (role === 'bhw') {
      return res.status(200).json(users.filter((user) => canViewUserList(req.user, user)));
    }

    return res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ message: 'Server Error. Please try again later.' });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const barangay = req.user?.barangay;

    // Exclude obvious test accounts from stats
    const testFilter = "AND LOWER(TRIM(email)) NOT LIKE '%@example.com' AND LOWER(TRIM(username)) NOT LIKE 'test%' AND LOWER(TRIM(email)) NOT LIKE 'test%'";
    let whereClause = "deleted_at IS NULL AND role IN ('bhw', 'bns')" + (req.query.includeArchived === 'true' ? '' : ` ${testFilter}`);
    const params = [];

    if (role === 'bhw' && barangay) {
      whereClause += ' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))';
      params.push(barangay);
    }

    const [[stats]] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN role IN ('bhw', 'bns') THEN 1 ELSE 0 END), 0) AS totalUsers,
        COALESCE(SUM(CASE WHEN role = 'bns' THEN 1 ELSE 0 END), 0) AS totalBNS,
        COALESCE(SUM(CASE WHEN role = 'bhw' THEN 1 ELSE 0 END), 0) AS totalBHW,
        COALESCE(SUM(CASE WHEN role IN ('bhw', 'bns') AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeUsers,
        COALESCE(SUM(CASE WHEN role IN ('bhw', 'bns') AND status IN ('locked', 'inactive') THEN 1 ELSE 0 END), 0) AS lockedUsers,
        COALESCE(SUM(CASE WHEN role = 'bns' AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeBNS,
        COALESCE(SUM(CASE WHEN role = 'bhw' AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeBHW
      FROM users
      WHERE ${whereClause}`,
      params
    );

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Get user stats error:', error);
    return res.status(500).json({ message: 'Server error. Please try again later' });
  }
};

    exports.createUsers = async (req, res) => {
        const { first_name, middle_initial, last_name, email, username, password, role, municipality, barangay, purok, contact_number } = req.body;

        if (!first_name || !last_name || !email || !password || !role || !barangay) {
            return res.status(400).json({ message: 'First name, last name, email, password, role, and barangay are required.' });
        }

        if (contact_number !== undefined && contact_number !== null && String(contact_number).trim() !== '') {
            const contactCheck = validateContactNumber(contact_number);
            if (!contactCheck.valid) {
                return res.status(400).json({ message: contactCheck.message });
            }
        }

        const finalUsername = (username && username.trim()) ? username.trim() : email.trim();

        try {
            const [existingUsers] = await pool.query(
                `SELECT role, barangay, status, deleted_at FROM users WHERE deleted_at IS NULL AND status = 'active'`
            );
            const activeRoleGuard = ensureSingleActiveRolePerBarangay({ users: existingUsers, role, barangay });
            if (!activeRoleGuard.allowed) {
                return res.status(409).json({ message: activeRoleGuard.message });
            }

            const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, finalUsername]);
            if (existingUser.length > 0) {
                return res.status(400).json({ message: 'Email already exists.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const cleanContact = (contact_number && String(contact_number).trim()) ? String(contact_number).trim() : null;

            await pool.query(
                'INSERT INTO users (first_name, middle_initial, last_name, email, username, password_hash, role, municipality, barangay, purok, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [first_name, middle_initial || null, last_name, email, finalUsername, hashedPassword, role, municipality, barangay, purok || null, cleanContact]
            );
            return res.status(201).json({ message: 'User created successfully.' });
        } catch (error) {
            console.error('Create user error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                return res.status(409).json({ message: `Barangay ${barangay} already has an active ${String(role).toUpperCase()}` });
            }
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

exports.updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { first_name, middle_initial, last_name, email, username, password, role, municipality, barangay, purok, contact_number } = req.body;

  if (contact_number !== undefined && contact_number !== null && String(contact_number).trim() !== '') {
    const contactCheck = validateContactNumber(contact_number);
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
  }

  try {
    const [[targetUser]] = await pool.query(
      'SELECT user_id, role, barangay, purok, contact_number FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      [user_id]
    );

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const actingRole = String(req.user?.role || '').toLowerCase();
    if (actingRole === 'bhw' && !canEditUser(req.user, targetUser)) {
      return res.status(403).json({ message: 'You can only edit users in your own barangay.' });
    }

    const [existingUsers] = await pool.query(
      `SELECT user_id, role, barangay, status, deleted_at
       FROM users
       WHERE deleted_at IS NULL AND status = 'active' AND user_id <> ?`,
      [user_id]
    );
    const activeRoleGuard = ensureSingleActiveRolePerBarangay({ users: existingUsers, role, barangay });
    if (!activeRoleGuard.allowed) {
      return res.status(409).json({ message: activeRoleGuard.message });
    }

    const finalUsername = (username && username.trim()) ? username.trim() : email.trim();
    const finalPurok = purok !== undefined ? (purok ? String(purok).trim() : null) : targetUser.purok;
    const finalContact = contact_number !== undefined ? (contact_number && String(contact_number).trim() ? String(contact_number).trim() : null) : targetUser.contact_number;

    let query = 'UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, username = ?, role = ?, municipality = ?, barangay = ?, purok = ?, contact_number = ? WHERE user_id = ?';
    let updateValues = [first_name, middle_initial || null, last_name, email, finalUsername, role, municipality, barangay, finalPurok, finalContact, user_id];

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, username = ?, password_hash = ?, role = ?, municipality = ?, barangay = ?, purok = ?, contact_number = ? WHERE user_id = ?';
      updateValues = [first_name, middle_initial || null, last_name, email, finalUsername, hashed, role, municipality, barangay, finalPurok, finalContact, user_id];
    }

    await pool.query(query, updateValues);
    return res.status(200).json({ message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ message: `Barangay ${barangay} already has an active ${String(role).toUpperCase()}` });
    }
    return res.status(500).json({ message: 'Server Error. Please try again later.' });
  }
};

    exports.updateUserStatus = async (req, res) => {
        const { user_id } = req.params;
        const { status, deactivation_reason } = req.body;

        if (!['active', 'locked', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        try {
            const [[targetUser]] = await pool.query(
                'SELECT user_id, first_name, last_name, role, barangay FROM users WHERE user_id = ?',
                [user_id]
            );

            if (!targetUser) {
                return res.status(404).json({ message: 'User not found.' });
            }

            if (status === 'active' && ['bns', 'bhw'].includes(String(targetUser.role || '').toLowerCase())) {
                const [existingUsers] = await pool.query(
                    `SELECT user_id, role, barangay, status, deleted_at
                     FROM users
                     WHERE deleted_at IS NULL AND status = 'active' AND user_id <> ?`,
                    [user_id]
                );
                const activeRoleGuard = ensureSingleActiveRolePerBarangay({
                    users: existingUsers,
                    role: targetUser.role,
                    barangay: targetUser.barangay,
                });
                if (!activeRoleGuard.allowed) {
                    return res.status(409).json({ message: activeRoleGuard.message });
                }
            }

            await pool.query(
                'UPDATE users SET status = ?, deactivation_reason = ?, failed_attempts = 0 WHERE user_id = ?',
                [status, deactivation_reason || null, user_id]
            );

            try {
                const actionLabel = status === 'locked' ? 'Locked' : status === 'active' ? 'Unlocked' : 'Deactivated';
                await pool.query(
                    `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
                     VALUES (?, ?, 'account', FALSE, ?, NOW())`,
                    [
                        `Account ${actionLabel}: ${targetUser.first_name} ${targetUser.last_name}`,
                        `${targetUser.first_name} ${targetUser.last_name} (${(targetUser.role || '').toUpperCase()}) was ${status} by administrator.`,
                        user_id
                    ]
                );
            } catch (_) {}

            return res.status(200).json({ message: 'User status updated successfully.' });
        } catch (error) {
            console.error('Update user status error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                return res.status(409).json({ message: 'This barangay already has an active user with this role.' });
            }
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

    exports.archiveUser = async (req, res) => {
        const { user_id } = req.params;

        try {
            await pool.query(
                'UPDATE users SET status = ?, deleted_at = NOW(), failed_attempts = 0 WHERE user_id = ?',
                ['inactive', user_id]
            );

            try {
                const [[targetUser]] = await pool.query('SELECT first_name, last_name, role FROM users WHERE user_id = ?', [user_id]);
                if (targetUser) {
                    await pool.query(
                        `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
                         VALUES (?, ?, 'account', FALSE, ?, NOW())`,
                        [
                            `Account Archived: ${targetUser.first_name} ${targetUser.last_name}`,
                            `${targetUser.first_name} ${targetUser.last_name} (${(targetUser.role || '').toUpperCase()}) was archived.`,
                            user_id
                        ]
                    );
                }
            } catch (_) {}

            return res.status(200).json({ message: 'User archived successfully.' });
        } catch (error) {
            console.error('Archive user error:', error);
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

    exports.restoreUser = async (req, res) => {
        const { user_id } = req.params;

        try {
            const [[targetUser]] = await pool.query(
                'SELECT user_id, first_name, last_name, role, barangay FROM users WHERE user_id = ?',
                [user_id]
            );

            if (!targetUser) {
                return res.status(404).json({ message: 'User not found.' });
            }

            if (['bns', 'bhw'].includes(String(targetUser.role || '').toLowerCase())) {
                const [existingUsers] = await pool.query(
                    `SELECT user_id, role, barangay, status, deleted_at
                     FROM users
                     WHERE deleted_at IS NULL AND status = 'active' AND user_id <> ?`,
                    [user_id]
                );
                const activeRoleGuard = ensureSingleActiveRolePerBarangay({
                    users: existingUsers,
                    role: targetUser.role,
                    barangay: targetUser.barangay,
                });
                if (!activeRoleGuard.allowed) {
                    return res.status(409).json({ message: activeRoleGuard.message });
                }
            }

            await pool.query(
                'UPDATE users SET status = ?, deleted_at = NULL, failed_attempts = 0 WHERE user_id = ?',
                ['active', user_id]
            );

            try {
                await pool.query(
                    `INSERT INTO notifications (title, message, type, is_read, related_id, created_at)
                     VALUES (?, ?, 'account', FALSE, ?, NOW())`,
                    [
                        `Account Restored: ${targetUser.first_name} ${targetUser.last_name}`,
                        `${targetUser.first_name} ${targetUser.last_name} (${(targetUser.role || '').toUpperCase()}) was restored to active.`,
                        user_id
                    ]
                );
            } catch (_) {}

            return res.status(200).json({ message: 'User restored successfully.' });
        } catch (error) {
            console.error('Restore user error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                return res.status(409).json({ message: 'This barangay already has an active user with this role.' });
            }
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

    /**
     * Admin helper: unlock/reset a user by email or username.
     * Body: { identifier: '<email-or-username>' }
     */
    exports.unlockUserByIdentifier = async (req, res) => {
        const { identifier } = req.body;
        if (!identifier || !String(identifier).trim()) {
            return res.status(400).json({ message: 'Identifier (email or username) is required.' });
        }

        try {
            const id = String(identifier).trim();
            const [rows] = await pool.query(
                'SELECT user_id, role, barangay FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1',
                [id, id]
            );

            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: 'User not found for provided identifier.' });
            }

            const user = rows[0];

            if (['bns', 'bhw'].includes(String(user.role || '').toLowerCase())) {
                const [existingUsers] = await pool.query(
                    `SELECT user_id, role, barangay, status, deleted_at
                     FROM users
                     WHERE deleted_at IS NULL AND status = 'active' AND user_id <> ?`,
                    [user.user_id]
                );
                const activeRoleGuard = ensureSingleActiveRolePerBarangay({
                    users: existingUsers,
                    role: user.role,
                    barangay: user.barangay,
                });
                if (!activeRoleGuard.allowed) {
                    return res.status(409).json({ message: activeRoleGuard.message });
                }
            }

            await pool.query(
                'UPDATE users SET failed_attempts = 0, status = ?, deleted_at = NULL WHERE user_id = ?',
                ['active', user.user_id]
            );

            return res.status(200).json({ message: 'User unlocked and reset successfully.' });
        } catch (error) {
            console.error('Unlock user error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                return res.status(409).json({ message: 'This barangay already has an active user with this role.' });
            }
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };