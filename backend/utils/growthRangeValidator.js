const GROWTH_RANGE_TABLE = [
  // 0-1 month
  {
    minMonth: 0,
    maxMonth: 1,
    hardMinWeight: 1.2,
    softMinWeight: 2.2,
    softMaxWeight: 6.0,
    hardMaxWeight: 7.5,
    hardMinHeight: 38.0,
    softMinHeight: 44.0,
    softMaxHeight: 60.0,
    hardMaxHeight: 66.0,
  },
  // 2-3 months
  {
    minMonth: 2,
    maxMonth: 3,
    hardMinWeight: 1.8,
    softMinWeight: 3.0,
    softMaxWeight: 8.5,
    hardMaxWeight: 10.5,
    hardMinHeight: 42.0,
    softMinHeight: 48.0,
    softMaxHeight: 68.0,
    hardMaxHeight: 75.0,
  },
  // 4-6 months (e.g. 6 mos: weight expected 3-12 kg, height expected 55-80 cm)
  {
    minMonth: 4,
    maxMonth: 6,
    hardMinWeight: 2.2,
    softMinWeight: 3.0,
    softMaxWeight: 12.0,
    hardMaxWeight: 15.0,
    hardMinHeight: 48.0,
    softMinHeight: 55.0,
    softMaxHeight: 80.0,
    hardMaxHeight: 86.0,
  },
  // 7-11 months
  {
    minMonth: 7,
    maxMonth: 11,
    hardMinWeight: 3.0,
    softMinWeight: 4.5,
    softMaxWeight: 13.5,
    hardMaxWeight: 17.5,
    hardMinHeight: 50.0,
    softMinHeight: 58.0,
    softMaxHeight: 85.0,
    hardMaxHeight: 93.0,
  },
  // 12-23 months (1 year)
  {
    minMonth: 12,
    maxMonth: 23,
    hardMinWeight: 4.0,
    softMinWeight: 5.5,
    softMaxWeight: 16.5,
    hardMaxWeight: 21.0,
    hardMinHeight: 55.0,
    softMinHeight: 65.0,
    softMaxHeight: 95.0,
    hardMaxHeight: 105.0,
  },
  // 24-35 months (2 years)
  {
    minMonth: 24,
    maxMonth: 35,
    hardMinWeight: 5.0,
    softMinWeight: 7.0,
    softMaxWeight: 19.5,
    hardMaxWeight: 26.0,
    hardMinHeight: 62.0,
    softMinHeight: 74.0,
    softMaxHeight: 105.0,
    hardMaxHeight: 116.0,
  },
  // 36-47 months (3 years)
  {
    minMonth: 36,
    maxMonth: 47,
    hardMinWeight: 6.0,
    softMinWeight: 8.5,
    softMaxWeight: 22.5,
    hardMaxWeight: 30.0,
    hardMinHeight: 68.0,
    softMinHeight: 80.0,
    softMaxHeight: 115.0,
    hardMaxHeight: 126.0,
  },
  // 48-59 months (4 years)
  {
    minMonth: 48,
    maxMonth: 59,
    hardMinWeight: 7.0,
    softMinWeight: 9.5,
    softMaxWeight: 26.0,
    hardMaxWeight: 35.0,
    hardMinHeight: 72.0,
    softMinHeight: 85.0,
    softMaxHeight: 125.0,
    hardMaxHeight: 136.0,
  },
  // 60+ months (fallback)
  {
    minMonth: 60,
    maxMonth: 120,
    hardMinWeight: 8.0,
    softMinWeight: 10.0,
    softMaxWeight: 35.0,
    hardMaxWeight: 50.0,
    hardMinHeight: 75.0,
    softMinHeight: 90.0,
    softMaxHeight: 135.0,
    hardMaxHeight: 150.0,
  },
];

function getGrowthRangeForAge(ageMonths) {
  const m = Math.max(0, Number(ageMonths) || 0);
  for (const r of GROWTH_RANGE_TABLE) {
    if (m >= r.minMonth && m <= r.maxMonth) return r;
  }
  return GROWTH_RANGE_TABLE[GROWTH_RANGE_TABLE.length - 1];
}

function validateMeasurementPlausibility(weightKg, heightCm, ageMonths, sex) {
  let w, h, m;
  if (typeof weightKg === 'object' && weightKg !== null) {
    w = Number(weightKg.weight ?? weightKg.weight_kg ?? weightKg.weightKg);
    h = Number(weightKg.height ?? weightKg.height_cm ?? weightKg.heightCm);
    m = Number(weightKg.ageMonths ?? weightKg.age_months ?? weightKg.age ?? 0);
  } else {
    w = Number(weightKg);
    h = Number(heightCm);
    m = Number(ageMonths || 0);
  }

  // Baseline 0-59 months range check
  if (m <= 59) {
    if (w && (w < 2.0 || w > 30.0)) {
      return {
        isValid: false,
        field: 'weight_kg',
        message: `Weight ${w} kg is outside plausible range for 0–59 months (2–30 kg).`,
      };
    }
    if (h && (h < 45.0 || h > 125.0)) {
      return {
        isValid: false,
        field: 'height_cm',
        message: `Height ${h} cm is outside plausible range for 0–59 months (45–125 cm).`,
      };
    }

    // WHO BIV (Biological Implausible Values) check:
    // e.g., an infant measuring 45cm with weight 6.0kg has extreme implausible weight-for-length
    // At 45cm, expected weight is ~2.4kg (+3SD is 3.3kg). 6.0kg is nearly +8 SDs.
    if (w > 0 && h > 0) {
      if (h <= 50.0 && w >= 5.8) {
        return {
          isValid: false,
          field: 'weight_kg',
          message: `Weight ${w} kg is biologically implausible for length ${h} cm (WHO WFL z > +5 SD). Needs re-measurement.`,
        };
      }
      if (m >= 2 && h <= 45.0) {
        return {
          isValid: false,
          field: 'height_cm',
          message: `Height ${h} cm is biologically implausible for age ${m} months (WHO HFA z < -6 SD). Needs re-measurement.`,
        };
      }
    }
  }

  const range = getGrowthRangeForAge(m);
  const ageLabel = m === 1 ? '1 mo' : `${m} mos`;

  if (w && (w < range.hardMinWeight || w > range.hardMaxWeight)) {
    return {
      isValid: false,
      field: 'weight_kg',
      message: `Weight ${w} kg is outside plausible range for ${ageLabel}. Expected ${range.softMinWeight}-${range.softMaxWeight} kg.`,
    };
  }

  if (h && (h < range.hardMinHeight || h > range.hardMaxHeight)) {
    return {
      isValid: false,
      field: 'height_cm',
      message: `Height ${h} cm is outside plausible range for ${ageLabel}. Expected ${range.softMinHeight}-${range.softMaxHeight} cm.`,
    };
  }

  return { isValid: true };
}

module.exports = {
  GROWTH_RANGE_TABLE,
  getGrowthRangeForAge,
  validateMeasurementPlausibility,
};

