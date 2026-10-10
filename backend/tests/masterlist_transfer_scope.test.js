const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAccessMasterlistItem,
  canTransferBeneficiary,
} = require('../utils/roleAccess');

test('Admin and same-barangay BHW/BNS can see masterlist records', () => {
  assert.equal(canAccessMasterlistItem({ role: 'admin' }, { barangay: 'Antipolo' }), true);
  assert.equal(canAccessMasterlistItem({ role: 'bhw', barangay: 'Antipolo' }, { barangay: 'Antipolo' }), true);
  assert.equal(canAccessMasterlistItem({ role: 'bns', barangay: 'Antipolo' }, { barangay: 'San Isidro' }), false);
});

test('Transfers are only allowed for admin or same-barangay partner assignment', () => {
  assert.equal(canTransferBeneficiary({ role: 'admin' }, 'Antipolo', 'San Isidro'), true);
  assert.equal(canTransferBeneficiary({ role: 'bhw', barangay: 'Antipolo' }, 'Antipolo', 'San Isidro'), false);
  assert.equal(canTransferBeneficiary({ role: 'bns', barangay: 'Antipolo' }, 'Antipolo', 'Antipolo'), true);
});
