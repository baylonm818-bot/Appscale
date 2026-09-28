import 'package:hive_flutter/hive_flutter.dart';
import '../models/vitamin_a_record.dart';
import 'activity_log_repository.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';

class VitaminARepository {
  Box get _box => Hive.box(HiveBoxes.vitaminA);

  List<VitaminARecord> getAllForBarangay(String barangay) {
    final list = _box.values
        .map((e) => VitaminARecord.fromMap(Map<String, dynamic>.from(e as Map)))
        .where((r) => r.barangay == barangay)
        .toList();
    list.sort((a, b) => b.dateGiven.compareTo(a.dateGiven));
    return list;
  }

  List<VitaminARecord> getByChildId(String childId) {
    final list = _box.values
        .map((e) => VitaminARecord.fromMap(Map<String, dynamic>.from(e as Map)))
        .where((r) => r.childId == childId)
        .toList();
    list.sort((a, b) => b.dateGiven.compareTo(a.dateGiven));
    return list;
  }

  VitaminARecord? getLatestForChild(String childId) {
    final list = getByChildId(childId);
    return list.isNotEmpty ? list.first : null;
  }

  Future<void> save(VitaminARecord record) async {
    await _box.put(record.id, record.toMap());
    await ActivityLogRepository().logActivity(
      type: 'measurement_added',
      title: 'Administered Vit A: ${record.childName} (${record.dosage})',
    );
    AppDataBus.notifyChanged();
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
