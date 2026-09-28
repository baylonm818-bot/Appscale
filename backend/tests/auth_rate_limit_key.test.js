const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLoginLimiterKey } = require('../utils/authRateLimit');

test('same email gets the same limiter bucket even when IP differs', () => {
  const a = buildLoginLimiterKey({ body: { email: 'admin@apscale.local' }, ip: '10.0.0.1' });
  const b = buildLoginLimiterKey({ body: { email: 'ADMIN@apscale.local' }, ip: '10.0.0.2' });

  assert.equal(a, 'email:admin@apscale.local');
  assert.equal(b, 'email:admin@apscale.local');
  assert.equal(a, b);
});

test('different emails get different limiter buckets', () => {
  const a = buildLoginLimiterKey({ body: { email: 'admin@apscale.local' }, ip: '10.0.0.1' });
  const b = buildLoginLimiterKey({ body: { email: 'bhw@apscale.local' }, ip: '10.0.0.1' });

  assert.notEqual(a, b);
});
