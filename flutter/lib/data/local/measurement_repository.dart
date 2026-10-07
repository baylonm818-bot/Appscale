import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/measurement.dart';
import '../remote/beneficiary_api.dart';
import 'app_data_bus.dart';
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
    final list = raw
        .map((e) => Measurement.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
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
          if (item is Map && item['_syncStatus'] != 'synced') count++;
        }
      }
    }
    return count;
  }

  /// Attempts to sync all pending measurements to the server.
  /// Called automatically by [MainShell] timer and on app resume.
  /// Attempts to sync all pending measurements to the server.
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
          final m = Measurement.fromMap(map);
          final res = await BeneficiaryApi.syncNutritionRecord(childId, m);
          if (res.success) {
            map['_syncStatus'] = 'synced';
            map.remove('_lastSyncError');
            map['_retryCount'] = 0;
            anyUpdated = true;
          } else {
            map['_syncStatus'] = 'failed';
            map['_lastSyncError'] = res.message;
            map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
            anyUpdated = true;
            errors.add('Measurement ($childId): ${res.message}');
          }
        }
        updated.add(map);
      }

      if (anyUpdated) {
        await _box.put(childId, updated);
      }
    }
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
}
