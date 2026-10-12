import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../data/local/child_repository.dart';
import '../../../../data/local/feeding_attendance_repository.dart';
import '../../../../data/local/feeding_enrollment_repository.dart';
import '../../../../data/local/feeding_suggestion_service.dart';
import '../../../../data/local/hive_boxes.dart';
import '../../../../data/local/meal_plan_repository.dart';
import '../../../../data/models/child.dart';
import '../../../../shared/utils/app_pickers.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/empty_state.dart';

import '../../../../data/local/app_data_bus.dart';

class AttendanceTab extends StatefulWidget {
  const AttendanceTab({super.key});

  @override
  State<AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<AttendanceTab> {
  final _settings = SettingsRepository();
  final _enrollmentRepo = FeedingEnrollmentRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  DateTime _selectedDate = DateTime.now();
  Map<String, String> _draftStatuses = {};
  final Set<String> _withdrawingIds = {};

  @override
  void initState() {
    super.initState();
    AppDataBus.version.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    AppDataBus.version.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) setState(() {});
  }

  void _openEnrollSearch() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const _EnrollSearchSheet(),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showAppDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 120)),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _draftStatuses = {};
      });
    }
  }

  Future<void> _confirmWithdraw(Child child) async {
    final reasonController = TextEditingController(text: 'Completed feeding cycle');
    String selectedReason = 'Completed feeding cycle';
    final reasons = [
      'Completed feeding cycle',
      'Normal nutritional status achieved',
      'Moved to another barangay',
      'Opted out / Caregiver request',
      'Other',
    ];

    final shouldWithdraw = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Withdraw from Feeding Program'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Are you sure you want to withdraw ${child.fullName} from the Feeding Program? All historical attendance and records will remain preserved.',
                style: AppTextStyles.body.copyWith(fontSize: 13),
              ),
              const SizedBox(height: 16),
              const Text(
                'Reason for withdrawal:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                isExpanded: true,
                items: reasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 12))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() {
                      selectedReason = val;
                      reasonController.text = val;
                    });
                  }
                },
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(),
                ),
              ),
              if (selectedReason == 'Other') ...[
                const SizedBox(height: 10),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Specify reason',
                    border: OutlineInputBorder(),
                  ),
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
              child: const Text('Withdraw'),
            ),
          ],
        ),
      ),
    );

    if (shouldWithdraw == true && mounted) {
      setState(() => _withdrawingIds.add(child.id));
      try {
        await _enrollmentRepo.unenroll(child.id, reason: reasonController.text.trim());
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${child.fullName} withdrawn from program')),
        );
      } finally {
        if (mounted) setState(() => _withdrawingIds.remove(child.id));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final enrolled = _enrollmentRepo.getEnrolledChildren(_currentBarangay);
    final suggested = FeedingSuggestionService().getSuggested(_currentBarangay);
    final saved = FeedingAttendanceRepository().getForDate(
      _currentBarangay,
      _selectedDate,
    );

    // Only keep statuses for enrolled children.
    final Map<String, String> statuses = {};
    for (final c in enrolled) {
      final existingStatus = _draftStatuses[c.id] ?? saved[c.id];
      statuses[c.id] = existingStatus ?? 'Present';
    }

    // Counts must reflect ONLY currently enrolled children
    final presentCount = enrolled.where((c) => statuses[c.id] == 'Present').length;
    final absentCount = enrolled.where((c) => statuses[c.id] == 'Absent').length;
    final excusedCount = enrolled.where((c) => statuses[c.id] == 'Excused').length;

    final mealPlan = MealPlanRepository().getActiveForDate(
      _currentBarangay,
      _selectedDate,
    );
    final isToday = _isSameDay(_selectedDate, DateTime.now());

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (suggested.isNotEmpty) _SuggestedCard(children: suggested),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${enrolled.length} enrolled ${enrolled.length == 1 ? "child" : "children"}',
                style: AppTextStyles.h2.copyWith(fontSize: 15),
              ),
              InkWell(
                onTap: _openEnrollSearch,
                child: Row(
                  children: [
                    const Icon(
                      Icons.person_add_alt_1_outlined,
                      size: 14,
                      color: AppColors.primaryGreen,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Enroll Child',
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
          const SizedBox(height: AppSpacing.md),
          InkWell(
            onTap: _pickDate,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.calendar_today_outlined,
                    size: 16,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isToday
                        ? 'Today · ${_formatDate(_selectedDate)}'
                        : _formatDate(_selectedDate),
                    style: AppTextStyles.label.copyWith(fontSize: 13),
                  ),
                  const Spacer(),
                  Text(
                    'Change',
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.primaryGreen,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (mealPlan != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.lightGreenBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Meal for this day: ${mealPlan.itemsSummary}',
                style: AppTextStyles.body.copyWith(
                  fontSize: 12,
                  color: AppColors.darkGreen,
                ),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _CountBox(
                  value: '$presentCount',
                  label: 'Present',
                  color: AppColors.primaryGreen,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CountBox(
                  value: '$absentCount',
                  label: 'Absent',
                  color: AppColors.statRed,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CountBox(
                  value: '$excusedCount',
                  label: 'Excused',
                  color: AppColors.statAmber,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (enrolled.isEmpty)
            const EmptyState(
              icon: Icons.groups_outlined,
              message: 'No enrolled children yet.',
            )
          else
            ...enrolled.map(
              (c) {
                final isPending = _enrollmentRepo.isPendingSync(c.id);
                final isWithdrawing = _withdrawingIds.contains(c.id);
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    c.fullName,
                                    style: AppTextStyles.label.copyWith(fontSize: 13),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (isPending) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.statAmber.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Pending sync',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.statAmber,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          InkWell(
                            onTap: isWithdrawing ? null : () => _confirmWithdraw(c),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              child: isWithdrawing
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : Text(
                                      'Withdraw',
                                      style: AppTextStyles.body.copyWith(
                                        fontSize: 11,
                                        color: AppColors.statRed,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _statusChip(
                              'Present',
                              c.id,
                              statuses,
                              AppColors.primaryGreen,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _statusChip(
                              'Absent',
                              c.id,
                              statuses,
                              AppColors.statRed,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _statusChip(
                              'Excused',
                              c.id,
                              statuses,
                              AppColors.statAmber,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: AppSpacing.md),
          if (enrolled.isNotEmpty) ...[
            AppButton(
              label: 'Save Attendance',
              onPressed: () async {
                // Ensure only enrolled children statuses are saved
                final enrolledStatuses = <String, String>{};
                for (final c in enrolled) {
                  enrolledStatuses[c.id] = statuses[c.id] ?? 'Present';
                }
                await FeedingAttendanceRepository().saveForDate(
                  _currentBarangay,
                  _selectedDate,
                  enrolledStatuses,
                );
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Attendance saved')),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusChip(
    String label,
    String childId,
    Map<String, String> statuses,
    Color color,
  ) {
    final selected = statuses[childId] == label;
    return InkWell(
      onTap: () =>
          setState(() => _draftStatuses = {...statuses, childId: label}),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color : AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? color : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
  String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _SuggestedCard extends StatefulWidget {
  final List<Child> children;
  const _SuggestedCard({required this.children});

  @override
  State<_SuggestedCard> createState() => _SuggestedCardState();
}

class _SuggestedCardState extends State<_SuggestedCard> {
  final Set<String> _enrollingIds = {};

  Future<void> _enrollChild(Child c) async {
    setState(() => _enrollingIds.add(c.id));
    try {
      await FeedingEnrollmentRepository().enroll(c.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${c.fullName} enrolled')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not complete enrollment for ${c.fullName}'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _enrollingIds.remove(c.id));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.statRed.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.statRed.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.error_outline,
                size: 16,
                color: AppColors.statRed,
              ),
              const SizedBox(width: 6),
              Text(
                'Suggested for enrollment',
                style: TextStyle(
                  color: AppColors.statRed,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Currently malnourished, not yet in the program.',
            style: AppTextStyles.body.copyWith(
              fontSize: 11,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),
          ...widget.children.map(
            (c) {
              final isEnrolling = _enrollingIds.contains(c.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${c.fullName} · ${c.nutritionStatus == 'Normal' ? c.wastingStatus : c.nutritionStatus}',
                        style: AppTextStyles.body.copyWith(fontSize: 12),
                      ),
                    ),
                    SizedBox(
                      height: 30,
                      child: FilledButton(
                        onPressed: isEnrolling ? null : () => _enrollChild(c),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.statRed,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: isEnrolling
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Enroll',
                                style: TextStyle(fontSize: 11),
                              ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CountBox extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _CountBox({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(label, style: AppTextStyles.body.copyWith(fontSize: 10)),
        ],
      ),
    );
  }
}

class _EnrollSearchSheet extends StatefulWidget {
  const _EnrollSearchSheet();
  @override
  State<_EnrollSearchSheet> createState() => _EnrollSearchSheetState();
}

class _EnrollSearchSheetState extends State<_EnrollSearchSheet> {
  final _settings = SettingsRepository();
  final _controller = TextEditingController();
  final Set<String> _enrollingIds = {};
  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';
  late List<Child> _results;

  @override
  void initState() {
    super.initState();
    _results = ChildRepository().search(
      '',
      barangay: _currentBarangay,
      limit: 20,
    );
  }

  Future<void> _enroll(Child c) async {
    setState(() => _enrollingIds.add(c.id));
    try {
      await FeedingEnrollmentRepository().enroll(c.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${c.fullName} enrolled')),
      );
      Navigator.pop(context);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not complete enrollment for ${c.fullName}'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _enrollingIds.remove(c.id));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final notEnrolled = _results
        .where((c) => !FeedingEnrollmentRepository().isEnrolled(c.id))
        .toList();
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.sm,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Enroll a child',
            style: AppTextStyles.h2.copyWith(fontSize: 16),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _controller,
            onChanged: (q) => setState(
              () => _results = ChildRepository().search(
                q,
                barangay: _currentBarangay,
                limit: 20,
              ),
            ),
            decoration: const InputDecoration(
              hintText: 'Search child by name',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (notEnrolled.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No matching children to enroll.',
                style: AppTextStyles.body.copyWith(
                  fontSize: 12,
                  color: AppColors.textMuted,
                ),
              ),
            )
          else
            ...notEnrolled.map(
              (c) {
                final isEnrolling = _enrollingIds.contains(c.id);
                return ListTile(
                  title: Text(c.fullName),
                  subtitle: Text('${c.ageInMonths} mos · ${c.address}'),
                  trailing: FilledButton(
                    onPressed: isEnrolling ? null : () => _enroll(c),
                    child: isEnrolling
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Enroll'),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
