class MeasurementValidator {
  const MeasurementValidator._();

  static double? parseDecimal(String? raw) {
    if (raw == null) return null;
    final sanitized = raw.trim().replaceAll(',', '.');
    if (sanitized.isEmpty) return null;
    return double.tryParse(sanitized);
  }

  static ({double min, double max}) getWeightRange(int ageMonths) {
    if (ageMonths <= 1) return (min: 1.5, max: 6.5);
    if (ageMonths <= 3) return (min: 2.0, max: 8.5);
    if (ageMonths <= 6) return (min: 3.0, max: 10.5);
    if (ageMonths <= 11) return (min: 4.5, max: 13.5);
    if (ageMonths <= 23) return (min: 5.5, max: 18.0);
    if (ageMonths <= 35) return (min: 7.0, max: 22.0);
    if (ageMonths <= 59) return (min: 8.5, max: 32.0);
    return (min: 10.0, max: 50.0);
  }

  static ({double min, double max}) getHeightRange(int ageMonths) {
    if (ageMonths <= 1) return (min: 40.0, max: 62.0);
    if (ageMonths <= 3) return (min: 48.0, max: 68.0);
    if (ageMonths <= 6) return (min: 53.0, max: 75.0);
    if (ageMonths <= 11) return (min: 58.0, max: 85.0);
    if (ageMonths <= 23) return (min: 65.0, max: 98.0);
    if (ageMonths <= 35) return (min: 75.0, max: 108.0);
    if (ageMonths <= 59) return (min: 82.0, max: 128.0);
    return (min: 85.0, max: 150.0);
  }

  static String? validateWeight(double weight, int ageMonths) {
    final range = getWeightRange(ageMonths);
    if (weight < range.min || weight > range.max) {
      return 'Weight ($weight kg) is outside plausible range (${range.min}–${range.max} kg) for $ageMonths mos.';
    }
    return null;
  }

  static String? validateHeight(
    double height,
    int ageMonths, {
    double? previousHeightCm,
  }) {
    final range = getHeightRange(ageMonths);
    if (height < range.min || height > range.max) {
      return 'Height ($height cm) is outside plausible range (${range.min}–${range.max} cm) for $ageMonths mos.';
    }
    if (previousHeightCm != null && previousHeightCm > 0 && height < previousHeightCm) {
      return 'Height ($height cm) cannot decrease from previous recorded height ($previousHeightCm cm).';
    }
    return null;
  }

  static bool isMuacApplicable(int ageMonths) => ageMonths >= 6;

  static String? validateMuac(double muac, int ageMonths) {
    if (ageMonths < 6) return null;
    if (muac < 7.0 || muac > 30.0) {
      return 'MUAC ($muac cm) is outside plausible range (7.0–30.0 cm).';
    }
    return null;
  }

  static String? validatePlausibility({
    required double weight,
    required double height,
    double? muac,
    required int ageMonths,
    double? previousHeightCm,
  }) {
    final wErr = validateWeight(weight, ageMonths);
    if (wErr != null) return wErr;

    final hErr = validateHeight(height, ageMonths, previousHeightCm: previousHeightCm);
    if (hErr != null) return hErr;

    final hMeters = height / 100;
    final bmi = weight / (hMeters * hMeters);
    if (bmi < 8.0 || bmi > 35.0) {
      return 'Weight-to-Height combination is physiologically implausible (BMI: ${bmi.toStringAsFixed(1)} kg/m²). Please re-check entries.';
    }

    if (muac != null && ageMonths >= 6) {
      final mErr = validateMuac(muac, ageMonths);
      if (mErr != null) return mErr;
    }

    return null;
  }
}
