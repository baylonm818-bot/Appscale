import 'package:hive_flutter/hive_flutter.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import '../models/feeding_schedule.dart';
import '../remote/beneficiary_api.dart';

/// One schedule per barangay — setting a new one overwrites the old,
/// since a barangay realistically runs one feeding pattern at a time.
class FeedingScheduleRepository {
  Box get _box => Hive.box(HiveBoxes.feedingSchedule);

  Future<void> save(FeedingSchedule schedule) async {
    await _box.put(schedule.barangay, schedule.toMap()..['_syncStatus'] = 'pending');
    AppDataBus.notifyChanged();

    try {
      final res = await BeneficiaryApi.syncFeedingSchedule(schedule);
      if (res.success) {
        await _box.put(schedule.barangay, schedule.toMap()..['_syncStatus'] = 'synced');
      }
    } catch (_) {}
  }

  FeedingSchedule? get(String barangay) {
    final raw = _box.get(barangay);
    return raw == null
        ? null
        : FeedingSchedule.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  int get pendingCount {
    var count = 0;
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw is Map && raw['_syncStatus'] == 'pending') count++;
    }
    return count;
  }

  Future<void> syncPending() async {
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw is Map && raw['_syncStatus'] == 'pending') {
        final schedule = FeedingSchedule.fromMap(Map<String, dynamic>.from(raw));
        try {
          final res = await BeneficiaryApi.syncFeedingSchedule(schedule);
          if (res.success) {
            await _box.put(key, schedule.toMap()..['_syncStatus'] = 'synced');
          }
        } catch (_) {}
      }
    }
  }
}
