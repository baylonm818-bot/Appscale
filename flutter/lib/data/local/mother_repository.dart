import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/mother.dart';
import 'hive_boxes.dart';
import 'app_data_bus.dart';
import '../remote/beneficiary_api.dart';

class MotherRepository {
  Box get _box => Hive.box(HiveBoxes.mothers);

  Future<Mother> add(Mother mother) async {
    final map = mother.toMap()..['_syncStatus'] = 'pending';
    await _box.put(mother.id, map);
    AppDataBus.notifyChanged();
    _trySync(mother).catchError((e) {
      debugPrint('Background mother sync error: $e');
      return null;
    });
    return mother;
  }

  Mother? getById(String id) {
    final map = _box.get(id);
    if (map == null || map is! Map) return null;
    try {
      return Mother.fromMap(map);
    } catch (e, stack) {
      debugPrint('Skipping corrupt Mother record $id: $e\n$stack');
      return null;
    }
  }

  List<Mother> getAll() {
    final list = <Mother>[];
    for (final m in _box.values) {
      try {
        if (m is Map) {
          list.add(Mother.fromMap(m));
        }
      } catch (e, stack) {
        debugPrint('Skipping corrupt Mother in getAll: $e\n$stack');
      }
    }
    return list;
  }

  Future<void> update(Mother mother) async {
    final map = mother.toMap()..['_syncStatus'] = 'pending';
    await _box.put(mother.id, map);
    AppDataBus.notifyChanged();
    _trySync(mother).catchError((e) {
      debugPrint('Background mother sync error: $e');
      return null;
    });
  }

  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final raw in List.from(_box.values)) {
      final map = Map<String, dynamic>.from(raw as Map);
      if (map['_syncStatus'] != 'synced') {
        final res = await _trySync(Mother.fromMap(map));
        if (res != null && !res.success) {
          errors.add('${map['fullName'] ?? 'Mother'}: ${res.message}');
        }
      }
    }
    return errors;
  }

  int get pendingCount => _box.values
      .where((raw) => (raw as Map?)?['_syncStatus'] == 'pending')
      .length;

  int get failedCount => _box.values
      .where((raw) => (raw as Map?)?['_syncStatus'] == 'failed')
      .length;

  Future<ApiResponse?> trySync(Mother mother) => _trySync(mother);

  Future<ApiResponse?> transferMother({
    required Mother mother,
    required String targetBarangay,
    required String reason,
    required DateTime transferDate,
    bool alsoTransferLinked = false,
  }) async {
    final existing = _box.get(mother.id) as Map?;
    final map = Map<String, dynamic>.from(existing ?? mother.toMap());
    map['barangay'] = targetBarangay;
    map['isTransferPending'] = true;
    map['_transferPending'] = true;
    map['pendingTargetBarangay'] = targetBarangay;
    map['_pendingTargetBarangay'] = targetBarangay;
    map['inactiveReason'] = reason;
    map['inactiveDate'] = transferDate.toIso8601String();
    map['alsoTransferLinked'] = alsoTransferLinked;
    map['_syncStatus'] = 'pending';
    await _box.put(mother.id, map);

    if (alsoTransferLinked && mother.linkedChildIds.isNotEmpty) {
      final cBox = Hive.box(HiveBoxes.children);
      for (final cid in mother.linkedChildIds) {
        final cRaw = cBox.get(cid);
        if (cRaw != null) {
          final cMap = Map<String, dynamic>.from(cRaw as Map);
          cMap['barangay'] = targetBarangay;
          cMap['isTransferPending'] = true;
          cMap['_transferPending'] = true;
          cMap['pendingTargetBarangay'] = targetBarangay;
          cMap['_pendingTargetBarangay'] = targetBarangay;
          cMap['inactiveReason'] = 'Transferred with mother';
          cMap['inactiveDate'] = transferDate.toIso8601String();
          cMap['_syncStatus'] = 'pending';
          await cBox.put(cid, cMap);
        }
      }
    }

    AppDataBus.notifyChanged();
    return _trySync(Mother.fromMap(map));
  }

  Future<ApiResponse?> _trySync(Mother mother) async {
    final existing = _box.get(mother.id) as Map?;
    final map = Map<String, dynamic>.from(existing ?? mother.toMap());
    final isTransferPending =
        map['isTransferPending'] == true || map['_transferPending'] == true;

    ApiResponse res;
    if (isTransferPending) {
      final targetBarangay = (map['pendingTargetBarangay'] ??
              map['_pendingTargetBarangay'] ??
              mother.barangay)
          .toString();
      final reason = (map['inactiveReason'] ?? 'Transferred').toString();
      final alsoTransferLinked = map['alsoTransferLinked'] == true;
      final transferDate = map['inactiveDate'] != null
          ? DateTime.tryParse(map['inactiveDate'].toString()) ?? DateTime.now()
          : DateTime.now();

      res = await BeneficiaryApi.transferBeneficiary(
        entityType: 'mother',
        entityId: mother.id,
        targetBarangay: targetBarangay,
        reason: reason,
        transferDate: transferDate,
        alsoTransferLinked: alsoTransferLinked,
      );

      if (res.success) {
        map['barangay'] = targetBarangay;
        map['isTransferPending'] = false;
        map['_transferPending'] = false;
        map.remove('pendingTargetBarangay');
        map.remove('_pendingTargetBarangay');
        map.remove('alsoTransferLinked');
        map['_syncStatus'] = 'synced';
        map['_syncedAt'] = DateTime.now().toIso8601String();
        map.remove('_lastSyncError');
        map['_retryCount'] = 0;
        await _box.put(mother.id, map);

        if (alsoTransferLinked && mother.linkedChildIds.isNotEmpty) {
          final cBox = Hive.box(HiveBoxes.children);
          for (final cid in mother.linkedChildIds) {
            final cRaw = cBox.get(cid);
            if (cRaw != null) {
              final cMap = Map<String, dynamic>.from(cRaw as Map);
              cMap['barangay'] = targetBarangay;
              cMap['isTransferPending'] = false;
              cMap['_transferPending'] = false;
              cMap.remove('pendingTargetBarangay');
              cMap.remove('_pendingTargetBarangay');
              cMap['_syncStatus'] = 'synced';
              cMap['_syncedAt'] = DateTime.now().toIso8601String();
              await cBox.put(cid, cMap);
            }
          }
        }
        AppDataBus.notifyChanged();
        return res;
      }
    } else {
      res = await BeneficiaryApi.syncMother(mother);
    }

    if (res.success) {
      map['_syncStatus'] = 'synced';
      map['_syncedAt'] = DateTime.now().toIso8601String();
      map.remove('_lastSyncError');
      map['_retryCount'] = 0;
      if (res.data?['mother_id'] != null) {
        map['serverMotherId'] = res.data!['mother_id'];
      }
    } else {
      map['_lastSyncError'] = res.message;
      map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
      // On 4xx error: mark Failed so user can edit and retry.
      // On network error or 5xx: keep Pending with retry count.
      if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode != 408) {
        map['_syncStatus'] = 'failed';
      } else {
        map['_syncStatus'] = 'pending';
      }
    }
    await _box.put(mother.id, map);
    AppDataBus.notifyChanged();
    return res;
  }

  /// Used by the Link Mother search field — filters by barangay first,
  /// then by name, and caps results so the list never overwhelms the screen.
  List<Mother> search(String query, {required String barangay, int limit = 6}) {
    final lower = query.trim().toLowerCase();
    final results = getAll().where((m) {
      final matchesBarangay =
          m.barangay.toLowerCase() == barangay.toLowerCase();
      final matchesName =
          lower.isEmpty || m.fullName.toLowerCase().contains(lower);
      return matchesBarangay && matchesName;
    }).toList();
    return results.take(limit).toList();
  }

  static String generateId() => const Uuid().v4();

  List<Mother> getFiltered({
    required String barangay,
    required bool activeOnly,
    String query = '',
    String? statusFilter,
  }) {
    final lower = query.trim().toLowerCase();
    final cleanStatus = (statusFilter ?? 'All').trim().toLowerCase();
    return getAll().where((m) {
      final matchesBarangay =
          m.barangay.toLowerCase() == barangay.toLowerCase();
      final matchesActive = m.isActive == activeOnly;
      final matchesQuery =
          lower.isEmpty || m.fullName.toLowerCase().contains(lower);
      final formatted = m.riskStatus.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
      final targetStatus = cleanStatus.replaceAll('_', ' ').replaceAll('-', ' ');
      final matchesStatus = targetStatus == 'all' ||
          formatted == targetStatus ||
          (targetStatus == 'at risk' && formatted.contains('risk'));
      return matchesBarangay && matchesActive && matchesQuery && matchesStatus;
    }).toList();
  }

  int countActive(String barangay) =>
      getAll().where((m) => m.barangay == barangay && m.isActive).length;
  int countInactive(String barangay) =>
      getAll().where((m) => m.barangay == barangay && !m.isActive).length;
}
