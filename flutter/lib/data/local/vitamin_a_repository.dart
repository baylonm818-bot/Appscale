import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/vitamin_a_record.dart';
import 'activity_log_repository.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import '../remote/beneficiary_api.dart';

class VitaminARepository {
  Box get _box => Hive.box(HiveBoxes.vitaminA);

  List<VitaminARecord> getAllForBarangay(String barangay) {
    final list = <VitaminARecord>[];
    for (final e in _box.values) {
      try {
        if (e is Map) {
          final record = VitaminARecord.fromMap(Map<String, dynamic>.from(e));
          if (record.barangay == barangay) {
            list.add(record);
          }
        }
      } catch (err, stack) {
        debugPrint('Skipping corrupt VitaminARecord in getAllForBarangay: $err\n$stack');
      }
    }
    list.sort((a, b) => b.dateGiven.compareTo(a.dateGiven));
    return list;
  }

  List<VitaminARecord> getByChildId(String childId) {
    final list = <VitaminARecord>[];
    for (final e in _box.values) {
      try {
        if (e is Map) {
          final record = VitaminARecord.fromMap(Map<String, dynamic>.from(e));
          if (record.childId == childId) {
            list.add(record);
          }
        }
      } catch (err, stack) {
        debugPrint('Skipping corrupt VitaminARecord in getByChildId: $err\n$stack');
      }
    }
    list.sort((a, b) => b.dateGiven.compareTo(a.dateGiven));
    return list;
  }

  VitaminARecord? getLatestForChild(String childId) {
    final list = getByChildId(childId);
    return list.isNotEmpty ? list.first : null;
  }

  Future<ApiResponse?> trySync(VitaminARecord record) async {
    try {
      final res = await BeneficiaryApi.syncChildService(
        externalId: record.id,
        childExternalId: record.childId,
        childName: record.childName,
        serviceType: 'Vitamin A',
        serviceName: record.doseType,
        dosage: record.dosage,
        serviceDate: record.dateGiven,
        nextSchedule: record.nextDueDate,
        providedBy: record.administeredBy,
        notes: record.remarks,
      );
      if (res.success) {
        final map = record.toMap()
          ..['_syncStatus'] = 'synced'
          ..['_syncedAt'] = DateTime.now().toIso8601String()
          ..remove('_lastSyncError');
        await _box.put(record.id, map);
        await Hive.box(HiveBoxes.settings).put('last_synced_at', DateTime.now().toIso8601String());
        AppDataBus.notifyChanged();
        return res;
      } else {
        final map = record.toMap()
          ..['_syncStatus'] = 'failed'
          ..['_lastSyncError'] = res.message;
        await _box.put(record.id, map);
        AppDataBus.notifyChanged();
        return res;
      }
    } catch (e) {
      final map = record.toMap()
        ..['_syncStatus'] = 'failed'
        ..['_lastSyncError'] = e.toString();
      await _box.put(record.id, map);
      AppDataBus.notifyChanged();
      return ApiResponse(success: false, statusCode: 500, message: e.toString());
    }
  }

  Future<void> save(VitaminARecord record) async {
    await _box.put(record.id, record.toMap()..['_syncStatus'] = 'pending');
    await ActivityLogRepository().logActivity(
      type: 'measurement_added',
      title: 'Administered Vit A: ${record.childName} (${record.dosage})',
    );
    AppDataBus.notifyChanged();

    await trySync(record);
  }

  int get pendingCount {
    var count = 0;
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw is Map && raw['_syncStatus'] != 'synced') count++;
    }
    return count;
  }

  Future<void> syncPending() async {
    for (final key in List.from(_box.keys)) {
      final raw = _box.get(key);
      if (raw is Map && raw['_syncStatus'] != 'synced') {
        final record = VitaminARecord.fromMap(Map<String, dynamic>.from(raw));
        await trySync(record);
      }
    }
  }

  Future<void> delete(String id) async {
    await _box.delete(id);
    AppDataBus.notifyChanged();
  }

  static String determineRecommendedDosage(int ageInMonths) {
    if (ageInMonths < 6) {
      return 'Not Eligible (<6 mos)';
    } else if (ageInMonths <= 11) {
      return '100,000 IU (Blue)';
    } else if (ageInMonths <= 59) {
      return '200,000 IU (Red)';
    } else {
      return 'Exceeds Target Age (>59 mos)';
    }
  }

  static String determineDefaultDoseType(int ageInMonths) {
    if (ageInMonths < 6) {
      return 'Under Age';
    } else if (ageInMonths <= 11) {
      return 'Routine (6-11 mos)';
    } else {
      return 'Routine (12-59 mos)';
    }
  }

  void seedInitialIfEmpty(String barangay) {
    if (_box.isNotEmpty) return;
  }
}
