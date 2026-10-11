import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../../core/theme/app_colors.dart';
import '../models/referral.dart';
import '../models/app_notification.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import 'notification_repository.dart';
import '../remote/referral_api.dart';
import '../remote/beneficiary_api.dart';

class ReferralHeaderStatus {
  final bool showReferButton;
  final String? chipLabel;
  final Color? chipColor;

  const ReferralHeaderStatus({
    required this.showReferButton,
    this.chipLabel,
    this.chipColor,
  });
}

class ReferralRepository {
  Box get _box => Hive.box(HiveBoxes.referrals);

  Future<Referral> add(Referral referral) async {
    final existingPending = getAll().where(
      (r) =>
          r.beneficiaryId == referral.beneficiaryId &&
          r.status == 'Pending' &&
          r.reason == referral.reason,
    ).toList();

    if (existingPending.isNotEmpty) {
      final existing = existingPending.first;
      final updated = Referral(
        id: existing.id,
        beneficiaryType: existing.beneficiaryType,
        beneficiaryId: existing.beneficiaryId,
        beneficiaryName: existing.beneficiaryName,
        barangay: existing.barangay,
        reason: existing.reason,
        facility: existing.facility,
        notes: referral.notes.isNotEmpty ? referral.notes : existing.notes,
        status: existing.status,
        createdAt: referral.createdAt,
      );
      await _box.put(updated.id, updated.toMap()..['_syncStatus'] = 'pending');
      AppDataBus.notifyChanged();
      return updated;
    }

    final map = referral.toMap()..['_syncStatus'] = 'pending';
    await _box.put(referral.id, map);
    AppDataBus.notifyChanged();
    return referral;
  }

