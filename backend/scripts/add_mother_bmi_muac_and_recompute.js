const pool = require('../config/db');

async function ensureColumns() {
  const [cols] = await pool.query('SHOW COLUMNS FROM mothers');
  const colNames = cols.map(c => c.Field);

  const toAdd = [];
  if (!colNames.includes('muac_cm')) toAdd.push("ALTER TABLE mothers ADD COLUMN muac_cm DECIMAL(5,2) NULL");
  if (!colNames.includes('bmi')) toAdd.push("ALTER TABLE mothers ADD COLUMN bmi DECIMAL(5,2) NULL");
  if (!colNames.includes('bmi_status')) toAdd.push("ALTER TABLE mothers ADD COLUMN bmi_status VARCHAR(50) NULL");
  if (!colNames.includes('muac_status')) toAdd.push("ALTER TABLE mothers ADD COLUMN muac_status VARCHAR(50) NULL");

  for (const sql of toAdd) {
    console.log('Executing:', sql);
    await pool.query(sql);
  }
}

function computeBmiStatus(weight, height) {
  if (!weight || !height || height <= 0) return { bmi: null, bmi_status: null };
  const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
  let bmi_status = null;
  if (bmi < 18.5) bmi_status = 'Underweight';
  else if (bmi < 25) bmi_status = 'Normal';
  else if (bmi < 30) bmi_status = 'Overweight';
  else bmi_status = 'Obese';
  return { bmi, bmi_status };
}

function computeMuacStatus(muac) {
  if (muac == null) return null;
  return muac < 23 ? 'At risk' : 'Normal';
}

async function recompute() {
  const [rows] = await pool.query('SELECT mother_id, weight_kg, height_cm, muac_cm FROM mothers');
  for (const r of rows) {
    const { bmi, bmi_status } = computeBmiStatus(r.weight_kg, r.height_cm);
    const muac_status = computeMuacStatus(r.muac_cm);
    await pool.query('UPDATE mothers SET bmi = ?, bmi_status = ?, muac_status = ? WHERE mother_id = ?', [bmi, bmi_status, muac_status, r.mother_id]);
  }
}

async function main() {
  try {
    await ensureColumns();
    await recompute();
    console.log('Mother BMI/MUAC migration and recompute completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err && err.message);
    process.exit(1);
  }
}

main();
