const test = require('node:test');
const assert = require('node:assert/strict');

function makeRes() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('mobile nutrition sync normalizes status values to database-safe strings', async () => {
  const pool = require('../config/db');
  const originalQuery = pool.query;

  const created = { insertId: 221, values: null };
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT child_id, age_in_months, sex FROM children WHERE external_id = ?')) {
      return [[{ child_id: 21, age_in_months: 18, sex: 'male' }]];
    }
    if (sql.includes('SELECT age_in_months, sex FROM children WHERE child_id = ?')) {
      return [[{ age_in_months: 18, sex: 'male' }]];
    }
    if (sql.includes('SELECT nutrition_record_id, child_id, record_date FROM nutrition_records')) {
      return [[]];
    }
    if (sql.includes('INSERT INTO nutrition_records')) {
      created.values = params;
      return [created];
    }
    return [[{ ok: true }]];
  };

  try {
    const controller = require('../controllers/mobileBeneficiaryControllers');
    const req = {
      body: {
        child_external_id: 'local-child-uuid',
        record_date: '2025-01-10',
        weight_kg: 8.6,
        height_cm: 74,
        muac_cm: 11,
        weight_status: 'Underweight',
        height_status: 'Normal',
        overall_status: 'Normal',
        recorded_by: 7,
      },
    };
    const res = makeRes();

    await controller.syncNutritionRecord(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(created.values[6], 'underweight');
    assert.equal(created.values[7], 'normal');
    assert.equal(created.values[8], 'normal');
  } finally {
    pool.query = originalQuery;
  }
});

test('referral creation falls back to beneficiary name when mobile sends a UUID child id', async () => {
  const pool = require('../config/db');
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;

  pool.query = async (sql, params) => {
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
      return [[{ COLUMN_NAME: 'referral_id' }, { COLUMN_NAME: 'child_id' }, { COLUMN_NAME: 'beneficiary_type' }]];
    }
    if (sql.includes('FROM children c WHERE c.child_id = ?')) {
      return [[]];
    }
    if (sql.includes('FROM children c WHERE c.barangay = ?')) {
      return [[{ child_id: 45, first_name: 'Ana', last_name: 'Dela Cruz', barangay: 'Tiguion' }]];
    }
    if (sql.includes('SELECT user_id FROM users')) {
      return [[{ user_id: 12 }]];
    }
    return [[{ ok: true }]];
  };

  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('SELECT referral_id')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO referrals')) {
        return [{ insertId: 77 }];
      }
      if (sql.includes('INSERT INTO notifications')) {
        return [{ insertId: 99 }];
      }
      return [[{ ok: true }]];
    },
  });

  try {
    const controller = require('../controllers/bhwRefferalsControllers');
    const req = {
      body: {
        child_id: 'local-child-uuid-123',
        beneficiary_name: 'Ana Dela Cruz',
        beneficiary_type: 'child',
        barangay: 'Tiguion',
        facility: 'RHU',
        reason: 'Needs follow-up',
        severity: 'medium',
        notes: 'Please review',
        referred_by: 12,
      },
    };
    const res = makeRes();

    await controller.createReferral(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.message, 'Referral submitted successfully.');
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
  }
});