  int get pendingCount => _box.values
      .where((raw) => (raw as Map?)?['_syncStatus'] != 'synced')
      .length;

  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final raw in _box.values) {
      final map = Map<String, dynamic>.from(raw as Map);
      if (map['_syncStatus'] == 'synced') continue;

      final referral = Referral.fromMap(map);

      // Exponential backoff retry logic
      final retryCount = (map['_retryCount'] as int?) ?? 0;
      final maxRetries = 4;
      if (retryCount >= maxRetries && map['_syncStatus'] == 'failed') {
        errors.add('${referral.beneficiaryName}: ${map['_lastSyncError'] ?? 'Repeated failures'}');
        continue;
      }

      final res = await _trySync(referral);
      if (res != null && !res.success) {
        errors.add('${referral.beneficiaryName}: ${res.message}');
      }
      // If failed and will retry, wait with backoff before continuing loop
      final updated = _box.get(referral.id) as Map?;
      final updatedRetry = (updated?['_retryCount'] as int?) ?? 0;
      if ((updated?['_syncStatus'] as String?) == 'failed' && updatedRetry > retryCount) {
        final backoffMs = (1 << (updatedRetry - 1)) * 500; // 500ms, 1s, 2s, 4s
        await Future.delayed(Duration(milliseconds: backoffMs));
      }
    }
    return errors;
  }

  Future<ApiResponse?> trySync(Referral referral) => _trySync(referral);

  Future<ApiResponse?> _trySync(Referral referral) async {
    final res = await ReferralApi.submit(referral);
    final existing = _box.get(referral.id) as Map?;
    final map = Map<String, dynamic>.from(existing ?? referral.toMap());
    if (res.success) {
      // Mark as synced and capture server-assigned referral id if provided
      map['_syncStatus'] = 'synced';
      map['_syncedAt'] = DateTime.now().toIso8601String();
      map.remove('_lastSyncError');
      map['_retryCount'] = 0;
      try {
        // Prefer structured id from ApiResponse.data if present
        if (res.data != null && res.data is Map && (res.data as Map)['referral_id'] != null) {
          map['server_id'] = (res.data as Map)['referral_id'].toString();
        } else {
          final idMatch = RegExp(r'id:\s*(\d+)').firstMatch(res.message);
          if (idMatch != null) {
            map['server_id'] = idMatch.group(1);
          }
        }
      } catch (_) {}
    } else {
      map['_syncStatus'] = 'failed';
      map['_lastSyncError'] = res.message;
      map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
    }
    await _box.put(referral.id, map);
    return res;
  }

  Future<ApiResponse> syncToWeb(Referral referral) async {
    final res = await _trySync(referral);
    return res ??
        const ApiResponse(
          success: false,
          statusCode: 0,
          message: 'Unknown sync error',
        );
  }

  Future<void> update(Referral referral) async {
    await _box.put(referral.id, referral.toMap());
    AppDataBus.notifyChanged();
  }

  Referral? getById(String id) {
    final raw = _box.get(id);
    if (raw == null) return null;
    return Referral.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  /// Simulates / processes incoming updates from the RHU Web Portal (Admin/BHW).
  /// Mobile users cannot edit statuses directly; updates arrive from the web
  /// and trigger an in-app notification when completed or moved in-progress.
  Future<void> receiveWebUpdate({
    required String referralId,
    required String newStatus,
    String? notes,
  }) async {
    final existing = getById(referralId);
    if (existing == null) return;

    final updated = existing.copyWith(
      status: newStatus,
      notes: notes ?? existing.notes,
    );
    await _box.put(updated.id, updated.toMap());

    // Dispatch notification to mobile user
    if (newStatus == 'Completed') {
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'Referral Resolved by RHU',
          message:
              'RHU/BHW completed referral for ${updated.beneficiaryName}. Outcome: ${notes?.isNotEmpty == true ? notes : "Referral resolved by RHU."}',
          type: 'referral_completed',
          referralId: updated.id,
          timestamp: DateTime.now(),
        ),
      );
    } else if (newStatus == 'In Progress') {
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'Referral In Progress at RHU',
          message:
              'RHU/BHW is currently evaluating ${updated.beneficiaryName}.',
          type: 'referral_in_progress',
          referralId: updated.id,
          timestamp: DateTime.now(),
        ),
      );
    }

    AppDataBus.notifyChanged();
  }

  List<Referral> getAll() => _box.values
      .map((r) => Referral.fromMap(Map<String, dynamic>.from(r as Map)))
      .toList();

  List<Referral> getForBeneficiary(String beneficiaryId) {
    final list = getAll()
        .where((r) => r.beneficiaryId == beneficiaryId)
        .toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  /// Returns the latest active (Pending, Ongoing, In Progress, Responded) referral
  /// for a given beneficiary if one exists.
  Referral? getActiveForBeneficiary(String beneficiaryId) {
    const activeStatuses = {'pending', 'in progress', 'ongoing', 'responded'};
    final list = getAll().where((r) =>
        r.beneficiaryId == beneficiaryId &&
        activeStatuses.contains(r.status.trim().toLowerCase())
    ).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list.isNotEmpty ? list.first : null;
  }

  /// Returns the latest referral for a beneficiary that is not cancelled or rejected.
  Referral? getLatestValidForBeneficiary(String beneficiaryId) {
    final list = getAll().where((r) {
      final s = r.status.trim().toLowerCase();
      return r.beneficiaryId == beneficiaryId &&
          s != 'cancelled' &&
          s != 'rejected';
    }).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list.isNotEmpty ? list.first : null;
  }

  /// Calculates header button and status chip state for a beneficiary profile:
  /// 1. Not visited / no records: no button, no chip
  /// 2. Active referral: "Referred to BHW" chip, no refer button
  /// 3. Completed referral: "Referral completed" chip, no refer button UNLESS
  ///    a new visit/record after the referral flagged that referral is needed again
  /// 4. Needs referral & no active referral: "Refer" button, no chip
  /// 5. Normal assessment: no button, no chip
  ReferralHeaderStatus getReferralHeaderStatus({
    required String beneficiaryId,
    required bool hasRecords,
    required bool needsReferralFromRecord,
    DateTime? recordDate,
  }) {
    if (!hasRecords) {
      return const ReferralHeaderStatus(showReferButton: false);
    }

    final latestReferral = getLatestValidForBeneficiary(beneficiaryId);

    final isActive = latestReferral != null &&
        (latestReferral.status.trim().toLowerCase() == 'pending' ||
            latestReferral.status.trim().toLowerCase() == 'in progress' ||
            latestReferral.status.trim().toLowerCase() == 'ongoing' ||
            latestReferral.status.trim().toLowerCase() == 'responded');

    if (isActive) {
      return const ReferralHeaderStatus(
        showReferButton: false,
        chipLabel: 'Referred to BHW',
        chipColor: AppColors.statOrange,
      );
    }

    final isCompleted = latestReferral != null &&
        latestReferral.status.trim().toLowerCase() == 'completed';

    if (isCompleted) {
      final isNewRecordAfterReferral = recordDate != null &&
          recordDate.isAfter(latestReferral.createdAt);

      if (isNewRecordAfterReferral) {
        if (needsReferralFromRecord) {
          return const ReferralHeaderStatus(
            showReferButton: true,
            chipLabel: null,
          );
        } else {
          return const ReferralHeaderStatus(
            showReferButton: false,
            chipLabel: null,
          );
        }
      } else {
        return const ReferralHeaderStatus(
          showReferButton: false,
          chipLabel: 'Referral completed',
          chipColor: AppColors.primaryGreen,
        );
      }
    }

    if (needsReferralFromRecord) {
      return const ReferralHeaderStatus(
        showReferButton: true,
        chipLabel: null,
      );
    }

    return const ReferralHeaderStatus(
      showReferButton: false,
      chipLabel: null,
    );
  }

  /// Barangay-wide view for the Dashboard entry point — pending and
  /// in-progress cases surface first, since those are what a BNS
  /// actually needs to act on.
  List<Referral> getForBarangay(String barangay) {
    final list = getAll()
        .where((r) => r.barangay == barangay && r.status != 'Cancelled')
        .toList();
    list.sort((a, b) {
      const order = {
        'Pending': 0,
        'In Progress': 1,
        'Completed': 2,
      };
      final statusCompare = (order[a.status] ?? 9).compareTo(
        order[b.status] ?? 9,
      );
      if (statusCompare != 0) return statusCompare;
      return b.createdAt.compareTo(a.createdAt);
    });
    return list;
  }

  int countOpenForBarangay(String barangay) => getAll()
      .where(
        (r) =>
            r.barangay == barangay &&
            (r.status == 'Pending' || r.status == 'In Progress'),
      )
      .length;

  static String generateId() => const Uuid().v4();
}
