import 'growth_range_config.dart';

enum ValidationSeverity {
  none,
  warning, // soft warning (orange, can confirm to save)
  error,   // hard error (red, blocks saving)
}

class ValidationResult {
  final ValidationSeverity severity;
  final String? message;
  final String? suggestion; // e.g. "Ibig mo bang sabihin 3.2 kg?"
  final String? suggestionValue; // e.g. "3.2"

  const ValidationResult({
    this.severity = ValidationSeverity.none,
    this.message,
    this.suggestion,
    this.suggestionValue,
  });

  bool get isError => severity == ValidationSeverity.error;
  bool get isWarning => severity == ValidationSeverity.warning;
  bool get isValid => severity == ValidationSeverity.none;
  bool get hasMessage => message != null && message!.isNotEmpty;

  String? get fullMessage {
    if (message == null) return null;
    if (suggestion != null) return '$message $suggestion';
    return message;
  }
}

class MeasurementValidator {
  const MeasurementValidator._();

  static double? parseDecimal(String? raw) {
    if (raw == null) return null;
    final sanitized = raw.trim().replaceAll(',', '.');
    if (sanitized.isEmpty) return null;
    return double.tryParse(sanitized);
  }

  static ({double min, double max}) getWeightRange(int ageMonths) {
    final range = GrowthRangeConfig.getForAge(ageMonths);
    return (min: range.softMinWeight, max: range.softMaxWeight);
  }

  static ({double min, double max}) getHeightRange(int ageMonths) {
    final range = GrowthRangeConfig.getForAge(ageMonths);
    return (min: range.softMinHeight, max: range.softMaxHeight);
  }

  static ({String? suggestion, String? value}) suggestDecimalCorrection({
    required double value,
    required double softMin,
    required double softMax,
    required String unit,
  }) {
    if (value > softMax) {
      final div10 = double.parse((value / 10).toStringAsFixed(1));
      if (div10 >= softMin && div10 <= softMax) {
        final valStr = div10.truncateToDouble() == div10
            ? div10.toInt().toString()
            : div10.toString();
        return (
          suggestion: 'Ibig mo bang sabihin $valStr $unit?',
          value: valStr,
        );
      }
      final div100 = double.parse((value / 100).toStringAsFixed(1));
      if (div100 >= softMin && div100 <= softMax) {
        final valStr = div100.truncateToDouble() == div100
            ? div100.toInt().toString()
            : div100.toString();
        return (
          suggestion: 'Ibig mo bang sabihin $valStr $unit?',
          value: valStr,
        );
      }
    }
    return (suggestion: null, value: null);
  }

  static const double minPlausibleWeightKg = 2.0;
  static const double maxPlausibleWeightKg = 30.0;
  static const double minPlausibleHeightCm = 45.0;
  static const double maxPlausibleHeightCm = 125.0;
  static const double minPlausibleMuacCm = 8.0;
  static const double maxPlausibleMuacCm = 20.0;

  static bool isPlausibleRecord({
    required double heightCm,
    required double weightKg,
    double? muacCm,
    int? ageMonths,
  }) {
    // For children 0-59 months: height 45-125 cm, weight 2-30 kg, MUAC 8-20 cm (if entered)
    if (ageMonths == null || (ageMonths >= 0 && ageMonths <= 59)) {
      if (heightCm < minPlausibleHeightCm || heightCm > maxPlausibleHeightCm) {
        return false;
      }
      if (weightKg < minPlausibleWeightKg || weightKg > maxPlausibleWeightKg) {
        return false;
      }
      if (muacCm != null && (muacCm < minPlausibleMuacCm || muacCm > maxPlausibleMuacCm)) {
        return false;
      }
    }
    return true;
  }

