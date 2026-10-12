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
      .where((raw) =>
          raw is Map && (raw['_syncStatus'] == 'pending' || raw['_archiveQueue'] != null))
      .length;

  int get failedCount => _box.values
      .where((raw) => (raw as Map?)?['_syncStatus'] == 'failed')
      .length;

  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final raw in _box.values) {
      final map = Map<String, dynamic>.from(raw as Map);

      // Handle pending archive/unarchive queue
      if (map['_archiveQueue'] != null) {
        final serverId = map['server_id']?.toString() ?? map['serverId']?.toString();
        if (serverId != null && serverId.isNotEmpty) {
          final isArch = map['_archiveQueue'] == 'archive';
          final aRes = isArch
              ? await ReferralApi.archive(serverId)
              : await ReferralApi.unarchive(serverId);
          if (aRes.success) {
            map.remove('_archiveQueue');
            await _box.put(map['id'] ?? serverId, map);
          }
        }
      }

      if (map['_syncStatus'] == 'synced') continue;

      final referral = Referral.fromMap(map);

      // Exponential backoff retry logic
      final retryCount = (map['_retryCount'] as int?) ?? 0;
      final maxRetries = 4;
      if (retryCount >= maxRetries && map['_syncStatus'] == 'failed') {
        errors.add('${referral.resolvedBeneficiaryName}: ${map['_lastSyncError'] ?? 'Repeated failures'}');
        continue;
      }

      final res = await _trySync(referral);
      if (res != null && !res.success) {
        errors.add('${referral.resolvedBeneficiaryName}: ${res.message}');
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
    if (res.success || res.statusCode == 409) {
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
      map['_lastSyncError'] = res.message;
      map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
      if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode != 408) {
        map['_syncStatus'] = 'failed';
      } else {
        map['_syncStatus'] = 'pending';
      }
    }
    await _box.put(referral.id, map);
    AppDataBus.notifyChanged();
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
    if (raw != null) {
      return Referral.fromMap(Map<String, dynamic>.from(raw as Map));
    }
    // Also look up by server_id if not found by primary key
    for (final val in _box.values) {
      if (val is Map) {
        if (val['server_id']?.toString() == id || val['serverId']?.toString() == id) {
          return Referral.fromMap(Map<String, dynamic>.from(val));
        }
      }
    }
    return null;
  }

  /// Pulls the latest referrals from the backend and reconciles them with Hive.
  /// Server status takes precedence over local status when server is updated.
  Future<void> pullLatest({String? barangay}) async {
    try {
      final settings = SettingsRepository();
      final effectiveBarangay = barangay ?? settings.authUser?['barangay']?.toString();
      final incoming = await ReferralApi.fetchReferrals(barangay: effectiveBarangay);
      if (incoming != null && incoming.isNotEmpty) {
        await processIncomingReferrals(incoming);
      }
    } catch (e) {
      debugPrint('[ReferralRepository] pullLatest error: $e');
    }
  }

  /// Processes incoming referral records from either dedicated pull or full sync payload.
  Future<void> processIncomingReferrals(List<Map<String, dynamic>> incoming) async {
    for (final r in incoming) {
      final serverId = (r['referral_id'] ?? r['id'])?.toString();
      if (serverId == null || serverId.isEmpty) continue;

      final serverStatus = Referral.normalizeStatus(r['status']?.toString());
      final serverNotes = (r['notes'] ?? r['response_notes'] ?? '').toString();
      final serverUpdatedAt = DateTime.tryParse((r['updated_at'] ?? r['updatedAt'] ?? r['created_at'] ?? '').toString());
      final serverCreatedAt = DateTime.tryParse((r['created_at'] ?? r['createdAt'] ?? '').toString()) ?? DateTime.now();
      final beneficiaryType = r['beneficiary_type']?.toString() ??
          (r['mother_id'] != null ? 'mother' : 'child');
      final beneficiaryId = (r['child_external_id'] ??
              r['mother_external_id'] ??
              r['child_id'] ??
              r['mother_id'])
          ?.toString() ??
          '';

      String name = '${r['beneficiary_first_name'] ?? ''} ${r['beneficiary_last_name'] ?? ''}'.trim();
      if (name.isEmpty) {
        name = (r['beneficiary_name'] ?? r['beneficiaryName'] ?? '').toString().trim();
      }

      String facility = (r['facility'] ?? '').toString().trim();
      if (facility.isEmpty || RegExp(r'^\d+$').hasMatch(facility)) {
        final match = RegExp(r'Facility:\s*([^|\n]+)').firstMatch(serverNotes);
        if (match != null && match.group(1)!.trim().isNotEmpty && !RegExp(r'^\d+$').hasMatch(match.group(1)!.trim())) {
          facility = match.group(1)!.trim();
        } else {
          facility = 'Rural Health Unit (RHU)';
        }
      }

      List<Map<String, dynamic>> items = const [];
      final rawItems = r['items_given'] ?? r['itemsGiven'];
      if (rawItems is List) {
        items = rawItems.map((i) {
          if (i is Map) return Map<String, dynamic>.from(i);
          return <String, dynamic>{'item_name': i.toString(), 'quantity': 1};
        }).toList();
      }

      // Find matching local Hive record
      String? matchedKey;
      Map<String, dynamic>? matchedMap;

      for (final key in _box.keys) {
        final raw = _box.get(key);
        if (raw is Map) {
          final m = Map<String, dynamic>.from(raw);
          if (m['server_id']?.toString() == serverId || m['id']?.toString() == serverId) {
            matchedKey = key.toString();
            matchedMap = m;
            break;
          }
        }
      }

      // Secondary match by beneficiaryId and reason if pending local record without server_id
      if (matchedKey == null && beneficiaryId.isNotEmpty) {
        for (final key in _box.keys) {
          final raw = _box.get(key);
          if (raw is Map) {
            final m = Map<String, dynamic>.from(raw);
            if (m['beneficiaryId']?.toString() == beneficiaryId &&
                m['reason']?.toString() == (r['reason'] ?? '').toString()) {
              matchedKey = key.toString();
              matchedMap = m;
              break;
            }
          }
        }
      }

      if (matchedKey != null && matchedMap != null) {
        final previousStatus = Referral.normalizeStatus(matchedMap['status']?.toString());
        final existingUpdatedAt = DateTime.tryParse(
          (matchedMap['updatedAt'] ?? matchedMap['createdAt'] ?? '').toString(),
        );

        // Server wins if serverUpdatedAt is newer, or if server has resolved/progressed
        final bool shouldUpdateStatus = serverUpdatedAt == null ||
            existingUpdatedAt == null ||
            !serverUpdatedAt.isBefore(existingUpdatedAt) ||
            serverStatus == 'Completed' ||
            serverStatus == 'Ongoing' ||
            serverStatus == 'In Progress' ||
            serverStatus == 'Cancelled';

        final effectiveStatus = shouldUpdateStatus ? serverStatus : previousStatus;

        final refObj = Referral.fromMap({
          ...matchedMap,
          if (name.isNotEmpty) 'beneficiaryName': name,
          'beneficiaryType': beneficiaryType,
          'beneficiaryId': beneficiaryId,
        });
        final resolvedName = refObj.resolvedBeneficiaryName;

        // Trigger notification if status updated by RHU/BHW
        if (previousStatus != effectiveStatus) {
          if (effectiveStatus == 'Completed') {
            await NotificationRepository().add(
              AppNotification(
                id: NotificationRepository.generateId(),
                title: 'Referral Completed',
                message: 'Referral completed for $resolvedName.',
                type: 'referral_completed',
                referralId: matchedKey,
                timestamp: DateTime.now().toUtc(),
              ),
            );
          } else if (effectiveStatus == 'Ongoing') {
            await NotificationRepository().add(
              AppNotification(
                id: NotificationRepository.generateId(),
                title: 'Referral In Progress',
                message: 'Referral in progress for $resolvedName.',
                type: 'referral_in_progress',
                referralId: matchedKey,
                timestamp: DateTime.now().toUtc(),
              ),
            );
          } else if (effectiveStatus == 'Cancelled') {
            await NotificationRepository().add(
              AppNotification(
                id: NotificationRepository.generateId(),
                title: 'Referral Cancelled',
                message: 'Referral cancelled for $resolvedName.',
                type: 'referral_cancelled',
                referralId: matchedKey,
                timestamp: DateTime.now().toUtc(),
              ),
            );
          }
        }

        final updatedRecord = {
          ...matchedMap,
          'server_id': serverId,
          'status': effectiveStatus,
          'notes': serverNotes.isNotEmpty ? serverNotes : (matchedMap['notes'] ?? ''),
          'facility': facility,
          'beneficiaryName': resolvedName,
          'itemsGiven': items,
          if (r['archived_at'] != null) 'archived_at': r['archived_at']?.toString(),
          if (r['archived_by'] != null) 'archived_by': r['archived_by'],
          'updatedAt': (serverUpdatedAt ?? DateTime.now()).toIso8601String(),
          '_syncStatus': 'synced',
        };
        await _box.put(matchedKey, updatedRecord);
      } else {
        // Brand new referral from server
        final newRecord = {
          'id': serverId,
          'server_id': serverId,
          'beneficiaryId': beneficiaryId,
          'beneficiaryType': beneficiaryType,
          'beneficiaryName': name,
          'barangay': r['barangay']?.toString() ?? '',
          'reason': (r['reason'] ?? '').toString(),
          'facility': facility,
          'notes': serverNotes,
          'status': serverStatus,
          'createdAt': serverCreatedAt.toIso8601String(),
          'updatedAt': (serverUpdatedAt ?? serverCreatedAt).toIso8601String(),
          if (r['archived_at'] != null) 'archived_at': r['archived_at']?.toString(),
          if (r['archived_by'] != null) 'archived_by': r['archived_by'],
          'itemsGiven': items,
          '_syncStatus': 'synced',
        };
        final newReferral = Referral.fromMap(newRecord);
        final newResolvedName = newReferral.resolvedBeneficiaryName;
        newRecord['beneficiaryName'] = newResolvedName;
        await _box.put(serverId, newRecord);

        if (serverStatus == 'Completed') {
          await NotificationRepository().add(
            AppNotification(
              id: NotificationRepository.generateId(),
              title: 'Referral Completed',
              message: 'Referral completed for $newResolvedName.',
              type: 'referral_completed',
              referralId: serverId,
              timestamp: DateTime.now().toUtc(),
            ),
          );
        } else if (serverStatus == 'Ongoing') {
          await NotificationRepository().add(
            AppNotification(
              id: NotificationRepository.generateId(),
              title: 'Referral In Progress',
              message: 'Referral in progress for $newResolvedName.',
              type: 'referral_in_progress',
              referralId: serverId,
              timestamp: DateTime.now().toUtc(),
            ),
          );
        }
      }
    }
    AppDataBus.notifyChanged();
  }

  /// Simulates / processes incoming updates from the RHU Web Portal (Admin/BHW).
  Future<void> receiveWebUpdate({
    required String referralId,
    required String newStatus,
    String? notes,
    List<Map<String, dynamic>>? itemsGiven,
  }) async {
    final existing = getById(referralId);
    if (existing == null) return;

    final normStatus = Referral.normalizeStatus(newStatus);
    final updated = existing.copyWith(
      status: normStatus,
      notes: notes ?? existing.notes,
      updatedAt: DateTime.now(),
      itemsGiven: itemsGiven ?? existing.itemsGiven,
    );
    await _box.put(updated.id, updated.toMap()..['_syncStatus'] = 'synced');

    // Dispatch notification to mobile user
    final resolvedName = updated.resolvedBeneficiaryName;
    if (normStatus == 'Completed') {
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'Referral Completed',
          message: 'Referral completed for $resolvedName.',
          type: 'referral_completed',
          referralId: updated.id,
          timestamp: DateTime.now().toUtc(),
        ),
      );
    } else if (normStatus == 'Ongoing' || normStatus == 'In Progress') {
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'Referral In Progress',
          message: 'Referral in progress for $resolvedName.',
          type: 'referral_in_progress',
          referralId: updated.id,
          timestamp: DateTime.now().toUtc(),
        ),
      );
    } else if (normStatus == 'Cancelled') {
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'Referral Cancelled',
          message: 'Referral cancelled for $resolvedName.',
          type: 'referral_cancelled',
          referralId: updated.id,
          timestamp: DateTime.now().toUtc(),
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

  /// Returns the latest active (Pending, In Progress) referral for a given beneficiary.
  Referral? getActiveForBeneficiary(String beneficiaryId) {
    final list = getAll().where((r) =>
        r.beneficiaryId == beneficiaryId &&
        (r.isPending || r.isInProgress)
    ).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list.isNotEmpty ? list.first : null;
  }

  /// Returns the latest referral for a beneficiary that is not cancelled or rejected.
  Referral? getLatestValidForBeneficiary(String beneficiaryId) {
    final list = getAll().where((r) =>
        r.beneficiaryId == beneficiaryId &&
        !r.isCancelled
    ).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list.isNotEmpty ? list.first : null;
  }

  /// Calculates header button and status chip state for a beneficiary profile:
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

    if (latestReferral != null && (latestReferral.isPending || latestReferral.isInProgress)) {
      return const ReferralHeaderStatus(
        showReferButton: false,
        chipLabel: 'Referred to BHW',
        chipColor: AppColors.statOrange,
      );
    }

    if (latestReferral != null && latestReferral.isCompleted) {
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

  /// Barangay-wide view: Pending and In-Progress cases surface first,
  /// completed cases at the bottom. By default, hides archived referrals.
  List<Referral> getForBarangay(String barangay, {bool includeArchived = false}) {
    final list = getAll()
        .where((r) =>
            r.barangay == barangay &&
            !r.isCancelled &&
            (includeArchived || !r.isArchived))
        .toList();
    list.sort((a, b) {
      const order = {
        'Pending': 0,
        'Ongoing': 1,
        'In Progress': 1,
        'Completed': 2,
      };
      final aRank = order[a.statusDisplay] ?? 1;
      final bRank = order[b.statusDisplay] ?? 1;
      if (aRank != bRank) return aRank.compareTo(bRank);
      return b.createdAt.compareTo(a.createdAt);
    });
    return list;
  }

  List<Referral> getArchivedForBarangay(String barangay) {
    final list = getAll()
        .where((r) => r.barangay == barangay && r.isArchived)
        .toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  Future<void> archive(String referralId) async {
    final raw = _box.get(referralId);
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    map['archived_at'] = DateTime.now().toIso8601String();
    map['_archiveQueue'] = 'archive';
    await _box.put(referralId, map);
    AppDataBus.notifyChanged();

    final serverId = map['server_id']?.toString() ?? map['serverId']?.toString();
    if (serverId != null && serverId.isNotEmpty) {
      try {
        final res = await ReferralApi.archive(serverId);
        if (res.success) {
          map.remove('_archiveQueue');
          await _box.put(referralId, map);
        }
      } catch (_) {}
    }
  }

  Future<void> unarchive(String referralId) async {
    final raw = _box.get(referralId);
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    map.remove('archived_at');
    map.remove('archivedAt');
    map['_archiveQueue'] = 'unarchive';
    await _box.put(referralId, map);
    AppDataBus.notifyChanged();

    final serverId = map['server_id']?.toString() ?? map['serverId']?.toString();
    if (serverId != null && serverId.isNotEmpty) {
      try {
        final res = await ReferralApi.unarchive(serverId);
        if (res.success) {
          map.remove('_archiveQueue');
          await _box.put(referralId, map);
        }
      } catch (_) {}
    }
  }

  int countOpenForBarangay(String barangay) => getAll()
      .where(
        (r) =>
            r.barangay == barangay &&
            !r.isArchived &&
            (r.isPending || r.isInProgress),
      )
      .length;

  static String generateId() => const Uuid().v4();
}
