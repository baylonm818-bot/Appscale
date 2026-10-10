const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { isUserActiveForLogin } = require('../utils/roleAccess');

module.exports = async function (req, res, next) {
  // basic request trace for auth-protected routes
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const masked = authHeader ? `${String(authHeader).slice(0,12)}...` : null;
    console.log('jwtMiddleware called for', req.method, req.path, 'authHeaderPresent:', !!authHeader, 'authHeader:', masked);
  } catch (e) {
    console.error('jwtMiddleware logging failed', e && e.message);
  }
  // Allow unauthenticated access to auth routes
  if (req.path.startsWith('/auth')) return next();

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Authorization header missing.' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Invalid authorization format.' });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT user_id, role, barangay, municipality, status, deleted_at FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      [payload.user_id]
    );

    if (!rows || rows.length === 0 || !isUserActiveForLogin(rows[0])) {
      return res.status(401).json({ message: 'Account is inactive or no longer valid for this session.' });
    }

    req.user = {
      ...payload,
      role: rows[0].role || payload.role,
      barangay: rows[0].barangay || payload.barangay,
      municipality: rows[0].municipality || payload.municipality,
      status: rows[0].status,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
