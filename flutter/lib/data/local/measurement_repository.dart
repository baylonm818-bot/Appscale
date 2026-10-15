import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/measurement.dart';
import '../remote/beneficiary_api.dart';
import 'app_data_bus.dart';
import 'child_repository.dart';
import 'hive_boxes.dart';

/// Module 7: Offline Data Recording and Synchronization
/// - Records measurements offline to Hive local storage immediately
/// - Automatically synchronizes locally stored data to server when internet is available
/// - Retries pending records on next sync call
class MeasurementRepository {
  Box get _box => Hive.box(HiveBoxes.measurements);

  List<Measurement> getForChild(String childId) {
    final raw = _box.get(childId) as List?;
    if (raw == null) return [];
    final list = <Measurement>[];
    for (final e in raw) {
      try {
        if (e is Map) {
          list.add(Measurement.fromMap(Map<String, dynamic>.from(e)));
        }
      } catch (err, stack) {
        debugPrint('Skipping corrupt Measurement for child $childId: $err\n$stack');
      }
    }
    list.sort((a, b) => b.date.compareTo(a.date));
    return list;
  }

  List<Measurement> getForChildAscending(String childId) =>
      getForChild(childId).reversed.toList();

  int get totalCount {
    int count = 0;
    for (final raw in _box.values) {
      if (raw is List) count += raw.length;
    }
    return count;
  }

  int get pendingCount {
    int count = 0;
    for (final raw in _box.values) {
      if (raw is List) {
        for (final item in raw) {
          if (item is Map && item['_syncStatus'] == 'pending') count++;
        }
      }
    }
    return count;
  }

  int get failedCount {
    int count = 0;
    for (final raw in _box.values) {
      if (raw is List) {
        for (final item in raw) {
          if (item is Map && item['_syncStatus'] == 'failed') count++;
        }
      }
    }
    return count;
  }

