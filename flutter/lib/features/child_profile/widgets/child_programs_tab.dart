import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/app_data_bus.dart';
import '../../../data/local/deworming_repository.dart';
import '../../../data/local/feeding_attendance_repository.dart';
import '../../../data/local/feeding_enrollment_repository.dart';
import '../../../data/local/vitamin_a_repository.dart';
import '../../../data/models/child.dart';
import '../../../shared/utils/app_page_route.dart';
import '../../program/deworming/record_deworming_screen.dart';
import '../../program/feeding/feeding_program_screen.dart';
import '../../program/vitamin_a/record_vitamin_a_screen.dart';

import '../../../data/local/program_schedule_repository.dart';
import '../../../data/models/program_schedule.dart';

class ChildProgramsTab extends StatefulWidget {
  final Child child;

  const ChildProgramsTab({super.key, required this.child});

  @override
  State<ChildProgramsTab> createState() => _ChildProgramsTabState();
}

class _ChildProgramsTabState extends State<ChildProgramsTab> {
  final bool _isLoading = false;
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, version, _) {
        if (_isLoading) {
          return const Center(
            child: CircularProgressIndicator(color: AppColors.primaryGreen),
          );
        }

        if (_errorMessage != null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.statRed),
                  const SizedBox(height: 12),
                  Text(
                    'Failed to load program records',
                    style: AppTextStyles.h2.copyWith(fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryGreen,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => setState(() => _errorMessage = null),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }

        try {
          final isEnrolledInFeeding = FeedingEnrollmentRepository().isEnrolled(
            widget.child.id,
          );
          final enrolledDate = FeedingEnrollmentRepository().enrolledAt(widget.child.id);
          final wasEverEnrolled = FeedingEnrollmentRepository().wasEverEnrolled(widget.child.id);
          final vitARecords = VitaminARepository().getByChildId(widget.child.id);
          final dewormingRecords = DewormingRepository().getByChildId(widget.child.id);

          // Calculate attendance
          final attRepo = FeedingAttendanceRepository();
          final loggedDates = attRepo.getLoggedDates(widget.child.barangay);
          var daysPresent = 0;
          for (final d in loggedDates) {
            final statuses = attRepo.getForDate(widget.child.barangay, d);
            if (statuses[widget.child.id] == 'Present') {
              daysPresent++;
            }
          }

          // Upcoming schedules for each program
          final upcomingSchedules = ProgramScheduleRepository().getUpcoming(widget.child.barangay);
          final nextFeeding = _findNextSchedule(upcomingSchedules, 'Feeding');
          final nextVitA = _findNextSchedule(upcomingSchedules, 'Vitamin A');
          final nextDeworming = _findNextSchedule(upcomingSchedules, 'Deworming');

          final hasAnyProgramActivity = isEnrolledInFeeding ||
              wasEverEnrolled ||
              vitARecords.isNotEmpty ||
              dewormingRecords.isNotEmpty;

          return ColoredBox(
            color: AppColors.background,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                if (!hasAnyProgramActivity) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.info_outline, color: AppColors.primaryGreen, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'No program records yet',
                                    style: AppTextStyles.h2.copyWith(fontSize: 14),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'This child has not received Vitamin A, Deworming, or Feeding enrollments yet.',
                                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryGreen,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 36),
                            elevation: 0,
                          ),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Enroll in program', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          onPressed: () async {
                            final messenger = ScaffoldMessenger.of(context);
                            await FeedingEnrollmentRepository().enroll(widget.child.id);
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('${widget.child.fullName} enrolled in Feeding Program'),
                                backgroundColor: AppColors.primaryGreen,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
                _buildServicesProvidedChecklist(
                  context,
                  isEnrolledInFeeding: isEnrolledInFeeding,
                  vitARecords: vitARecords,
                  dewormingRecords: dewormingRecords,
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildFeedingSection(
                  context,
                  isEnrolledInFeeding,
                  enrolledDate,
                  daysPresent,
                  nextSchedule: nextFeeding,
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildVitaminASection(context, vitARecords, nextSchedule: nextVitA),
                const SizedBox(height: AppSpacing.lg),
                _buildDewormingSection(context, dewormingRecords, nextSchedule: nextDeworming),
                const SizedBox(height: 48),
              ],
            ),
          );
        } catch (e) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.statRed),
                  const SizedBox(height: 12),
                  Text('Failed to load program records', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                  const SizedBox(height: 6),
                  Text('$e', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryGreen, foregroundColor: Colors.white),
                    onPressed: () => setState(() {}),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }
      },
    );
  }

  Child get child => widget.child;

  ProgramSchedule? _findNextSchedule(List<ProgramSchedule> list, String type) {
    try {
      return list.firstWhere(
        (s) => s.programType.toLowerCase() == type.toLowerCase(),
      );
    } catch (_) {
      return null;
    }
  }

  Widget _buildServicesProvidedChecklist(
    BuildContext context, {
    required bool isEnrolledInFeeding,
    required List<dynamic> vitARecords,
    required List<dynamic> dewormingRecords,
  }) {
    final hasFeeding = isEnrolledInFeeding;
    final hasVitA = vitARecords.isNotEmpty;
    final hasDeworming = dewormingRecords.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.checklist_rounded,
                  color: AppColors.primaryGreen,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Services Provided',
                      style: AppTextStyles.h2.copyWith(fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Health & nutrition intervention checklist',
                      style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(color: AppColors.border),
          _checklistTile(
            title: 'Vitamin A Supplementation',
            subtitle: hasVitA
                ? '${vitARecords.length} dose(s) recorded'
                : 'Pending / Not yet received',
            isChecked: hasVitA,
            color: AppColors.statAmber,
          ),
          _checklistTile(
            title: 'Deworming Tablet / Syrup',
            subtitle: hasDeworming
                ? '${dewormingRecords.length} round(s) recorded'
                : 'Pending / Not yet received',
            isChecked: hasDeworming,
            color: AppColors.statOrange,
          ),
          _checklistTile(
            title: 'Supplementary Feeding Program',
            subtitle: hasFeeding ? 'Currently enrolled' : 'Not enrolled',
            isChecked: hasFeeding,
            color: AppColors.primaryGreen,
          ),
          _checklistTile(
            title: 'Routine Growth Monitoring (OPT Plus)',
            subtitle: 'Regular height & weight monitoring',
            isChecked: true,
            color: AppColors.statBlue,
          ),
        ],
      ),
    );
  }

  Widget _checklistTile({
    required String title,
    required String subtitle,
    required bool isChecked,
    required Color color,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            isChecked ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: isChecked ? color : AppColors.textMuted,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isChecked ? AppColors.textPrimary : AppColors.textSecondary,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedingSection(
    BuildContext context,
    bool isEnrolled,
    DateTime? enrolledDate,
    int daysPresent, {
    ProgramSchedule? nextSchedule,
  }) {
    final repo = FeedingEnrollmentRepository();
    final wasEverEnrolled = repo.wasEverEnrolled(child.id);
    final unenrolledAt = repo.unenrolledAt(child.id);
    final unenrollReason = repo.unenrollReason(child.id);
    final history = repo.getHistory(child.id);

    final isSamOrMam =
        child.wastingStatus == 'SAM' ||
        child.wastingStatus == 'MAM' ||
        child.nutritionStatus.contains('Underweight');

    String statusLabel = 'NOT ENROLLED';
    Color statusColor = AppColors.textMuted;
    Color statusBg = AppColors.surface;

    if (isEnrolled) {
      statusLabel = 'ENROLLED';
      statusColor = AppColors.primaryGreen;
      statusBg = AppColors.primaryGreen.withValues(alpha: 0.12);
    } else if (wasEverEnrolled) {
      statusLabel = 'UNENROLLED';
      statusColor = AppColors.statAmber;
      statusBg = AppColors.statAmber.withValues(alpha: 0.12);
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.soup_kitchen_outlined,
                  color: AppColors.primaryGreen,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '120-Day Feeding Program',
                      style: AppTextStyles.h3.copyWith(fontSize: 15),
                    ),
                    Text(
                      isEnrolled
                          ? 'Active Beneficiary'
                          : (wasEverEnrolled ? 'Inactive / Unenrolled' : 'Not Currently Enrolled'),
                      style: AppTextStyles.caption.copyWith(
                        color: isEnrolled
                            ? AppColors.primaryGreen
                            : (wasEverEnrolled ? AppColors.statAmber : AppColors.textMuted),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 12),
          if (isEnrolled) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Days Attended',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$daysPresent / 120 days',
                      style: AppTextStyles.h3.copyWith(fontSize: 14),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Enrolled Since',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      enrolledDate != null
                          ? '${enrolledDate.month}/${enrolledDate.day}/${enrolledDate.year}'
                          : '—',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Status',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      child.wastingStatus,
                      style: AppTextStyles.body.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.darkGreen,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (daysPresent / 120).clamp(0.0, 1.0),
                backgroundColor: AppColors.surface,
                valueColor: const AlwaysStoppedAnimation(
                  AppColors.primaryGreen,
                ),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 36),
                      side: const BorderSide(color: AppColors.primaryGreen),
                    ),
                    icon: const Icon(
                      Icons.arrow_forward,
                      size: 14,
                      color: AppColors.primaryGreen,
                    ),
                    label: const Text(
                      'View Program',
                      style: TextStyle(color: AppColors.primaryGreen, fontSize: 12),
                    ),
                    onPressed: () {
                      Navigator.push(
                        context,
                        appPageRoute(const FeedingProgramScreen()),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 36),
                      side: const BorderSide(color: AppColors.statRed),
                    ),
                    icon: const Icon(
                      Icons.person_remove_outlined,
                      size: 14,
                      color: AppColors.statRed,
                    ),
                    label: const Text(
                      'Unenroll',
                      style: TextStyle(color: AppColors.statRed, fontSize: 12),
                    ),
                    onPressed: () => _showUnenrollDialog(context),
                  ),
                ),
              ],
            ),
          ] else if (wasEverEnrolled) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.statAmber.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.statAmber.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline, size: 14, color: AppColors.statAmber),
                      const SizedBox(width: 6),
                      Text(
                        'Previously Enrolled',
                        style: AppTextStyles.label.copyWith(
                          fontSize: 12,
                          color: AppColors.statAmber,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Unenrolled on ${unenrolledAt != null ? "${unenrolledAt.month}/${unenrolledAt.day}/${unenrolledAt.year}" : "N/A"} · Reason: ${unenrollReason ?? "Unspecified"}',
                    style: AppTextStyles.caption.copyWith(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  Text(
                    'Total past attendance: $daysPresent days recorded (preserved).',
                    style: AppTextStyles.caption.copyWith(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                if (history.isNotEmpty) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        side: const BorderSide(color: AppColors.border),
                      ),
                      icon: const Icon(Icons.history, size: 14, color: AppColors.textSecondary),
                      label: const Text('History', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      onPressed: () => _showHistoryDialog(context, history),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryGreen,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 36),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.replay_rounded, size: 14),
                    label: const Text('Re-enroll', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      await repo.enroll(child.id, notes: 'Re-enrolled by BHW');
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text('${child.fullName} re-enrolled in Feeding Program'),
                          backgroundColor: AppColors.primaryGreen,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ] else ...[
            Text(
              isSamOrMam
                  ? '⚠️ Child is flagged as ${child.wastingStatus} / ${child.nutritionStatus} and is eligible for emergency supplementary feeding.'
                  : 'Child is not enrolled in the 120-day supplementary feeding program.',
              style: AppTextStyles.caption.copyWith(
                color: isSamOrMam ? AppColors.statOrange : AppColors.textMuted,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: isSamOrMam
                    ? AppColors.darkGreen
                    : AppColors.surface,
                foregroundColor: isSamOrMam
                    ? Colors.white
                    : AppColors.darkGreen,
                minimumSize: const Size(double.infinity, 36),
                elevation: 0,
              ),
              icon: const Icon(Icons.add, size: 16),
              label: const Text(
                'Enroll in Feeding Program',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                await FeedingEnrollmentRepository().enroll(child.id);
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      '${child.fullName} enrolled in Feeding Program',
                    ),
                    backgroundColor: AppColors.primaryGreen,
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  void _showUnenrollDialog(BuildContext context) {
    String selectedReason = 'Graduated / Reached Normal Nutritional Status';
    final notesController = TextEditingController();

    const reasons = [
      'Graduated / Reached Normal Nutritional Status',
      'Transferred Residence / Barangay',
      'Caregiver Refused / Dropped Out',
      'Medical Referral / Hospitalization',
      'Age Out (> 59 months)',
      'Other Reason',
    ];

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text('Unenroll from Feeding Program', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hindi mabubura ang mga naitalang datos (attendance, timbang). Papalitan lamang ang status at itatala ang dahilan.',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 14),
                    const Text('Dahilan ng Pag-unenroll *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: selectedReason,
                          isExpanded: true,
                          style: const TextStyle(fontSize: 12, color: Colors.black87),
                          items: reasons.map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 12)))).toList(),
                          onChanged: (val) {
                            if (val != null) setDialogState(() => selectedReason = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text('Karagdagang Tala (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: notesController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        hintText: 'Hal. Lumipat sa Brgy. Poblacion noong Oct 10',
                        hintStyle: TextStyle(fontSize: 11),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.all(8),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
                  onPressed: () async {
                    Navigator.pop(dialogCtx);
                    final messenger = ScaffoldMessenger.of(context);
                    await FeedingEnrollmentRepository().unenroll(
                      child.id,
                      reason: selectedReason,
                      notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                    );
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('${child.fullName} has been unenrolled. All past records retained.'),
                        backgroundColor: AppColors.statAmber,
                      ),
                    );
                  },
                  child: const Text('Confirm Unenroll'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showHistoryDialog(BuildContext context, List<Map<String, dynamic>> history) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('${child.fullName} — Enrollment History', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        content: SizedBox(
          width: double.maxFinite,
          child: history.isEmpty
              ? const Text('Walang nakatalang history.', style: TextStyle(fontSize: 12))
              : ListView.separated(
                  shrinkWrap: true,
                  itemCount: history.length,
                  separatorBuilder: (_, _) => const Divider(height: 16),
                  itemBuilder: (context, idx) {
                    final item = history[idx];
                    final action = item['action']?.toString() ?? 'enrolled';
                    final dateStr = item['date']?.toString();
                    final parsed = dateStr != null ? DateTime.tryParse(dateStr) : null;
                    final reason = item['reason']?.toString();
                    final notes = item['notes']?.toString();

                    Color iconColor = AppColors.primaryGreen;
                    IconData iconData = Icons.check_circle_outline;
                    String title = 'Enrolled in Program';

                    if (action == 'unenrolled') {
                      iconColor = AppColors.statRed;
                      iconData = Icons.cancel_outlined;
                      title = 'Unenrolled from Program';
                    } else if (action == 're_enrolled') {
                      iconColor = Colors.blue;
                      iconData = Icons.replay;
                      title = 'Re-enrolled in Program';
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(iconData, size: 18, color: iconColor),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: iconColor)),
                              Text(
                                parsed != null ? '${parsed.month}/${parsed.day}/${parsed.year}' : (dateStr ?? ''),
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                              ),
                              if (reason != null && reason.isNotEmpty)
                                Text('Dahilan: $reason', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                              if (notes != null && notes.isNotEmpty)
                                Text('Tala: $notes', style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted)),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Widget _buildVitaminASection(
    BuildContext context,
    List<dynamic> vitARecords, {
    ProgramSchedule? nextSchedule,
  }) {
    final age = child.ageInMonths;
    final recommendedDose = VitaminARepository.determineRecommendedDosage(age);
    final lastRecord = vitARecords.isNotEmpty ? vitARecords.first : null;
    final lastDateStr = lastRecord != null
        ? '${lastRecord.dateGiven.month}/${lastRecord.dateGiven.day}/${lastRecord.dateGiven.year}'
        : null;
    final nextScheduleStr = nextSchedule != null
        ? '${nextSchedule.date.month}/${nextSchedule.date.day}/${nextSchedule.date.year}'
        : (lastRecord?.nextDueDate != null
            ? '${lastRecord!.nextDueDate!.month}/${lastRecord.nextDueDate!.day}/${lastRecord.nextDueDate!.year}'
            : null);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.statAmber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.medication_outlined,
                  color: AppColors.statAmber,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Vitamin A Supplementation',
                      style: AppTextStyles.h3.copyWith(fontSize: 15),
                    ),
                    Text(
                      'Recommended: $recommendedDose',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle, color: AppColors.darkGreen),
                tooltip: 'Record Dose',
                onPressed: () {
                  Navigator.push(
                    context,
                    appPageRoute(RecordVitaminAScreen(initialChild: child)),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Last Dose Given', style: AppTextStyles.caption.copyWith(fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    lastDateStr ?? 'None',
                    style: AppTextStyles.body.copyWith(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Next Schedule / Due', style: AppTextStyles.caption.copyWith(fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    nextScheduleStr ?? '—',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkGreen,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (vitARecords.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Center(
                child: Text(
                  'No Vitamin A records yet',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            )
          else
            ...vitARecords.map((r) {
              final dateStr =
                  '${r.dateGiven.month}/${r.dateGiven.day}/${r.dateGiven.year}';
              final isBlue = r.dosage.contains('Blue');
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: 16,
                      color: isBlue ? Colors.blue : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${r.dosage} — $dateStr (${r.doseType})',
                        style: AppTextStyles.body.copyWith(fontSize: 12),
                      ),
                    ),
                    Text(
                      'By ${r.administeredBy}',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildDewormingSection(
    BuildContext context,
    List<dynamic> dewormingRecords, {
    ProgramSchedule? nextSchedule,
  }) {
    final isEligible = DewormingRepository.isEligible(child.ageInMonths);
    final lastRecord = dewormingRecords.isNotEmpty ? dewormingRecords.first : null;
    final lastDateStr = lastRecord != null
        ? '${lastRecord.dateGiven.month}/${lastRecord.dateGiven.day}/${lastRecord.dateGiven.year}'
        : null;
    final nextScheduleStr = nextSchedule != null
        ? '${nextSchedule.date.month}/${nextSchedule.date.day}/${nextSchedule.date.year}'
        : (lastRecord?.nextDueDate != null
            ? '${lastRecord!.nextDueDate!.month}/${lastRecord.nextDueDate!.day}/${lastRecord.nextDueDate!.year}'
            : null);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.statOrange.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.healing_outlined,
                  color: AppColors.statOrange,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Deworming Program',
                      style: AppTextStyles.h3.copyWith(fontSize: 15),
                    ),
                    Text(
                      isEligible
                          ? 'Eligible for mass deworming (12-59 mos)'
                          : 'Under 12 months (Not eligible)',
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 11,
                        color: isEligible
                            ? AppColors.darkGreen
                            : AppColors.statRed,
                      ),
                    ),
                  ],
                ),
              ),
              if (isEligible)
                IconButton(
                  icon: const Icon(
                    Icons.add_circle,
                    color: AppColors.darkGreen,
                  ),
                  tooltip: 'Record Deworming',
                  onPressed: () {
                    Navigator.push(
                      context,
                      appPageRoute(RecordDewormingScreen(initialChild: child)),
                    );
                  },
                ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Last Dose Given', style: AppTextStyles.caption.copyWith(fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    lastDateStr ?? 'None',
                    style: AppTextStyles.body.copyWith(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Next Schedule / Round', style: AppTextStyles.caption.copyWith(fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    nextScheduleStr ?? '—',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkGreen,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (dewormingRecords.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Center(
                child: Text(
                  'No Deworming records yet',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            )
          else
            ...dewormingRecords.map((r) {
              final dateStr =
                  '${r.dateGiven.month}/${r.dateGiven.day}/${r.dateGiven.year}';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      size: 16,
                      color: AppColors.statOrange,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${r.drugName} — $dateStr (${r.round})',
                        style: AppTextStyles.body.copyWith(fontSize: 12),
                      ),
                    ),
                    Text(
                      'By ${r.administeredBy}',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
