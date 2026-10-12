const { getAdminStats, getNutritionAudit } = require('../controllers/dashboardControllers');

async function test() {
  console.log('Testing getAdminStats...');
  let statsResult = null;
  const mockReq = { query: {} };
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        statsResult = { code, data };
        return data;
      }
    })
  };

  await getAdminStats(mockReq, mockRes);
  console.log('getAdminStats status code:', statsResult?.code);
  const data = statsResult?.data;
  console.log('Total Children:', data?.totalChildren);
  console.log('Total Barangays:', data?.totalBarangays);
  console.log('nineCategoryTrend:', data?.nineCategoryTrend);
  const sumCategories = Object.values(data?.nineCategoryTrend || {}).reduce((a, b) => a + b, 0);
  console.log('Sum of nineCategoryTrend categories:', sumCategories);
  console.log('Does sum match totalChildren?:', sumCategories === data?.totalChildren);

  const municipalMalnutrition = Object.entries(data?.nineCategoryTrend || {})
    .filter(([k]) => k !== 'normal' && k !== 'no_assessment')
    .reduce((a, [, v]) => a + v, 0);

  const barangayTotalMalnutrition = (data?.malnutritionByBarangay || [])
    .reduce((a, b) => a + Number(b.cases), 0);

  console.log('Municipal malnutrition count:', municipalMalnutrition);
  console.log('Sum of malnutrition cases across all barangays:', barangayTotalMalnutrition);
  console.log('Does sum of barangays match municipal total?:', municipalMalnutrition === barangayTotalMalnutrition);
  console.log('Malnutrition by Barangay:', data?.malnutritionByBarangay);

  console.log('\nTesting getNutritionAudit...');
  let auditResult = null;
  const mockAuditRes = {
    status: (code) => ({
      json: (data) => {
        auditResult = { code, data };
        return data;
      }
    })
  };
  await getNutritionAudit(mockReq, mockAuditRes);
  console.log('getNutritionAudit status code:', auditResult?.code);
  console.log('Audit Total Children:', auditResult?.data?.totalActiveChildren);
  console.log('Audit Category Summary:', auditResult?.data?.categorySummary);
  console.log('Audit Barangay Summary:', auditResult?.data?.barangaySummary);

  process.exit(0);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
