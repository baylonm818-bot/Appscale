import 'dart:io';
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
import '../../data/models/child.dart';
import '../../data/models/mother.dart';
import '../../data/models/measurement.dart';
import '../../data/models/referral.dart';
import '../../data/remote/auth_api.dart';
import '../../data/remote/beneficiary_api.dart';
import '../../data/remote/sync_service.dart';

class SyncItem {
  final String id;
  final String type; // 'child', 'mother', 'measurement', 'referral', 'vitamin_a', 'profile_photo'
  final String title;
  final String subtitle;
  final String status; // 'synced', 'pending', 'failed'
  final DateTime timestamp;
  final String? error;

  const SyncItem({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.timestamp,
    this.error,
  });
}

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

  List<SyncItem> _loadSyncItems() {
    final items = <SyncItem>[];
    final current = _currentBarangay;

    // 1. Children
    final childBox = Hive.box(HiveBoxes.children);
    for (final raw in childBox.values) {
      if (raw is! Map) continue;
      final map = Map<String, dynamic>.from(raw);
      final b = map['barangay']?.toString() ?? '';
      if (current.isNotEmpty && b.isNotEmpty && b != current) continue;

      final status = map['_syncStatus']?.toString() ?? 'synced';
      final name = map['fullName']?.toString() ?? 'Child';
      final error = map['_lastSyncError']?.toString();
      final timeStr = map['_syncedAt'] ?? map['updatedAt'] ?? map['createdAt'];
      DateTime dt;
      try {
        dt = timeStr != null ? DateTime.parse(timeStr.toString()) : DateTime.now();
      } catch (_) {
        dt = DateTime.now();
      }

      String title;
      if (status == 'synced') {
        title = 'Child record synced';
      } else if (status == 'failed') {
        title = 'Child record sync failed';
      } else {
        title = 'Child record pending';
      }

      items.add(SyncItem(
        id: map['id']?.toString() ?? '',
        type: 'child',
        title: title,
        subtitle: name,
        status: status,
        timestamp: dt,
        error: error,
      ));
    }

    // 2. Mothers
    final motherBox = Hive.box(HiveBoxes.mothers);
    for (final raw in motherBox.values) {
      if (raw is! Map) continue;
      final map = Map<String, dynamic>.from(raw);
      final b = map['barangay']?.toString() ?? '';
      if (current.isNotEmpty && b.isNotEmpty && b != current) continue;

      final status = map['_syncStatus']?.toString() ?? 'synced';
      final name = map['fullName']?.toString() ?? 'Mother';
      final error = map['_lastSyncError']?.toString();
      final timeStr = map['_syncedAt'] ?? map['updatedAt'] ?? map['createdAt'];
      DateTime dt;
      try {
        dt = timeStr != null ? DateTime.parse(timeStr.toString()) : DateTime.now();
      } catch (_) {
        dt = DateTime.now();
      }

      String title;
      if (status == 'synced') {
        title = 'Mother record synced';
      } else if (status == 'failed') {
        title = 'Mother record sync failed';
      } else {
        title = 'Mother record pending';
      }

      items.add(SyncItem(
        id: map['id']?.toString() ?? '',
        type: 'mother',
        title: title,
        subtitle: name,
        status: status,
        timestamp: dt,
        error: error,
      ));
    }

    // 3. Measurements
    final measurementBox = Hive.box(HiveBoxes.measurements);
    for (final key in measurementBox.keys) {
      final childId = key.toString();
      final childRaw = childBox.get(childId);
      String childName = 'Child #$childId';
      if (childRaw is Map && childRaw['fullName'] != null) {
        final b = childRaw['barangay']?.toString() ?? '';
        if (current.isNotEmpty && b.isNotEmpty && b != current) continue;
        childName = childRaw['fullName'].toString();
      }

      final list = (measurementBox.get(childId) as List?) ?? [];
      for (final raw in list) {
        if (raw is! Map) continue;
        final map = Map<String, dynamic>.from(raw);
        final status = map['_syncStatus']?.toString() ?? 'synced';
        final error = map['_lastSyncError']?.toString();
        final timeStr = map['_syncedAt'] ?? map['date'];
        DateTime dt;
        try {
          dt = timeStr != null ? DateTime.parse(timeStr.toString()) : DateTime.now();
        } catch (_) {
          dt = DateTime.now();
        }

        String title;
        if (status == 'synced') {
          title = 'Measurement synced';
        } else if (status == 'failed') {
          title = 'Measurement sync failed';
        } else {
          title = 'Measurement pending';
        }

        final w = map['weightKg'] != null ? '${map['weightKg']}kg' : '';
        final h = map['heightCm'] != null ? '${map['heightCm']}cm' : '';
        final metrics = [w, h].where((s) => s.isNotEmpty).join(', ');
        final sub = metrics.isNotEmpty ? '$childName ($metrics)' : childName;

        items.add(SyncItem(
          id: '${childId}_${map['date']}',
          type: 'measurement',
          title: title,
          subtitle: sub,
          status: status,
          timestamp: dt,
          error: error,
        ));
      }
    }

    // 4. Referrals
    final referralBox = Hive.box(HiveBoxes.referrals);
    for (final raw in referralBox.values) {
      if (raw is! Map) continue;
      final map = Map<String, dynamic>.from(raw);
      final b = map['barangay']?.toString() ?? '';
      if (current.isNotEmpty && b.isNotEmpty && b != current) continue;

      final status = map['_syncStatus']?.toString() ?? 'synced';
      final name = map['beneficiaryName']?.toString() ?? 'Beneficiary';
      final error = map['_lastSyncError']?.toString();
      final timeStr = map['_syncedAt'] ?? map['createdAt'];
      DateTime dt;
      try {
        dt = timeStr != null ? DateTime.parse(timeStr.toString()) : DateTime.now();
      } catch (_) {
        dt = DateTime.now();
      }

      String title;
      if (status == 'synced') {
        title = 'Referral synced';
      } else if (status == 'failed') {
        title = 'Referral sync failed';
      } else {
        title = 'Referral pending';
      }

      items.add(SyncItem(
        id: map['id']?.toString() ?? '',
        type: 'referral',
        title: title,
        subtitle: name,
        status: status,
        timestamp: dt,
        error: error,
      ));
    }

    // 5. Vitamin A records
    final vitaminABox = Hive.box(HiveBoxes.vitaminA);
    for (final raw in vitaminABox.values) {
      if (raw is! Map) continue;
      final map = Map<String, dynamic>.from(raw);
      final b = map['barangay']?.toString() ?? '';
      if (current.isNotEmpty && b.isNotEmpty && b != current) continue;

      final status = map['_syncStatus']?.toString() ?? 'synced';
      final name = map['childName']?.toString() ?? 'Child';
      final error = map['_lastSyncError']?.toString();
      final timeStr = map['_syncedAt'] ?? map['dateGiven'] ?? map['createdAt'];
      DateTime dt;
      try {
        dt = timeStr != null ? DateTime.parse(timeStr.toString()) : DateTime.now();
      } catch (_) {
        dt = DateTime.now();
      }

      String title;
      if (status == 'synced') {
        title = 'Vitamin A record synced';
      } else if (status == 'failed') {
        title = 'Vitamin A record sync failed';
      } else {
        title = 'Vitamin A record pending';
      }

      final dose = map['dosage']?.toString() ?? '';
      final sub = dose.isNotEmpty ? '$name ($dose)' : name;

      items.add(SyncItem(
        id: map['id']?.toString() ?? '',
        type: 'vitamin_a',
        title: title,
        subtitle: sub,
        status: status,
        timestamp: dt,
        error: error,
      ));
    }

    // 6. Profile Photo
    final pendingPicPath = _settings.pendingProfilePicturePath;
    if (pendingPicPath != null && pendingPicPath.isNotEmpty) {
      final userName = _settings.authUser?['first_name'] ?? _settings.authUser?['username'] ?? 'User';
      items.add(SyncItem(
        id: 'profile_photo',
        type: 'profile_photo',
        title: 'Profile photo pending',
        subtitle: userName.toString(),
        status: 'pending',
        timestamp: DateTime.now(),
      ));
    }

    // Behavior: Pinakabago ang nasa itaas (Newest first)
    // Pending and failed records appear prominently at the top
    items.sort((a, b) {
      if (a.status != 'synced' && b.status == 'synced') return -1;
      if (a.status == 'synced' && b.status != 'synced') return 1;
      return b.timestamp.compareTo(a.timestamp);
    });

    return items;
  }

  /// Sequential, item-by-item push sync updating UI in real-time
  Future<void> _syncNow() async {
    setState(() {
      _isSyncing = true;
      _message = 'Syncing records...';
      _syncErrors = [];
    });

    final errors = <String>[];
    try {
      // Step 1: Sync Children one by one
      final childBox = Hive.box(HiveBoxes.children);
      for (final raw in List.from(childBox.values)) {
        if (raw is! Map) continue;
        final map = Map<String, dynamic>.from(raw);
        if (map['_syncStatus'] != 'synced') {
          final child = Child.fromMap(map);
          final res = await _children.trySync(child);
          if (res != null && !res.success) {
            errors.add('${child.fullName}: ${res.message}');
          }
          if (mounted) setState(() {});
          await Future.delayed(const Duration(milliseconds: 100));
        }
      }

      // Step 2: Sync Mothers one by one
      final motherBox = Hive.box(HiveBoxes.mothers);
      for (final raw in List.from(motherBox.values)) {
        if (raw is! Map) continue;
        final map = Map<String, dynamic>.from(raw);
        if (map['_syncStatus'] != 'synced') {
          final mother = Mother.fromMap(map);
          final res = await _mothers.trySync(mother);
          if (res != null && !res.success) {
            errors.add('${mother.fullName}: ${res.message}');
          }
          if (mounted) setState(() {});
          await Future.delayed(const Duration(milliseconds: 100));
        }
      }

      // Step 3: Sync Measurements one by one
      final measurementBox = Hive.box(HiveBoxes.measurements);
      for (final key in List.from(measurementBox.keys)) {
        final childId = key.toString();
        final list = (measurementBox.get(childId) as List?) ?? [];
        bool anyUpdated = false;
        final updated = <dynamic>[];

        for (final raw in list) {
          if (raw is! Map) {
            updated.add(raw);
            continue;
          }
          final map = Map<String, dynamic>.from(raw);
          if (map['_syncStatus'] != 'synced') {
            final m = Measurement.fromMap(map);
            final res = await BeneficiaryApi.syncNutritionRecord(childId, m);
            if (res.success) {
              map['_syncStatus'] = 'synced';
              map['_syncedAt'] = DateTime.now().toIso8601String();
              map.remove('_lastSyncError');
              map['_retryCount'] = 0;
            } else {
              map['_syncStatus'] = 'failed';
              map['_lastSyncError'] = res.message;
              map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
              errors.add('Measurement ($childId): ${res.message}');
            }
            anyUpdated = true;
            updated.add(map);
            await measurementBox.put(childId, updated);
            if (mounted) setState(() {});
            await Future.delayed(const Duration(milliseconds: 100));
          } else {
            updated.add(map);
          }
        }
        if (anyUpdated) {
          await measurementBox.put(childId, updated);
        }
      }

      // Step 4: Sync Referrals one by one
      final referralBox = Hive.box(HiveBoxes.referrals);
      for (final raw in List.from(referralBox.values)) {
        if (raw is! Map) continue;
        final map = Map<String, dynamic>.from(raw);
        if (map['_syncStatus'] != 'synced') {
          final referral = Referral.fromMap(map);
          final res = await _referrals.trySync(referral);
          if (res != null && !res.success) {
            errors.add('${referral.beneficiaryName}: ${res.message}');
          }
          if (mounted) setState(() {});
          await Future.delayed(const Duration(milliseconds: 100));
        }
      }

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
              await _settings.setPendingProfilePicturePath(null, userId: userId);
            }
          } catch (e) {
            errors.add('Profile picture upload failed: $e');
          }
        } else {
          await _settings.setPendingProfilePicturePath(null, userId: userId);
        }
        if (mounted) setState(() {});
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

      ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
      if (errors.isEmpty && remaining == 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ All records successfully synced with server.'),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 3),
          ),
        );
      } else if (errors.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sync finished with ${errors.length} issue(s). Check details below.'),
            backgroundColor: AppColors.statRed,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$remaining item(s) remaining in sync queue.'),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSyncing = false;
        _syncErrors = [...errors, 'Unexpected error: $e'];
        _message = 'Sync interrupted.';
      });
      ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sync failed: $e'),
          backgroundColor: AppColors.statRed,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  Future<void> _retryItem(SyncItem item) async {
    setState(() => _isSyncing = true);
    try {
      if (item.type == 'child') {
        final raw = Hive.box(HiveBoxes.children).get(item.id);
        if (raw is Map) {
          final child = Child.fromMap(Map<String, dynamic>.from(raw));
          final res = await _children.trySync(child);
          if (mounted && res != null && !res.success) {
            ScaffoldMessenger.maybeOf(context)?.showSnackBar(
              SnackBar(content: Text('Retry failed: ${res.message}'), backgroundColor: AppColors.statRed),
            );
          }
        }
      } else if (item.type == 'mother') {
        final raw = Hive.box(HiveBoxes.mothers).get(item.id);
        if (raw is Map) {
          final mother = Mother.fromMap(Map<String, dynamic>.from(raw));
          final res = await _mothers.trySync(mother);
          if (mounted && res != null && !res.success) {
            ScaffoldMessenger.maybeOf(context)?.showSnackBar(
              SnackBar(content: Text('Retry failed: ${res.message}'), backgroundColor: AppColors.statRed),
            );
          }
        }
      } else if (item.type == 'referral') {
        final raw = Hive.box(HiveBoxes.referrals).get(item.id);
        if (raw is Map) {
          final referral = Referral.fromMap(Map<String, dynamic>.from(raw));
          final res = await _referrals.trySync(referral);
          if (mounted && res != null && !res.success) {
            ScaffoldMessenger.maybeOf(context)?.showSnackBar(
              SnackBar(content: Text('Retry failed: ${res.message}'), backgroundColor: AppColors.statRed),
            );
          }
        }
      } else if (item.type == 'measurement') {
        final parts = item.id.split('_');
        if (parts.isNotEmpty) {
          final childId = parts[0];
          final measurementBox = Hive.box(HiveBoxes.measurements);
          final list = (measurementBox.get(childId) as List?) ?? [];
          final updated = <dynamic>[];
          for (final raw in list) {
            if (raw is Map) {
              final map = Map<String, dynamic>.from(raw);
              if (item.id == '${childId}_${map['date']}') {
                final m = Measurement.fromMap(map);
                final res = await BeneficiaryApi.syncNutritionRecord(childId, m);
                if (res.success) {
                  map['_syncStatus'] = 'synced';
                  map['_syncedAt'] = DateTime.now().toIso8601String();
                  map.remove('_lastSyncError');
                  map['_retryCount'] = 0;
                } else {
                  map['_syncStatus'] = 'failed';
                  map['_lastSyncError'] = res.message;
                }
              }
              updated.add(map);
            }
          }
          await measurementBox.put(childId, updated);
        }
      } else if (item.type == 'profile_photo') {
        final pendingPicPath = _settings.pendingProfilePicturePath;
        final userId = _settings.authUser?['user_id']?.toString() ?? '';
        final token = _settings.authToken;
        if (pendingPicPath != null && userId.isNotEmpty && token != null) {
          final uploaded = await AuthApi.uploadProfilePicture(userId: userId, filePath: pendingPicPath, token: token);
          if (uploaded != null && uploaded['profile_picture'] != null) {
            final serverUser = Map<String, dynamic>.from(_settings.authUser ?? {});
            serverUser['profile_picture'] = uploaded['profile_picture'].toString();
            await _settings.setAuthUser(serverUser);
            await _settings.setPendingProfilePicturePath(null, userId: userId);
          }
        }
      }
      AppDataBus.notifyChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(content: Text('Retry failed: $e'), backgroundColor: AppColors.statRed),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
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

  String _formatSyncTime(DateTime dt, String status) {
    if (status == 'pending') {
      return 'Pending';
    }
    final now = DateTime.now();
    final local = dt.toLocal();
    final isToday = local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = local.year == yesterday.year &&
        local.month == yesterday.month &&
        local.day == yesterday.day;

    final hour = local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    final timeStr = '$hour:$minute $period';

    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[local.month - 1]} ${local.day}';
    }
  }

  Widget _buildSyncItemTile(SyncItem item) {
    Color iconColor;
    IconData iconData;
    Color statusBg;

    if (item.status == 'synced') {
      iconColor = AppColors.primaryGreen;
      iconData = Icons.check_circle_rounded;
      statusBg = AppColors.lightGreenBg;
    } else if (item.status == 'failed') {
      iconColor = AppColors.statRed;
      iconData = Icons.error_outline_rounded;
      statusBg = const Color(0xFFFEF2F2);
    } else {
      iconColor = AppColors.statAmber;
      iconData = Icons.access_time_rounded;
      statusBg = AppColors.statAmber.withValues(alpha: 0.12);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: item.status == 'failed'
              ? const Color(0xFFFCA5A5)
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: statusBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(iconData, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: AppTextStyles.label.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle,
                      style: AppTextStyles.body.copyWith(
                        fontSize: 12,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _formatSyncTime(item.timestamp, item.status),
                style: AppTextStyles.caption.copyWith(
                  fontSize: 11,
                  color: item.status == 'pending'
                      ? AppColors.statAmber
                      : AppColors.textMuted,
                  fontWeight: item.status == 'pending' ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
          if (item.status == 'failed') ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      item.error ?? 'Upload failed.',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF991B1B),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 28,
                    child: OutlinedButton(
                      onPressed: _isSyncing ? null : () => _retryItem(item),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.statRed,
                        side: const BorderSide(color: AppColors.statRed),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      child: const Text(
                        'Retry',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, _, child) {
        final referralPending = _referrals.pendingCount;
        final pendingPhoto = _settings.pendingProfilePicturePath != null ? 1 : 0;
        final pendingCount = _children.pendingCount +
            _mothers.pendingCount +
            _measurements.pendingCount +
            referralPending +
            pendingPhoto;

        final syncItems = _loadSyncItems();

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

                          // Reserved status line space so layout never jumps
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpacing.sm),
                            child: SizedBox(
                              height: 22,
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  _message ??
                                      (pendingCount == 0
                                          ? '✓ All records synchronized.'
                                          : '$pendingCount record(s) remaining in queue.'),
                                  style: AppTextStyles.body.copyWith(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: _syncErrors.isNotEmpty
                                        ? AppColors.statRed
                                        : (_message == null && pendingCount == 0
                                            ? AppColors.textMuted
                                            : AppColors.darkGreen),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
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
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Local device records',
                                style: AppTextStyles.h2.copyWith(fontSize: 15),
                              ),
                              Text(
                                '${syncItems.length} records',
                                style: AppTextStyles.caption.copyWith(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),

                          // Notification-style list of synced/pending/failed items
                          if (syncItems.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 40),
                              alignment: Alignment.center,
                              child: Column(
                                children: [
                                  const Icon(Icons.sync_outlined, size: 48, color: AppColors.textMuted),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No sync activity yet',
                                    style: AppTextStyles.body.copyWith(
                                      color: AppColors.textMuted,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            ...syncItems.map(_buildSyncItemTile),

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
}
