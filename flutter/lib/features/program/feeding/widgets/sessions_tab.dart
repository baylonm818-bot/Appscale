import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../data/local/app_data_bus.dart';
import '../../../../data/local/feeding_attendance_repository.dart';
import '../../../../data/local/feeding_enrollment_repository.dart';
import '../../../../data/local/feeding_session_repository.dart';
import '../../../../data/local/hive_boxes.dart';
import '../../../../data/local/measurement_repository.dart';
import '../../../../data/models/feeding_session.dart';
import '../../../../shared/utils/app_page_route.dart';
import '../../../../shared/utils/app_pickers.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../masterlist/widgets/status_badge.dart';
import '../session_detail_screen.dart';

class SessionsTab extends StatefulWidget {
  const SessionsTab({super.key});

  @override
  State<SessionsTab> createState() => _SessionsTabState();
}

class _SessionsTabState extends State<SessionsTab> {
  final _settings = SettingsRepository();
  final _sessionRepo = FeedingSessionRepository();
  final _attendanceRepo = FeedingAttendanceRepository();
  final _enrollmentRepo = FeedingEnrollmentRepository();
  final _measurementRepo = MeasurementRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  // Filters
  int? _selectedMonth; // null = all months, 1-12
  DateTimeRange? _customDateRange;
  String _statusFilter = 'All'; // 'All', 'Completed', 'Ongoing', 'Scheduled'

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  static const _shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  static const _weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ];

  String _formatCardDate(DateTime d) {
    final wd = _weekdays[(d.weekday - 1) % 7];
    final m = _shortMonths[(d.month - 1) % 12];
    return '$wd, $m ${d.day}, ${d.year}';
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

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now.add(const Duration(days: 365)),
      initialDateRange: _customDateRange ??
          DateTimeRange(
            start: now.subtract(const Duration(days: 30)),
            end: now,
          ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primaryGreen,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _customDateRange = picked;
        _selectedMonth = null;
      });
    }
  }

  Future<void> _openNewSessionDialog() async {
    DateTime selectedDate = DateTime.now();
    final menuController = TextEditingController(
      text: 'Nutritious Hot Meal, Boiled Egg, Fruit',
    );
    String selectedStatus = 'Ongoing';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(dialogCtx).viewInsets.bottom,
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
                          'New Feeding Session',
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
                      'Session Date',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: () async {
                        final picked = await showAppDatePicker(
                          context: context,
                          initialDate: selectedDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(const Duration(days: 120)),
                        );
                        if (picked != null) {
                          setDialogState(() => selectedDate = picked);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today, size: 16, color: AppColors.primaryGreen),
                            const SizedBox(width: 8),
                            Text(
                              _formatCardDate(selectedDate),
                              style: AppTextStyles.body.copyWith(
                                fontSize: 13,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Planned Menu Items (comma-separated)',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: menuController,
                      style: AppTextStyles.body.copyWith(fontSize: 13),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Initial Status',
                      style: AppTextStyles.label.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      initialValue: selectedStatus,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: ['Completed', 'Ongoing', 'Scheduled']
                          .map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13))))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedStatus = val);
                      },
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

                          final items = menuController.text
                              .split(RegExp(r'[,•\n]+'))
                              .map((s) => s.trim())
                              .where((s) => s.isNotEmpty)
                              .toList();

                          final session = await _sessionRepo.getOrCreateForDate(
                            _currentBarangay,
                            selectedDate,
                            menuItems: items,
                          );

                          if (session.status != selectedStatus) {
                            await _sessionRepo.save(session.copyWith(status: selectedStatus));
                          }

                          nav.pop();
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Feeding session created successfully'),
                            ),
                          );
                        },
                        child: const Text(
                          'Create Session',
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

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, version, _) {
        final allSessions = _sessionRepo.getAllForBarangay(_currentBarangay);
        final enrolled = _enrollmentRepo.getEnrolledChildren(_currentBarangay);

        // Apply filters
        final filteredSessions = allSessions.where((s) {
          // Status filter
          if (_statusFilter != 'All' &&
              s.status.toLowerCase() != _statusFilter.toLowerCase()) {
            return false;
          }

          // Custom date range filter
          if (_customDateRange != null) {
            final start = DateTime(
              _customDateRange!.start.year,
              _customDateRange!.start.month,
              _customDateRange!.start.day,
            );
            final end = DateTime(
              _customDateRange!.end.year,
              _customDateRange!.end.month,
              _customDateRange!.end.day,
              23,
              59,
              59,
            );
            if (s.date.isBefore(start) || s.date.isAfter(end)) {
              return false;
            }
          }

          // Month filter
          if (_selectedMonth != null && s.date.month != _selectedMonth) {
            return false;
          }

          return true;
        }).toList();

        return RefreshIndicator(
          color: AppColors.primaryGreen,
          onRefresh: () async {
            setState(() {});
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Row with Title and + Session Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Feeding Sessions',
                          style: AppTextStyles.h2.copyWith(fontSize: 16),
                        ),
                        Text(
                          '${filteredSessions.length} session${filteredSessions.length == 1 ? '' : 's'} recorded',
                          style: AppTextStyles.caption.copyWith(fontSize: 11),
                        ),
                      ],
                    ),
                    ElevatedButton.icon(
                      onPressed: _openNewSessionDialog,
                      icon: const Icon(Icons.add, size: 16, color: Colors.white),
                      label: const Text(
                        'New Session',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        elevation: 0,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Filter Controls Bar ──
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      // Row 1: Month Dropdown & Date Range Picker Button
                      Row(
                        children: [
                          // Month Selector
                          Expanded(
                            child: Container(
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<int?>(
                                  value: _selectedMonth,
                                  isExpanded: true,
                                  hint: const Text(
                                    'All Months',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  items: [
                                    const DropdownMenuItem<int?>(
                                      value: null,
                                      child: Text(
                                        'All Months',
                                        style: TextStyle(fontSize: 12),
                                      ),
                                    ),
                                    ...List.generate(12, (idx) {
                                      final monthNum = idx + 1;
                                      return DropdownMenuItem<int?>(
                                        value: monthNum,
                                        child: Text(
                                          _months[idx],
                                          style: const TextStyle(fontSize: 12),
                                        ),
                                      );
                                    }),
                                  ],
                                  onChanged: (val) {
                                    setState(() {
                                      _selectedMonth = val;
                                      if (val != null) _customDateRange = null;
                                    });
                                  },
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Date Range Button
                          InkWell(
                            onTap: _pickDateRange,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: _customDateRange != null
                                    ? AppColors.lightGreenBg
                                    : AppColors.background,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: _customDateRange != null
                                      ? AppColors.primaryGreen
                                      : AppColors.border,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.date_range,
                                    size: 15,
                                    color: _customDateRange != null
                                        ? AppColors.darkGreen
                                        : AppColors.textMuted,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _customDateRange != null
                                        ? '${_customDateRange!.start.month}/${_customDateRange!.start.day} - ${_customDateRange!.end.month}/${_customDateRange!.end.day}'
                                        : 'Date Range',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _customDateRange != null
                                          ? AppColors.darkGreen
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                  if (_customDateRange != null) ...[
                                    const SizedBox(width: 4),
                                    GestureDetector(
                                      onTap: () {
                                        setState(() => _customDateRange = null);
                                      },
                                      child: const Icon(
                                        Icons.close,
                                        size: 13,
                                        color: AppColors.darkGreen,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Row 2: Status Filter Chips
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _StatusFilterPill(
                              label: 'All',
                              isSelected: _statusFilter == 'All',
                              onTap: () => setState(() => _statusFilter = 'All'),
                            ),
                            const SizedBox(width: 6),
                            _StatusFilterPill(
                              label: 'Completed',
                              isSelected: _statusFilter == 'Completed',
                              activeColor: AppColors.primaryGreen,
                              onTap: () => setState(() => _statusFilter = 'Completed'),
                            ),
                            const SizedBox(width: 6),
                            _StatusFilterPill(
                              label: 'Ongoing',
                              isSelected: _statusFilter == 'Ongoing',
                              activeColor: AppColors.statAmber,
                              onTap: () => setState(() => _statusFilter = 'Ongoing'),
                            ),
                            const SizedBox(width: 6),
                            _StatusFilterPill(
                              label: 'Scheduled',
                              isSelected: _statusFilter == 'Scheduled',
                              activeColor: AppColors.statPurple,
                              onTap: () => setState(() => _statusFilter = 'Scheduled'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Sessions List Cards ──
                if (filteredSessions.isEmpty)
                  const EmptyState(
                    icon: Icons.no_meals_outlined,
                    message: 'No feeding sessions yet.',
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredSessions.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final session = filteredSessions[index];
                      final attendance = _attendanceRepo.getForDate(
                        _currentBarangay,
                        session.date,
                      );

                      int present = 0;
                      int absent = 0;
                      for (final child in enrolled) {
                        final st = attendance[child.id];
                        if (st == 'Present') present++;
                        if (st == 'Absent') absent++;
                      }

                      // Check how many children weighed on this session date
                      int weighed = 0;
                      for (final child in enrolled) {
                        final list = _measurementRepo.getForChild(child.id);
                        if (list.any(
                          (m) =>
                              m.date.year == session.date.year &&
                              m.date.month == session.date.month &&
                              m.date.day == session.date.day,
                        )) {
                          weighed++;
                        }
                      }

                      return _FeedingSessionCard(
                        session: session,
                        dateText: _formatCardDate(session.date),
                        statusColor: _statusColor(session.status),
                        presentCount: present,
                        absentCount: absent,
                        weighedCount: weighed,
                        onTap: () {
                          Navigator.push(
                            context,
                            appPageRoute(
                              SessionDetailScreen(session: session),
                            ),
                          );
                        },
                      );
                    },
                  ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Session Card Widget ──

class _FeedingSessionCard extends StatelessWidget {
  final FeedingSession session;
  final String dateText;
  final Color statusColor;
  final int presentCount;
  final int absentCount;
  final int weighedCount;
  final VoidCallback onTap;

  const _FeedingSessionCard({
    required this.session,
    required this.dateText,
    required this.statusColor,
    required this.presentCount,
    required this.absentCount,
    required this.weighedCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Date & Status Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: AppColors.lightGreenBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.calendar_today_rounded,
                        size: 14,
                        color: AppColors.primaryGreen,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      dateText,
                      style: AppTextStyles.h3.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                StatusBadge(
                  label: session.status,
                  color: statusColor,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Menu Served
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.restaurant,
                  size: 14,
                  color: AppColors.primaryGreen,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    session.menuSummary,
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 10),

            // Stats Bottom Row: Present, Absent, Weighed Chips
            Row(
              children: [
                _StatBadge(
                  label: '$presentCount Present',
                  icon: Icons.check_circle_outline,
                  color: AppColors.primaryGreen,
                  bg: AppColors.lightGreenBg,
                ),
                const SizedBox(width: 6),
                _StatBadge(
                  label: '$absentCount Absent',
                  icon: Icons.cancel_outlined,
                  color: AppColors.statRed,
                  bg: AppColors.statRed.withValues(alpha: 0.08),
                ),
                const SizedBox(width: 6),
                if (weighedCount > 0)
                  _StatBadge(
                    label: '$weighedCount Weighed',
                    icon: Icons.monitor_weight_outlined,
                    color: AppColors.statBlue,
                    bg: AppColors.statBlue.withValues(alpha: 0.08),
                  ),
                const Spacer(),
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatBadge extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;

  const _StatBadge({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusFilterPill extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color activeColor;
  final VoidCallback onTap;

  const _StatusFilterPill({
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? activeColor : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
