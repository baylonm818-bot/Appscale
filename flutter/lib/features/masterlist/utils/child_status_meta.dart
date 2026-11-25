import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';

/// Maps a child's nutrition status string to its display color.
/// Add a new status here (e.g. once MUAC/SAM tracking is built) and
/// every badge and list tile in the app updates automatically.
class ChildStatusMeta {
  ChildStatusMeta._();

  /// Normalizes status strings (trim, lowercase, replace hyphens and spaces with underscores)
  static String normalizeKey(String? status) {
    if (status == null) return '';
    return status.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  }

  static String formatStatus(String? status) {
    if (status == null || status.trim().isEmpty) return 'Normal';
    final key = normalizeKey(status);
    switch (key) {
      case 'severe':
      case 'severe_acute_malnutrition':
      case 'sam':
      case 'wasting_severe':
        return 'Severe';
      case 'severely_underweight':
      case 'suw':
        return 'Severely Underweight';
      case 'underweight':
      case 'uw':
        return 'Underweight';
      case 'at_risk':
      case 'moderate':
      case 'moderate_acute_malnutrition':
      case 'mam':
        return 'At risk';
      case 'severely_stunted':
      case 'sst':
        return 'Severely Stunted';
      case 'stunted':
      case 'st':
        return 'Stunted';
      case 'tall':
        return 'Tall';
      case 'severely_wasted':
        return 'Severely Wasted';
      case 'wasted':
        return 'Wasted';
      case 'overweight':
      case 'ow':
        return 'Overweight';
      case 'obese':
      case 'ob':
        return 'Obese';
      case 'normal':
      case 'n':
        return 'Normal';
      case 'not_weighed':
      case 'unweighed':
      case 'not_yet_classified':
      case 'none':
      case '--':
        return 'Not weighed';
      case 'needs_re_measurement':
      case 'needs_remeasurement':
      case 're_measurement':
        return 'Needs re-measurement';
      default:
        final s = status.trim().replaceAll('_', ' ');
        return s
            .split(' ')
            .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
            .join(' ');
    }
  }

  static Color colorFor(String rawStatus) {
    final key = normalizeKey(rawStatus);
    switch (key) {
      // 1. Severe variants
      case 'severe':
      case 'severe_(any_indicator)':
      case 'severe_any_indicator':
      case 'severely_underweight':
      case 'suw':
      case 'severely_stunted':
      case 'sst':
      case 'severely_wasted':
      case 'sam':
      case 'wasting_severe':
      case 'severe_acute_malnutrition':
        return AppColors.statRed;

      // 2. At risk / Moderate variants
      case 'at_risk':
      case 'moderate':
      case 'moderate_at_risk':
      case 'moderate_acute_malnutrition':
      case 'underweight':
      case 'uw':
      case 'stunted':
      case 'st':
      case 'wasted':
      case 'mam':
        return AppColors.statOrange;

      // 3. Normal variants
      case 'normal':
      case 'n':
      case 'tall':
        return AppColors.primaryGreen;

      // 4. Overweight variants
      case 'overweight':
      case 'ow':
        return AppColors.statBlue;

      // 5. Obese variants
      case 'obese':
      case 'ob':
        return AppColors.statPurple;

      // 6. Not weighed variants
      case 'not_weighed':
      case 'unweighed':
      case 'not_yet_classified':
      case 'none':
      case '--':
      case '__':
      case '-':
      case '':
        return AppColors.notWeighed;

      // 7. Needs re-measurement
      case 'needs_re_measurement':
      case 'needs_remeasurement':
      case 're_measurement':
        return AppColors.statRed;

      default:
        // Visible warning color fallback + debug log (never silently return gray)
        debugPrint('[ChildStatusMeta] Unknown nutrition status key: "$rawStatus" (normalized: "$key")');
        return AppColors.statAmber;
    }
  }

  static bool needsAttention(String status) =>
      normalizeKey(status) == 'not_weighed';

  static const allStatuses = [
    'All',
    'Normal',
    'Underweight',
    'Severely Underweight',
    'Overweight',
    'Obese',
    'Stunted',
    'Not weighed',
  ];
}

enum ChildOverallCategory {
  all,
  severe,
  atRisk,
  overweight,
  obese,
  normal,
  notWeighed,
}

class ChildOverallStatus {
  final String label;
  final String specificLabel; // Exact indicator: "Severely Wasted (SAM)", "Severely Stunted", "Severely Underweight", "Moderately Wasted (MAM)", "Stunted", "Underweight", "Obese", "Overweight", "Normal", "Not weighed"
  final Color color;
  final ChildOverallCategory category;
  final int severityRank; // 0 = Severe, 1 = At risk, 2 = Obese, 3 = Overweight, 4 = Normal, 5 = Not weighed
  final bool isSam;
  final bool isMam;
  final bool isSeverelyUnderweight;
  final bool isSeverelyStunted;
  final bool isUnderweight;
  final bool isStunted;
  final bool isObese;
  final bool isOverweight;
  final bool isNormal;
  final bool isNotWeighed;
  final bool isSevere;
  final bool isAtRisk;

  const ChildOverallStatus({
    required this.label,
    required this.specificLabel,
    required this.color,
    required this.category,
    required this.severityRank,
    this.isSam = false,
    this.isMam = false,
    this.isSeverelyUnderweight = false,
    this.isSeverelyStunted = false,
    this.isUnderweight = false,
    this.isStunted = false,
    this.isObese = false,
    this.isOverweight = false,
    this.isNormal = false,
    this.isNotWeighed = false,
    this.isSevere = false,
    this.isAtRisk = false,
  });