  static ValidationResult checkWeight(double weight, int ageMonths) {
    final range = GrowthRangeConfig.getForAge(ageMonths);
    final ageLabel = ageMonths == 1 ? '1 mo' : '$ageMonths mos';
    final valStr = weight.truncateToDouble() == weight
        ? weight.toInt().toString()
        : weight.toStringAsFixed(1);

    // Hard absolute limits for 0-59 months: 2-30 kg
    if (ageMonths <= 59) {
      if (weight < minPlausibleWeightKg) {
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Weight $valStr kg is invalid. Must be between 2 and 30 kg for children 0–59 months (Expected ${range.expectedWeightLabel} for $ageLabel).',
        );
      }
      if (weight > maxPlausibleWeightKg) {
        final suggestion = suggestDecimalCorrection(
          value: weight,
          softMin: range.softMinWeight,
          softMax: range.softMaxWeight,
          unit: 'kg',
        );
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Weight $valStr kg is too high for $ageLabel. Expected ${range.expectedWeightLabel}. (Must be between 2 and 30 kg for children 0–59 months)',
          suggestion: suggestion.suggestion,
          suggestionValue: suggestion.value,
        );
      }
    }

    // Hard error: physically impossible or extreme typo per age bracket
    if (weight < range.hardMinWeight) {
      return ValidationResult(
        severity: ValidationSeverity.error,
        message: 'Weight $valStr kg is too low for $ageLabel. Expected ${range.expectedWeightLabel}.',
      );
    }
    if (weight > range.hardMaxWeight) {
      final suggestion = suggestDecimalCorrection(
        value: weight,
        softMin: range.softMinWeight,
        softMax: range.softMaxWeight,
        unit: 'kg',
      );
      return ValidationResult(
        severity: ValidationSeverity.error,
        message: 'Weight $valStr kg is too high for $ageLabel. Expected ${range.expectedWeightLabel}.',
        suggestion: suggestion.suggestion,
        suggestionValue: suggestion.value,
      );
    }

    // Soft warning: unusual but plausible (e.g. SAM or severe underweight/overweight)
    if (weight < range.softMinWeight) {
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'Weight $valStr kg is unusually low for $ageLabel. Expected ${range.expectedWeightLabel}.',
      );
    }
    if (weight > range.softMaxWeight) {
      final suggestion = suggestDecimalCorrection(
        value: weight,
        softMin: range.softMinWeight,
        softMax: range.softMaxWeight,
        unit: 'kg',
      );
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'Weight $valStr kg is unusually high for $ageLabel. Expected ${range.expectedWeightLabel}.',
        suggestion: suggestion.suggestion,
        suggestionValue: suggestion.value,
      );
    }

    return const ValidationResult();
  }

  static ValidationResult checkHeight(
    double height,
    int ageMonths, {
    double? previousHeightCm,
  }) {
    final range = GrowthRangeConfig.getForAge(ageMonths);
    final ageLabel = ageMonths == 1 ? '1 mo' : '$ageMonths mos';
    final valStr = height.truncateToDouble() == height
        ? height.toInt().toString()
        : height.toStringAsFixed(1);

    if (previousHeightCm != null && previousHeightCm > 0 && height < previousHeightCm) {
      final diff = previousHeightCm - height;
      if (diff > 3.0) {
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Height $valStr cm cannot decrease from previous recorded height ($previousHeightCm cm).',
        );
      }
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'Height $valStr cm is slightly lower than previous entry ($previousHeightCm cm). Please verify.',
      );
    }

    // Hard absolute limits for 0-59 months: 45-125 cm
    if (ageMonths <= 59) {
      if (height < minPlausibleHeightCm) {
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Height $valStr cm is too low for $ageLabel. Expected ${range.expectedHeightLabel}. (Must be between 45 and 125 cm for children 0–59 months)',
        );
      }
      if (height > maxPlausibleHeightCm) {
        final suggestion = suggestDecimalCorrection(
          value: height,
          softMin: range.softMinHeight,
          softMax: range.softMaxHeight,
          unit: 'cm',
        );
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Height $valStr cm is too high for $ageLabel. Expected ${range.expectedHeightLabel}. (Must be between 45 and 125 cm for children 0–59 months)',
          suggestion: suggestion.suggestion,
          suggestionValue: suggestion.value,
        );
      }
    }

    // Hard error
    if (height < range.hardMinHeight) {
      return ValidationResult(
        severity: ValidationSeverity.error,
        message: 'Height $valStr cm is too low for $ageLabel. Expected ${range.expectedHeightLabel}.',
      );
    }
    if (height > range.hardMaxHeight) {
      final suggestion = suggestDecimalCorrection(
        value: height,
        softMin: range.softMinHeight,
        softMax: range.softMaxHeight,
        unit: 'cm',
      );
      return ValidationResult(
        severity: ValidationSeverity.error,
        message: 'Height $valStr cm is too high for $ageLabel. Expected ${range.expectedHeightLabel}.',
        suggestion: suggestion.suggestion,
        suggestionValue: suggestion.value,
      );
    }

    // Soft warning
    if (height < range.softMinHeight) {
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'Height $valStr cm is unusually low for $ageLabel. Expected ${range.expectedHeightLabel}.',
      );
    }
    if (height > range.softMaxHeight) {
      final suggestion = suggestDecimalCorrection(
        value: height,
        softMin: range.softMinHeight,
        softMax: range.softMaxHeight,
        unit: 'cm',
      );
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'Height $valStr cm is unusually high for $ageLabel. Expected ${range.expectedHeightLabel}.',
        suggestion: suggestion.suggestion,
        suggestionValue: suggestion.value,
      );
    }

    return const ValidationResult();
  }

  static bool isMuacApplicable(int ageMonths) => ageMonths >= 6;

  static ValidationResult checkMuac(double muac, int ageMonths) {
    if (ageMonths < 6) return const ValidationResult();
    final valStr = muac.truncateToDouble() == muac
        ? muac.toInt().toString()
        : muac.toStringAsFixed(1);

    if (ageMonths <= 59) {
      if (muac < minPlausibleMuacCm || muac > maxPlausibleMuacCm) {
        return ValidationResult(
          severity: ValidationSeverity.error,
          message: 'MUAC $valStr cm is outside plausible range (8–20 cm for children 0–59 months).',
        );
      }
    } else if (muac < 7.0 || muac > 30.0) {
      return ValidationResult(
        severity: ValidationSeverity.error,
        message: 'MUAC $valStr cm is outside plausible range (7.0–30.0 cm).',
      );
    }
    if (muac < 10.5) {
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'MUAC $valStr cm indicates severe acute wasting (SAM). Please verify measurement.',
      );
    }
    if (muac < 11.5) {
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'MUAC $valStr cm indicates moderate acute wasting (MAM). Please verify measurement.',
      );
    }
    if (muac > 22.0) {
      return ValidationResult(
        severity: ValidationSeverity.warning,
        message: 'MUAC $valStr cm is unusually high for age. Expected 11.5–18.0 cm.',
      );
    }
    return const ValidationResult();
  }

  // Backward compatibility methods
  static String? validateWeight(double weight, int ageMonths) {
    final res = checkWeight(weight, ageMonths);
    return res.isValid ? null : res.fullMessage;
  }

  static String? validateHeight(
    double height,
    int ageMonths, {
    double? previousHeightCm,
  }) {
    final res = checkHeight(height, ageMonths, previousHeightCm: previousHeightCm);
    return res.isValid ? null : res.fullMessage;
  }

  static String? validateMuac(double muac, int ageMonths) {
    final res = checkMuac(muac, ageMonths);
    return res.isValid ? null : res.fullMessage;
  }

  static String? validatePlausibility({
    required double weight,
    required double height,
    double? muac,
    required int ageMonths,
    double? previousHeightCm,
  }) {
    final wRes = checkWeight(weight, ageMonths);
    if (wRes.isError) return wRes.fullMessage;

    final hRes = checkHeight(height, ageMonths, previousHeightCm: previousHeightCm);
    if (hRes.isError) return hRes.fullMessage;

    final hMeters = height / 100;
    final bmi = weight / (hMeters * hMeters);
    if (bmi < 8.0 || bmi > 35.0) {
      return 'Weight-to-Height combination is physiologically implausible (BMI: ${bmi.toStringAsFixed(1)} kg/m²). Please re-check entries.';
    }

    if (muac != null && ageMonths >= 6) {
      final mRes = checkMuac(muac, ageMonths);
      if (mRes.isError) return mRes.fullMessage;
    }

    return null;
  }
}
