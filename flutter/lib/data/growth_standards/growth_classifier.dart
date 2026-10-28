import 'dart:math' as math;
import 'height_for_age_data.dart';
import 'sd_thresholds.dart';
import 'weight_for_age_data.dart';
import 'weight_for_length_data.dart';

/// Single unified result of WHO Child Growth Standards assessment.
class GrowthAssessment {
  final bool isInvalid;
  final String? invalidReason;
  final double? wfaZScore;
  final double? hfaZScore;
  final double? wflZScore;
  final String weightForAgeStatus;     // Severely Underweight / Underweight / Normal / Overweight
  final String heightForAgeStatus;     // Severely Stunted / Stunted / Normal / Tall
  final String weightForLengthStatus;  // SAM / MAM / Normal / Overweight / Obese
  final double? bmi;                   // Informational only, never adult BMI status
  final String statusSummary;          // Severe / At risk / Obese / Overweight / Normal / Needs re-measurement
  final String? overallStatus;         // Worst indicator exact name: Severely Wasted (SAM) / Severely Stunted / Severely Underweight / Moderately Wasted (MAM) / Stunted / Underweight / Obese / Overweight / Normal

  const GrowthAssessment({
    required this.isInvalid,
    this.invalidReason,
    this.wfaZScore,
    this.hfaZScore,
    this.wflZScore,
    required this.weightForAgeStatus,
    required this.heightForAgeStatus,
    required this.weightForLengthStatus,
    this.bmi,
    required this.statusSummary,
    this.overallStatus,
  });

  /// Overall status: exact worst of valid indicators per WHO guidelines.
  String get effectiveOverallStatus {
    if (isInvalid) return 'Needs re-measurement';
    if (overallStatus != null) return overallStatus!;
    if (weightForLengthStatus == 'SAM') return 'Severely Wasted (SAM)';
    if (heightForAgeStatus == 'Severely Stunted') return 'Severely Stunted';
    if (weightForAgeStatus == 'Severely Underweight') return 'Severely Underweight';
    if (weightForLengthStatus == 'MAM') return 'Moderately Wasted (MAM)';
    if (heightForAgeStatus == 'Stunted') return 'Stunted';
    if (weightForAgeStatus == 'Underweight') return 'Underweight';
    if (weightForLengthStatus == 'Obese') return 'Obese';
    if (weightForLengthStatus == 'Overweight' || weightForAgeStatus == 'Overweight') return 'Overweight';
    return 'Normal';
  }

  bool get isSevere =>
      !isInvalid &&
      (weightForAgeStatus == 'Severely Underweight' ||
          heightForAgeStatus == 'Severely Stunted' ||
          weightForLengthStatus == 'SAM');
}

/// Applies official WHO Child Growth Standards (0–59 months).
/// Uses WHO z-scores, applies recumbent length vs standing height adjustments (0.7 cm),
/// enforces WHO Biological Implausible Values (BIV) flagging cutoffs,
/// and produces a single, non-contradictory status per indicator.
class GrowthClassifier {
  GrowthClassifier._();

  static bool isMale(String gender) {
    final g = gender.trim().toLowerCase();
    return g == 'male' || g == 'boy' || g == 'm';
  }

  /// Calculates WHO z-score from measurement, given LMS or SD thresholds.
  /// If LMS parameters are available:
  ///   z = ((y / M)^L - 1) / (L * S)   when L != 0
  ///   z = ln(y / M) / S               when L == 0
  /// If only SD thresholds exist, calculates piece-wise standard deviation distance.
  static double calculateZScore({
    required double value,
    required SdThresholds thresholds,
  }) {
    if (thresholds.l != null && thresholds.m != null && thresholds.s != null) {
      final l = thresholds.l!;
      final m = thresholds.m!;
      final s = thresholds.s!;
      if (l.abs() > 0.001) {
        return (math.pow(value / m, l) - 1.0) / (l * s);
      } else {
        return math.log(value / m) / s;
      }
    }

    // Piecewise SD calculation:
    // negThreeSD (-3), negTwoSD (-2), posTwoSD (+2), posThreeSD (+3)
    final median = thresholds.median ?? ((thresholds.negTwoSD + thresholds.posTwoSD) / 2.0);
    if (value < median) {
      final sdUnit = (median - thresholds.negTwoSD) / 2.0;
      if (sdUnit <= 0) return 0.0;
      return (value - median) / sdUnit;
    } else {
      final sdUnit = (thresholds.posTwoSD - median) / 2.0;
      if (sdUnit <= 0) return 0.0;
      return (value - median) / sdUnit;
    }
  }



