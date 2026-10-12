const pool = require('../config/db');

async function recomputeRecords() {
  console.log('--- Starting Nutrition Records Audit & Recompute ---');

  try {
    const [records] = await pool.query(`
      SELECT nr.record_id, nr.child_id, nr.record_date, nr.age_in_months,
             nr.weight_kg, nr.height_cm, nr.muac_cm,
             nr.weight_status, nr.height_status, nr.overall_status,
             nr.bmi, nr.bmi_status,
             c.sex, c.birth_date
      FROM nutrition_records nr
      INNER JOIN children c ON c.child_id = nr.child_id
    `);

    console.log(`Found ${records.length} nutrition records to inspect.`);

    let updatedCount = 0;

    for (const rec of records) {
      let needsUpdate = false;
      let newWeightStatus = rec.weight_status;
      let newHeightStatus = rec.height_status;
      let newOverallStatus = rec.overall_status;
      let newBmi = rec.bmi;
      let newBmiStatus = rec.bmi_status;

      // 1. Normalize height status (enum: normal, stunted, severely_stunted)
      if (String(newHeightStatus).toLowerCase() === 'tall') {
        newHeightStatus = 'normal';
        needsUpdate = true;
      } else if (String(newHeightStatus).toLowerCase() === 'severly_stunted') {
        newHeightStatus = 'severely_stunted';
        needsUpdate = true;
      }

      // 2. Normalize weight status
      if (String(newWeightStatus).toLowerCase() === 'severly_underweight') {
        newWeightStatus = 'severely_underweight';
        needsUpdate = true;
      }

      // 3. Normalize overall status
      if (String(newOverallStatus).toLowerCase() === 'sam') {
        newOverallStatus = 'SAM';
      } else if (String(newOverallStatus).toLowerCase() === 'mam') {
        newOverallStatus = 'MAM';
      }

      // 4. Compute missing BMI
      const w = Number(rec.weight_kg);
      const h = Number(rec.height_cm);
      if (w > 0 && h > 0 && (!newBmi || !newBmiStatus)) {
        const hm = h / 100;
        newBmi = Number((w / (hm * hm)).toFixed(2));
        if (newBmi < 18.5) newBmiStatus = 'Underweight';
        else if (newBmi < 25.0) newBmiStatus = 'Normal';
        else if (newBmi < 30.0) newBmiStatus = 'Overweight';
        else newBmiStatus = 'Obese';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await pool.query(`
          UPDATE nutrition_records
          SET weight_status = ?, height_status = ?, overall_status = ?, bmi = ?, bmi_status = ?
          WHERE record_id = ?
        `, [newWeightStatus, newHeightStatus, newOverallStatus, newBmi, newBmiStatus, rec.record_id]);
        updatedCount++;
      }
    }

    console.log(`Successfully inspected ${records.length} records. Updated ${updatedCount} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Audit and recompute failed:', err);
    process.exit(1);
  }
}

recomputeRecords();
