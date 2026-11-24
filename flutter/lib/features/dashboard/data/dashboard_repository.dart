import 'package:flutter/material.dart';
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

import '../../../data/models/program_schedule.dart';
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

    // Single shared source of truth for nutrition counts based on latest plausible measurements:
    // - SAM Cases = children with severe wasting (WFH/WFL SAM or bilateral pitting edema)
    // - Severe = Any severe condition: Severely Underweight (WFA), Severely Stunted (HFA), or SAM (WFH)
    // - Uses ONLY each child's latest plausible measurement. Children without measurements count as "Not weighed".
    final measRepo = MeasurementRepository();
    final counts = computeNutritionCounts(activeChildren, measRepo);
    final samCases = counts.samCases;

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
        label: 'Children 0-59 mos',
        value: '${activeChildren.length}',
        subtitle: dueForWeighingCount > 0
            ? '$dueForWeighingCount due for weighing'
            : (childrenThisMonth > 0
                ? '$childrenThisMonth registered this month'
                : 'All children up to date'),
        accentColor: const Color(0xFF2E7D32), // green
        icon: Icons.child_care_rounded,
      ),
      StatCardData(
        label: 'Lactating Mothers',
        value: '${activeMothers.length}',
        subtitle: mothersThisMonth > 0
            ? '$mothersThisMonth enrolled this month'
            : 'All profiles active',
        accentColor: const Color(0xFF00897B), // teal
        icon: Icons.pregnant_woman_rounded,
      ),
      StatCardData(
        label: 'SAM (severe wasting)',
        value: '$samCases',
        subtitle: samCases > 0
            ? '$samCases acute wasting cases'
            : 'No active SAM cases',
        accentColor: const Color(0xFFE53935), // red
        icon: Icons.warning_amber_rounded,
      ),
      StatCardData(
        label: 'Feeding Program',
        value: '$enrolledCount',
        subtitle: enrolledCount > 0
            ? '$enrolledCount beneficiaries enrolled'
            : 'No active beneficiaries',
        accentColor: const Color(0xFF689F38), // olive
        icon: Icons.restaurant_menu_rounded,
      ),
    ];
  }

  bool _isThisMonth(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  /// Single shared source of truth for nutrition counts across the dashboard.
  /// Evaluates each active child's latest plausible measurement.
  /// Children without measurements are strictly counted as "Not weighed".
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
      if (m == null) {
        // Child with no plausible measurement
        notWeighedCount++;
        continue;
      }

      final isSam = m.effectiveWastingStatus == 'SAM';
      if (isSam) {
        samCases++;
      }

      final isSevere = isSam ||
          m.heightForAgeStatus == 'Severely Stunted' ||
          m.weightForAgeStatus == 'Severely Underweight';

      if (isSevere) {
        severeCount++;
        continue;
      }

      final isAtRisk = m.effectiveWastingStatus == 'MAM' ||
          m.heightForAgeStatus == 'Stunted' ||
          m.weightForAgeStatus == 'Underweight';

      if (isAtRisk) {
        atRiskCount++;
        continue;
      }

      final isObese = m.effectiveWastingStatus == 'Obese' ||
          m.customBmiStatus == 'Obese';

      if (isObese) {
        obeseCount++;
        continue;
      }

      final isOverweight = m.effectiveWastingStatus == 'Overweight' ||
          m.weightForAgeStatus == 'Overweight' ||
          m.customBmiStatus == 'Overweight';

      if (isOverweight) {
        overweightCount++;
        continue;
      }

      normalCount++;
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
  /// Label 'Severe (any indicator)' matches the severe count in the SAM Cases card subtitle.
  List<NutritionStatusItem> getNutritionBreakdown() {
    final allChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();

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

  List<ProgramSchedule> getTodayActivities() {
    final now = DateTime.now();
    return ProgramScheduleRepository()
        .getAllForBarangay(_currentBarangay)
        .where((s) => s.date.year == now.year && s.date.month == now.month && s.date.day == now.day)
        .toList();
  }

  int getDueForWeighingCount() {
    final activeChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();
    final now = DateTime.now();
    final measRepo = MeasurementRepository();
    return activeChildren.where((c) {
      final m = measRepo.getLatestPlausible(c.id);
      if (m == null) return true;
      return m.isDueForWeighing(now, childAgeMonths: c.ageInMonths);
    }).length;
  }

  List<NutritionStatusItem> getNutritionBreakdownForYear(int year) {
    final allChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();

    final counts = computeNutritionCountsForYear(allChildren, year);

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

  NutritionCounts computeNutritionCountsForYear(
    List<Child> activeChildren,
    int year, [
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

    final endOfYear = DateTime(year, 12, 31, 23, 59, 59);

    for (final c in activeChildren) {
      final childMeas = measRepo
          .getForChild(c.id)
          .where((m) => m.isPlausible && !m.date.isAfter(endOfYear))
          .toList();
      final m = childMeas.isNotEmpty ? childMeas.first : null;
      if (m == null) {
        notWeighedCount++;
        continue;
      }

      final isSam = m.effectiveWastingStatus == 'SAM';
      if (isSam) samCases++;

      final isSevere = isSam ||
          m.heightForAgeStatus == 'Severely Stunted' ||
          m.weightForAgeStatus == 'Severely Underweight';

      if (isSevere) {
        severeCount++;
        continue;
      }

      final isAtRisk = m.effectiveWastingStatus == 'MAM' ||
          m.heightForAgeStatus == 'Stunted' ||
          m.weightForAgeStatus == 'Underweight';

      if (isAtRisk) {
        atRiskCount++;
        continue;
      }

      final isObese = m.effectiveWastingStatus == 'Obese' ||
          m.customBmiStatus == 'Obese';

      if (isObese) {
        obeseCount++;
        continue;
      }

      final isOverweight = m.effectiveWastingStatus == 'Overweight' ||
          m.weightForAgeStatus == 'Overweight' ||
          m.customBmiStatus == 'Overweight';

      if (isOverweight) {
        overweightCount++;
        continue;
      }

      normalCount++;
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

  List<YearlyNutritionBreakdown> getYearlyNutritionComparison(String indicator) {
    final nowYear = DateTime.now().year;
    final years = [nowYear - 2, nowYear - 1, nowYear];
    final activeChildren = _childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => c.isActive)
        .toList();
    final measRepo = MeasurementRepository();

    return years.map((y) {
      final endOfYear = DateTime(y, 12, 31, 23, 59, 59);
      final counts = <String, int>{};
      int total = 0;

      for (final c in activeChildren) {
        final childMeas = measRepo
            .getForChild(c.id)
            .where((m) => m.isPlausible && !m.date.isAfter(endOfYear))
            .toList();
        final m = childMeas.isNotEmpty ? childMeas.first : null;
        if (m == null) continue;

        total++;
        String cat = 'Normal';
        if (indicator == 'WFA') {
          cat = m.weightForAgeStatus;
        } else if (indicator == 'WFH') {
          cat = m.effectiveWastingStatus;
        } else if (indicator == 'HFA') {
          cat = m.heightForAgeStatus;
        }
        counts[cat] = (counts[cat] ?? 0) + 1;
      }

      final percents = <String, double>{};
      counts.forEach((k, v) {
        percents[k] = total > 0 ? (v / total) * 100 : 0.0;
      });

      return YearlyNutritionBreakdown(
        year: y,
        totalWeighed: total,
        counts: counts,
        percents: percents,
      );
    }).toList();
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
