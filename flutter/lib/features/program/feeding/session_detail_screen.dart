import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/app_data_bus.dart';
import '../../../data/local/feeding_attendance_repository.dart';
import '../../../data/local/feeding_enrollment_repository.dart';
import '../../../data/local/feeding_session_repository.dart';
import '../../../data/local/hive_boxes.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/feeding_session.dart';
import '../../../data/models/measurement.dart';
import '../../../shared/utils/app_page_route.dart';
import '../../child_profile/add_measurement_screen.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';

class SessionDetailScreen extends StatefulWidget {
  final FeedingSession session;

  const SessionDetailScreen({super.key, required this.session});

  @override
  State<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> {
  final _settings = SettingsRepository();
  final _sessionRepo = FeedingSessionRepository();
  final _attendanceRepo = FeedingAttendanceRepository();
  final _enrollmentRepo = FeedingEnrollmentRepository();
  final _measurementRepo = MeasurementRepository();

  late FeedingSession _currentSession;
  String _attendanceFilter = 'all'; // 'all', 'present', 'absent'

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ??
      widget.session.barangay;

  static const _shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  static const _weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ];

  String _formatDate(DateTime d) {
    final wd = _weekdays[(d.weekday - 1) % 7];
    final m = _shortMonths[(d.month - 1) % 12];
    return '$wd, $m ${d.day}, ${d.year}';
  }

  @override
  void initState() {
    super.initState();
    _currentSession = widget.session;
    AppDataBus.version.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    AppDataBus.version.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    final refreshed = _sessionRepo.getForDate(
      _currentBarangay,
      _currentSession.date,
    );
    if (refreshed != null && mounted) {
      setState(() => _currentSession = refreshed);
    } else if (mounted) {
      setState(() {});
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return AppColors.primaryGreen;
      case 'ongoing':
        return AppColors.statAmber;
      case 'scheduled':
        return AppColors.statPurple;
      default:
        return AppColors.primaryGreen;
    }
  }

