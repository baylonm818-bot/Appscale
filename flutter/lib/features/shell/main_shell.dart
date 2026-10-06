import 'dart:async';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
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
import '../../data/remote/beneficiary_api.dart';
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
    // Automatically synchronize locally stored data when internet is available
    // Fires immediately on launch, then every 30 seconds
    Future.microtask(() async {
      await _autoSyncPending();
      await _restoreFromServerIfEmpty();
    });
    _autoSyncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _autoSyncPending();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoSyncTimer?.cancel();
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

  Future<void> _restoreFromServerIfEmpty() async {
    if (!_settings.hasValidSession) return;
    if (_childRepo.getAll().isNotEmpty || _motherRepo.getAll().isNotEmpty) return;

    final user = _settings.authUser;
    final barangay = user?['barangay']?.toString() ?? '';
    final token = _settings.authToken;
    if (barangay.isEmpty || token == null) return;

    try {
      final results = await Future.wait([
        BeneficiaryApi.fetchChildrenForBarangay(barangay, token),
        BeneficiaryApi.fetchMothersForBarangay(barangay, token),
        BeneficiaryApi.fetchReferralsForBarangay(barangay, token),
        BeneficiaryApi.fetchSchedulesForBarangay(barangay, token),
        BeneficiaryApi.fetchNotificationsForBarangay(barangay, token),
      ]);

      final children      = results[0];
      final mothers       = results[1];
      final referrals     = results[2];
      final schedules     = results[3];
      final notifications = results[4];

      final childBox       = Hive.box(HiveBoxes.children);
      final motherBox      = Hive.box(HiveBoxes.mothers);
      final referralBox    = Hive.box(HiveBoxes.referrals);
      final scheduleBox    = Hive.box(HiveBoxes.programSchedule);
      final notifBox       = Hive.box(HiveBoxes.notifications);
      final measurementBox = Hive.box(HiveBoxes.measurements);

      for (final c in children) {
        final key = (c['external_id'] ?? c['child_id']).toString();
        final firstName = c['first_name'] as String? ?? '';
        final middleInitial = c['middle_initial'] as String? ?? '';
        final lastName = c['last_name'] as String? ?? '';
        final fullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
            .where((s) => s.isNotEmpty)
            .join(' ');
        childBox.put(key, {
          'id': key,
          'sequenceNo': key,
          'fullName': fullName,
          'birthDate': (c['birth_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
          'gender': c['sex'] as String? ?? 'Male',
          'address': c['purok'] as String? ?? '',
          'barangay': c['barangay'] as String? ?? barangay,
          'belongsToIpGroup': false,
          'disability': '',
          'guardian': {
            'fullName': c['guardian_name'] as String? ?? '',
            'relationship': 'Guardian',
            'contactNo': c['guardian_contact'] as String? ?? '',
            'linkedMotherId': null,
          },
          'createdAt': DateTime.now().toIso8601String(),
          'nutritionStatus': c['weight_status'] ?? 'Not weighed',
          'stuntingStatus': c['height_status'] ?? 'Not weighed',
          'wastingStatus': c['overall_status'] ?? 'Not weighed',
          'lastWeighedAt': c['last_visit'] != null
              ? (c['last_visit'] as String).split('T').first
              : null,
          'isActive': (c['status'] as String? ?? 'active') == 'active',
          'inactiveReason': null,
          '_syncStatus': 'synced',
        });

        if (c['weight_status'] != null || c['height_status'] != null || c['last_weight'] != null) {
          final mKey = 'm_${key}_initial';
          final weight = (c['last_weight'] as num?)?.toDouble() ?? 0.0;
          final height = (c['last_height'] as num?)?.toDouble() ?? 0.0;
          final dateStr = c['last_visit'] != null
              ? (c['last_visit'] as String).split('T').first
              : DateTime.now().toIso8601String().split('T').first;
          measurementBox.put(mKey, {
            'childId': key,
            'date': dateStr,
            'weightKg': weight,
            'heightCm': height,
            'muacCm': null,
            'bilateralPittingEdema': false,
            'weightForAgeStatus': c['weight_status'] ?? 'Normal',
            'heightForAgeStatus': c['height_status'] ?? 'Normal',
            'weightForLengthStatus': c['overall_status'] ?? 'Normal',
            'customBmi': null,
            'customBmiStatus': null,
            '_syncStatus': 'synced',
          });
        }
      }

      for (final m in mothers) {
        final key = (m['external_id'] ?? m['mother_id']).toString();
        final firstName = m['first_name'] as String? ?? '';
        final middleInitial = m['middle_initial'] as String? ?? '';
        final lastName = m['last_name'] as String? ?? '';
        final fullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
            .where((s) => s.isNotEmpty)
            .join(' ');
        motherBox.put(key, {
          'id': key,
          'fullName': fullName,
          'birthDate': (m['birth_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
          'contactNo': m['contact_number'] as String? ?? '',
          'address': m['purok'] as String? ?? '',
          'barangay': m['barangay'] as String? ?? barangay,
          'linkedChildIds': <String>[],
          'isActive': (m['status'] as String? ?? 'active') == 'active',
          'inactiveReason': null,
          'createdAt': DateTime.now().toIso8601String(),
          '_syncStatus': 'synced',
        });
      }

      for (final r in referrals) {
        final key = r['referral_id']?.toString() ?? '';
        if (key.isEmpty) continue;
        referralBox.put(key, {
          'id': key,
          'beneficiaryId': (r['child_id'] ?? r['mother_id'])?.toString() ?? '',
          'beneficiaryType': r['beneficiary_type'] as String? ?? 'child',
          'beneficiaryName': '${r['beneficiary_first_name'] ?? ''} ${r['beneficiary_last_name'] ?? ''}'.trim(),
          'barangay': r['barangay'] as String? ?? barangay,
          'facility': r['referred_to']?.toString() ?? '',
          'reason': r['reason'] as String? ?? '',
          'notes': r['response_notes'] as String? ?? '',
          'status': r['status'] as String? ?? 'Pending',
          'createdAt': r['created_at'] as String? ?? DateTime.now().toIso8601String(),
          '_syncStatus': 'synced',
        });
      }

      for (final s in schedules) {
        final key = s['schedule_id']?.toString() ?? '';
        if (key.isEmpty) continue;
        scheduleBox.put(key, {
          'id': key,
          'title': s['title'] as String? ?? 'Activity',
          'programType': s['schedule_type'] as String? ?? 'feeding',
          'date': (s['schedule_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
          'startTime': s['schedule_time'] as String? ?? '08:00 AM',
          'location': s['venue'] as String? ?? 'Health Center',
          'barangay': s['barangay'] as String? ?? barangay,
          'notes': s['notes'] as String? ?? '',
          'status': s['status'] as String? ?? 'pending',
          '_syncStatus': 'synced',
        });
      }

      for (final n in notifications) {
        final key = n['notification_id']?.toString() ?? n['id']?.toString() ?? '';
        if (key.isEmpty) continue;
        notifBox.put(key, {
          'id': key,
          'title': n['title'] as String? ?? 'Notification',
          'message': n['message'] as String? ?? '',
          'type': n['type'] as String? ?? 'general',
          'referralId': null,
          'timestamp': (n['created_at'] as String?) ?? DateTime.now().toIso8601String(),
          'isRead': (n['is_read'] as int? ?? 0) == 1,
        });
      }

      AppDataBus.notifyChanged();
      debugPrint('Auto-restored ${children.length} children, ${mothers.length} mothers, ${referrals.length} referrals, ${schedules.length} schedules, ${notifications.length} notifications from cloud database.');
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
      await _restoreFromServerIfEmpty();
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
