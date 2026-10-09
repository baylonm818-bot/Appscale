import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/remote/auth_api.dart';
import '../../data/remote/sync_service.dart';
import 'package:hive_flutter/hive_flutter.dart';

class SyncStatusScreen extends StatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  State<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends State<SyncStatusScreen> {
  final _children = ChildRepository();
  final _mothers = MotherRepository();
  final _measurements = MeasurementRepository();
  final _referrals = ReferralRepository();
  final _settings = SettingsRepository();
  bool _isSyncing = false;
  List<String> _syncErrors = [];
  String? _message;
  String _currentBarangay = '';
  String? _lastSyncedAt;

  @override
  void initState() {
    super.initState();
    final user = _settings.authUser;
    if (user != null && user['barangay'] != null) {
      _currentBarangay = user['barangay'].toString();
    }
    _lastSyncedAt = Hive.box(HiveBoxes.settings).get('last_synced_at') as String?;
  }

  /// Sequential, order-aware push sync followed by cloud pull sync:
  /// 1. Children (parents)
  /// 2. Mothers (parents)
  /// 3. Measurements (dependent on children)
  /// 4. Referrals (dependent on children/mothers)
  /// 5. Profile photo (if pending)
  /// 6. Pull updated cloud state
  Future<void> _syncNow() async {
    setState(() {
      _isSyncing = true;
      _message = null;
      _syncErrors = [];
    });

    final errors = <String>[];
    try {
      // Step 1: Sync Children
      final childErrors = await _children.syncPending();
      errors.addAll(childErrors);

      // Step 2: Sync Mothers
      final motherErrors = await _mothers.syncPending();
      errors.addAll(motherErrors);

      // Step 3: Sync Measurements
      final measurementErrors = await _measurements.syncPending();
      errors.addAll(measurementErrors);

      // Step 4: Sync Referrals
      final referralErrors = await _referrals.syncPending();
      errors.addAll(referralErrors);

      // Step 5: Sync Profile Picture if pending
      final pendingPicPath = _settings.pendingProfilePicturePath;
      final userId = _settings.authUser?['user_id']?.toString() ?? '';
      final token = _settings.authToken;
      if (pendingPicPath != null && pendingPicPath.isNotEmpty && userId.isNotEmpty && token != null && token.isNotEmpty) {
        final file = File(pendingPicPath);
        if (file.existsSync()) {
          try {
            final uploaded = await AuthApi.uploadProfilePicture(
              userId: userId,
              filePath: pendingPicPath,
              token: token,
            );
            if (uploaded != null && uploaded['profile_picture'] != null) {
              final serverUser = Map<String, dynamic>.from(_settings.authUser ?? {});
              serverUser['profile_picture'] = uploaded['profile_picture'].toString();
              await _settings.setAuthUser(serverUser);
              await _settings.setPendingProfilePicturePath(null);
            }
          } catch (e) {
            errors.add('Profile picture upload failed: $e');
          }
        } else {
          await _settings.setPendingProfilePicturePath(null);
        }
      }

      // Step 6: Pull fresh data from cloud backend
      if (_currentBarangay.isNotEmpty && token != null && token.isNotEmpty) {
        final pullResult = await SyncService.instance.pullFromServer(
          barangay: _currentBarangay,
          token: token,
        );
        if (!pullResult.success && pullResult.error != null) {
          errors.add('Cloud pull failed: ${pullResult.error}');
        }
      }

      final nowIso = DateTime.now().toIso8601String();
      await Hive.box(HiveBoxes.settings).put('last_synced_at', nowIso);
      AppDataBus.notifyChanged();

      if (!mounted) return;
      final remaining = _children.pendingCount +
          _mothers.pendingCount +
          _measurements.pendingCount +
          _referrals.pendingCount +
          (_settings.pendingProfilePicturePath != null ? 1 : 0);

      setState(() {
        _isSyncing = false;
        _lastSyncedAt = nowIso;
        _syncErrors = errors;
        _message = remaining == 0 && errors.isEmpty
            ? '✓ All records successfully synced with central database.'
            : (remaining > 0
                ? '$remaining record(s) remaining in queue.'
                : 'Sync finished with warnings.');
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSyncing = false;
        _syncErrors = [...errors, 'Unexpected error: $e'];
        _message = 'Sync interrupted.';
      });
    }
  }