  void _openEditFeedbackModal() {
    final menuController = TextEditingController(
      text: _currentSession.menuItems.join(', '),
    );
    final notesController = TextEditingController(
      text: _currentSession.feedbackNotes ?? '',
    );
    String selectedAppetite =
        _currentSession.appetite ?? 'Good (Finished meal)';
    String selectedLeftovers =
        _currentSession.leftovers ?? 'None / Clean plates';
    String selectedStatus = _currentSession.status;

    final appetiteOptions = [
      'Good (Finished meal)',
      'Fair (Moderate appetite)',
      'Poor (Low intake / Left food)',
    ];

    final leftoverOptions = [
      'None / Clean plates',
      'Minimal (<10% left)',
      'Moderate (10-30% left)',
      'Heavy (>30% left)',
    ];

    final statusOptions = ['Completed', 'Ongoing', 'Scheduled'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalContext).viewInsets.bottom,
                left: AppSpacing.lg,
                right: AppSpacing.lg,
                top: AppSpacing.lg,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Edit Session Feedback',
                          style: AppTextStyles.h2.copyWith(fontSize: 16),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 20),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Menu Items (comma-separated)',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: menuController,
                      style: AppTextStyles.body.copyWith(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'e.g. Rice, Ginisang Monggo, Boiled Egg',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Children Appetite',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      initialValue: selectedAppetite,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      items: appetiteOptions
                          .map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13))))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedAppetite = val);
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Leftovers Observed',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      initialValue: selectedLeftovers,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      items: leftoverOptions
                          .map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13))))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedLeftovers = val);
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Session Status',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      initialValue: selectedStatus,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      items: statusOptions
                          .map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13))))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedStatus = val);
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Feedback Notes / Observations',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: notesController,
                      maxLines: 3,
                      style: AppTextStyles.body.copyWith(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'e.g., Children ate enthusiastically. 2 children had second servings.',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        contentPadding: const EdgeInsets.all(12),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryGreen,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final nav = Navigator.of(ctx);

                          final parsedMenu = menuController.text
                              .split(RegExp(r'[,•\n]+'))
                              .map((s) => s.trim())
                              .where((s) => s.isNotEmpty)
                              .toList();

                          await _sessionRepo.updateFeedback(
                            barangay: _currentBarangay,
                            date: _currentSession.date,
                            menuItems: parsedMenu.isNotEmpty ? parsedMenu : null,
                            appetite: selectedAppetite,
                            leftovers: selectedLeftovers,
                            feedbackNotes: notesController.text.trim(),
                            status: selectedStatus,
                          );

                          nav.pop();
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Session feedback updated successfully'),
                            ),
                          );
                        },
                        child: const Text(
                          'Save Feedback',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showChildSessionHistory(Child child) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _ChildSessionHistorySheet(
        child: child,
        barangay: _currentBarangay,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final enrolled = _enrollmentRepo.getEnrolledChildren(_currentBarangay);
    final attendanceMap =
        _attendanceRepo.getForDate(_currentBarangay, _currentSession.date);
    final remarksMap =
        _attendanceRepo.getRemarksForDate(_currentBarangay, _currentSession.date);

    int presentCount = 0;
    int absentCount = 0;
    for (final c in enrolled) {
      final st = attendanceMap[c.id];
      if (st == 'Present') presentCount++;
      if (st == 'Absent') absentCount++;
    }

    // Measure children on session date
    int weighedCount = 0;
    for (final c in enrolled) {
      final measurements = _measurementRepo.getForChild(c.id);
      final hasMeasurement = measurements.any(
        (m) =>
            m.date.year == _currentSession.date.year &&
            m.date.month == _currentSession.date.month &&
            m.date.day == _currentSession.date.day,
      );
      if (hasMeasurement) weighedCount++;
    }

    final filteredEnrolled = enrolled.where((c) {
      final st = attendanceMap[c.id];
      if (_attendanceFilter == 'present') return st == 'Present';
      if (_attendanceFilter == 'absent') return st == 'Absent';
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _formatDate(_currentSession.date),
              style: AppTextStyles.h2.copyWith(fontSize: 16),
            ),
            Text(
              'Barangay ${_currentSession.barangay}',
              style: AppTextStyles.caption.copyWith(fontSize: 11),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.md),
            child: Center(
              child: StatusBadge(
                label: _currentSession.status,
                color: _statusColor(_currentSession.status),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quick Stat Summary Header
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _HeaderMiniStat(
                      icon: Icons.check_circle_outline,
                      color: AppColors.primaryGreen,
                      title: '$presentCount',
                      label: 'Present',
                    ),
                  ),
                  Container(height: 28, width: 1, color: AppColors.border),
                  Expanded(
                    child: _HeaderMiniStat(
                      icon: Icons.cancel_outlined,
                      color: AppColors.statRed,
                      title: '$absentCount',
                      label: 'Absent',
                    ),
                  ),
                  Container(height: 28, width: 1, color: AppColors.border),
                  Expanded(
                    child: _HeaderMiniStat(
                      icon: Icons.monitor_weight_outlined,
                      color: AppColors.statBlue,
                      title: '$weighedCount',
                      label: 'Weighed',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // ── Section 1: Menu & Session Feedback ──
            _SectionContainer(
              title: '1. Menu & Session Feedback',
              icon: Icons.restaurant_menu,
              action: TextButton.icon(
                onPressed: _openEditFeedbackModal,
                icon: const Icon(Icons.edit_outlined, size: 14, color: AppColors.primaryGreen),
                label: const Text(
                  'Edit Feedback',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryGreen,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'FOOD SERVED',
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (_currentSession.menuItems.isEmpty)
                    Text(
                      'Supplemental Nutritious Meal',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 13,
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    )
                  else
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _currentSession.menuItems.map((item) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.lightGreenBg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: AppColors.primaryGreen.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.eco_outlined,
                                size: 13,
                                color: AppColors.primaryGreen,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                item,
                                style: const TextStyle(
                                  color: AppColors.darkGreen,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: AppSpacing.md),
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: AppSpacing.md),

                  // Appetite & Leftovers Row
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'CHILDREN APPETITE',
                              style: AppTextStyles.caption.copyWith(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.sentiment_satisfied_alt,
                                  size: 16,
                                  color: AppColors.primaryGreen,
                                ),
                                const SizedBox(width: 5),
                                Expanded(
                                  child: Text(
                                    _currentSession.appetite ?? 'Good (Finished meal)',
                                    style: AppTextStyles.label.copyWith(fontSize: 12),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'LEFTOVERS',
                              style: AppTextStyles.caption.copyWith(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.no_meals_outlined,
                                  size: 16,
                                  color: AppColors.statAmber,
                                ),
                                const SizedBox(width: 5),
                                Expanded(
                                  child: Text(
                                    _currentSession.leftovers ?? 'None / Clean plates',
                                    style: AppTextStyles.label.copyWith(fontSize: 12),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  if (_currentSession.feedbackNotes != null &&
                      _currentSession.feedbackNotes!.trim().isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'OBSERVATIONS / NOTES',
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.neutralGrayBg.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _currentSession.feedbackNotes!,
                        style: AppTextStyles.body.copyWith(fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // ── Section 2: Attendance ──
            _SectionContainer(
              title: '2. Attendance Record',
              icon: Icons.checklist_rounded,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Automatically synced from the Attendance tab for ${_formatDate(_currentSession.date)}. Tap any child to view full feeding history.',
                    style: AppTextStyles.caption.copyWith(fontSize: 11),
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Segmented Filter
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _FilterChipBtn(
                          label: 'All (${enrolled.length})',
                          isSelected: _attendanceFilter == 'all',
                          onTap: () => setState(() => _attendanceFilter = 'all'),
                        ),
                        const SizedBox(width: 8),
                        _FilterChipBtn(
                          label: 'Present ($presentCount)',
                          isSelected: _attendanceFilter == 'present',
                          activeColor: AppColors.primaryGreen,
                          onTap: () => setState(() => _attendanceFilter = 'present'),
                        ),
                        const SizedBox(width: 8),
                        _FilterChipBtn(
                          label: 'Absent ($absentCount)',
                          isSelected: _attendanceFilter == 'absent',
                          activeColor: AppColors.statRed,
                          onTap: () => setState(() => _attendanceFilter = 'absent'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  if (filteredEnrolled.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                          'No children found matching "$_attendanceFilter"',
                          style: AppTextStyles.caption.copyWith(fontSize: 12),
                        ),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredEnrolled.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final child = filteredEnrolled[index];
                        final status = attendanceMap[child.id];
                        final isAbsent = status == 'Absent';
                        final isPresent = status == 'Present';
                        final reason = remarksMap[child.id];

                        return InkWell(
                          onTap: () => _showChildSessionHistory(child),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: isAbsent
                                  ? AppColors.statRed.withValues(alpha: 0.05)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isAbsent
                                    ? AppColors.statRed.withValues(alpha: 0.3)
                                    : AppColors.border,
                              ),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 17,
                                  backgroundColor: isAbsent
                                      ? AppColors.statRed.withValues(alpha: 0.12)
                                      : AppColors.lightGreenBg,
                                  child: Text(
                                    child.initials,
                                    style: TextStyle(
                                      color: isAbsent
                                          ? AppColors.statRed
                                          : AppColors.darkGreen,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        child.fullName,
                                        style: AppTextStyles.label.copyWith(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      if (isAbsent && reason != null && reason.trim().isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Text(
                                            'Reason: $reason',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontStyle: FontStyle.italic,
                                              color: AppColors.statRed.withValues(alpha: 0.9),
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        )
                                      else if (isAbsent)
                                        const Padding(
                                          padding: EdgeInsets.only(top: 2),
                                          child: Text(
                                            'Reason: No reason stated',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontStyle: FontStyle.italic,
                                              color: AppColors.textMuted,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (isPresent)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.lightGreenBg,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Present',
                                      style: TextStyle(
                                        color: AppColors.darkGreen,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 11,
                                      ),
                                    ),
                                  )
                                else if (isAbsent)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.statRed.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Absent',
                                      style: TextStyle(
                                        color: AppColors.statRed,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 11,
                                      ),
                                    ),
                                  )
                                else
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.neutralGrayBg,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Not recorded',
                                      style: TextStyle(
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.w500,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // ── Section 3: Weights ──
            _SectionContainer(
              title: '3. Weights & Nutritional Growth',
              icon: Icons.monitor_weight_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Recorded weights on ${_shortMonths[(_currentSession.date.month - 1) % 12]} ${_currentSession.date.day} with weight trend from previous measurement. Tap child to view history.',
                    style: AppTextStyles.caption.copyWith(fontSize: 11),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  if (enrolled.isEmpty)
                    const Center(
                      child: Text(
                        'No enrolled children in this barangay.',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: enrolled.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final child = enrolled[index];
                        final measurements = _measurementRepo.getForChild(child.id);

                        // Measurement on session date
                        Measurement? sessionMeasurement;
                        for (final m in measurements) {
                          if (m.date.year == _currentSession.date.year &&
                              m.date.month == _currentSession.date.month &&
                              m.date.day == _currentSession.date.day) {
                            sessionMeasurement = m;
                            break;
                          }
                        }

                        // Prior measurement strictly before session date
                        Measurement? priorMeasurement;
                        final targetMidnight = DateTime(
                          _currentSession.date.year,
                          _currentSession.date.month,
                          _currentSession.date.day,
                        );
                        for (final m in measurements) {
                          if (m.date.isBefore(targetMidnight) && m.isPlausible) {
                            priorMeasurement = m;
                            break;
                          }
                        }

                        final isPriority =
                            child.nutritionStatus == 'Severely Underweight' ||
                            child.wastingStatus == 'SAM' ||
                            child.wastingStatus == 'MAM';

                        double? weightDiff;
                        if (sessionMeasurement != null && priorMeasurement != null) {
                          weightDiff = sessionMeasurement.weightKg - priorMeasurement.weightKg;
                        }

                        return InkWell(
                          onTap: () => _showChildSessionHistory(child),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isPriority
                                  ? AppColors.statRed.withValues(alpha: 0.04)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isPriority
                                    ? AppColors.statRed.withValues(alpha: 0.25)
                                    : AppColors.border,
                              ),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: AppColors.lightGreenBg,
                                  child: Text(
                                    child.initials,
                                    style: const TextStyle(
                                      color: AppColors.darkGreen,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              child.fullName,
                                              style: AppTextStyles.label.copyWith(fontSize: 13),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          if (isPriority) ...[
                                            const SizedBox(width: 4),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 6,
                                                vertical: 2,
                                              ),
                                              decoration: BoxDecoration(
                                                color: AppColors.statRed.withValues(alpha: 0.12),
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              child: const Text(
                                                'Priority',
                                                style: TextStyle(
                                                  color: AppColors.statRed,
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 2),

                                      if (sessionMeasurement != null) ...[
                                        Row(
                                          children: [
                                            Text(
                                              '${sessionMeasurement.weightKg.toStringAsFixed(1)} kg',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            if (weightDiff != null) ...[
                                              Icon(
                                                weightDiff >= 0
                                                    ? Icons.arrow_upward_rounded
                                                    : Icons.arrow_downward_rounded,
                                                size: 13,
                                                color: weightDiff >= 0
                                                    ? AppColors.primaryGreen
                                                    : AppColors.statRed,
                                              ),
                                              Text(
                                                '${weightDiff >= 0 ? '+' : ''}${weightDiff.toStringAsFixed(1)} kg',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: weightDiff >= 0
                                                      ? AppColors.primaryGreen
                                                      : AppColors.statRed,
                                                ),
                                              ),
                                            ] else ...[
                                              const Text(
                                                '(baseline)',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: AppColors.textMuted,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        StatusBadge(
                                          label: sessionMeasurement.weightForAgeStatus,
                                          color: ChildStatusMeta.colorFor(
                                            sessionMeasurement.weightForAgeStatus,
                                          ),
                                        ),
                                      ] else ...[
                                        const Text(
                                          'Not weighed on this day',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        StatusBadge(
                                          label: child.nutritionStatus,
                                          color: ChildStatusMeta.colorFor(child.nutritionStatus),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),

                                if (sessionMeasurement == null)
                                  OutlinedButton(
                                    onPressed: () => Navigator.push(
                                      context,
                                      appPageRoute(
                                        AddMeasurementScreen(
                                          child: child,
                                          showReferralPrompt: false,
                                        ),
                                      ),
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: AppColors.primaryGreen),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    ),
                                    child: const Text(
                                      'Weigh',
                                      style: TextStyle(
                                        color: AppColors.primaryGreen,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  )
                                else
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: AppColors.lightGreenBg,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check,
                                      size: 16,
                                      color: AppColors.primaryGreen,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ── Reusable Component Containers ──

class _SectionContainer extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget? action;
  final Widget child;

  const _SectionContainer({
    required this.title,
    required this.icon,
    this.action,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primaryGreen),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.h2.copyWith(fontSize: 14),
                ),
              ),
              ?action,
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _HeaderMiniStat extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String label;

  const _HeaderMiniStat({
    required this.icon,
    required this.color,
    required this.title,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(fontSize: 10),
        ),
      ],
    );
  }
}

class _FilterChipBtn extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color activeColor;
  final VoidCallback onTap;

  const _FilterChipBtn({
    required this.label,
    required this.isSelected,
    this.activeColor = AppColors.primaryGreen,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? activeColor : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ── Child Feeding History Bottom Sheet ──

class _ChildSessionHistorySheet extends StatelessWidget {
  final Child child;
  final String barangay;

  const _ChildSessionHistorySheet({
    required this.child,
    required this.barangay,
  });

  static const _shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final sessionRepo = FeedingSessionRepository();
    final attendanceRepo = FeedingAttendanceRepository();
    final measurementRepo = MeasurementRepository();

    final allSessions = sessionRepo.getAllForBarangay(barangay);
    final measurements = measurementRepo.getForChild(child.id);

    int presentDays = 0;
    int absentDays = 0;
    final List<Map<String, dynamic>> records = [];

    for (final s in allSessions) {
      final statuses = attendanceRepo.getForDate(barangay, s.date);
      final remarks = attendanceRepo.getRemarksForDate(barangay, s.date);
      final st = statuses[child.id];

      if (st != null) {
        if (st == 'Present') presentDays++;
        if (st == 'Absent') absentDays++;

        // Check if weighed on that date
        final m = measurements.where(
          (m) =>
              m.date.year == s.date.year &&
              m.date.month == s.date.month &&
              m.date.day == s.date.day,
        ).firstOrNull;

        records.add({
          'session': s,
          'status': st,
          'remark': remarks[child.id],
          'measurement': m,
        });
      }
    }

    final totalLogged = presentDays + absentDays;
    final rate = totalLogged > 0 ? (presentDays / totalLogged) * 100 : 0.0;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.82,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Child Feeding History',
                style: AppTextStyles.h2.copyWith(fontSize: 16),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Child Overview Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.lightGreenBg.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.primaryGreen.withValues(alpha: 0.2),
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.primaryGreen,
                  child: Text(
                    child.initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        child.fullName,
                        style: AppTextStyles.h3.copyWith(fontSize: 14),
                      ),
                      Text(
                        '${child.ageInMonths} months · Brgy. ${child.barangay}',
                        style: AppTextStyles.caption.copyWith(fontSize: 11),
                      ),
                    ],
                  ),
                ),
                StatusBadge(
                  label: child.nutritionStatus,
                  color: ChildStatusMeta.colorFor(child.nutritionStatus),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Attendance Summary
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '$presentDays',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryGreen,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Present Sessions',
                        style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '$absentDays',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.statRed,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Absent Sessions',
                        style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${rate.toStringAsFixed(0)}%',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.darkGreen,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Attendance Rate',
                        style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Session Records (${records.length})',
            style: AppTextStyles.label.copyWith(fontSize: 13),
          ),
          const SizedBox(height: 8),

          Expanded(
            child: records.isEmpty
                ? const Center(
                    child: Text(
                      'No session logs recorded yet for this child.',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  )
                : ListView.separated(
                    itemCount: records.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final item = records[idx];
                      final FeedingSession s = item['session'] as FeedingSession;
                      final String st = item['status'] as String;
                      final String? remark = item['remark'] as String?;
                      final Measurement? m = item['measurement'] as Measurement?;
                      final isPresent = st == 'Present';

                      final d = s.date;
                      final dateStr =
                          '${_shortMonths[(d.month - 1) % 12]} ${d.day}, ${d.year}';

                      return Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isPresent
                              ? Colors.white
                              : AppColors.statRed.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isPresent
                                ? AppColors.border
                                : AppColors.statRed.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: isPresent
                                    ? AppColors.lightGreenBg
                                    : AppColors.statRed.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                st,
                                style: TextStyle(
                                  color: isPresent
                                      ? AppColors.darkGreen
                                      : AppColors.statRed,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    dateStr,
                                    style: AppTextStyles.label.copyWith(fontSize: 12),
                                  ),
                                  Text(
                                    s.menuSummary,
                                    style: AppTextStyles.caption.copyWith(fontSize: 11),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (!isPresent && remark != null && remark.isNotEmpty)
                                    Text(
                                      'Remark: $remark',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontStyle: FontStyle.italic,
                                        color: AppColors.statRed.withValues(alpha: 0.8),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            if (m != null)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.neutralGrayBg,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${m.weightKg.toStringAsFixed(1)} kg',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
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
    );
  }
}
