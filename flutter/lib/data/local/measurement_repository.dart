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

  Future<void> addMeasurement(String childId, Measurement measurement) async {
    final current = (_box.get(childId) as List?) ?? [];
    await _box.put(childId, [...current, measurement.toMap()]);
    AppDataBus.notifyChanged();

    try {
      await BeneficiaryApi.syncNutritionRecord(childId, measurement);
    } catch (e) {
      print('Offline measurement sync failed: $e');
    }
  }
}
