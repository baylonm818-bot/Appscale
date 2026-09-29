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
  Future<void> syncPending() async {
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
            await BeneficiaryApi.syncNutritionRecord(childId, m);
            map['_syncStatus'] = 'synced';
            anyUpdated = true;
          } catch (_) {
            // No internet or server error — keep as pending, retry next time
          }
        }
        updated.add(map);
      }

      if (anyUpdated) {
        await _box.put(childId, updated);
      }
    }
  }

  /// Saves the measurement to local Hive storage immediately (offline-safe),
  /// then tries to sync to the server in the background.
  /// If sync fails (no internet), the record stays as 'pending' and will
  /// be automatically synced by the next [syncPending] call.
  Future<void> addMeasurement(String childId, Measurement measurement) async {
    // Step 1: Save locally first — always succeeds regardless of internet
    final current = (_box.get(childId) as List?) ?? [];
    final recordDate = measurement.date.toIso8601String();
    final map = measurement.toMap()
      ..['_syncStatus'] = 'pending'
      ..['_localId'] = recordDate;

    await _box.put(childId, [...current, map]);
    AppDataBus.notifyChanged();

    // Step 2: Try to sync immediately in the background
    _trySyncSingle(childId, recordDate, measurement);
  }

  /// Background sync attempt for a single record.
  /// Does not throw — failure is silent and will be retried by the auto-sync timer.
  void _trySyncSingle(String childId, String recordDate, Measurement measurement) {
    Future(() async {
      try {
        await BeneficiaryApi.syncNutritionRecord(childId, measurement);
        // Mark this specific record as synced in Hive
        final list = (_box.get(childId) as List?) ?? [];
        bool updated = false;
        final newList = list.map((raw) {
          final m = Map<String, dynamic>.from(raw as Map);
          if (m['_localId'] == recordDate || m['date'] == recordDate) {
            m['_syncStatus'] = 'synced';
            updated = true;
          }
          return m;
        }).toList();

        if (updated) {
          await _box.put(childId, newList);
          AppDataBus.notifyChanged();
          debugPrint('[Sync] Measurement synced to server: $recordDate');
        }
      } catch (e) {
        // No internet — record stays as 'pending', auto-sync timer will retry
        debugPrint('[Sync] No internet, measurement queued locally: $e');
      }
    });
  }
}
