const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceScopedBarangay } = require('../utils/roleAccess');

test('BHW can only read and write within their assigned barangay', () => {
  assert.deepEqual(enforceScopedBarangay({ role: 'bhw', barangay: 'Tiguion' }, 'Tiguion'), {
    allowed: true,
    barangay: 'Tiguion',
  });

  assert.deepEqual(enforceScopedBarangay({ role: 'bhw', barangay: 'Tiguion' }, 'San Isidro'), {
    allowed: false,
    reason: 'barangay_mismatch',
  });
});

test('BNS requests are forced to their own barangay even when query params try to override it', () => {
  assert.deepEqual(enforceScopedBarangay({ role: 'bns', barangay: 'Dawis' }, 'Gasan'), {
    allowed: false,
    reason: 'barangay_mismatch',
  });

  assert.deepEqual(enforceScopedBarangay({ role: 'bns', barangay: 'Dawis' }, null), {
    allowed: true,
    barangay: 'Dawis',
  });
});
