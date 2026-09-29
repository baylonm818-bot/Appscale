import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/remote/beneficiary_api.dart';

class SyncStatusScreen extends StatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  State<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends State<SyncStatusScreen> {
  final _children = ChildRepository();
  final _mothers = MotherRepository();
  final _measurements = MeasurementRepository();
  final _settings = SettingsRepository();
  bool _isSyncing = false;
  String? _message;
  String _currentBarangay = '';

  @override
  void initState() {
    super.initState();
    final user = _settings.authUser;
    if (user != null && user['barangay'] != null) {
      _currentBarangay = user['barangay'].toString();
    }
  }

  /// Push any local pending records to server, then pull fresh data back
  /// from the server so the BNS always sees the most up-to-date records.
  Future<void> _syncNow() async {
    setState(() {
      _isSyncing = true;
      _message = null;
    });
    try {
      // 1. Push pending local records to server (children, mothers, measurements)
      await Future.wait([
        _children.syncPending(),
        _mothers.syncPending(),
        _measurements.syncPending(),
      ]);

      // 2. Pull fresh data from server for this barangay (re-seed)
      final token = _settings.authToken;
      if (_currentBarangay.isNotEmpty && token != null) {
        try {
          final serverChildren = await BeneficiaryApi.fetchChildrenForBarangay(
              _currentBarangay, token);
          final serverMothers = await BeneficiaryApi.fetchMothersForBarangay(
              _currentBarangay, token);

          final childBox = Hive.box(HiveBoxes.children);
          final motherBox = Hive.box(HiveBoxes.mothers);

          for (final c in serverChildren) {
            final key = (c['external_id'] ?? c['child_id']).toString();
            // Only update records that are already synced — don't overwrite local pending edits
            final existing = childBox.get(key) as Map?;
            if (existing == null || existing['_syncStatus'] == 'synced') {
              final firstName = c['first_name'] as String? ?? '';
              final middleInitial = c['middle_initial'] as String? ?? '';
              final lastName = c['last_name'] as String? ?? '';
              final fullName = [
                firstName,
                if (middleInitial.isNotEmpty) middleInitial,
                lastName,
              ].where((s) => s.isNotEmpty).join(' ');
              childBox.put(key, {
                'id': key,
                'sequenceNo': key,
                'fullName': fullName,
                'birthDate': (c['birth_date'] as String?)?.split('T').first ??
                    DateTime.now().toIso8601String(),
                'gender': c['sex'] as String? ?? 'Male',
                'address': c['purok'] as String? ?? '',
                'barangay': c['barangay'] as String? ?? _currentBarangay,
                'belongsToIpGroup': false,
                'disability': '',
                'guardian': {
                  'fullName': c['guardian_name'] as String? ?? '',
                  'relationship': 'Guardian',
                  'contactNo': c['guardian_contact'] as String? ?? '',
                  'linkedMotherId': null,
                },
                'createdAt': existing?['createdAt'] ?? DateTime.now().toIso8601String(),
                'nutritionStatus': (c['weight_status'] != null && c['weight_status'] != 'Not weighed')
                    ? c['weight_status']
                    : (existing?['nutritionStatus'] ?? 'Not weighed'),
                'stuntingStatus': (c['height_status'] != null && c['height_status'] != 'Not weighed')
                    ? c['height_status']
                    : (existing?['stuntingStatus'] ?? 'Not weighed'),
                'wastingStatus': (c['overall_status'] != null && c['overall_status'] != 'Not weighed')
                    ? c['overall_status']
                    : (existing?['wastingStatus'] ?? 'Not weighed'),
                'lastWeighedAt': c['last_visit'] != null
                    ? (c['last_visit'] as String).split('T').first
                    : existing?['lastWeighedAt'],
                'isActive': (c['status'] as String? ?? 'active') == 'active',
                'inactiveReason': null,
                '_syncStatus': 'synced',
              });
            }
          }

          for (final m in serverMothers) {
            final key = (m['external_id'] ?? m['mother_id']).toString();
            final existing = motherBox.get(key) as Map?;
            if (existing == null || existing['_syncStatus'] == 'synced') {
              final firstName = m['first_name'] as String? ?? '';
              final middleInitial = m['middle_initial'] as String? ?? '';
              final lastName = m['last_name'] as String? ?? '';
              final fullName = [
                firstName,
                if (middleInitial.isNotEmpty) middleInitial,
                lastName,
              ].where((s) => s.isNotEmpty).join(' ');
              motherBox.put(key, {
                'id': key,
                'fullName': fullName,
                'birthDate': (m['birth_date'] as String?)?.split('T').first ??
                    DateTime.now().toIso8601String(),
                'contactNo': m['contact_number'] as String? ?? '',
                'address': m['purok'] as String? ?? '',
                'barangay': m['barangay'] as String? ?? _currentBarangay,
                'linkedChildIds': existing?['linkedChildIds'] ?? <String>[],
                'isActive': (m['status'] as String? ?? 'active') == 'active',
                'inactiveReason': null,
                'createdAt': existing?['createdAt'] ?? DateTime.now().toIso8601String(),
                '_syncStatus': 'synced',
              });
            }
          }
          AppDataBus.notifyChanged();
        } catch (fetchErr) {
          debugPrint('Re-seed after sync failed (non-fatal): $fetchErr');
        }
      }

      if (!mounted) return;
      final remaining = _children.pendingCount + _mothers.pendingCount + _measurements.pendingCount;
      setState(() {
        _isSyncing = false;
        _message = remaining == 0
            ? '✓ All records synced and local data refreshed.'
            : '$remaining records still pending. Check your connection and try again.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSyncing = false;
        _message = 'Sync failed: ${e.toString().replaceFirst('Exception: ', '')}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = _currentBarangay.isNotEmpty ? _currentBarangay : 'Unknown';
    final childCount = _children.getByBarangay(current).length;
    final motherCount = _mothers
        .getAll()
        .where((m) => m.barangay == current)
        .length;
    final referralCount = ReferralRepository().getForBarangay(current).length;
    final pendingCount = _children.pendingCount + _mothers.pendingCount + _measurements.pendingCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              color: AppColors.darkGreen,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back, color: Colors.white),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Sync Status',
                    style: AppTextStyles.h2.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.statAmber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.statAmber.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            pendingCount == 0
                                ? Icons.cloud_done_outlined
                                : Icons.cloud_upload_outlined,
                            color: AppColors.primaryGreen,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              pendingCount == 0
                                  ? 'Hive records are synced with the central database.'
                                  : '$pendingCount local records are waiting to sync.',
                              style: AppTextStyles.body.copyWith(
                                fontSize: 12,
                                color: AppColors.darkGreen,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_message != null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Text(
                          _message!,
                          style: AppTextStyles.body.copyWith(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Local records',
                      style: AppTextStyles.h2.copyWith(fontSize: 15),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _row('Children', childCount,
                        synced: childCount - _children.pendingCount),
                    _row('Mothers', motherCount,
                        synced: motherCount - _mothers.pendingCount),
                    _row('Measurements', _measurements.totalCount,
                        synced: _measurements.totalCount - _measurements.pendingCount),
                    _row('Referrals', referralCount, synced: referralCount),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton.icon(
                        onPressed: _isSyncing ? null : _syncNow,
                        icon: _isSyncing
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.sync, size: 18),
                        label: Text(_isSyncing ? 'Syncing...' : 'Sync Now'),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, int count, {required int synced}) {
    final pending = count - synced < 0 ? 0 : count - synced;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTextStyles.label.copyWith(fontSize: 14)),
          Row(
            children: [
              Text(
                '$count on device',
                style: AppTextStyles.body.copyWith(fontSize: 12),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: pending > 0
                      ? AppColors.statAmber.withValues(alpha: 0.15)
                      : AppColors.lightGreenBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  pending > 0 ? '$pending pending' : '$synced synced',
                  style: AppTextStyles.body.copyWith(
                    fontSize: 10,
                    color: pending > 0
                        ? AppColors.statAmber
                        : AppColors.darkGreen,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
