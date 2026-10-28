import 'package:flutter/material.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/hive_boxes.dart';
import 'data/dashboard_repository.dart';
import 'widgets/dashboard_header.dart';
import 'widgets/nutrition_status_card.dart';
import 'widgets/recent_activity_card.dart';
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
  const DashboardBody({super.key, this.onNavigateToMasterlist});

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

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, value, childWidget) {
        final stats = _dashboardRepo.getStatCards();
        final nutrition = _dashboardRepo.getNutritionBreakdown();
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
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Stat cards (2x2)
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
                    const SizedBox(height: 12),
                    // 2. Nutritional Status (Weight-for-Age)
                    NutritionStatusCard(items: nutrition),
                    const SizedBox(height: 12),
                    // 3. Upcoming Activities (Nearest schedule)
                    UpcomingActivitiesCard(activities: upcoming),
                    const SizedBox(height: 12),
                    // 4. Recent Activity (Last 3 entries)
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
