import '../../core/utils/safe_parser.dart';

class Measurement {
  final DateTime date;
  final double weightKg;
  final double heightCm;
  final double? muacCm;
  final bool bilateralPittingEdema;
  final String weightForAgeStatus; // Severely Underweight / Underweight / Normal
  final String heightForAgeStatus; // Severely Stunted / Stunted / Normal / Tall
  final String weightForLengthStatus; // SAM / MAM / Normal / Overweight / Obese
  final double? customBmi;
  final String? customBmiStatus;

  const Measurement({
    required this.date,
    required this.weightKg,
    required this.heightCm,
    this.muacCm,
    required this.bilateralPittingEdema,
    required this.weightForAgeStatus,
    required this.heightForAgeStatus,
    required this.weightForLengthStatus,
    this.customBmi,
    this.customBmiStatus,
  });

  /// Plausibility check for 0-59 months: height 45-125 cm, weight 2-30 kg, MUAC 8-20 cm (if provided).
  /// Excludes MUAC <= 0.0 or outside 8-20 cm. Missing or null MUAC does not flag invalid.
  bool get isPlausible {
    if (heightCm < 45.0 || heightCm > 125.0) return false;
    if (weightKg < 2.0 || weightKg > 30.0) return false;
    if (muacCm != null && muacCm! > 0 && (muacCm! < 8.0 || muacCm! > 20.0)) return false;
    return true;
  }

  /// Module 3 Requirement: "The system will automatically identify the nutritional status (obese, normal, underweight, etc.) based on the result of beneficiaries computed BMI."
  double get bmi {
    if (customBmi != null) return customBmi!;
    if (heightCm <= 0) return 0.0;
    final hMeters = heightCm / 100;
    return double.parse((weightKg / (hMeters * hMeters)).toStringAsFixed(2));
  }

  String get bmiStatus {
    if (!isPlausible) return 'Needs re-measurement';
    if (customBmiStatus != null && customBmiStatus!.isNotEmpty) {
      return customBmiStatus!;
    }
    final val = bmi;
    if (val <= 0) return 'Unknown';
    if (val < 18.5) return 'Underweight';
    if (val < 25.0) return 'Normal';
    if (val < 30.0) return 'Overweight';
    return 'Obese';
  }

  /// Edema present overrides the wasting classification to SAM regardless
  /// of the weight-for-length number — this is a real WHO/NNC rule, not
  /// a cosmetic warning, since edema itself signals severe acute malnutrition.
  String get effectiveWastingStatus {
    if (!isPlausible) return 'Needs re-measurement';
    return bilateralPittingEdema ? 'SAM' : weightForLengthStatus;
  }

  /// WHO/NNC classification is age-aware: children under 24 months are
  /// classified using weight-for-length while older children use BMI.
  String statusForAgeMonths(int ageMonths) {
    if (!isPlausible) return 'Needs re-measurement';
    if (ageMonths <= 23) return effectiveWastingStatus;

    if (customBmiStatus != null && customBmiStatus!.isNotEmpty) {
      return customBmiStatus!;
    }

    final val = bmi;
    if (val <= 0) return 'Unknown';
    if (val < 18.5) return 'Underweight';
    if (val < 25.0) return 'Normal';
    if (val < 30.0) return 'Overweight';
    return 'Obese';
  }

  bool get isSevere {
    if (!isPlausible) return false;
    return weightForAgeStatus == 'Severely Underweight' ||
        heightForAgeStatus == 'Severely Stunted' ||
        effectiveWastingStatus == 'SAM' ||
        bmiStatus == 'Obese';
  }

  Map<String, dynamic> toMap() => {
    'date': SafeParser.toDateString(date),
    'weightKg': weightKg,
    'heightCm': heightCm,
    'muacCm': (muacCm != null && muacCm! > 0) ? muacCm : null,
    'bilateralPittingEdema': bilateralPittingEdema,
    'weightForAgeStatus': weightForAgeStatus,
    'heightForAgeStatus': heightForAgeStatus,
    'weightForLengthStatus': weightForLengthStatus,
    'bmi': isPlausible ? bmi : null,
    'bmiStatus': isPlausible ? bmiStatus : 'Needs re-measurement',
  };

  factory Measurement.fromMap(Map map) {
    final rawMuac = SafeParser.asDouble(map['muacCm'] ?? map['muac_cm']);
    final effectiveMuac = (rawMuac != null && rawMuac > 0) ? rawMuac : null;
    return Measurement(
      date: SafeParser.asDate(map['date'] ?? map['record_date']) ?? DateTime.now(),
      weightKg: SafeParser.asNonNullDouble(map['weightKg'] ?? map['weight_kg']),
      heightCm: SafeParser.asNonNullDouble(map['heightCm'] ?? map['height_cm']),
      muacCm: effectiveMuac,
      bilateralPittingEdema: SafeParser.asNonNullBool(map['bilateralPittingEdema'] ?? map['edema'] ?? map['bilateral_edema']),
      weightForAgeStatus: SafeParser.asNonNullString(map['weightForAgeStatus'] ?? map['weight_status'], 'Normal'),
      heightForAgeStatus: SafeParser.asNonNullString(map['heightForAgeStatus'] ?? map['height_status'], 'Normal'),
      weightForLengthStatus: SafeParser.asNonNullString(map['weightForLengthStatus'] ?? map['overall_status'], 'Normal'),
      customBmi: SafeParser.asDouble(map['bmi']),
      customBmiStatus: SafeParser.asString(map['bmiStatus'] ?? map['bmi_status']),
    );
  }
}
