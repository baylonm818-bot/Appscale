const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const {
  canAccessProfile,
  canViewUserList,
  canAccessSchedule,
  canAccessReferral,
} = require('../utils/roleAccess');

async function canUseTriggerHardening() {
  try {
    await pool.query('DROP TRIGGER IF EXISTS trg_users_block_duplicate_active_bhw_insert');
    return true;
  } catch (error) {
    const message = String(error?.message || '');
    return !/TRIGGER|syntax/i.test(message);
  }
}

async function ensureDuplicateActiveRoleTrigger() {
  for (const triggerName of [
    'trg_users_block_duplicate_active_bhw_insert',
    'trg_users_block_duplicate_active_bhw_update',
    'trg_users_block_duplicate_active_bns_insert',
    'trg_users_block_duplicate_active_bns_update',
  ]) {
    try {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName}`);
    } catch (error) {
      const message = String(error?.message || '');
      if (!/does not exist|not exist|trigger.*not/i.test(message)) {
        throw error;
      }
    }
  }

  await pool.query(`
    CREATE TRIGGER trg_users_block_duplicate_active_bhw_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    BEGIN
      IF NEW.role = 'bhw' AND NEW.status = 'active' AND NEW.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.role = 'bhw'
          AND u.barangay = NEW.barangay
          AND u.status = 'active'
          AND u.deleted_at IS NULL
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'This barangay already has an active BHW. Deactivate or lock the existing BHW before adding a replacement.';
      END IF;
    END
  `);

  await pool.query(`
    CREATE TRIGGER trg_users_block_duplicate_active_bhw_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    BEGIN
      IF NEW.role = 'bhw' AND NEW.status = 'active' AND NEW.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.role = 'bhw'
          AND u.barangay = NEW.barangay
          AND u.status = 'active'
          AND u.deleted_at IS NULL
          AND u.user_id <> NEW.user_id
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'This barangay already has an active BHW. Deactivate or lock the existing BHW before adding a replacement.';
      END IF;
    END
  `);

  await pool.query(`
    CREATE TRIGGER trg_users_block_duplicate_active_bns_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    BEGIN
      IF NEW.role = 'bns' AND NEW.status = 'active' AND NEW.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.role = 'bns'
          AND u.barangay = NEW.barangay
          AND u.status = 'active'
          AND u.deleted_at IS NULL
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'This barangay already has an active BNS. Deactivate or lock the existing BNS before adding a replacement.';
      END IF;
    END
  `);

  await pool.query(`
    CREATE TRIGGER trg_users_block_duplicate_active_bns_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    BEGIN
      IF NEW.role = 'bns' AND NEW.status = 'active' AND NEW.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.role = 'bns'
          AND u.barangay = NEW.barangay
          AND u.status = 'active'
          AND u.deleted_at IS NULL
          AND u.user_id <> NEW.user_id
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'This barangay already has an active BNS. Deactivate or lock the existing BNS before adding a replacement.';
      END IF;
    END
  `);
}

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

test('Creator sees their own schedule, but admin does not see partner-created schedules', () => {
  assert.equal(canAccessSchedule({ user_id: 7, role: 'bhw', barangay: 'Tiguion' }, {
    created_by: 7,
    barangay: 'Tiguion',
    target_role: 'bns'
  }), true);

  assert.equal(canAccessSchedule({ user_id: 10, role: 'bns', barangay: 'Tiguion' }, {
    created_by: 10,
    barangay: 'Tiguion',
    target_role: 'bhw'
  }), true);

  assert.equal(canAccessSchedule({ user_id: 1, role: 'admin' }, {
    created_by: 7,
    barangay: 'Tiguion',
    target_role: 'bns'
  }), false);
});

test('A barangay can only have one active BNS and one active BHW', () => {
  const { ensureSingleActiveRolePerBarangay } = require('../utils/roleAccess');

  const users = [
    { role: 'bns', barangay: 'Tiguion', status: 'active', deleted_at: null },
    { role: 'bhw', barangay: 'Tiguion', status: 'active', deleted_at: null },
  ];

  assert.deepEqual(ensureSingleActiveRolePerBarangay({ users, role: 'bns', barangay: 'Tiguion' }), {
    allowed: false,
    message: 'This barangay already has an active BNS. Deactivate or lock the existing BNS before adding a replacement.',
  });

  assert.deepEqual(ensureSingleActiveRolePerBarangay({ users, role: 'bhw', barangay: 'Tiguion' }), {
    allowed: false,
    message: 'This barangay already has an active BHW. Deactivate or lock the existing BHW before adding a replacement.',
  });

  assert.deepEqual(ensureSingleActiveRolePerBarangay({
    users: [{ role: 'bns', barangay: 'Tiguion', status: 'inactive', deleted_at: null }],
    role: 'bns',
    barangay: 'Tiguion',
  }), { allowed: true, message: 'ok' });
});

test('Database rejects duplicate active BHW/BNS entries in the same barangay', async () => {
  const triggerSupported = await canUseTriggerHardening();
  if (!triggerSupported) {
    return;
  }

  await ensureDuplicateActiveRoleTrigger();

  const suffix = Date.now();
  const firstEmail = `dbguard-first-${suffix}@example.com`;
  const secondEmail = `dbguard-second-${suffix}@example.com`;

  await pool.query(
    'INSERT INTO users (email, username, password_hash, first_name, last_name, role, barangay, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    [firstEmail, `dbguard_first_${suffix}`, 'hash', 'DB', 'One', 'bhw', 'Tiguion', 'active']
  );

  await assert.rejects(
    async () => {
      await pool.query(
        'INSERT INTO users (email, username, password_hash, first_name, last_name, role, barangay, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        [secondEmail, `dbguard_second_${suffix}`, 'hash', 'DB', 'Two', 'bhw', 'Tiguion', 'active']
      );
    },
    /This barangay already has an active BHW/i
  );

  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [firstEmail, secondEmail]);
});

test('Deactivated users are denied by the role access contract', () => {
  const { isUserActiveForLogin } = require('../utils/roleAccess');

  assert.equal(isUserActiveForLogin({ status: 'active', deleted_at: null }), true);
  assert.equal(isUserActiveForLogin({ status: 'inactive', deleted_at: null }), false);
  assert.equal(isUserActiveForLogin({ status: 'locked', deleted_at: null }), false);
  assert.equal(isUserActiveForLogin({ status: 'active', deleted_at: '2024-01-01' }), false);
});

test('Role middleware rejects inactive users and wrong-role access consistently', () => {
  const roleMiddleware = require('../middleware/roleMiddleware');

  let called = false;
  const activeReq = { user: { role: 'bhw', status: 'active' } };
  const inactiveReq = { user: { role: 'bns', status: 'inactive' } };
  const wrongRoleReq = { user: { role: 'bns', status: 'active' } };

  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  roleMiddleware(['bhw'])(activeReq, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.code, undefined);

  const inactiveRes = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  roleMiddleware(['bhw', 'bns'])(inactiveReq, inactiveRes, () => { called = true; });
  assert.equal(inactiveRes.code, 401);

  const wrongRes = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  roleMiddleware(['bhw'])(wrongRoleReq, wrongRes, () => { called = true; });
  assert.equal(wrongRes.code, 403);
});
