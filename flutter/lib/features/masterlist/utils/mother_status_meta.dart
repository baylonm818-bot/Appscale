import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class MotherStatusMeta {
  MotherStatusMeta._();

  static String formatStatus(String? status) {
    if (status == null || status.trim().isEmpty) return 'Not visited';
    final s = status.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
    if (s == 'at risk') return 'At-risk';
    if (s == 'normal') return 'Normal';
    if (s == 'not visited') return 'Not visited';
    return status;
  }

  static Color colorFor(String status) {
    final s = formatStatus(status);
    switch (s) {
      case 'Normal':
        return AppColors.primaryGreen;
      case 'At-risk':
        return AppColors.statRed;
      case 'Not visited':
        return AppColors.notWeighed;
      default:
        return AppColors.textMuted;
    }
  }

  static const allStatuses = [
    'All',
    'Normal',
    'At-risk',
    'Not visited',
  ];
}
