import 'package:flutter/material.dart';
import '../../../app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/local/feeding_enrollment_repository.dart';
import '../../../data/local/measurement_repository.dart';
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
    final activeChildren = _childRepo.getActive(_currentBarangay);
    final activeMothers = _motherRepo.getActive(_currentBarangay);

    final childrenThisMonth = activeChildren
        .where((c) => _isThisMonth(c.createdAt))
        .length;
    final mothersThisMonth = activeMothers
        .where((m) => _isThisMonth(m.createdAt))
        .length;

    // Single shared source of truth for nutrition counts based on latest plausible measurements:
    // - SAM Cases = children with severe wasting (WFH/WFL SAM or bilateral pitting edema)
    // - Severe = Any severe condition: Severely Underweight (WFA), Severely Stunted (HFA), or SAM (WFH)
    // - Uses ONLY each child's latest plausible measurement. Children without measurements count as "Not weighed".
    final measRepo = MeasurementRepository();
    final counts = computeNutritionCounts(activeChildren, measRepo);
    final samCases = counts.samCases;
    final severeCount = counts.severeCount;

    final enrolledCount = FeedingEnrollmentRepository()
        .getEnrolledChildren(_currentBarangay)
        .length;

    final now = DateTime.now();
    final dueForWeighingCount = activeChildren.where((c) {
      final m = measRepo.getLatestPlausible(c.id);
      if (m == null) return true; // not weighed yet
      return m.isDueForWeighing(now, childAgeMonths: c.ageInMonths);
    }).length;

    return [
      StatCardData(
        label: 'stat_children_0_59'.tr,
        value: '${activeChildren.length}',
        subtitle: dueForWeighingCount > 0
            ? 'due_for_weighing_count'.trArgs({'count': '$dueForWeighingCount'})
            : (childrenThisMonth > 0
                ? 'new_this_month_count'.trArgs({'count': '$childrenThisMonth'})
                : 'all_up_to_date'.tr),
        accentColor: const Color(0xFF1B5E20), // dark green
        icon: Icons.child_care_rounded,
      ),

      StatCardData(
        label: 'stat_lactating_mothers'.tr,
        value: '${activeMothers.length}',
        subtitle: mothersThisMonth > 0
            ? 'new_this_month_count'.trArgs({'count': '$mothersThisMonth'})
            : 'no_new_this_month'.tr,
        accentColor: const Color(0xFF00796B), // teal
        icon: Icons.pregnant_woman_rounded,
      ),
      StatCardData(
        label: 'stat_sam_cases'.tr,
        value: '$samCases',
        subtitle: samCases > 0
            ? 'sam_wasting_severe'.trArgs({'sam': '$samCases', 'severe': '$severeCount'})
            : (severeCount > 0
                ? 'severe_no_acute'.trArgs({'severe': '$severeCount'})
                : 'no_active_cases'.tr),
        accentColor: const Color(0xFFC62828), // deep red / terracotta
        icon: Icons.warning_amber_rounded,
      ),
      StatCardData(
        label: 'stat_feeding_program'.tr,
        value: '$enrolledCount',
        subtitle: enrolledCount > 0
            ? 'enrolled_count'.trArgs({'count': '$enrolledCount'})
            : 'none_enrolled'.tr,
        accentColor: const Color(0xFF558B2F), // olive / moss green
        icon: Icons.restaurant_menu_rounded,
      ),
    ];
  }

  bool _isThisMonth(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  /// Single shared source of truth for nutrition counts across the dashboard.
  /// Uses ChildOverallStatus.fromChild to guarantee 100% consistency with Masterlist chips,
  /// profile badges, and feeding enrollment.
  NutritionCounts computeNutritionCounts(
    List<Child> activeChildren, [
    MeasurementRepository? repo,
  ]) {
    final measRepo = repo ?? MeasurementRepository();
    int samCases = 0;
    int severeCount = 0;
    int atRiskCount = 0;
    int obeseCount = 0;
    int overweightCount = 0;
    int normalCount = 0;
    int notWeighedCount = 0;

    for (final c in activeChildren) {
      final m = measRepo.getLatestPlausible(c.id);
      final overall = ChildOverallStatus.fromChild(c, m);
      switch (overall.category) {
        case ChildOverallCategory.severe:
          severeCount++;
          if (overall.isSam) samCases++;
          break;
        case ChildOverallCategory.atRisk:
          atRiskCount++;
          break;
        case ChildOverallCategory.obese:
          obeseCount++;
          break;
        case ChildOverallCategory.overweight:
          overweightCount++;
          break;
        case ChildOverallCategory.normal:
          normalCount++;
          break;
        case ChildOverallCategory.notWeighed:
          notWeighedCount++;
          break;
        case ChildOverallCategory.all:
          break;
      }
    }

    return NutritionCounts(
      totalChildren: activeChildren.length,
      samCases: samCases,
      severeCount: severeCount,
      atRiskCount: atRiskCount,
      obeseCount: obeseCount,
      overweightCount: overweightCount,
      normalCount: normalCount,
      notWeighedCount: notWeighedCount,
    );
  }

  /// Primary distribution across weighed children using the shared source of truth.
  List<NutritionStatusItem> getNutritionBreakdown() {
    final allChildren = _childRepo.getActive(_currentBarangay);

    final counts = computeNutritionCounts(allChildren);

    final statusMap = <String, int>{
      'Normal': counts.normalCount,
      'At risk': counts.atRiskCount,
      'Severe (any indicator)': counts.severeCount,
      'Overweight': counts.overweightCount,
      'Obese': counts.obeseCount,
      'Not weighed': counts.notWeighedCount,
    };

    const order = [
      'Normal',
      'At risk',
      'Severe (any indicator)',
      'Overweight',
      'Obese',
      'Not weighed',
    ];

    final total = allChildren.length;
    const coreCategories = {
      'Normal',
      'At risk',
      'Severe (any indicator)',
      'Overweight',
      'Not weighed',
    };

    return order
        .where((s) => coreCategories.contains(s) || (statusMap[s] ?? 0) > 0)
        .map(
          (s) => NutritionStatusItem(
            label: s,
            count: statusMap[s] ?? 0,
            percent: total > 0
                ? (((statusMap[s] ?? 0) / total) * 100).clamp(0, 100)
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
