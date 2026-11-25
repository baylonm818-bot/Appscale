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
import '../../../../data/local/measurement_repository.dart';
import '../../../../data/models/child.dart';
import '../../../../shared/utils/app_notifications.dart';
import '../../../../shared/utils/app_pickers.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/mother_signature_pad.dart';

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
  Map<String, String?> _draftStatuses = {};
  Map<String, String> _draftRemarks = {};
  Map<String, String> _draftSignatures = {};
  late final TextEditingController _foodServedController;
  final Set<String> _withdrawingIds = {};
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _foodServedController = TextEditingController(
      text: FeedingAttendanceRepository().getFoodServedForDate(_currentBarangay, _selectedDate),
    );
    _draftRemarks = FeedingAttendanceRepository().getRemarksForDate(_currentBarangay, _selectedDate);
    _draftSignatures = FeedingAttendanceRepository().getSignaturesForDate(_currentBarangay, _selectedDate);
    AppDataBus.version.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    _foodServedController.dispose();
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
        _draftRemarks = FeedingAttendanceRepository().getRemarksForDate(_currentBarangay, picked);
        _draftSignatures = FeedingAttendanceRepository().getSignaturesForDate(_currentBarangay, picked);
        _foodServedController.text = FeedingAttendanceRepository().getFoodServedForDate(_currentBarangay, picked);
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
    // Issue 6: Default every child to unmarked (null), not Present.
    final Map<String, String?> statuses = {};
    for (final c in enrolled) {
      final existingStatus = _draftStatuses[c.id] ?? saved[c.id];
      statuses[c.id] = existingStatus; // null if unmarked
    }

    // Counts reflect marked enrolled children
    final presentCount = enrolled.where((c) => statuses[c.id] == 'Present').length;
    final absentCount = enrolled.where((c) => statuses[c.id] == 'Absent').length;
    final unmarkedCount = enrolled.length - presentCount - absentCount;

    final mealPlan = MealPlanRepository().getActiveForDate(
      _currentBarangay,
      _selectedDate,
    );
    final isToday = _isSameDay(_selectedDate, DateTime.now());

    final filteredEnrolled = _searchQuery.isEmpty
        ? enrolled
        : enrolled
            .where((c) =>
                c.fullName.toLowerCase().contains(_searchQuery.toLowerCase()))
            .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 120),
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
          const SizedBox(height: AppSpacing.sm),

          // Compact Header: Date and Meal in ONE card
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 16,
                      color: AppColors.primaryGreen,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isToday
                          ? 'Today · ${_formatDate(_selectedDate)}'
                          : _formatDate(_selectedDate),
                      style: AppTextStyles.label.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    const Text(
                      'Change Date',
                      style: TextStyle(
                        color: AppColors.primaryGreen,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),

          // Meal today card
          Container(
            padding: const EdgeInsets.all(14),
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
                    const Icon(Icons.restaurant_menu, size: 16, color: AppColors.primaryGreen),
                    const SizedBox(width: 8),
                    Text(
                      'Meal today',
                      style: AppTextStyles.label.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _foodServedController,
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
                    ),
                    hintText: mealPlan != null
                        ? mealPlan.itemsSummary
                        : 'Record food served today (e.g. Nutri-soup, Porridge)',
                    hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.darkGreen,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Summary: Present / Absent / Not yet marked, with a progress bar
          Container(
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
                  children: [
                    Expanded(
                      child: _SummaryBadge(
                        value: '$presentCount',
                        label: 'Present',
                        color: AppColors.primaryGreen,
                        icon: Icons.check_circle_outline,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _SummaryBadge(
                        value: '$absentCount',
                        label: 'Absent',
                        color: AppColors.statRed,
                        icon: Icons.cancel_outlined,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _SummaryBadge(
                        value: '$unmarkedCount',
                        label: 'Not yet marked',
                        color: const Color(0xFF64748B),
                        icon: Icons.help_outline,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox(
                    height: 6,
                    child: Row(
                      children: [
                        if (presentCount > 0)
                          Expanded(
                            flex: presentCount,
                            child: Container(color: AppColors.primaryGreen),
                          ),
                        if (absentCount > 0)
                          Expanded(
                            flex: absentCount,
                            child: Container(color: AppColors.statRed),
                          ),
                        if (unmarkedCount > 0)
                          Expanded(
                            flex: unmarkedCount,
                            child: Container(color: Colors.grey.shade300),
                          ),
                        if (enrolled.isEmpty)
                          Expanded(
                            child: Container(color: Colors.grey.shade200),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Search & Quick Action: Mark all present
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search child name...',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.search, size: 18),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    style: const TextStyle(fontSize: 12),
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: enrolled.isEmpty
                    ? null
                    : () {
                        final updated = Map<String, String?>.from(statuses);
                        for (final c in filteredEnrolled) {
                          updated[c.id] = 'Present';
                          _draftRemarks.remove(c.id);
                        }
                        setState(() => _draftStatuses = updated);
                      },
                icon: const Icon(Icons.done_all, size: 15),
                label: const Text(
                  'Mark all present',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.darkGreen,
                  side: const BorderSide(color: AppColors.primaryGreen),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
          else if (filteredEnrolled.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No matching child found.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ),
            )
          else
            ...filteredEnrolled.map(
              (c) {
                final isPending = _enrollmentRepo.isPendingSync(c.id);
                final isWithdrawing = _withdrawingIds.contains(c.id);
                final savedRemarks = FeedingAttendanceRepository()
                    .getRemarksForDate(_currentBarangay, _selectedDate);
                final childRemark = _draftRemarks[c.id] ?? savedRemarks[c.id];
                final currentStatus = statuses[c.id];
                final isSigned = _draftSignatures[c.id] != null ||
                    FeedingAttendanceRepository()
                        .getSignaturesForDate(_currentBarangay, _selectedDate)[c.id] !=
                        null;
                final statusLabel = c.wastingStatus.isNotEmpty
                    ? c.wastingStatus
                    : c.nutritionStatus;

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: currentStatus == 'Present'
                          ? AppColors.primaryGreen.withValues(alpha: 0.3)
                          : (currentStatus == 'Absent'
                              ? AppColors.statRed.withValues(alpha: 0.3)
                              : AppColors.border),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.lightGreenBg,
                            child: Text(
                              c.initials,
                              style: const TextStyle(
                                color: AppColors.darkGreen,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.fullName,
                                  style: AppTextStyles.label.copyWith(fontSize: 12.5),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                      decoration: BoxDecoration(
                                        color: _statusChipColor(statusLabel).withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        statusLabel,
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                          color: _statusChipColor(statusLabel),
                                        ),
                                      ),
                                    ),
                                    if (isPending) ...[
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: AppColors.statAmber.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text(
                                          'Pending',
                                          style: TextStyle(
                                            fontSize: 8.5,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.statAmber,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          // Present / Absent Toggle Buttons
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      _draftStatuses = {...statuses, c.id: 'Present'};
                                      _draftRemarks.remove(c.id);
                                    });
                                  },
                                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(7)),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: currentStatus == 'Present' ? AppColors.primaryGreen : Colors.transparent,
                                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(7)),
                                    ),
                                    child: Text(
                                      'Present',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: currentStatus == 'Present' ? Colors.white : AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                ),
                                Container(width: 1, height: 16, color: Colors.grey.shade300),
                                InkWell(
                                  onTap: () => _promptAbsentRemark(c.id, c.fullName, statuses),
                                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(7)),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: currentStatus == 'Absent' ? AppColors.statRed : Colors.transparent,
                                      borderRadius: const BorderRadius.horizontal(right: Radius.circular(7)),
                                    ),
                                    child: Text(
                                      'Absent',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: currentStatus == 'Absent' ? Colors.white : AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          PopupMenuButton<String>(
                            icon: isWithdrawing
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(
                                    Icons.more_vert,
                                    size: 18,
                                    color: AppColors.textMuted,
                                  ),
                            padding: EdgeInsets.zero,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            onSelected: (val) {
                              if (val == 'withdraw') {
                                _confirmWithdraw(c);
                              } else if (val == 'absence_history') {
                                _showAbsenceHistorySheet(context, c);
                              } else if (val == 'food_history') {
                                _showFoodHistorySheet(context, c);
                              } else if (val == 'effectiveness') {
                                _showEffectivenessSheet(context, c);
                              }
                            },
                            itemBuilder: (ctx) => [
                              const PopupMenuItem(
                                value: 'absence_history',
                                child: Row(
                                  children: [
                                    Icon(Icons.event_busy, size: 16, color: AppColors.statRed),
                                    SizedBox(width: 8),
                                    Text('Absence History', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                              const PopupMenuItem(
                                value: 'food_history',
                                child: Row(
                                  children: [
                                    Icon(Icons.restaurant, size: 16, color: AppColors.primaryGreen),
                                    SizedBox(width: 8),
                                    Text('Food History', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                              const PopupMenuItem(
                                value: 'effectiveness',
                                child: Row(
                                  children: [
                                    Icon(Icons.trending_up, size: 16, color: Color(0xFF1565C0)),
                                    SizedBox(width: 8),
                                    Text('Feeding Effectiveness', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                              const PopupMenuDivider(),
                              const PopupMenuItem(
                                value: 'withdraw',
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.person_remove_outlined,
                                      size: 16,
                                      color: AppColors.statRed,
                                    ),
                                    SizedBox(width: 8),
                                    Text(
                                      'Withdraw',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.statRed,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      if (currentStatus == 'Present') ...[
                        const SizedBox(height: 5),
                        GestureDetector(
                          onTap: () => _openSignatureDialog(c),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: isSigned ? AppColors.lightGreenBg : Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: isSigned
                                    ? AppColors.primaryGreen.withValues(alpha: 0.5)
                                    : Colors.grey.shade300,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isSigned ? Icons.check_circle : Icons.draw_outlined,
                                  size: 13,
                                  color: isSigned ? AppColors.darkGreen : AppColors.textMuted,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    isSigned
                                        ? "Mother's Signature Attached (Tap to view/re-sign)"
                                        : "Tap to sign with Mother's Signature",
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      color: isSigned ? AppColors.darkGreen : AppColors.textMuted,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Icon(Icons.edit, size: 11, color: AppColors.primaryGreen),
                              ],
                            ),
                          ),
                        ),
                      ],
                      if (currentStatus == 'Absent' && childRemark != null && childRemark.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        GestureDetector(
                          onTap: () => _promptAbsentRemark(c.id, c.fullName, statuses),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: AppColors.statRed.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.statRed.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline, size: 12, color: AppColors.statRed),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    'Reason: $childRemark',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.statRed,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Icon(Icons.edit, size: 11, color: AppColors.statRed),
                              ],
                            ),
                          ),
                        ),
                      ],
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
                final unmarkedCount = enrolled.where((c) => statuses[c.id] == null).length;
                if (unmarkedCount > 0) {
                  final proceed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Unmarked Children'),
                      content: Text(
                        'There ${unmarkedCount == 1 ? "is 1 child" : "are $unmarkedCount children"} without attendance marked. Do you want to proceed and save marked attendance?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Review List'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Save Anyway'),
                        ),
                      ],
                    ),
                  );
                  if (proceed != true) return;
                }

                // Ensure only marked enrolled children statuses are saved
                final enrolledStatuses = <String, String>{};
                for (final c in enrolled) {
                  final st = statuses[c.id];
                  if (st != null) {
                    enrolledStatuses[c.id] = st;
                  }
                }
                await FeedingAttendanceRepository().saveForDate(
                  _currentBarangay,
                  _selectedDate,
                  enrolledStatuses,
                  remarks: _draftRemarks,
                  foodServed: _foodServedController.text.trim(),
                  signatures: _draftSignatures,
                );
                if (!context.mounted) return;
                AppNotificationUI.showSuccess(
                  context,
                  'Attendance & food history saved successfully',
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _promptAbsentRemark(
    String childId,
    String childName,
    Map<String, String?> statuses,
  ) async {
    final existingRemarks = FeedingAttendanceRepository()
        .getRemarksForDate(_currentBarangay, _selectedDate);
    final currentRemark = _draftRemarks[childId] ?? existingRemarks[childId] ?? '';
    final controller = TextEditingController(text: currentRemark);
    String selectedReason = 'Sick / Not feeling well';
    final commonReasons = [
      'Sick / Not feeling well',
      'Family emergency / Travel',
      'Weather / Heavy rain',
      'Caregiver unavailable',
      'Other reason',
    ];
    if (currentRemark.isNotEmpty && commonReasons.contains(currentRemark)) {
      selectedReason = currentRemark;
    } else if (currentRemark.isNotEmpty) {
      selectedReason = 'Other reason';
    }

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Reason for Absence ($childName)',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Please specify reason for absence:',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                isExpanded: true,
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: commonReasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setDlgState(() {
                      selectedReason = val;
                      if (val != 'Other reason') {
                        controller.text = val;
                      } else {
                        controller.clear();
                      }
                    });
                  }
                },
              ),
              if (selectedReason == 'Other reason') ...[
                const SizedBox(height: 10),
                TextField(
                  controller: controller,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: 'Enter specific reason...',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, null),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
              onPressed: () {
                final remarkText = selectedReason == 'Other reason'
                    ? controller.text.trim()
                    : selectedReason;
                if (remarkText.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Please specify a reason for absence.')),
                  );
                  return;
                }
                Navigator.pop(ctx, remarkText);
              },
              child: const Text('Mark Absent'),
            ),
          ],
        ),
      ),
    );

    if (result != null && result.isNotEmpty) {
      setState(() {
        _draftStatuses = {...statuses, childId: 'Absent'};
        _draftRemarks[childId] = result;
      });
    }
  }

  Future<void> _openSignatureDialog(Child child) async {
    String? currentSig = _draftSignatures[child.id] ??
        FeedingAttendanceRepository().getSignaturesForDate(_currentBarangay, _selectedDate)[child.id];

    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          "Mother's Signature - ${child.fullName}",
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        content: SingleChildScrollView(
          child: MotherSignaturePad(
            title: "Guardian Signature for Feeding",
            initialSignature: currentSig,
            onSignatureChanged: (newSig) {
              currentSig = newSig;
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primaryGreen),
            onPressed: () {
              if (currentSig != null && currentSig!.isNotEmpty) {
                setState(() {
                  _draftSignatures[child.id] = currentSig!;
                });
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save Signature'),
          ),
        ],
      ),
    );
  }

  void _showAbsenceHistorySheet(BuildContext context, Child child) {
    final history = FeedingAttendanceRepository()
        .getAbsenceHistoryForChild(_currentBarangay, child.id);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        maxChildSize: 0.85,
        minChildSize: 0.35,
        expand: false,
        builder: (_, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.statRed.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.event_busy, color: AppColors.statRed, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Absence History', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                        Text(child.fullName, style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.statRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${history.length} Absences',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.statRed),
                    ),
                  ),
                ],
              ),
              const Divider(height: 24),
              Expanded(
                child: history.isEmpty
                    ? const Center(
                        child: Text(
                          'Perfect Attendance! No absences recorded.',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollCtrl,
                        itemCount: history.length,
                        separatorBuilder: (_, index) => const SizedBox(height: 8),
                        itemBuilder: (_, idx) {
                          final item = history[idx];
                          final d = item['date'] as DateTime;
                          final remark = item['remark'] as String;
                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.calendar_today, size: 14, color: AppColors.statRed),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        'Reason: $remark',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFoodHistorySheet(BuildContext context, Child child) {
    final history = FeedingAttendanceRepository()
        .getFoodHistoryForChild(_currentBarangay, child.id);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        maxChildSize: 0.85,
        minChildSize: 0.35,
        expand: false,
        builder: (_, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.restaurant_menu, color: AppColors.primaryGreen, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Food Intake History', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                        Text(child.fullName, style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${history.length} Feedings',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryGreen),
                    ),
                  ),
                ],
              ),
              const Divider(height: 24),
              Expanded(
                child: history.isEmpty
                    ? const Center(
                        child: Text(
                          'No feeding records yet.',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollCtrl,
                        itemCount: history.length,
                        separatorBuilder: (_, index) => const SizedBox(height: 8),
                        itemBuilder: (_, idx) {
                          final item = history[idx];
                          final d = item['date'] as DateTime;
                          final food = item['food'] as String;
                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.check_circle, size: 15, color: AppColors.primaryGreen),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        'Food Eaten: $food',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.darkGreen,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEffectivenessSheet(BuildContext context, Child child) {
    final measList = MeasurementRepository().getForChild(child.id);
    final baseline = measList.isNotEmpty ? measList.last : null;
    final latest = measList.isNotEmpty ? measList.first : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.90,
        minChildSize: 0.40,
        expand: false,
        builder: (_, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.trending_up, color: AppColors.primaryGreen, size: 22),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Feeding Effectiveness', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                        Text('${child.fullName} · Before vs After', style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 24),
              Expanded(
                child: (baseline == null || latest == null)
                    ? const Center(
                        child: Text(
                          'No anthropometric measurements recorded yet to compare effectiveness.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      )
                    : ListView(
                        controller: scrollCtrl,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.amber.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'BEFORE (Baseline)',
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${baseline.weightKg.toStringAsFixed(1)} kg',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                      Text(
                                        '${baseline.heightCm.toStringAsFixed(1)} cm',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'WFA: ${baseline.weightForAgeStatus}',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                      ),
                                      Text(
                                        'Wasting: ${baseline.effectiveWastingStatus}',
                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.green.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'AFTER (Latest)',
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${latest.weightKg.toStringAsFixed(1)} kg',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.darkGreen),
                                      ),
                                      Text(
                                        '${latest.heightCm.toStringAsFixed(1)} cm',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'WFA: ${latest.weightForAgeStatus}',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.darkGreen),
                                      ),
                                      Text(
                                        'Wasting: ${latest.effectiveWastingStatus}',
                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Net Progress / Improvement:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    Column(
                                      children: [
                                        Text(
                                          '${(latest.weightKg - baseline.weightKg) >= 0 ? "+" : ""}${(latest.weightKg - baseline.weightKg).toStringAsFixed(2)} kg',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: (latest.weightKg - baseline.weightKg) >= 0 ? AppColors.primaryGreen : AppColors.statRed,
                                          ),
                                        ),
                                        const Text('Weight Gained', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                      ],
                                    ),
                                    Column(
                                      children: [
                                        Text(
                                          '${(latest.heightCm - baseline.heightCm) >= 0 ? "+" : ""}${(latest.heightCm - baseline.heightCm).toStringAsFixed(1)} cm',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.primaryGreen,
                                          ),
                                        ),
                                        const Text('Height Growth', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusChipColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('sam') || s.contains('severely wasted') || s.contains('severely underweight')) {
      return AppColors.statRed;
    }
    if (s.contains('mam') || s.contains('moderately wasted') || s.contains('underweight') || s.contains('stunted')) {
      return AppColors.statOrange;
    }
    return AppColors.primaryGreen;
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
                    Builder(
                      builder: (ctx) {
                        final hasMeas = MeasurementRepository().getForChild(c.id).any((m) => m.isPlausible);
                        return SizedBox(
                          height: 30,
                          child: FilledButton(
                            onPressed: (!hasMeas || isEnrolling) ? null : () => _enrollChild(c),
                            style: FilledButton.styleFrom(
                              backgroundColor: hasMeas ? AppColors.statRed : AppColors.border,
                              foregroundColor: hasMeas ? Colors.white : AppColors.textMuted,
                              disabledBackgroundColor: AppColors.border,
                              disabledForegroundColor: AppColors.textMuted,
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
                                : Text(
                                    hasMeas ? 'Enroll' : 'Weigh child first',
                                    style: const TextStyle(fontSize: 11),
                                  ),
                          ),
                        );
                      },
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

class _SummaryBadge extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  final IconData icon;

  const _SummaryBadge({
    required this.value,
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 13, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
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
                final hasMeas = MeasurementRepository().getForChild(c.id).any((m) => m.isPlausible);
                return ListTile(
                  title: Text(c.fullName),
                  subtitle: Text('${c.ageInMonths} mos · ${c.address}'),
                  trailing: FilledButton(
                    style: !hasMeas
                        ? FilledButton.styleFrom(
                            backgroundColor: AppColors.border,
                            foregroundColor: AppColors.textMuted,
                            disabledBackgroundColor: AppColors.border,
                            disabledForegroundColor: AppColors.textMuted,
                          )
                        : null,
                    onPressed: (!hasMeas || isEnrolling) ? null : () => _enroll(c),
                    child: isEnrolling
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            hasMeas ? 'Enroll' : 'Weigh child first',
                            style: const TextStyle(fontSize: 11),
                          ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
