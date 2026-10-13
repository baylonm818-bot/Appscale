import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/child.dart';

/// Maps a child's nutrition status string to its display color.
/// Add a new status here (e.g. once MUAC/SAM tracking is built) and
/// every badge and list tile in the app updates automatically.
class ChildStatusMeta {
  ChildStatusMeta._();

  static String formatStatus(String? status) {
    if (status == null || status.trim().isEmpty) return 'Normal';
    final s = status.trim().toLowerCase().replaceAll('_', ' ');
    switch (s) {
      case 'severely underweight':
      case 'suw':
        return 'Severely Underweight';
      case 'underweight':
      case 'uw':
        return 'Underweight';
      case 'severely stunted':
      case 'sst':
        return 'Severely Stunted';
      case 'stunted':
      case 'st':
        return 'Stunted';
      case 'tall':
        return 'Tall';
      case 'severely wasted':
      case 'sam':
        return 'SAM';
      case 'wasted':
      case 'mam':
        return 'MAM';
      case 'overweight':
      case 'ow':
        return 'Overweight';
      case 'obese':
      case 'ob':
        return 'Obese';
      case 'normal':
      case 'n':
        return 'Normal';
      case 'not weighed':
        return 'Not weighed';
      default:
        return s
            .split(' ')
            .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
            .join(' ');
    }
  }

  static Color colorFor(String rawStatus) {
    final status = formatStatus(rawStatus);
    switch (status) {
      case 'Normal':
        return AppColors.primaryGreen;
      case 'Underweight':
        return AppColors.statAmber;
      case 'Severely Underweight':
        return AppColors.statRed;
      case 'Overweight':
        return AppColors.statBlue;
      case 'Obese':
        return AppColors.statPurple;
      case 'Stunted':
        return AppColors.statOrange;
      case 'Severely Stunted':
        return AppColors.statRed;
      case 'Not weighed':
        return AppColors.notWeighed;
      case 'SAM':
        return AppColors.statRed;
      case 'MAM':
        return AppColors.statOrange;
      default:
        return AppColors.textMuted;
    }
  }

  static bool needsAttention(String status) => formatStatus(status) == 'Not weighed';

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
  final Color color;
  final ChildOverallCategory category;
  final int severityRank; // 0 = Severe, 1 = At risk, 2 = Obese, 3 = Overweight, 4 = Normal, 5 = Not weighed

  const ChildOverallStatus({
    required this.label,
    required this.color,
    required this.category,
    required this.severityRank,
  });

  /// Single WHO z-score classification function across the app.
  /// Rules:
  /// - Under-5s use weight-for-height (WFH) instead of BMI.
  /// - "Severe": ONLY Severely Underweight (WFA < -3SD), Severely Stunted (HFA < -3SD), or Severely Wasted / SAM (WFH < -3SD or bilateral edema).
  /// - "At risk": Underweight (WFA < -2SD), Stunted (HFA < -2SD), or MAM (WFH < -2SD).
  /// - "Obese": Obese (WFH > +3SD).
  /// - "Overweight": Overweight (WFH or WFA > +2SD). Never show Overweight and Obese together.
  /// - "Normal": Normal / Tall.
  /// - "Not weighed": All statuses unrecorded.
  static ChildOverallStatus fromChild(Child child) {
    final wfa = ChildStatusMeta.formatStatus(child.nutritionStatus);
    final hfa = ChildStatusMeta.formatStatus(child.stuntingStatus);
    final wfh = ChildStatusMeta.formatStatus(child.wastingStatus);

    final statuses = [wfa, hfa, wfh];

    if (statuses.every((s) => s == 'Not weighed')) {
      return const ChildOverallStatus(
        label: 'Not weighed',
        color: AppColors.notWeighed,
        category: ChildOverallCategory.notWeighed,
        severityRank: 5,
      );
    }

    // 1. Severe: ONLY severely underweight, severely stunted, or wasted (SAM)
    final isSevere = statuses.any((s) =>
        s == 'Severely Underweight' ||
        s == 'Severely Stunted' ||
        s == 'SAM');
    if (isSevere) {
      return const ChildOverallStatus(
        label: 'Severe',
        color: AppColors.statRed,
        category: ChildOverallCategory.severe,
        severityRank: 0,
      );
    }

    // 2. Moderate / At risk: Underweight, Stunted, MAM
    final isAtRisk = statuses.any((s) =>
        s == 'Underweight' ||
        s == 'Stunted' ||
        s == 'MAM');
    if (isAtRisk) {
      return const ChildOverallStatus(
        label: 'At risk',
        color: AppColors.statOrange,
        category: ChildOverallCategory.atRisk,
        severityRank: 1,
      );
    }

    // 3. Obese: Prioritized if obese per WFH (never show Overweight and Obese together)
    final isObese = statuses.any((s) => s == 'Obese');
    if (isObese) {
      return const ChildOverallStatus(
        label: 'Obese',
        color: AppColors.statPurple,
        category: ChildOverallCategory.obese,
        severityRank: 2,
      );
    }

    // 4. Overweight: if overweight (and not obese)
    final isOverweight = statuses.any((s) => s == 'Overweight');
    if (isOverweight) {
      return const ChildOverallStatus(
        label: 'Overweight',
        color: AppColors.statBlue,
        category: ChildOverallCategory.overweight,
        severityRank: 3,
      );
    }

    // 5. Normal: Lahat Normal o Tall
    return const ChildOverallStatus(
      label: 'Normal',
      color: AppColors.primaryGreen,
      category: ChildOverallCategory.normal,
      severityRank: 4,
    );
  }
}