  /// Adjusts height/length according to WHO guidelines:
  /// - Under 24 months (< 731 days): expected mode is recumbent length.
  ///   If measured standing, add 0.7 cm to approximate recumbent length.
  /// - 24 to 59 months: expected mode is standing height.
  ///   If measured lying down (recumbent), subtract 0.7 cm to approximate standing height.
  static double adjustMeasurementLength({
    required double heightCm,
    required int ageInDays,
    bool? isStanding,
  }) {
    if (heightCm <= 0) return heightCm;
    if (ageInDays < 731) {
      // Expected: recumbent length
      if (isStanding == true) {
        return double.parse((heightCm + 0.7).toStringAsFixed(1));
      }
      return heightCm;
    } else {
      // Expected: standing height
      if (isStanding == false) {
        return double.parse((heightCm - 0.7).toStringAsFixed(1));
      }
      return heightCm;
    }
  }

  /// Master unified assessment function for all screens, home, reports, and history.
  static GrowthAssessment assess({
    required double weightKg,
    required double heightCm,
    required int ageMonths,
    int? ageInDays,
    required String gender,
    bool edema = false,
    bool? isStanding,
    double? previousWeightKg,
    double? previousHeightCm,
    int? daysSincePrevious,
  }) {
    final effectiveDays = ageInDays ?? (ageMonths * 30.4375).round();
    final adjustedHeight = adjustMeasurementLength(
      heightCm: heightCm,
      ageInDays: effectiveDays,
      isStanding: isStanding,
    );

    // Baseline plausible bounds: H 45-125 cm, W 2-30 kg (0-59 mos)
    if (ageMonths <= 59) {
      if (heightCm < 45.0 || heightCm > 125.0 || weightKg < 2.0 || weightKg > 30.0) {
        return const GrowthAssessment(
          isInvalid: true,
          invalidReason: 'Value outside plausible physiological range for 0–59 months.',
          weightForAgeStatus: 'Needs re-measurement',
          heightForAgeStatus: 'Needs re-measurement',
          weightForLengthStatus: 'Needs re-measurement',
          statusSummary: 'Needs re-measurement',
        );
      }
    }

    // Check implausible change vs previous measurement
    if (previousWeightKg != null && daysSincePrevious != null && daysSincePrevious >= 0) {
      final deltaW = weightKg - previousWeightKg;
      // Gain > 4.5 kg in <= 7 days or rapid loss > 3.0 kg in <= 7 days is biologically implausible
      if (daysSincePrevious <= 7 && (deltaW > 4.5 || deltaW < -3.0)) {
        return GrowthAssessment(
          isInvalid: true,
          invalidReason: 'Implausible weight change (${deltaW > 0 ? "+$deltaW" : "$deltaW"} kg in $daysSincePrevious days). Needs re-measurement.',
          weightForAgeStatus: 'Needs re-measurement',
          heightForAgeStatus: 'Needs re-measurement',
          weightForLengthStatus: 'Needs re-measurement',
          statusSummary: 'Needs re-measurement',
        );
      }
    }
    if (previousHeightCm != null && previousHeightCm > 0) {
      final deltaH = adjustedHeight - previousHeightCm;
      // Height decrease > 1.0 cm is considered measurement error
      if (deltaH < -1.0) {
        return GrowthAssessment(
          isInvalid: true,
          invalidReason: 'Height decreased by ${(-deltaH).toStringAsFixed(1)} cm from previous measurement. Needs re-measurement.',
          weightForAgeStatus: 'Needs re-measurement',
          heightForAgeStatus: 'Needs re-measurement',
          weightForLengthStatus: 'Needs re-measurement',
          statusSummary: 'Needs re-measurement',
        );
      }
    }

    final male = isMale(gender);
    final wfaTable = male ? weightForAgeBoys : weightForAgeGirls;
    final hfaTable = male ? heightForAgeBoys : heightForAgeGirls;
    final wflTable = male ? weightForLengthBoys : weightForLengthGirls;

    final wfaThresholds = _nearest(wfaTable, ageMonths);
    final hfaThresholds = _nearest(hfaTable, ageMonths);

    final roundedLength = (adjustedHeight * 2).round() / 2;
    final wflThresholds = _nearestByLength(wflTable, roundedLength);

    final wfaZ = calculateZScore(value: weightKg, thresholds: wfaThresholds);
    final hfaZ = calculateZScore(value: adjustedHeight, thresholds: hfaThresholds);
    final wflZ = calculateZScore(value: weightKg, thresholds: wflThresholds);

    // 3. WHO Flagging Rules (Biologically Implausible Values - BIV):
    // HFA z < -6 or > +6
    // WFA z < -6 or > +5
    // WFL/WFH z < -5 or > +5
    final isBiv = hfaZ < -6.0 ||
        hfaZ > 6.0 ||
        wfaZ < -6.0 ||
        wfaZ > 5.0 ||
        wflZ < -5.0 ||
        wflZ > 5.0;

    if (isBiv) {
      return GrowthAssessment(
        isInvalid: true,
        invalidReason: 'Flagged invalid per WHO z-score plausibility cutoffs (HFA z: ${hfaZ.toStringAsFixed(2)}, WFA z: ${wfaZ.toStringAsFixed(2)}, WFL z: ${wflZ.toStringAsFixed(2)}). Needs re-measurement.',
        wfaZScore: wfaZ,
        hfaZScore: hfaZ,
        wflZScore: wflZ,
        weightForAgeStatus: 'Needs re-measurement',
        heightForAgeStatus: 'Needs re-measurement',
        weightForLengthStatus: 'Needs re-measurement',
        statusSummary: 'Needs re-measurement',
      );
    }

    // Valid measurement — compute statuses strictly per WHO indicators
    // WFA (Weight-for-age)
    String wfaStatus;
    if (wfaZ < -3.0 || weightKg < wfaThresholds.negThreeSD) {
      wfaStatus = 'Severely Underweight';
    } else if (wfaZ < -2.0 || weightKg < wfaThresholds.negTwoSD) {
      wfaStatus = 'Underweight';
    } else if (wfaZ > 2.0 || weightKg > wfaThresholds.posTwoSD) {
      wfaStatus = 'Overweight';
    } else {
      wfaStatus = 'Normal';
    }

    // HFA (Height-for-age)
    String hfaStatus;
    if (hfaZ < -3.0 || adjustedHeight < hfaThresholds.negThreeSD) {
      hfaStatus = 'Severely Stunted';
    } else if (hfaZ < -2.0 || adjustedHeight < hfaThresholds.negTwoSD) {
      hfaStatus = 'Stunted';
    } else if (hfaZ > 2.0 || adjustedHeight > hfaThresholds.posTwoSD) {
      hfaStatus = 'Tall';
    } else {
      hfaStatus = 'Normal';
    }

    // WFL/WFH (Weight-for-length/height)
    String wflStatus;
    if (edema) {
      wflStatus = 'SAM';
    } else if (wflZ < -3.0 || weightKg < wflThresholds.negThreeSD) {
      wflStatus = 'SAM';
    } else if (wflZ < -2.0 || weightKg < wflThresholds.negTwoSD) {
      wflStatus = 'MAM';
    } else if ((wflThresholds.posThreeSD != null && weightKg > wflThresholds.posThreeSD!) || wflZ > 3.0) {
      wflStatus = 'Obese';
    } else if (wflZ > 2.0 || weightKg > wflThresholds.posTwoSD) {
      wflStatus = 'Overweight';
    } else {
      wflStatus = 'Normal';
    }

    // Informational BMI (not adult BMI categories)
    double? computedBmi;
    if (adjustedHeight > 0) {
      final hMeters = adjustedHeight / 100;
      computedBmi = double.parse((weightKg / (hMeters * hMeters)).toStringAsFixed(2));
    }

    // Overall summary category (priority: Severe -> At risk -> Obese -> Overweight -> Normal)
    String summary;
    if (wfaStatus == 'Severely Underweight' || hfaStatus == 'Severely Stunted' || wflStatus == 'SAM') {
      summary = 'Severe';
    } else if (wfaStatus == 'Underweight' || hfaStatus == 'Stunted' || wflStatus == 'MAM') {
      summary = 'At risk';
    } else if (wflStatus == 'Obese') {
      summary = 'Obese';
    } else if (wflStatus == 'Overweight' || wfaStatus == 'Overweight') {
      summary = 'Overweight';
    } else {
      summary = 'Normal';
    }

    // Overall status = worst of valid indicators per WHO guidelines
    String exactWorstStatus;
    if (wflStatus == 'SAM') {
      exactWorstStatus = 'Severely Wasted (SAM)';
    } else if (hfaStatus == 'Severely Stunted') {
      exactWorstStatus = 'Severely Stunted';
    } else if (wfaStatus == 'Severely Underweight') {
      exactWorstStatus = 'Severely Underweight';
    } else if (wflStatus == 'MAM') {
      exactWorstStatus = 'Moderately Wasted (MAM)';
    } else if (hfaStatus == 'Stunted') {
      exactWorstStatus = 'Stunted';
    } else if (wfaStatus == 'Underweight') {
      exactWorstStatus = 'Underweight';
    } else if (wflStatus == 'Obese') {
      exactWorstStatus = 'Obese';
    } else if (wflStatus == 'Overweight' || wfaStatus == 'Overweight') {
      exactWorstStatus = 'Overweight';
    } else {
      exactWorstStatus = 'Normal';
    }

    return GrowthAssessment(
      isInvalid: false,
      wfaZScore: wfaZ,
      hfaZScore: hfaZ,
      wflZScore: wflZ,
      weightForAgeStatus: wfaStatus,
      heightForAgeStatus: hfaStatus,
      weightForLengthStatus: wflStatus,
      bmi: computedBmi,
      statusSummary: summary,
      overallStatus: exactWorstStatus,
    );
  }

