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

  /// Module 3 Requirement: "The system will automatically identify the nutritional status (obese, normal, underweight, etc.) based on the result of beneficiaries computed BMI."
  double get bmi {
    if (customBmi != null) return customBmi!;
    if (heightCm <= 0) return 0.0;
    final hMeters = heightCm / 100;
    return double.parse((weightKg / (hMeters * hMeters)).toStringAsFixed(2));
  }

  String get bmiStatus {
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
  String get effectiveWastingStatus =>
      bilateralPittingEdema ? 'SAM' : weightForLengthStatus;

  /// WHO/NNC classification is age-aware: children under 24 months are
  /// classified using weight-for-length while older children use BMI.
  String statusForAgeMonths(int ageMonths) {
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

  bool get isSevere =>
      weightForAgeStatus == 'Severely Underweight' ||
      heightForAgeStatus == 'Severely Stunted' ||
      effectiveWastingStatus == 'SAM' ||
      bmiStatus == 'Obese';

  Map<String, dynamic> toMap() => {
    'date': date.toIso8601String(),
    'weightKg': weightKg,
    'heightCm': heightCm,
    'muacCm': muacCm,
    'bilateralPittingEdema': bilateralPittingEdema,
    'weightForAgeStatus': weightForAgeStatus,
    'heightForAgeStatus': heightForAgeStatus,
    'weightForLengthStatus': weightForLengthStatus,
    'bmi': bmi,
    'bmiStatus': bmiStatus,
  };

  factory Measurement.fromMap(Map<String, dynamic> map) => Measurement(
    date: DateTime.parse(map['date'] as String),
    weightKg: (map['weightKg'] as num).toDouble(),
    heightCm: (map['heightCm'] as num).toDouble(),
    muacCm: (map['muacCm'] as num?)?.toDouble(),
    bilateralPittingEdema: map['bilateralPittingEdema'] as bool? ?? false,
    weightForAgeStatus: map['weightForAgeStatus'] as String? ?? 'Normal',
    heightForAgeStatus: map['heightForAgeStatus'] as String? ?? 'Normal',
    weightForLengthStatus: map['weightForLengthStatus'] as String? ?? 'Normal',
    customBmi: (map['bmi'] as num?)?.toDouble(),
    customBmiStatus: map['bmiStatus'] as String?,
  );
}
