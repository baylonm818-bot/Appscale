const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
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
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