  static String classifyWeightForAge({
    required double weightKg,
    required int ageMonths,
    required String gender,
  }) {
    final table = isMale(gender) ? weightForAgeBoys : weightForAgeGirls;
    final t = _nearest(table, ageMonths);
    if (weightKg < t.negThreeSD) return 'Severely Underweight';
    if (weightKg < t.negTwoSD) return 'Underweight';
    if (weightKg > t.posTwoSD) return 'Overweight';
    return 'Normal';
  }

  static String classifyHeightForAge({
    required double heightCm,
    required int ageMonths,
    required String gender,
  }) {
    final table = isMale(gender) ? heightForAgeBoys : heightForAgeGirls;
    final t = _nearest(table, ageMonths);
    if (heightCm < t.negThreeSD) return 'Severely Stunted';
    if (heightCm < t.negTwoSD) return 'Stunted';
    if (heightCm > t.posTwoSD) return 'Tall';
    return 'Normal';
  }

  static String classifyWeightForLength({
    required double weightKg,
    required double heightCm,
    required String gender,
  }) {
    final table = isMale(gender) ? weightForLengthBoys : weightForLengthGirls;
    final roundedLength = (heightCm * 2).round() / 2;
    final t = _nearestByLength(table, roundedLength);
    if (weightKg < t.negThreeSD) return 'SAM';
    if (weightKg < t.negTwoSD) return 'MAM';
    if (t.posThreeSD != null && weightKg > t.posThreeSD!) return 'Obese';
    if (weightKg > t.posTwoSD) return 'Overweight';
    return 'Normal';
  }

  static SdThresholds _nearest(Map<int, SdThresholds> table, int age) {
    if (table.containsKey(age)) return table[age]!;
    final keys = table.keys.toList()..sort();
    return table[keys.reduce(
      (a, b) => (a - age).abs() < (b - age).abs() ? a : b,
    )]!;
  }

  static SdThresholds _nearestByLength(
    Map<double, SdThresholds> table,
    double length,
  ) {
    if (table.containsKey(length)) return table[length]!;
    final keys = table.keys.toList()..sort();
    return table[keys.reduce(
      (a, b) => (a - length).abs() < (b - length).abs() ? a : b,
    )]!;
  }
}

