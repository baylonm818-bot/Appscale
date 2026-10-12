import 'package:hive_flutter/hive_flutter.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import '../remote/beneficiary_api.dart';

/// Attendance is now keyed by calendar date, not by a session object —
/// marking today's attendance never requires creating anything first.
class FeedingAttendanceRepository {
  Box get _box => Hive.box(HiveBoxes.feedingAttendance);

  String _key(String barangay, DateTime date) =>
      '$barangay|${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<void> saveForDate(
    String barangay,
    DateTime date,
    Map<String, String> statuses,
  ) async {
    await _box.put(_key(barangay, date), statuses);
    AppDataBus.notifyChanged();

    try {
      await BeneficiaryApi.syncFeedingAttendance(
        barangay: barangay,
        date: date,
        statuses: statuses,
      );
    } catch (_) {}
  }

  Future<void> syncPending() async {
    for (final key in _box.keys) {
      final parts = key.toString().split('|');
      if (parts.length == 2) {
        final barangay = parts[0];
        final date = DateTime.tryParse(parts[1]);
        if (date != null) {
          final statuses = getForDate(barangay, date);
          if (statuses.isNotEmpty) {
            try {
              await BeneficiaryApi.syncFeedingAttendance(
                barangay: barangay,
                date: date,
                statuses: statuses,
              );
            } catch (_) {}
          }
        }
      }
    }
  }

  Map<String, String> getForDate(String barangay, DateTime date) {
    final raw = _box.get(_key(barangay, date)) as Map?;
    if (raw == null) return {};
    return raw.map((k, v) => MapEntry(k.toString(), v.toString()));
  }

  List<DateTime> getLoggedDates(String barangay) {
    final prefix = '$barangay|';
    return _box.keys.where((k) => k.toString().startsWith(prefix)).map((k) {
      final parts = k.toString().substring(prefix.length).split('-');
      return DateTime(
        int.parse(parts[0]),
        int.parse(parts[1]),
        int.parse(parts[2]),
      );
    }).toList();
  }

  double? getAttendanceRate(String barangay) {
    var present = 0, total = 0;
    for (final d in getLoggedDates(barangay)) {
      for (final status in getForDate(barangay, d).values) {
        total++;
        if (status == 'Present') present++;
      }
    }
    return total == 0 ? null : present / total;
  }
}
