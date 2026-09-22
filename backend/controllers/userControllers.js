const pool = require('../config/db');
const bcrypt = require('bcrypt');

exports.getUsers = async (req, res) => {
  try {
        const includeArchived = req.query.includeArchived === 'true';
    const [users] = await pool.query(
        `SELECT user_id, first_name, middle_initial, last_name, email, username, role, municipality, barangay, status, created_at, deleted_at 
        FROM users 
                WHERE ${includeArchived ? '1 = 1' : 'deleted_at IS NULL'} AND role IN ('bhw', 'bns')
        order by created_at desc`);

        return res.status(200).json(users);
    } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({ message: 'Server Error. Please try again later.' });
    }
    };

    exports.getUserStats = async (req, res) =>{
        try{
            const [[stats]] = await pool.query(
                `SELECT
                COALESCE(SUM(CASE WHEN role IN ('bhw', 'bns') THEN 1 ELSE 0 END), 0) AS totalUsers,
                COALESCE(SUM(CASE WHEN role = 'bns' THEN 1 ELSE 0 END), 0) AS totalBNS,
                COALESCE(SUM(CASE WHEN role = 'bhw' THEN 1 ELSE 0 END), 0) AS totalBHW,
                COALESCE(SUM(CASE WHEN role IN ('bhw', 'bns') AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeUsers,
                COALESCE(SUM(CASE WHEN role = 'bns' AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeBNS,
                COALESCE(SUM(CASE WHEN role = 'bhw' AND status = 'active' THEN 1 ELSE 0 END), 0) AS activeBHW
                FROM users
                WHERE deleted_at IS NULL AND role IN ('bhw', 'bns')
                `
            );
            return res.status(200).json(stats);
        }catch (error){
            console.error('Get user stats error:', error);
            return res.status(500).json({message: 'Server error. Please try again later'});
        }
        
    };

    exports.createUsers = async (req, res) => {
        const { first_name, middle_initial, last_name, email, username, password, role, municipality, barangay , purok, contact_number} = req.body;

        if (!first_name || !middle_initial || !last_name || !email || !username || !password || !role || !municipality || !barangay || !purok || !contact_number) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        try{
            if (role === 'bns') {
                const [[existingBarangayBns]] = await pool.query(
                    `SELECT COUNT(*) AS count
                     FROM users
                     WHERE role = 'bns' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))
                       AND deleted_at IS NULL`,
                    [barangay]
                );
                if (existingBarangayBns.count > 0) {
                    return res.status(409).json({ message: 'This barangay already has a BNS. Archive the existing BNS before adding a replacement.' });
                }
            }

            if (role === 'bhw') {
                const [[existingBarangayBns]] = await pool.query(
                    `SELECT COUNT(*) AS count
                     FROM users
                     WHERE role = 'bns' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))
                       AND status = 'active' AND deleted_at IS NULL`,
                    [barangay]
                );
                if (existingBarangayBns.count === 0) {
                    return res.status(409).json({ message: 'This barangay has no active BNS assigned yet. Create or restore the BNS for this barangay first.' });
                }
            }

            const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
            if (existingUser.length > 0) {
                return res.status(400).json({ message: 'Email or username already exists.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await pool.query(
                'INSERT INTO users (first_name, middle_initial, last_name, email, username, password_hash, role, municipality, barangay, purok , contact_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)',
                [first_name, middle_initial  || null, last_name, email, username, hashedPassword, role, municipality, barangay, purok, contact_number]
            );
            return res.status(201).json({ message: 'User created successfully.' });
        } catch (error) {
            console.error('Create user error:', error);
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

    exports.updateUser = async (req, res) => {
        const { user_id } = req.params;
        const { first_name, middle_initial, last_name, email, username, password, role, municipality, barangay } = req.body;

        try{
            if (role === 'bns') {
                const [[existingBarangayBns]] = await pool.query(
                    `SELECT COUNT(*) AS count
                     FROM users
                     WHERE role = 'bns' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))
                       AND deleted_at IS NULL AND user_id <> ?`,
                    [barangay, user_id]
                );
                if (existingBarangayBns.count > 0) {
                    return res.status(409).json({ message: 'This barangay already has a BNS. Archive the existing BNS before assigning another one.' });
                }
            }

            if (role === 'bhw') {
                const [[existingBarangayBns]] = await pool.query(
                    `SELECT COUNT(*) AS count
                     FROM users
                     WHERE role = 'bns' AND LOWER(TRIM(barangay)) = LOWER(TRIM(?))
                       AND status = 'active' AND deleted_at IS NULL AND user_id <> ?`,
                    [barangay, user_id]
                );
                if (existingBarangayBns.count === 0) {
                    return res.status(409).json({ message: 'This barangay has no active BNS assigned yet. Assign the BNS first before adding a BHW.' });
                }
            }

            const updateValues = [first_name, middle_initial || null, last_name, email, username, role, municipality, barangay, user_id];
            let query = 'UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, username = ?, role = ?, municipality = ?, barangay = ? WHERE user_id = ?';

            if (password) {
                // hash password before storing
                const hashed = await bcrypt.hash(password, 10);
                query = 'UPDATE users SET first_name = ?, middle_initial = ?, last_name = ?, email = ?, username = ?, password_hash = ?, role = ?, municipality = ?, barangay = ? WHERE user_id = ?';
                updateValues.splice(5, 0, hashed); // insert hashed at position 5
            }

            await pool.query(query, updateValues);
            return res.status(200).json({ message: 'User updated successfully.' });
        } catch (error) {
            console.error('Update user error:', error);
            return res.status(500).json({ message: 'Server Error. Please try again later.' });  
        }
    };

    exports.updateUserStatus = async (req, res) => {
        const { user_id } = req.params;
        const { status, deactivation_reason} = req.body;

        if (!['active', 'locked', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        try {
            await pool.query(
                'UPDATE users SET status = ?, deactivation_reason = ?, failed_attempts = 0 WHERE user_id = ?',
                [status, deactivation_reason || null, user_id]
            );
            return res.status(200).json({ message: 'User status updated successfully.' });
        } catch (error) {
            console.error('Update user status error:', error);
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
            return res.status(200).json({ message: 'User archived successfully.' });
        } catch (error) {
            console.error('Archive user error:', error);
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };

    exports.restoreUser = async (req, res) => {
        const { user_id } = req.params;

        try {
            await pool.query(
                'UPDATE users SET status = ?, deleted_at = NULL, failed_attempts = 0 WHERE user_id = ?',
                ['active', user_id]
            );
            return res.status(200).json({ message: 'User restored successfully.' });
        } catch (error) {
            console.error('Restore user error:', error);
            return res.status(500).json({ message: 'Server Error. Please try again later.' });
        }
    };