  String _formatLastSynced(String? iso) {
    if (iso == null || iso.isEmpty) return 'Never';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final date = '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
      final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      return '$date at $time';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, _, child) {
        final current = _currentBarangay.isNotEmpty ? _currentBarangay : 'Unknown';
        final childCount = _children.getByBarangay(current).length;
        final motherCount = _mothers
            .getAll()
            .where((m) => m.barangay == current)
            .length;
        final referralCount = _referrals.getForBarangay(current).length;
        final referralPending = _referrals.pendingCount;
        final pendingPhoto = _settings.pendingProfilePicturePath != null ? 1 : 0;
        final pendingCount = _children.pendingCount +
            _mothers.pendingCount +
            _measurements.pendingCount +
            referralPending +
            pendingPhoto;

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
                  child: RefreshIndicator(
                    onRefresh: _syncNow,
                    color: AppColors.primaryGreen,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Status Banner
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: pendingCount == 0
                                  ? AppColors.lightGreenBg
                                  : AppColors.statAmber.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: pendingCount == 0
                                    ? AppColors.primaryGreen.withValues(alpha: 0.4)
                                    : AppColors.statAmber.withValues(alpha: 0.4),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  pendingCount == 0
                                      ? Icons.cloud_done_outlined
                                      : Icons.cloud_upload_outlined,
                                  color: pendingCount == 0
                                      ? AppColors.darkGreen
                                      : AppColors.statAmber,
                                  size: 22,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        pendingCount == 0
                                            ? 'All local device records are in sync.'
                                            : '$pendingCount local record(s) waiting to sync.',
                                        style: AppTextStyles.body.copyWith(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.darkGreen,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Last synced: ${_formatLastSynced(_lastSyncedAt)}',
                                        style: AppTextStyles.caption.copyWith(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ],
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
                                  fontWeight: FontWeight.w500,
                                  color: _syncErrors.isNotEmpty
                                      ? AppColors.statAmber
                                      : AppColors.darkGreen,
                                ),
                              ),
                            ),

                          // Error details box if any errors occurred
                          if (_syncErrors.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFFCA5A5)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Row(
                                    children: [
                                      Icon(Icons.warning_amber_rounded,
                                          color: Color(0xFFDC2626), size: 16),
                                      SizedBox(width: 6),
                                      Text(
                                        'Sync Issues / Errors:',
                                        style: TextStyle(
                                          color: Color(0xFF991B1B),
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  ..._syncErrors.map(
                                    (err) => Padding(
                                      padding: const EdgeInsets.only(bottom: 4),
                                      child: Text(
                                        '• $err',
                                        style: const TextStyle(
                                          color: Color(0xFF7F1D1D),
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            'Local device records queue',
                            style: AppTextStyles.h2.copyWith(fontSize: 15),
                          ),
                          const SizedBox(height: AppSpacing.sm),

                          _row(
                            'Children',
                            childCount,
                            synced: childCount - _children.pendingCount,
                          ),
                          _row(
                            'Mothers',
                            motherCount,
                            synced: motherCount - _mothers.pendingCount,
                          ),
                          _row(
                            'Measurements',
                            _measurements.totalCount,
                            synced: _measurements.totalCount - _measurements.pendingCount,
                          ),
                          _row(
                            'Referrals',
                            referralCount,
                            synced: referralCount - referralPending,
                          ),
                          if (pendingPhoto > 0)
                            _row(
                              'Profile Photo',
                              1,
                              synced: 0,
                            ),

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
            ),
          ],
        ),
      ),
    );
      },
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
