const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAccessProfile,
  canViewUserList,
  canAccessSchedule,
  canAccessReferral,
} = require('../utils/roleAccess');

test('BHW can view same-barangay BNS profile information', () => {
  const requester = { user_id: 7, role: 'bhw', barangay: 'Tiguion' };
  const target = { user_id: 9, role: 'bns', barangay: 'Tiguion' };

  assert.equal(canAccessProfile(requester, target), true);
});

test('BNS cannot view other barangay staff records', () => {
  const requester = { user_id: 10, role: 'bns', barangay: 'Tiguion' };
  const target = { user_id: 14, role: 'bhw', barangay: 'San Isidro' };

  assert.equal(canAccessProfile(requester, target), false);
});

test('Admin can view all staff lists, BHW sees same-barangay staff only', () => {
  assert.equal(canViewUserList({ user_id: 1, role: 'admin' }, { role: 'bns', barangay: 'Tiguion' }), true);
  assert.equal(canViewUserList({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { role: 'bns', barangay: 'Tiguion' }), true);
  assert.equal(canViewUserList({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { role: 'bns', barangay: 'San Isidro' }), false);
  assert.equal(canViewUserList({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, { role: 'bws', barangay: 'Tiguion' }), false);
});

test('BHW and BNS can only see schedules for their own barangay or same-role scope', () => {
  assert.equal(canAccessSchedule({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { barangay: 'Tiguion', target_role: 'bhw' }), true);
  assert.equal(canAccessSchedule({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { barangay: 'San Isidro', target_role: 'bhw' }), false);
  assert.equal(canAccessSchedule({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, { barangay: 'Tiguion', target_role: 'bns' }), true);
  assert.equal(canAccessSchedule({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, { barangay: 'Tiguion', target_role: 'bhw' }), false);
  assert.equal(canAccessSchedule({ user_id: 1, role: 'admin' }, { barangay: 'Tiguion', target_role: 'bhw' }), true);
});

test('Referral visibility follows barangay and assignment rules', () => {
  assert.equal(canAccessReferral({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { barangay: 'Tiguion', referred_by: 9 }), true);
  assert.equal(canAccessReferral({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, { barangay: 'San Isidro', referred_by: 9 }), false);
  assert.equal(canAccessReferral({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, { barangay: 'Tiguion', referred_by: 10 }), true);
  assert.equal(canAccessReferral({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, { barangay: 'San Isidro', referred_by: 12 }), false);
  assert.equal(canAccessReferral({ user_id: 1, role: 'admin' }, { barangay: 'Tiguion', referred_by: 7 }), true);
});
