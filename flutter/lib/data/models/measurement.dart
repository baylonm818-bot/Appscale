import '../../core/utils/safe_parser.dart';

class Measurement {
  final DateTime date;
  final double weightKg;
  final double heightCm;
  final double? muacCm;
  final bool bilateralPittingEdema;
  final String weightForAgeStatus; // Severely Underweight / Underweight / Normal / Overweight
  final String heightForAgeStatus; // Severely Stunted / Stunted / Normal / Tall
  final String weightForLengthStatus; // SAM / MAM / Normal / Overweight / Obese
  final double? customBmi;
  final String? customBmiStatus;
  final int? ageInDays;
  final int? ageInMonths;

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
    this.ageInDays,
    this.ageInMonths,
  });

  /// Plausibility check for 0-59 months:
  /// Evaluates both range bounds and WHO BIV cutoffs or explicit 'Needs re-measurement'.
  bool get isPlausible {
    if (weightForAgeStatus == 'Needs re-measurement' ||
        heightForAgeStatus == 'Needs re-measurement' ||
        weightForLengthStatus == 'Needs re-measurement' ||
        customBmiStatus == 'Needs re-measurement') {
      return false;
    }
    if (heightCm < 45.0 || heightCm > 125.0) return false;
    if (weightKg < 2.0 || weightKg > 30.0) return false;
    if (muacCm != null && muacCm! > 0 && (muacCm! < 8.0 || muacCm! > 20.0)) return false;
    return true;
  }

  /// Informational BMI value (kg/m²).
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
    return effectiveWastingStatus;
  }

  /// Edema present overrides the wasting classification to SAM regardless
  /// of the weight-for-length number per WHO/NNC guidelines.
  String get effectiveWastingStatus {
    if (!isPlausible) return 'Needs re-measurement';
    return bilateralPittingEdema ? 'SAM' : weightForLengthStatus;
  }

  /// WHO/NNC classification indicator for child:
  /// Under 24 months uses weight-for-length, while older children use weight-for-height.
  String statusForAgeMonths(int ageMonths) {
    if (!isPlausible) return 'Needs re-measurement';
    if (ageMonths <= 23) return effectiveWastingStatus;
    if (customBmiStatus != null && customBmiStatus!.isNotEmpty) {
      return customBmiStatus!;
    }
    return effectiveWastingStatus;
  }


  bool get isSevere {
    if (!isPlausible) return false;
    return weightForAgeStatus == 'Severely Underweight' ||
        heightForAgeStatus == 'Severely Stunted' ||
        effectiveWastingStatus == 'SAM';
  }

  /// Checks if this measurement is older than the recommended weighing interval:
  /// - 0 to 23 months: Monthly weighing (due if > 30 days old)
  /// - 24 to 59 months: Quarterly weighing (due if > 90 days old)
  bool isDueForWeighing(DateTime asOfDate, {int? childAgeMonths}) {
    final effectiveAgeMonths = childAgeMonths ?? ageInMonths ?? 0;
    final diffDays = asOfDate.difference(date).inDays;
    if (effectiveAgeMonths <= 23) {
      return diffDays > 30;
    } else {
      return diffDays > 90;
    }
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
    'ageInDays': ageInDays,
    'ageInMonths': ageInMonths,
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
      ageInDays: SafeParser.asInt(map['ageInDays'] ?? map['age_in_days']),
      ageInMonths: SafeParser.asInt(map['ageInMonths'] ?? map['age_in_months']),
    );
  }
}

