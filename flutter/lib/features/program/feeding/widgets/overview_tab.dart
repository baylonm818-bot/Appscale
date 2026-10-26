import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../data/local/feeding_attendance_repository.dart';
import '../../../../data/local/feeding_enrollment_repository.dart';
import '../../../../data/local/feeding_schedule_repository.dart';
import '../../../../data/local/program_schedule_repository.dart';
import '../../../../data/local/hive_boxes.dart';
import '../../../../data/local/measurement_repository.dart';
import '../../../../data/models/measurement.dart';
import '../../../../shared/utils/app_page_route.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../set_feeding_schedule_screen.dart';

class OverviewTab extends StatelessWidget {
  const OverviewTab({super.key});

  static final _settings = SettingsRepository();
  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  @override
  Widget build(BuildContext context) {
    final enrolled = FeedingEnrollmentRepository().getEnrolledChildren(
      _currentBarangay,
    );
    final loggedDays = FeedingAttendanceRepository()
        .getLoggedDates(_currentBarangay)
        .length;
    final rate = FeedingAttendanceRepository().getAttendanceRate(
      _currentBarangay,
    );
    final feedingSchedule = FeedingScheduleRepository().get(_currentBarangay);
    final programFeedingSchedules = ProgramScheduleRepository()
        .getAllForBarangay(_currentBarangay)
        .where((s) => s.programType == 'Feeding')
        .toList();
    final fallbackProgramSchedule = programFeedingSchedules.isNotEmpty
        ? programFeedingSchedules.first
        : null;

    final measRepo = MeasurementRepository();
    final samCount = enrolled.where((c) {
      final m = measRepo.getLatestPlausible(c.id);
      if (m != null) return m.effectiveWastingStatus == 'SAM';
      final w = c.wastingStatus.trim().toUpperCase();
      return w == 'SAM' || w == 'SEVERELY WASTED';
    }).length;
    final mamCount = enrolled.where((c) {
      final m = measRepo.getLatestPlausible(c.id);
      if (m != null) return m.effectiveWastingStatus == 'MAM';
      final w = c.wastingStatus.trim().toUpperCase();
      return w == 'MAM' || w == 'MODERATELY WASTED';
    }).length;
    final recoveredCount = enrolled.where((c) {
      final m = measRepo.getLatestPlausible(c.id);
      if (m != null) return m.effectiveWastingStatus == 'Normal';
      return c.wastingStatus == 'Normal';
    }).length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Schedule', style: AppTextStyles.h2.copyWith(fontSize: 16)),
              InkWell(
                onTap: () => Navigator.push(
                  context,
                  appPageRoute(const SetFeedingScheduleScreen()),
                ),
                child: Row(
                  children: [
                    Icon(
                      feedingSchedule == null && fallbackProgramSchedule == null
                          ? Icons.add_circle_outline
                          : Icons.edit_outlined,
                      size: 14,
                      color: AppColors.primaryGreen,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      feedingSchedule == null && fallbackProgramSchedule == null
                          ? 'Set schedule'
                          : 'Edit',
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.primaryGreen,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: feedingSchedule != null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${feedingSchedule.daysSummary} · ${feedingSchedule.startTime} – ${feedingSchedule.endTime}',
                        style: AppTextStyles.label.copyWith(fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        feedingSchedule.location,
                        style: AppTextStyles.body.copyWith(fontSize: 12),
                      ),
                      Text(
                        feedingSchedule.endDate == null
                            ? 'Ongoing'
                            : 'Until ${feedingSchedule.endDate!.year}-${feedingSchedule.endDate!.month.toString().padLeft(2, '0')}-${feedingSchedule.endDate!.day.toString().padLeft(2, '0')}',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  )
                : fallbackProgramSchedule != null
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${fallbackProgramSchedule.title} · ${fallbackProgramSchedule.startTime} – ${fallbackProgramSchedule.endTime}',
                            style: AppTextStyles.label.copyWith(fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            fallbackProgramSchedule.location,
                            style: AppTextStyles.body.copyWith(fontSize: 12),
                          ),
                          Text(
                            'Scheduled for ${fallbackProgramSchedule.date.year}-${fallbackProgramSchedule.date.month.toString().padLeft(2, '0')}-${fallbackProgramSchedule.date.day.toString().padLeft(2, '0')}',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      )
                    : Text(
                        'No feeding schedule set yet.',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Program Summary',
            style: AppTextStyles.h2.copyWith(fontSize: 16),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _StatBox(
                  icon: Icons.groups_outlined,
                  iconColor: AppColors.primaryGreen,
                  value: '${enrolled.length}',
                  label: 'Enrolled Children',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _StatBox(
                  icon: Icons.event_note_outlined,
                  iconColor: AppColors.statOrange,
                  value: '$loggedDays',
                  label: 'Days Logged',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _StatBox(
            icon: Icons.check_circle_outline,
            iconColor: AppColors.statBlue,
            value: rate == null ? '—' : '${(rate * 100).round()}%',
            label: 'Attendance Rate',
            fullWidth: true,
          ),
          const SizedBox(height: AppSpacing.md),

          // SAM / MAM Reduction & Rehabilitation Tracker Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.trending_down_outlined,
                      size: 18,
                      color: AppColors.primaryGreen,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'SAM / MAM Recovery Tracker',
                      style: AppTextStyles.label.copyWith(fontSize: 13),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Monitors acute malnutrition reduction across the 120-day feeding cycle.',
                  style: AppTextStyles.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _RecoveryPill(
                        label: 'Active SAM',
                        count: samCount,
                        color: AppColors.statRed,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _RecoveryPill(
                        label: 'Active MAM',
                        count: mamCount,
                        color: AppColors.statAmber,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _RecoveryPill(
                        label: 'Recovered',
                        count: recoveredCount,
                        color: AppColors.primaryGreen,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Weight trend per child',
            style: AppTextStyles.h2.copyWith(fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            'Individual trends since enrollment — a barangay-wide average would hide who is actually improving.',
            style: AppTextStyles.body.copyWith(
              fontSize: 11,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (enrolled.isEmpty)
            const EmptyState(
              icon: Icons.child_care_outlined,
              message: 'No children enrolled yet.',
            )
          else
            ...enrolled.map(
              (c) => _WeightTrendRow(childId: c.id, childName: c.fullName),
            ),
        ],
      ),
    );
  }
}

class _RecoveryPill extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _RecoveryPill({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;
  final bool fullWidth;

  const _StatBox({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(height: 8),
          Text(value, style: AppTextStyles.h1.copyWith(fontSize: 24)),
          Text(label, style: AppTextStyles.body.copyWith(fontSize: 11)),
        ],
      ),
    );
  }
}

class _WeightTrendRow extends StatelessWidget {
  final String childId;
  final String childName;

  const _WeightTrendRow({required this.childId, required this.childName});

  @override
  Widget build(BuildContext context) {
    final enrolledDate = FeedingEnrollmentRepository().enrolledAt(childId);
    final allMeasurements = MeasurementRepository().getForChildAscending(childId);
    // Strict plausibility check: exclude any invalid measurements
    final validMeasurements = allMeasurements.where((m) => m.isPlausible).toList();

    // Filter measurements relevant to feeding program: on or close to enrollment date onwards
    List<Measurement> feedingMeasurements = validMeasurements;
    if (enrolledDate != null) {
      final enrollmentWindow = enrolledDate.subtract(const Duration(days: 14));
      final sinceEnrollment = validMeasurements
          .where((m) => !m.date.isBefore(enrollmentWindow))
          .toList();
      if (sinceEnrollment.isNotEmpty) {
        feedingMeasurements = sinceEnrollment;
      }
    }

    String trendLabel = 'No valid measurements yet';
    Color trendColor = AppColors.textMuted;
    if (feedingMeasurements.length >= 2) {
      final diff = feedingMeasurements.last.weightKg - feedingMeasurements.first.weightKg;
      trendLabel =
          '${diff >= 0 ? '+' : ''}${diff.toStringAsFixed(1)} kg since enrollment';
      trendColor = diff > 0
          ? AppColors.primaryGreen
          : (diff < 0 ? AppColors.statRed : AppColors.textMuted);
    } else if (feedingMeasurements.length == 1) {
      trendLabel = '${feedingMeasurements.first.weightKg} kg (Baseline)';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              childName,
              style: AppTextStyles.label.copyWith(fontSize: 13),
            ),
          ),
          Text(
            trendLabel,
            style: AppTextStyles.body.copyWith(
              fontSize: 11,
              color: trendColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
