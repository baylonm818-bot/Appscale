module.exports = function(allowedRoles = []) {
  return function(req, res, next) {
    const user = req.user || {};
    const role = (user.role || '').toString().toLowerCase();
    const normalized = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toString().toLowerCase()) : [];
    if (normalized.length === 0) return next();
    if (!normalized.includes(role)) return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    return next();
  }
}
