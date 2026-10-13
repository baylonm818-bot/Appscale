import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/feeding_enrollment_repository.dart';
import '../../../data/local/hive_boxes.dart';
import '../../../data/local/mother_repository.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../models/dashboard_models.dart';
import '../../../data/local/program_schedule_repository.dart';

import '../../../shared/utils/app_date_format.dart';

class DashboardRepository {
  final _settings = SettingsRepository();
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  List<StatCardData> getStatCards() {
    final activeChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();
    final activeMothers = _motherRepo
        .getAll()
        .where((m) => m.barangay == _currentBarangay && m.isActive)
        .toList();

    final childrenThisMonth = activeChildren
        .where((c) => _isThisMonth(c.createdAt))
        .length;
    final mothersThisMonth = activeMothers
        .where((m) => _isThisMonth(m.createdAt))
        .length;
    // SAM = wasting SAM (weight-for-length/height < -3SD), strictly per clinical definition.
    // Exclude records flagged as Needs re-measurement / implausible values.
    final samCases = activeChildren
        .where((c) =>
            ChildStatusMeta.formatStatus(c.wastingStatus) == 'SAM' &&
            c.wastingStatus != 'Needs re-measurement')
        .length;

    final enrolledCount = FeedingEnrollmentRepository()
        .getEnrolledChildren(_currentBarangay)
        .length;

    return [
      StatCardData(
        label: 'Children (0-59 mos)',
        value: '${activeChildren.length}',
        subtitle: childrenThisMonth > 0
            ? '$childrenThisMonth new this month'
            : 'No new this month',
        accentColor: const Color(0xFF1B5E20), // dark green
        icon: Icons.child_care_rounded,
      ),
      StatCardData(
        label: 'Lactating Mothers',
        value: '${activeMothers.length}',
        subtitle: mothersThisMonth > 0
            ? '$mothersThisMonth new this month'
            : 'No new this month',
        accentColor: const Color(0xFF00796B), // teal
        icon: Icons.pregnant_woman_rounded,
      ),
      StatCardData(
        label: 'SAM Cases',
        value: '$samCases',
        subtitle: samCases > 0
            ? '$samCases acute wasting'
            : 'No active cases',
        accentColor: const Color(0xFFC62828), // deep red / terracotta
        icon: Icons.warning_amber_rounded,
      ),
      StatCardData(
        label: 'Feeding Program',
        value: '$enrolledCount',
        subtitle: enrolledCount > 0
            ? '$enrolledCount enrolled'
            : 'None enrolled',
        accentColor: const Color(0xFF558B2F), // olive / moss green
        icon: Icons.restaurant_menu_rounded,
      ),
    ];
  }

  bool _isThisMonth(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  /// Primary Weight-for-Age (WFA) distribution across weighed children.
  /// Uses the single WHO classification source (ChildOverallStatus)
  /// so Home chart, list badges, filter chips, and profile chips match 100%.
  List<NutritionStatusItem> getNutritionBreakdown() {
    final allChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();

    const order = [
      'Normal',
      'At risk',
      'Severe',
      'Overweight',
      'Obese',
      'Needs re-measurement',
      'Not weighed',
    ];
    final counts = {for (final s in order) s: 0};
    for (final c in allChildren) {
      final overall = ChildOverallStatus.fromChild(c);
      final label = overall.label;
      if (counts.containsKey(label)) {
        counts[label] = counts[label]! + 1;
      } else {
        counts['Not weighed'] = counts['Not weighed']! + 1;
      }
    }

    final total = allChildren.length;
    return order
        .where((s) => (counts[s] ?? 0) > 0 || s == 'Normal' || s == 'At risk' || s == 'Severe')
        .map(
          (s) => NutritionStatusItem(
            label: s,
            count: counts[s] ?? 0,
            percent: total > 0
                ? (((counts[s] ?? 0) / total) * 100).clamp(0, 100)
                : 0,
            color: ChildStatusMeta.colorFor(s),
          ),
        )
        .toList();
  }

  List<UpcomingActivityData> getUpcomingActivities() {
    final upcoming = ProgramScheduleRepository().getUpcoming(_currentBarangay);

    const monthNames = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];

    Color colorForType(String type) {
      switch (type) {
        case 'Feeding':
          return AppColors.primaryGreen;
        case 'Vitamin A':
          return AppColors.statAmber;
        case 'Deworming':
          return AppColors.statOrange;
        case 'OPT Plus':
          return AppColors.statPurple;
        default:
          return AppColors.statBlue;
      }
    }

    return upcoming.take(5).map((s) {
      final mName = (s.date.month >= 1 && s.date.month <= 12)
          ? monthNames[s.date.month - 1]
          : '—';
      final dayStr = s.date.day.toString().padLeft(2, '0');
      final cleanTime = AppDateFormat.formatTime(s.startTime);
      final subtitle = cleanTime.isNotEmpty
          ? '$cleanTime · ${s.location}'
          : s.location;
      return UpcomingActivityData(
        month: mName,
        day: dayStr,
        title: s.title,
        subtitle: subtitle,
        statusLabel: s.programType,
        statusColor: colorForType(s.programType),
      );
    }).toList();
  }
}
