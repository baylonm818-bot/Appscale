const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChildServiceInsert,
  buildMotherServiceInsert,
} = require('../utils/medicalSchema');

test('buildChildServiceInsert omits unsupported columns when schema is older', () => {
  const insert = buildChildServiceInsert({
    child_id: 12,
    service_type: 'Medication',
    service_name: 'Vitamin C',
    dosage: '500mg',
    service_date: '2026-09-30',
    next_schedule: '2026-10-07',
    provided_by: 'Maria Dela Cruz',
    notes: 'Follow-up',
  }, ['child_id', 'service_type', 'service_date', 'provided_by']);

  assert.equal(insert.sql, 'INSERT INTO child_services (child_id, service_type, service_date, provided_by) VALUES (?, ?, ?, ?)');
  assert.deepEqual(insert.values, [12, 'Medication', '2026-09-30', 'Maria Dela Cruz']);
});

test('buildMotherServiceInsert supports the modern schema and includes all fields', () => {
  const insert = buildMotherServiceInsert({
    mother_id: 7,
    service_type: 'Supplement',
    service_name: 'Iron',
    dosage: '1 tablet',
    service_date: '2026-09-30',
    next_schedule: '2026-10-07',
    provided_by: 'Maria Dela Cruz',
    notes: 'Continue',
  }, ['mother_id', 'service_type', 'service_name', 'dosage', 'service_date', 'next_schedule', 'provided_by', 'notes']);

  assert.equal(insert.sql, 'INSERT INTO mother_services (mother_id, service_type, service_name, dosage, service_date, next_schedule, provided_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  assert.deepEqual(insert.values, [7, 'Supplement', 'Iron', '1 tablet', '2026-09-30', '2026-10-07', 'Maria Dela Cruz', 'Continue']);
});
