import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

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
