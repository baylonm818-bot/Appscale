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

  String _remarksKey(String barangay, DateTime date) =>
      '${_key(barangay, date)}|remarks';

  String _foodKey(String barangay, DateTime date) =>
      '${_key(barangay, date)}|food';

  String _childFoodKey(String barangay, DateTime date) =>
      '${_key(barangay, date)}|child_food';

  Future<void> saveForDate(
    String barangay,
    DateTime date,
    Map<String, String> statuses, {
    Map<String, String>? remarks,
    String? foodServed,
    Map<String, String>? childFood,
  }) async {
    await _box.put(_key(barangay, date), statuses);
    if (remarks != null) {
      await _box.put(_remarksKey(barangay, date), remarks);
    }
    if (foodServed != null) {
      await _box.put(_foodKey(barangay, date), foodServed);
    }
    if (childFood != null) {
      await _box.put(_childFoodKey(barangay, date), childFood);
    }
    AppDataBus.notifyChanged();

    try {
      await BeneficiaryApi.syncFeedingAttendance(
        barangay: barangay,
        date: date,
        statuses: statuses,
        remarks: remarks ?? getRemarksForDate(barangay, date),
        foodServed: foodServed ?? getFoodServedForDate(barangay, date),
      );
    } catch (_) {}
  }

  Map<String, String> getRemarksForDate(String barangay, DateTime date) {
    final raw = _box.get(_remarksKey(barangay, date)) as Map?;
    if (raw == null) return {};
    return raw.map((k, v) => MapEntry(k.toString(), v.toString()));
  }

  String getFoodServedForDate(String barangay, DateTime date) {
    final raw = _box.get(_foodKey(barangay, date));
    return raw?.toString() ?? '';
  }

  Map<String, String> getChildFoodForDate(String barangay, DateTime date) {
    final raw = _box.get(_childFoodKey(barangay, date)) as Map?;
    if (raw == null) return {};
    return raw.map((k, v) => MapEntry(k.toString(), v.toString()));
  }

  /// Absence history per child
  List<Map<String, dynamic>> getAbsenceHistoryForChild(
    String barangay,
    String childId,
  ) {
    final loggedDates = getLoggedDates(barangay);
    loggedDates.sort((a, b) => b.compareTo(a));
    final history = <Map<String, dynamic>>[];

    for (final d in loggedDates) {
      final statuses = getForDate(barangay, d);
      if (statuses[childId] == 'Absent') {
        final remarks = getRemarksForDate(barangay, d);
        history.add({
          'date': d,
          'remark': remarks[childId] ?? 'No reason stated',
        });
      }
    }
    return history;
  }

  /// Food history per child (what they ate across feeding sessions)
  List<Map<String, dynamic>> getFoodHistoryForChild(
    String barangay,
    String childId,
  ) {
    final loggedDates = getLoggedDates(barangay);
    loggedDates.sort((a, b) => b.compareTo(a));
    final history = <Map<String, dynamic>>[];

    for (final d in loggedDates) {
      final statuses = getForDate(barangay, d);
      if (statuses[childId] == 'Present') {
        final childFood = getChildFoodForDate(barangay, d);
        final defaultFood = getFoodServedForDate(barangay, d);
        final foodAte = childFood[childId] ??
            (defaultFood.isNotEmpty ? defaultFood : 'Supplemental Nutritious Meal');
        history.add({
          'date': d,
          'food': foodAte,
        });
      }
    }
    return history;
  }

  Future<void> syncPending() async {
    for (final key in _box.keys) {
      final keyStr = key.toString();
      if (keyStr.contains('|remarks') || keyStr.contains('|food') || keyStr.contains('|child_food')) {
        continue;
      }
      final parts = keyStr.split('|');
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
                remarks: getRemarksForDate(barangay, date),
                foodServed: getFoodServedForDate(barangay, date),
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

  /// Calculates attended days for a child in the 120-day feeding program:
  /// - Only counts attendance on or after child's enrollment date
  /// - Never counts future dates
  /// - Caps at elapsed days since enrollment
  /// - Maximum capped at 120 days
  int getAttendedDaysForChild(
    String barangay,
    String childId, {
    DateTime? enrolledDate,
  }) {
    final loggedDates = getLoggedDates(barangay);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final enrolled = enrolledDate != null
        ? DateTime(enrolledDate.year, enrolledDate.month, enrolledDate.day)
        : null;

    var daysPresent = 0;
    for (final d in loggedDates) {
      final dateOnly = DateTime(d.year, d.month, d.day);
      if (enrolled != null && dateOnly.isBefore(enrolled)) continue;
      if (dateOnly.isAfter(today)) continue;
      final statuses = getForDate(barangay, d);
      if (statuses[childId] == 'Present') {
        daysPresent++;
      }
    }
    if (enrolled != null) {
      final elapsedDays = today.difference(enrolled).inDays + 1;
      if (daysPresent > elapsedDays) {
        daysPresent = elapsedDays;
      }
    }
    return daysPresent.clamp(0, 120);
  }
}
