const { isUserActiveForLogin } = require('../utils/roleAccess');

module.exports = function(allowedRoles = []) {
  return function(req, res, next) {
    const user = req.user || {};
    const role = (user.role || '').toString().toLowerCase();
    const normalized = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toString().toLowerCase()) : [];
    if (normalized.length === 0) return next();

    if (!isUserActiveForLogin(user)) {
      return res.status(401).json({ message: 'Account is inactive or no longer valid for this session.' });
    }

    if (!normalized.includes(role)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }

    return next();
  }
}
