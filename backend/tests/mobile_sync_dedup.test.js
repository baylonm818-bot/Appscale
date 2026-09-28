const test = require('node:test');
const assert = require('node:assert/strict');
const { isDuplicateNutritionRecord } = require('../utils/mobileSyncSafety');

test('same child and date should be treated as duplicate nutrition sync payload', () => {
  const existing = [{ child_id: 12, record_date: '2026-09-28' }];
  assert.equal(isDuplicateNutritionRecord(existing, 12, '2026-09-28'), true);
  assert.equal(isDuplicateNutritionRecord(existing, 12, '2026-09-29'), false);
});

test('different child should not be flagged as duplicate for same date', () => {
  const existing = [{ child_id: 12, record_date: '2026-09-28' }];
  assert.equal(isDuplicateNutritionRecord(existing, 13, '2026-09-28'), false);
});
