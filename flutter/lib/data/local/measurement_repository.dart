import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/measurement.dart';
import '../remote/beneficiary_api.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';

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
          if (item is Map && item['_syncStatus'] != 'synced') {
            count++;
          }
        }
      }
    }
    return count;
  }

  Future<void> syncPending() async {
    for (final key in _box.keys) {
      final childId = key.toString();
      final list = (_box.get(childId) as List?) ?? [];
      bool modified = false;
      final updatedList = [];
      for (final raw in list) {
        final map = Map<String, dynamic>.from(raw as Map);
        if (map['_syncStatus'] != 'synced') {
          try {
            final m = Measurement.fromMap(map);
            await BeneficiaryApi.syncNutritionRecord(childId, m);
            map['_syncStatus'] = 'synced';
            modified = true;
          } catch (_) {
            // Keep pending until next retry
          }
        }
        updatedList.add(map);
      }
      if (modified) {
        await _box.put(childId, updatedList);
      }
    }
  }

  Future<void> addMeasurement(String childId, Measurement measurement) async {
    final current = (_box.get(childId) as List?) ?? [];
    final map = measurement.toMap()..['_syncStatus'] = 'pending';
    await _box.put(childId, [...current, map]);
    AppDataBus.notifyChanged();

    try {
      await BeneficiaryApi.syncNutritionRecord(childId, measurement);
      final currentAfterSync = (_box.get(childId) as List?) ?? [];
      final syncedList = currentAfterSync.map((item) {
        final itemMap = Map<String, dynamic>.from(item as Map);
        if (itemMap['date'] == map['date']) {
          itemMap['_syncStatus'] = 'synced';
        }
        return itemMap;
      }).toList();
      await _box.put(childId, syncedList);
      AppDataBus.notifyChanged();
    } catch (e) {
      debugPrint('Offline measurement saved locally; queued for synchronization: $e');
    }
  }
}
