const assert = require('assert');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');
const controllers = require('../controllers/nutritionCornerControllers');

async function runTests() {
  console.log('--- Starting Nutrition Corner Backend Tests ---');

  // Helper mock res
  const createMockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.data = data;
      return res;
    };
    return res;
  };

  // Test 1: getConsolidation for year 2026, All barangays
  {
    console.log('Test 1: getConsolidation with year=2026, barangay=All');
    const req = { query: { year: '2026', barangay: 'All' }, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getConsolidation(req, res);

    assert.strictEqual(res.statusCode, 200, 'Status should be 200');
    assert.ok(res.data.consolidation, 'Consolidation data should exist');
    assert.strictEqual(res.data.years.length, 3, 'Should cover 3 years');
    assert.ok(Array.isArray(res.data.schoolData), 'School data should be an array');

    for (const yrData of res.data.consolidation) {
      assert.ok(typeof yrData.total_population === 'number', 'total_population should be number');
      assert.ok(typeof yrData.total_weighed === 'number', 'total_weighed should be number');
      // Verify WFA breakdown adds up to total_weighed
      const wfaSum =
        yrData.wfa.normal.count +
        yrData.wfa.underweight.count +
        yrData.wfa.severely_underweight.count +
        yrData.wfa.overweight.count;
      assert.strictEqual(wfaSum, yrData.total_weighed, `WFA sum (${wfaSum}) must match total_weighed (${yrData.total_weighed})`);

      // Verify WFH breakdown adds up to total_weighed
      const wfhSum =
        yrData.wfh.normal.count +
        yrData.wfh.wasted.count +
        yrData.wfh.severely_wasted.count +
        yrData.wfh.overweight.count +
        yrData.wfh.obese.count;
      assert.strictEqual(wfhSum, yrData.total_weighed, `WFH sum (${wfhSum}) must match total_weighed (${yrData.total_weighed})`);

      // Verify HFA breakdown adds up to total_weighed
      const hfaSum =
        yrData.hfa.normal.count +
        yrData.hfa.stunted.count +
        yrData.hfa.severely_stunted.count +
        yrData.hfa.tall.count;
      assert.strictEqual(hfaSum, yrData.total_weighed, `HFA sum (${hfaSum}) must match total_weighed (${yrData.total_weighed})`);
    }
    console.log('✓ Test 1 Passed: Totals match indicator breakdown across all years');
  }

  // Test 2: getConsolidation for nonexistent barangay / no data
  {
    console.log('Test 2: getConsolidation for empty barangay');
    const req = { query: { year: '2026', barangay: 'NonExistentBgy' }, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getConsolidation(req, res);

    assert.strictEqual(res.statusCode, 200);
    for (const yrData of res.data.consolidation) {
      assert.strictEqual(yrData.total_weighed, 0);
      assert.strictEqual(yrData.total_population, 0);
      assert.strictEqual(yrData.wfa.normal.count, 0);
    }
    console.log('✓ Test 2 Passed: Handled empty barangay gracefully without errors');
  }

  // Test 3: getMonthlyMonitoring for year 2026
  {
    console.log('Test 3: getMonthlyMonitoring for 25 barangays');
    const req = { query: { year: '2026' }, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getMonthlyMonitoring(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.matrix.length, 25, 'Should have exactly 25 barangays');
    assert.strictEqual(res.data.columnTotals.length, 12, 'Should have 12 month column totals');

    // Verify row structure
    for (const row of res.data.matrix) {
      assert.ok(row.barangay, 'Barangay name must exist');
      assert.strictEqual(row.months.length, 12, 'Each barangay must have 12 months');
      for (const m of row.months) {
        assert.ok(['green', 'orange', 'red', 'gray'].includes(m.status), `Invalid status color: ${m.status}`);
      }
    }
    console.log('✓ Test 3 Passed: 25 barangays and 12-month matrix generated correctly');
  }

  // Test 4: getUnweighedChildren
  {
    console.log('Test 4: getUnweighedChildren for Antipolo');
    const req = { query: { barangay: 'Antipolo', year: '2026', month: '11' }, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getUnweighedChildren(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.children), 'Children list must be array');
    console.log(`✓ Test 4 Passed: Retrieved ${res.data.children.length} unweighed children for Antipolo`);
  }

  // Test 5: getPrograms with live coverage
  {
    console.log('Test 5: getPrograms');
    const req = { query: {}, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getPrograms(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.programs), 'Programs must be array');
    assert.ok(res.data.programs.length >= 5, 'Should have at least 5 programs');
    const feedingProg = res.data.programs.find((p) => p.coverage_metric === 'feeding');
    assert.ok(feedingProg, 'Feeding program should exist');
    assert.ok(feedingProg.coverage, 'Feeding coverage should be attached');
    console.log('✓ Test 5 Passed: Programs loaded with live coverage metrics');
  }

  // Test 6: getLaws
  {
    console.log('Test 6: getLaws');
    const req = { query: {}, user: { role: 'admin' } };
    const res = createMockRes();
    await controllers.getLaws(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data), 'Laws must be array');
    assert.ok(res.data.length >= 5, 'Should have the 5 reference laws');
    const milkCode = res.data.find((l) => l.title.includes('Milk Code'));
    assert.ok(milkCode, 'Milk Code must be among reference laws');
    console.log('✓ Test 6 Passed: 5 reference laws loaded successfully');
  }

  console.log('--- ALL NUTRITION CORNER TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
