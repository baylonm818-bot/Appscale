import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/child.dart';

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

  const ChildOverallStatus({
    required this.label,
    required this.specificLabel,
    required this.color,
    required this.category,
    required this.severityRank,
  });

  /// Single WHO z-score classification function across the app.
  /// Rules:
  /// - Under-5s use weight-for-height (WFH) instead of BMI.
  /// - Rule: overall status = worst of valid indicators (WFA, HFA, WFH)
  /// - "SAM" means severe wasting (WFH) ONLY.
  /// - Priority:
  ///   1. Severely Wasted (SAM)
  ///   2. Severely Stunted
  ///   3. Severely Underweight
  ///   4. Moderately Wasted (MAM)
  ///   5. Stunted
  ///   6. Underweight
  ///   7. Obese
  ///   8. Overweight
  ///   9. Normal
  /// - "Not weighed": All statuses unrecorded or child has no measurements.
  static ChildOverallStatus fromChild(Child child) {
    final wfa = ChildStatusMeta.formatStatus(child.nutritionStatus);
    final hfa = ChildStatusMeta.formatStatus(child.stuntingStatus);
    final wfh = ChildStatusMeta.formatStatus(child.wastingStatus);

    final statuses = [wfa, hfa, wfh];

    if (statuses.every((s) => s == 'Not weighed' || s.isEmpty || s == 'null')) {
      return const ChildOverallStatus(
        label: 'Not weighed',
        specificLabel: 'Not weighed',
        color: AppColors.notWeighed,
        category: ChildOverallCategory.notWeighed,
        severityRank: 5,
      );
    }

    if (statuses.any((s) => s == 'Needs re-measurement') &&
        !statuses.any((s) =>
            s == 'Severely Underweight' ||
            s == 'Severely Stunted' ||
            s == 'SAM' ||
            s == 'Underweight' ||
            s == 'Stunted' ||
            s == 'MAM' ||
            s == 'Obese' ||
            s == 'Overweight')) {
      return const ChildOverallStatus(
        label: 'Needs re-measurement',
        specificLabel: 'Needs re-measurement',
        color: AppColors.statRed,
        category: ChildOverallCategory.notWeighed,
        severityRank: 5,
      );
    }

    // 1. Severe: ONLY severely wasted (SAM), severely stunted, or severely underweight
    if (wfh == 'SAM') {
      return const ChildOverallStatus(
        label: 'Severe',
        specificLabel: 'Severely Wasted (SAM)',
        color: AppColors.statRed,
        category: ChildOverallCategory.severe,
        severityRank: 0,
      );
    }
    if (hfa == 'Severely Stunted') {
      return const ChildOverallStatus(
        label: 'Severe',
        specificLabel: 'Severely Stunted',
        color: AppColors.statRed,
        category: ChildOverallCategory.severe,
        severityRank: 0,
      );
    }
    if (wfa == 'Severely Underweight') {
      return const ChildOverallStatus(
        label: 'Severe',
        specificLabel: 'Severely Underweight',
        color: AppColors.statRed,
        category: ChildOverallCategory.severe,
        severityRank: 0,
      );
    }

    // 2. Moderate / At risk: MAM, Stunted, Underweight
    if (wfh == 'MAM') {
      return const ChildOverallStatus(
        label: 'At risk',
        specificLabel: 'Moderately Wasted (MAM)',
        color: AppColors.statOrange,
        category: ChildOverallCategory.atRisk,
        severityRank: 1,
      );
    }
    if (hfa == 'Stunted') {
      return const ChildOverallStatus(
        label: 'At risk',
        specificLabel: 'Stunted',
        color: AppColors.statOrange,
        category: ChildOverallCategory.atRisk,
        severityRank: 1,
      );
    }
    if (wfa == 'Underweight') {
      return const ChildOverallStatus(
        label: 'At risk',
        specificLabel: 'Underweight',
        color: AppColors.statOrange,
        category: ChildOverallCategory.atRisk,
        severityRank: 1,
      );
    }

    // 3. Obese: Prioritized if obese per WFH (never show Overweight and Obese together)
    if (wfh == 'Obese') {
      return const ChildOverallStatus(
        label: 'Obese',
        specificLabel: 'Obese',
        color: AppColors.statPurple,
        category: ChildOverallCategory.obese,
        severityRank: 2,
      );
    }

    // 4. Overweight: if overweight (and not obese)
    if (wfh == 'Overweight' || wfa == 'Overweight') {
      return const ChildOverallStatus(
        label: 'Overweight',
        specificLabel: 'Overweight',
        color: AppColors.statBlue,
        category: ChildOverallCategory.overweight,
        severityRank: 3,
      );
    }

    // 5. Normal: Lahat Normal o Tall
    return const ChildOverallStatus(
      label: 'Normal',
      specificLabel: 'Normal',
      color: AppColors.primaryGreen,
      category: ChildOverallCategory.normal,
      severityRank: 4,
    );
  }
}
