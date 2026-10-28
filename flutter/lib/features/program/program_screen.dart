import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/program_schedule_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/models/program_schedule.dart';
import '../../shared/utils/app_date_format.dart';
import '../../shared/utils/app_page_route.dart';
import '../referrals/referrals_overview_screen.dart';
import 'counseling/lactating_mothers_counseling_screen.dart';
import 'deworming/deworming_screen.dart';
import 'feeding/feeding_program_screen.dart';
import 'schedule/add_program_schedule_screen.dart';
import 'vitamin_a/vitamin_a_screen.dart';
import 'widgets/program_tile.dart';

class ProgramScreen extends StatefulWidget {
  final String barangay;
  final VoidCallback? onNavigateToHome;

  const ProgramScreen({
    super.key,
    this.barangay = 'Tiguion',
    this.onNavigateToHome,
  });

  @override
  State<ProgramScreen> createState() => _ProgramScreenState();
}

class _ProgramScreenState extends State<ProgramScreen> {
  bool _showingPrograms = true;
  DateTime _calendarMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime? _selectedCalendarDay;
  String _selectedFilter = 'All';
  final _scheduleRepo = ProgramScheduleRepository();
  final _settings = SettingsRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? widget.barangay;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, version, childWidget) {
        return Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: const BoxDecoration(
                color: AppColors.darkGreen,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      InkWell(
                        onTap: () {
                          if (widget.onNavigateToHome != null) {
                            widget.onNavigateToHome!();
                          } else if (Navigator.canPop(context)) {
                            Navigator.pop(context);
                          }
                        },
                        child: const Icon(Icons.arrow_back, color: Colors.white),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Programs & Schedule',
                          style: AppTextStyles.h1.copyWith(
                            color: Colors.white,
                            fontSize: 20,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(child: _segment('Programs', true)),
                        Expanded(child: _segment('Schedule', false)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _showingPrograms
                  ? SingleChildScrollView(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: _buildProgramsList(context),
                    )
                  : _buildScheduleView(context),
            ),
          ],
        );
      },
    );
  }

  Widget _segment(String label, bool value) {
    final isSelected = _showingPrograms == value;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _showingPrograms = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? AppColors.darkGreen : Colors.white,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildProgramsList(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.darkGreen,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Manage and Monitor nutrition programs in your barangay.',
                style: AppTextStyles.h2.copyWith(
                  color: Colors.white,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Track participation, schedule activities, and view coverage.',
                style: AppTextStyles.body.copyWith(
                  color: Colors.white70,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ProgramTile(
          icon: Icons.soup_kitchen_outlined,
          iconColor: AppColors.primaryGreen,
          title: 'Feeding Program Management',
          subtitle:
              'Manage feeding activities and monitor child participation.',
          onTap: () => Navigator.push(
            context,
            appPageRoute(const FeedingProgramScreen()),
          ),
        ),
        const Divider(color: AppColors.border),
        Builder(
          builder: (context) {
            final pendingReferralsCount = ReferralRepository()
                .getForBarangay(_currentBarangay)
                .where((r) => r.isPending)
                .length;
            return ProgramTile(
              icon: Icons.local_hospital_outlined,
              iconColor: const Color(0xFFD23369),
              title: 'Referral Monitoring',
              subtitle: pendingReferralsCount > 0
                  ? '$pendingReferralsCount pending referrals awaiting response.'
                  : 'Monitor referred children and mothers and their follow-up status.',
              onTap: () => Navigator.push(
                context,
                appPageRoute(ReferralsOverviewScreen(
                  initialFilter: pendingReferralsCount > 0 ? 'Pending' : 'Ongoing',
                )),
              ),
            );
          },
        ),
        const Divider(color: AppColors.border),
        ProgramTile(
          icon: Icons.medication_outlined,
          iconColor: AppColors.statAmber,
          title: 'Vitamin A Program',
          subtitle: 'Manage Vitamin A supplementation and schedules.',
          onTap: () => Navigator.push(
            context,
            appPageRoute(VitaminAScreen(barangay: widget.barangay)),
          ),
        ),
        const Divider(color: AppColors.border),
        ProgramTile(
          icon: Icons.healing_outlined,
          iconColor: AppColors.statOrange,
          title: 'Deworming Program',
          subtitle: 'Schedule deworming activities and track coverage.',
          onTap: () => Navigator.push(
            context,
            appPageRoute(DewormingScreen(barangay: widget.barangay)),
          ),
        ),
        const Divider(color: AppColors.border),
        ProgramTile(
          icon: Icons.pregnant_woman_outlined,
          iconColor: const Color(0xFF6C5CE7),
          title: 'Maternal Counseling for Lactating Mothers',
          subtitle: 'Monitor counseling sessions and nutrition support for mothers.',
          onTap: () => Navigator.push(
            context,
            appPageRoute(
              LactatingMothersCounselingScreen(barangay: _currentBarangay),
            ),
          ),
        ),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildScheduleView(BuildContext context) {
    final allSchedules = _scheduleRepo.getAllForBarangay(_currentBarangay);
    final filtered = _selectedFilter == 'All'
        ? allSchedules
        : allSchedules.where((s) => s.programType == _selectedFilter).toList();

    return Column(
      children: [
        // Action Bar & Filters
        Container(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          color: AppColors.surface,
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Program Schedules',
                    style: AppTextStyles.h2.copyWith(fontSize: 16),
                  ),
                  Row(
                    children: [
                      
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.darkGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text(
                          'Set',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        onPressed: () async {
                          final createdType = await Navigator.push<String>(
                            context,
                            appPageRoute(
                              AddProgramScheduleScreen(
                                prefillProgramType: _selectedFilter == 'All'
                                    ? 'Feeding'
                                    : _selectedFilter,
                              ),
                            ),
                          );
                          if (mounted && createdType != null) {
                            setState(() {
                              _selectedFilter = createdType;
                            });
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children:
                      [
                        'All',
                        'Feeding',
                        'Vitamin A',
                        'Deworming',
                        'OPT Plus',
                      ].map((filter) {
                        final isSel = _selectedFilter == filter;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            selected: isSel,
                            label: Text(filter),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              color: isSel
                                  ? Colors.white
                                  : AppColors.textPrimary,
                              fontWeight: isSel
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                            backgroundColor: Colors.white,
                            selectedColor: AppColors.darkGreen,
                            checkmarkColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: isSel
                                    ? AppColors.darkGreen
                                    : AppColors.border,
                              ),
                            ),
                            onSelected: (_) =>
                                setState(() => _selectedFilter = filter),
                          ),
                        );
                      }).toList(),
                ),
              ),
            ],
          ),
        ),

        // Schedules View (Calendar only)
        Expanded(
          child: _buildCalendarView(filtered),
        ),
      ],
    );
  }

  Widget _buildCalendarView(List<ProgramSchedule> schedules) {
    final year = _calendarMonth.year;
    final month = _calendarMonth.month;
    final firstDayOfMonth = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final leadingEmptyDays = (firstDayOfMonth.weekday % 7); // 0=Sun, 1=Mon...

    final monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Selected day schedules or all month schedules
    final selectedDay = _selectedCalendarDay;
    final selectedDaySchedules = selectedDay == null
        ? schedules.where((s) => s.date.year == year && s.date.month == month).toList()
        : schedules.where((s) =>
            s.date.year == selectedDay.year &&
            s.date.month == selectedDay.month &&
            s.date.day == selectedDay.day).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Month navigation header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left, color: AppColors.darkGreen),
                  onPressed: () {
                    setState(() {
                      _calendarMonth = DateTime(year, month - 1, 1);
                      _selectedCalendarDay = null;
                    });
                  },
                ),
                Text(
                  '${monthNames[month - 1]} $year',
                  style: AppTextStyles.h2.copyWith(fontSize: 15, color: AppColors.textPrimary),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, color: AppColors.darkGreen),
                  onPressed: () {
                    setState(() {
                      _calendarMonth = DateTime(year, month + 1, 1);
                      _selectedCalendarDay = null;
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Days of week header
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) {
                return SizedBox(
                  width: 38,
                  child: Text(
                    d,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: d == 'Sun' ? AppColors.statRed : AppColors.textSecondary,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 6),

          // Calendar Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: leadingEmptyDays + daysInMonth,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 4,
              mainAxisSpacing: 4,
              childAspectRatio: 0.95,
            ),
            itemBuilder: (context, index) {
              if (index < leadingEmptyDays) {
                return const SizedBox.shrink();
              }
              final dayNum = index - leadingEmptyDays + 1;
              final cellDate = DateTime(year, month, dayNum);
              final isToday = DateTime.now().year == year &&
                  DateTime.now().month == month &&
                  DateTime.now().day == dayNum;
              final isSelected = selectedDay != null &&
                  selectedDay.year == year &&
                  selectedDay.month == month &&
                  selectedDay.day == dayNum;

              final daySchedules = schedules.where((s) =>
                  s.date.year == year &&
                  s.date.month == month &&
                  s.date.day == dayNum).toList();

              return InkWell(
                onTap: () {
                  setState(() {
                    if (isSelected) {
                      _selectedCalendarDay = null; // Unselect to see all month
                    } else {
                      _selectedCalendarDay = cellDate;
                    }
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.darkGreen
                        : (isToday
                            ? AppColors.primaryGreen.withValues(alpha: 0.15)
                            : Colors.white),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.darkGreen
                          : (isToday ? AppColors.primaryGreen : AppColors.border),
                      width: isToday || isSelected ? 1.5 : 0.8,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isToday || isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected
                              ? Colors.white
                              : (isToday ? AppColors.primaryGreen : AppColors.textPrimary),
                        ),
                      ),
                      if (daySchedules.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: daySchedules.take(3).map((s) {
                            Color dotColor;
                            switch (s.programType) {
                              case 'Feeding':
                                dotColor = AppColors.primaryGreen;
                                break;
                              case 'Vitamin A':
                                dotColor = AppColors.statAmber;
                                break;
                              case 'Deworming':
                                dotColor = AppColors.statOrange;
                                break;
                              default:
                                dotColor = Colors.blueAccent;
                            }
                            return Container(
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.white : dotColor,
                                shape: BoxShape.circle,
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),

          // Selected Day or Month Events Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                selectedDay != null
                    ? 'Events for ${monthNames[selectedDay.month - 1]} ${selectedDay.day}, ${selectedDay.year}'
                    : 'Events in ${monthNames[month - 1]} $year',
                style: AppTextStyles.h3.copyWith(fontSize: 14),
              ),
              if (selectedDay != null)
                TextButton(
                  onPressed: () => setState(() => _selectedCalendarDay = null),
                  child: const Text('Show all month', style: TextStyle(fontSize: 11)),
                ),
            ],
          ),
          const SizedBox(height: 8),

          if (selectedDaySchedules.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              alignment: Alignment.center,
              child: Text(
                'No scheduled activities on this date.',
                style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
              ),
            )
          else
            ...selectedDaySchedules.map((s) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildScheduleCard(s),
                )),
        ],
      ),
    );
  }

  Widget _buildScheduleCard(ProgramSchedule s) {
    Color typeColor;
    IconData typeIcon;
    switch (s.programType) {
      case 'Feeding':
        typeColor = AppColors.primaryGreen;
        typeIcon = Icons.soup_kitchen_outlined;
        break;
      case 'Vitamin A':
        typeColor = AppColors.statAmber;
        typeIcon = Icons.medication_outlined;
        break;
      case 'Deworming':
        typeColor = AppColors.statOrange;
        typeIcon = Icons.healing_outlined;
        break;
      default:
        typeColor = Colors.blueAccent;
        typeIcon = Icons.calendar_today_outlined;
    }

    final monthStr = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][s.date.month - 1];

    final isWebAdmin =
        s.createdBy.contains('Web') || s.createdBy.contains('RHU');

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Date Badge
          Container(
            width: 52,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: typeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                Text(
                  monthStr.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: typeColor,
                  ),
                ),
                Text(
                  '${s.date.day}',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: typeColor,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: typeColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(typeIcon, size: 11, color: typeColor),
                          const SizedBox(width: 3),
                          Text(
                            s.programType,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: typeColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    if (isWebAdmin)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.indigo.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'RHU Web Admin',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: Colors.indigo,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(s.title, style: AppTextStyles.h3.copyWith(fontSize: 15)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.access_time,
                      size: 12,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      AppDateFormat.formatTimeRange(s.startTime, s.endTime),
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                    const SizedBox(width: 12),
                    const Icon(
                      Icons.location_on_outlined,
                      size: 12,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        s.location,
                        style: AppTextStyles.caption.copyWith(fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (s.targetGroup.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Target: ${s.readableTargetGroup}',
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 11,
                      color: AppColors.darkGreen,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
                if (s.notes.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    s.notes,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