  /// Single shared WHO z-score overall status function across the entire app.
  /// Rule: Overall status = the worst of valid indicators (WFA, HFA, WFH).
  /// Priority order:
  ///   1. Severe (SAM / Severely Wasted, Severely Stunted, Severely Underweight) -> Red
  ///   2. At risk (MAM / Moderately Wasted, Stunted, Underweight) -> Orange
  ///   3. Obese (WFH Obese) -> Purple
  ///   4. Overweight (WFH or WFA Overweight) -> Blue
  ///   5. Normal (All valid indicators Normal or Tall) -> Green
  ///   6. Not weighed (Child has no measurements or indicators are unrecorded) -> Gray
  static ChildOverallStatus fromChild(Child child, [Measurement? latestMeasurement]) {
    final m = latestMeasurement ?? MeasurementRepository().getLatestPlausible(child.id);

    if (m == null) {
      final all = MeasurementRepository().getForChild(child.id);
      if (all.isEmpty || child.lastWeighedAt == null) {
        return const ChildOverallStatus(
          label: 'Not weighed',
          specificLabel: 'Not weighed',
          color: AppColors.notWeighed,
          category: ChildOverallCategory.notWeighed,
          severityRank: 5,
          isNotWeighed: true,
        );
      }
    }

    final rawWfa = m?.weightForAgeStatus ?? child.nutritionStatus;
    final rawHfa = m?.heightForAgeStatus ?? child.stuntingStatus;
    final rawWfh = m?.effectiveWastingStatus ?? child.wastingStatus;

    bool matches(String raw, List<String> targets) {
      final norm = ChildStatusMeta.normalizeKey(raw);
      for (final t in targets) {
        if (norm == ChildStatusMeta.normalizeKey(t)) return true;
      }
      return false;
    }

    final isUnweighed = matches(rawWfa, ['not_weighed', 'not_yet_classified', 'none', '--', '', 'null']) &&
        matches(rawHfa, ['not_weighed', 'not_yet_classified', 'none', '--', '', 'null']) &&
        matches(rawWfh, ['not_weighed', 'not_yet_classified', 'none', '--', '', 'null']);

    if (isUnweighed) {
      return const ChildOverallStatus(
        label: 'Not weighed',
        specificLabel: 'Not weighed',
        color: AppColors.notWeighed,
        category: ChildOverallCategory.notWeighed,
        severityRank: 5,
        isNotWeighed: true,
      );
    }

    // 1. Severe (SAM, Severely Stunted, Severely Underweight)
    final isSam = matches(rawWfh, [
      'sam', 'severe', 'severely_wasted', 'wasting_severe', 'severe_acute_malnutrition'
    ]);
    final isSst = matches(rawHfa, ['severely_stunted', 'sst']);
    final isSuw = matches(rawWfa, ['severely_underweight', 'suw']);

    if (isSam || isSst || isSuw) {
      String specific = 'Severe';
      if (isSam) {
        specific = 'Severely Wasted (SAM)';
      } else if (isSst) {
        specific = 'Severely Stunted';
      } else {
        specific = 'Severely Underweight';
      }
      return ChildOverallStatus(
        label: 'Severe',
        specificLabel: specific,
        color: AppColors.statRed,
        category: ChildOverallCategory.severe,
        severityRank: 0,
        isSevere: true,
        isSam: isSam,
        isSeverelyStunted: isSst,
        isSeverelyUnderweight: isSuw,
      );
    }

    // 2. At risk (MAM / Moderately Wasted, Stunted, Underweight)
    final isMam = matches(rawWfh, [
      'mam', 'wasted', 'at_risk', 'moderate', 'moderate_acute_malnutrition', 'moderately_wasted'
    ]);
    final isStunted = matches(rawHfa, ['stunted', 'st']);
    final isUnderweight = matches(rawWfa, ['underweight', 'uw']);

    if (isMam || isStunted || isUnderweight) {
      String specific = 'At risk';
      if (isMam) {
        specific = 'Moderately Wasted (MAM)';
      } else if (isStunted) {
        specific = 'Stunted';
      } else {
        specific = 'Underweight';
      }
      return ChildOverallStatus(
        label: 'At risk',
        specificLabel: specific,
        color: AppColors.statOrange,
        category: ChildOverallCategory.atRisk,
        severityRank: 1,
        isAtRisk: true,
        isMam: isMam,
        isStunted: isStunted,
        isUnderweight: isUnderweight,
      );
    }

    // 3. Obese
    final isObese = matches(rawWfh, ['obese', 'ob']);
    if (isObese) {
      return const ChildOverallStatus(
        label: 'Obese',
        specificLabel: 'Obese',
        color: AppColors.statPurple,
        category: ChildOverallCategory.obese,
        severityRank: 2,
        isObese: true,
      );
    }

    // 4. Overweight
    final isOverweight = matches(rawWfh, ['overweight', 'ow']) || matches(rawWfa, ['overweight', 'ow']);
    if (isOverweight) {
      return const ChildOverallStatus(
        label: 'Overweight',
        specificLabel: 'Overweight',
        color: AppColors.statBlue,
        category: ChildOverallCategory.overweight,
        severityRank: 3,
        isOverweight: true,
      );
    }

    // 5. Normal
    return const ChildOverallStatus(
      label: 'Normal',
      specificLabel: 'Normal',
      color: AppColors.primaryGreen,
      category: ChildOverallCategory.normal,
      severityRank: 4,
      isNormal: true,
    );
  }
}
