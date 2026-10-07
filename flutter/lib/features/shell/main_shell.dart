import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import '../../shared/widgets/main_scaffold.dart';
import '../beneficiary/add_profile_sheet.dart';
import '../dashboard/dashboard_screen.dart';
import '../masterlist/masterlist_screen.dart';
import '../program/program_screen.dart';
import '../reports/reports_home_screen.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/remote/sync_service.dart';
import '../../shared/utils/app_notifications.dart';
import '../auth/login_screen.dart';
import '../masterlist/widgets/masterlist_header.dart';

/// The single owner of the bottom nav. Add a new tab by adding one
/// entry to IndexedStack and one item in AppBottomNav — nothing else changes.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _navIndex = 0;
  final _masterlistKey = GlobalKey<MasterlistScreenState>();
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _measurementRepo = MeasurementRepository();
  final _referralRepo = ReferralRepository();
  final _settings = SettingsRepository();
  Timer? _autoSyncTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _wasOffline = false;

  void _navigateToMasterlist(MasterlistCategory category) {
    setState(() => _navIndex = 1);
    _masterlistKey.currentState?.setCategory(category);
  }

  bool get _isBns {
    final user = _settings.authUser;
    return (user?['role'] ?? '').toString().toLowerCase() == 'bns';
  }

  @override
  Widget build(BuildContext context) {
    return MainScaffold(
      currentIndex: _navIndex,
      onTabSelected: (index) => setState(() => _navIndex = index),
      isBns: _isBns,
      onAddPressed: () {
        if (_isBns) {
          AddProfileSheet.show(context);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Only BNS can add beneficiaries.'),
              backgroundColor: Color(0xFF1B5E20),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      body: IndexedStack(
        index: _navIndex,
        children: [
          DashboardBody(onNavigateToMasterlist: _navigateToMasterlist),
          MasterlistScreen(key: _masterlistKey),
          const ProgramScreen(),
          const ReportsHomeScreen(),
        ],
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Fires immediately on launch, then every 30 seconds
    Future.microtask(() async {
      await _autoSyncPending();
      await _restoreFromServer();
    });
    _autoSyncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _autoSyncPending();
    });

    // Connectivity listener: when coming back online after being offline,
    // push any pending records and pull fresh server data.
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline && _wasOffline) {
        debugPrint('[Shell] Reconnected — triggering sync pull');
        _autoSyncPending();
        _restoreFromServer();
      }
      _wasOffline = !isOnline;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoSyncTimer?.cancel();
    _connectivitySub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      _handleResume();
    }
  }

  bool _isHandlingResume = false;
  bool _isAutoSyncing = false;

  /// Pull all server data into Hive using SyncService.
  Future<void> _restoreFromServer() async {
    if (!_settings.hasValidSession) return;

    final user = _settings.authUser;
    final barangay = user?['barangay']?.toString() ?? '';
    final token = _settings.authToken;
    if (barangay.isEmpty || token == null) return;

    try {
      await SyncService.instance.pullFromServer(
        barangay: barangay,
        token: token,
      );
    } catch (e) {
      debugPrint('Auto-restore failed (offline or server error): $e');
    }
  }

  Future<void> _autoSyncPending() async {
    if (_isAutoSyncing || !_settings.hasValidSession) return;
    final totalPending = _childRepo.pendingCount +
        _motherRepo.pendingCount +
        _measurementRepo.pendingCount +
        _referralRepo.pendingCount;
    if (totalPending == 0) {
      return;
    }

    _isAutoSyncing = true;
    try {
      await _childRepo.syncPending();
      await _motherRepo.syncPending();
      await _measurementRepo.syncPending();
      await _referralRepo.syncPending();
      AppDataBus.notifyChanged();

      // Show snackbar only if some records were actually synced
      final remaining = _childRepo.pendingCount +
          _motherRepo.pendingCount +
          _measurementRepo.pendingCount +
          _referralRepo.pendingCount;
      final synced = totalPending - remaining;
      if (synced > 0 && mounted) {
        AppNotificationUI.showSuccess(
          context,
          'Synced $synced record${synced > 1 ? 's' : ''} to server.',
          title: 'Auto-Sync Completed',
        );
      }
    } catch (e) {
      debugPrint('Auto sync periodic attempt: $e');
    } finally {
      _isAutoSyncing = false;
    }
  }

  Future<void> _handleResume() async {
    if (_isHandlingResume) return;
    _isHandlingResume = true;
    try {
      // If the saved session has expired while the app was backgrounded,
      // clear and force the user back to login to avoid showing empty data.
      if (!_settings.hasValidSession) {
        await _settings.clearSession();
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (_) => false,
        );
        return;
      }

      // Always notify the UI first so it never stays blank,
      // then attempt to sync pending records in the background.
      AppDataBus.notifyChanged();
      try {
        await _childRepo.syncPending();
        await _motherRepo.syncPending();
        await _measurementRepo.syncPending();
        await _referralRepo.syncPending();
        // Refresh again after sync completes in case counts changed.
        AppDataBus.notifyChanged();
      } catch (syncErr) {
        debugPrint('Background sync error (non-fatal): $syncErr');
      }
    } finally {
      _isHandlingResume = false;
    }
  }
}
