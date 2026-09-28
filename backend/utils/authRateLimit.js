function buildLoginLimiterKey(req) {
  const email = String(req?.body?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  return `ip:${String(req?.ip || 'unknown').trim()}`;
}

module.exports = {
  buildLoginLimiterKey,
};
