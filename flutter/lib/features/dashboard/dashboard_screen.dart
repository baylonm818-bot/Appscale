import 'package:flutter/material.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/hive_boxes.dart';
import 'data/dashboard_repository.dart';
import 'widgets/dashboard_header.dart';
import 'widgets/nutrition_status_card.dart';
import 'widgets/recent_activity_card.dart';
import 'widgets/today_card.dart';
import 'widgets/upcoming_activities_card.dart';
import '../../shared/widgets/responsive_stat_grid.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/auto_graduation_service.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../program/feeding/feeding_program_screen.dart';
import '../reports/sync_status_screen.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/utils/app_user_identity.dart';

import '../../data/local/notification_repository.dart';
import '../../data/local/program_schedule_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../notifications/notifications_screen.dart';
import '../profile/user_profile_screen.dart';

import '../masterlist/widgets/masterlist_header.dart';

/// The Home tab's content only. MainShell provides the Scaffold,
/// bottom nav, and FAB — this widget just returns what goes inside.
class DashboardBody extends StatefulWidget {
  final void Function(MasterlistCategory category, {String? filterChip})?
  onNavigateToMasterlist;
  final VoidCallback? onNavigateToSchedule;

  const DashboardBody({
    super.key,
    this.onNavigateToMasterlist,
    this.onNavigateToSchedule,
  });

  @override
  State<DashboardBody> createState() => _DashboardBodyState();
}

class _DashboardBodyState extends State<DashboardBody> {
  final _dashboardRepo = DashboardRepository();
  final _activityRepo = ActivityLogRepository();
  final _notificationRepo = NotificationRepository();
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _measurementRepo = MeasurementRepository();
  final _referralRepo = ReferralRepository();
  final _settings = SettingsRepository();

  int _selectedYear = DateTime.now().year;

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';
  String get _bnsName => AppUserIdentity.resolveDisplayName(_settings.authUser);

  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _notificationRepo.seedInitialIfEmpty();
    ProgramScheduleRepository().seedInitialIfEmpty(_currentBarangay);
    AutoGraduationService().runForBarangay(_currentBarangay);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _handleCategoryTap(String statusLabel) {
    String chip = 'All';
    final lower = statusLabel.toLowerCase();
    if (lower.contains('severe')) {
      chip = 'Severe';
    } else if (lower.contains('risk') ||
        lower.contains('underweight') ||
        lower.contains('wasted') ||
        lower.contains('stunted')) {
      chip = 'At risk';
    } else if (lower.contains('overweight')) {
      chip = 'Overweight';
    } else if (lower.contains('obese')) {
      chip = 'Obese';
    } else if (lower.contains('normal')) {
      chip = 'Normal';
    }
    widget.onNavigateToMasterlist?.call(
      MasterlistCategory.children,
      filterChip: chip,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, value, childWidget) {
        final stats = _dashboardRepo.getStatCards();
        final nutrition = _dashboardRepo.getNutritionBreakdownForYear(_selectedYear);
        final activeChildren = _childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => c.isActive)
            .toList();
        final counts = _dashboardRepo.computeNutritionCountsForYear(
          activeChildren,
          _selectedYear,
        );

        final todayActivities = _dashboardRepo.getTodayActivities();
        final dueForWeighingCount = _dashboardRepo.getDueForWeighingCount();
        final upcoming = _dashboardRepo.getUpcomingActivities();
        final recent = _activityRepo.getRecent();
        final unreadNotifs = _notificationRepo.getUnreadCount();

        return RefreshIndicator(
          onRefresh: () async => AppDataBus.notifyChanged(),
          child: ListView(
            controller: _scrollController,
            padding: EdgeInsets.zero,
            children: [
              DashboardHeader(
                bnsName: _bnsName,
                barangayName: 'Barangay $_currentBarangay',
                pendingSyncCount:
                    _childRepo.pendingCount +
                    _motherRepo.pendingCount +
                    _measurementRepo.pendingCount +
                    _referralRepo.pendingCount +
                    (_settings.pendingProfilePicturePath != null ? 1 : 0) +
                    (_settings.pendingProfileUpdate != null ? 1 : 0) +
                    (_settings.pendingPasswordChange != null ? 1 : 0),
                failedSyncCount:
                    _childRepo.failedCount +
                    _motherRepo.failedCount,
                unreadNotificationCount: unreadNotifs,
                profileImageUrl:
                    _settings.authUser?['profile_picture']?.toString() ??
                    _settings.getLocalProfilePicturePath(
                      _settings.authUser?['user_id']?.toString(),
                    ),
                onSyncTap:
                    () => Navigator.push(
                      context,
                      appPageRoute(const SyncStatusScreen()),
                    ),
                onNotificationTap:
                    () => Navigator.push(
                      context,
                      appPageRoute(const NotificationsScreen()),
                    ),
                onProfileTap:
                    () => Navigator.push(
                      context,
                      appPageRoute(const UserProfileScreen()),
                    ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Stat cards (2x2) with white background & colored icon circles
                    ResponsiveStatGrid(
                      items: stats,
                      onTaps: [
                        () => widget.onNavigateToMasterlist?.call(
                          MasterlistCategory.children,
                        ),
                        () => widget.onNavigateToMasterlist?.call(
                          MasterlistCategory.mothers,
                        ),
                        () => widget.onNavigateToMasterlist?.call(
                          MasterlistCategory.children,
                          filterChip: 'Severe',
                        ),
                        () => Navigator.push(
                          context,
                          appPageRoute(const FeedingProgramScreen()),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // 2. Today Card (Activities & Due for weighing)
                    TodayCard(
                      todayActivities: todayActivities,
                      dueForWeighingCount: dueForWeighingCount,
                      onViewSchedule: () => widget.onNavigateToSchedule?.call(),
                      onWeighingTap: () => widget.onNavigateToMasterlist?.call(
                        MasterlistCategory.children,
                      ),
                    ),
                    const SizedBox(height: 14),

                    // 3. Nutritional Status (WHO) Card with Year selector, Severe callout, & By-Year chart
                    NutritionStatusCard(
                      items: nutrition,
                      severeCount: counts.severeCount,
                      selectedYear: _selectedYear,
                      onYearChanged: (y) => setState(() => _selectedYear = y),
                      onTapCategory: _handleCategoryTap,
                      getYearlyComparison: (ind) =>
                          _dashboardRepo.getYearlyNutritionComparison(ind),
                    ),
                    const SizedBox(height: 14),

                    // 4. Upcoming Activities (Nearest schedule)
                    UpcomingActivitiesCard(activities: upcoming),
                    const SizedBox(height: 14),

                    // 5. Recent Activity (Last entries)
                    RecentActivityCard(entries: recent),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