  /// Attempts to sync all pending measurements to the server.
  /// Called automatically by [MainShell] timer and on app resume.
  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final key in _box.keys) {
      final childId = key.toString();
      final list = (_box.get(childId) as List?) ?? [];
      bool anyUpdated = false;
      final updated = <dynamic>[];

      for (final raw in list) {
        final map = Map<String, dynamic>.from(raw as Map);
        if (map['_syncStatus'] != 'synced') {
          try {
            final m = Measurement.fromMap(map);
            final action = (map['_action'] ?? 'create').toString();
            final auditNote = map['_auditNote']?.toString();

            final ApiResponse res;
            if (action == 'update') {
              res = await BeneficiaryApi.updateNutritionRecord(
                childExternalId: childId,
                measurement: m,
                auditNote: auditNote,
              );
            } else {
              res = await BeneficiaryApi.syncNutritionRecord(childId, m);
            }

            if (res.success) {
              map['_syncStatus'] = 'synced';
              map.remove('_action');
              map.remove('_lastSyncError');
              map['_retryCount'] = 0;
              anyUpdated = true;
            } else {
              map['_lastSyncError'] = res.message;
              map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
              if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode != 408) {
                map['_syncStatus'] = 'failed';
              } else {
                map['_syncStatus'] = 'pending';
              }
              anyUpdated = true;
              errors.add('Measurement ($childId): ${res.message}');
            }
          } catch (e) {
            errors.add('Measurement ($childId): $e');
          }
        }
        updated.add(map);
      }

      if (anyUpdated) {
        await _box.put(childId, updated);
      }
    }
    if (errors.isEmpty) AppDataBus.notifyChanged();
    return errors;
  }

  /// Saves the measurement to local Hive storage immediately (offline-safe),
  /// then tries to sync to the server in the background.
  Future<void> addMeasurement(String childId, Measurement measurement) async {
    final current = (_box.get(childId) as List?) ?? [];
    final recordDate = measurement.date.toIso8601String();
    final map = measurement.toMap()
      ..['_syncStatus'] = 'pending'
      ..['_localId'] = recordDate;

    await _box.put(childId, [...current, map]);
    AppDataBus.notifyChanged();

    _trySyncSingle(childId, recordDate, measurement);
  }

  /// Updates a measurement in Hive and syncs the update to the server.
  /// Also triggers recompute of the child's status from latest valid measurement.
  Future<ApiResponse?> updateMeasurement({
    required String childId,
    required DateTime originalDate,
    required Measurement updatedMeasurement,
    String? auditNote,
  }) async {
    final list = (_box.get(childId) as List?) ?? [];
    final origDateStr = originalDate.toIso8601String().substring(0, 10);
    final newDateStr = updatedMeasurement.date.toIso8601String();

    String? foundServerId;
    final updated = list.map((raw) {
      final m = Map<String, dynamic>.from(raw as Map);
      final rawDate = (m['date'] ?? '').toString();
      final isMatch = rawDate.startsWith(origDateStr) ||
          m['_localId'] == originalDate.toIso8601String();
      if (isMatch) {
        foundServerId = m['record_id']?.toString() ?? m['server_id']?.toString();
        final newMap = updatedMeasurement.toMap()
          ..['_syncStatus'] = 'pending'
          ..['_action'] = 'update'
          ..['_localId'] = newDateStr
          ..['_auditNote'] = auditNote;
        if (foundServerId != null) {
          newMap['server_id'] = foundServerId;
        }
        return newMap;
      }
      return m;
    }).toList();

    await _box.put(childId, updated);
    await ChildRepository().recomputeChildStatusFromMeasurements(childId);
    AppDataBus.notifyChanged();

    return await _syncUpdateImmediately(childId, updatedMeasurement, auditNote, foundServerId);
  }

  /// Deletes a measurement from Hive and syncs the deletion to the server.
  /// Also triggers recompute of the child's status from remaining valid measurements.
  Future<void> deleteMeasurement({
    required String childId,
    required DateTime recordDate,
  }) async {
    final list = (_box.get(childId) as List?) ?? [];
    final targetDateStr = recordDate.toIso8601String().substring(0, 10);

    final filtered = list.where((raw) {
      if (raw is! Map) return true;
      final rawDate = (raw['date'] ?? '').toString();
      final isMatch = rawDate.startsWith(targetDateStr) ||
          raw['_localId'] == recordDate.toIso8601String();
      return !isMatch;
    }).toList();

    await _box.put(childId, filtered);
    await ChildRepository().recomputeChildStatusFromMeasurements(childId);
    AppDataBus.notifyChanged();

    _trySyncDelete(childId, recordDate);
  }

  /// Background sync attempt for a single record.
  void _trySyncSingle(String childId, String recordDate, Measurement measurement) {
    Future(() async {
      final res = await BeneficiaryApi.syncNutritionRecord(childId, measurement);
      final list = (_box.get(childId) as List?) ?? [];
      bool updated = false;
      final newList = list.map((raw) {
        final m = Map<String, dynamic>.from(raw as Map);
        if (m['_localId'] == recordDate || m['date'] == recordDate) {
          if (res.success) {
            m['_syncStatus'] = 'synced';
            m.remove('_lastSyncError');
            m['_retryCount'] = 0;
            if (res.data != null && res.data is Map && (res.data as Map)['record_id'] != null) {
              m['server_id'] = (res.data as Map)['record_id'].toString();
            }
          } else {
            m['_syncStatus'] = 'failed';
            m['_lastSyncError'] = res.message;
            m['_retryCount'] = ((m['_retryCount'] as int?) ?? 0) + 1;
          }
          updated = true;
        }
        return m;
      }).toList();

      if (updated) {
        await _box.put(childId, newList);
        AppDataBus.notifyChanged();
        if (res.success) {
          debugPrint('[Sync] Measurement synced to server: $recordDate');
        } else {
          debugPrint('[Sync] Measurement sync failed: ${res.message}');
        }
      }
    });
  }

  Future<ApiResponse?> _syncUpdateImmediately(
    String childId,
    Measurement measurement,
    String? auditNote,
    String? serverId,
  ) async {
    try {
      final res = await BeneficiaryApi.updateNutritionRecord(
        childExternalId: childId,
        measurement: measurement,
        auditNote: auditNote,
        serverId: serverId,
      );
      final list = (_box.get(childId) as List?) ?? [];
      final dateStr = measurement.date.toIso8601String();
      final updated = list.map((raw) {
        final m = Map<String, dynamic>.from(raw as Map);
        if (m['_localId'] == dateStr || m['date'] == dateStr) {
          if (res.success) {
            m['_syncStatus'] = 'synced';
            m.remove('_action');
            m.remove('_lastSyncError');
          } else {
            m['_syncStatus'] = 'pending';
            m['_lastSyncError'] = res.message;
          }
        }
        return m;
      }).toList();
      await _box.put(childId, updated);
      AppDataBus.notifyChanged();
      return res;
    } catch (e) {
      return ApiResponse(success: false, statusCode: 500, message: e.toString());
    }
  }

  void _trySyncDelete(String childId, DateTime recordDate) {
    Future(() async {
      await BeneficiaryApi.deleteNutritionRecord(
        childExternalId: childId,
        recordDate: recordDate,
      );
    });
  }
}
