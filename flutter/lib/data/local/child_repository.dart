import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/child.dart';
import 'hive_boxes.dart';
import 'app_data_bus.dart';
import '../models/child_status_filter.dart';
import '../remote/beneficiary_api.dart';

class ChildRepository {
  Box get _box => Hive.box(HiveBoxes.children);

  Future<Child> add(Child child) async {
    final map = child.toMap()..['_syncStatus'] = 'pending';
    await _box.put(child.id, map);
    AppDataBus.notifyChanged();
    _trySync(child).catchError((e) {
      debugPrint('Background child sync error: $e');
      return null;
    });
    return child;
  }

  List<Child> getAll() =>
      _box.values.map((c) => Child.fromMap(c as Map)).toList();

  List<Child> getByBarangay(String barangay) =>
      getAll().where((c) => c.barangay == barangay).toList();

  Future<void> update(Child child) async {
    final map = child.toMap()..['_syncStatus'] = 'pending';
    await _box.put(child.id, map);
    AppDataBus.notifyChanged();
    _trySync(child).catchError((e) {
      debugPrint('Background child sync error: $e');
      return null;
    });
  }

  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final raw in List.from(_box.values)) {
      final map = Map<String, dynamic>.from(raw as Map);
      if (map['_syncStatus'] != 'synced') {
        final res = await _trySync(Child.fromMap(map));
        if (res != null && !res.success) {
          errors.add('${map['fullName'] ?? 'Child'}: ${res.message}');
        }
      }
    }
    return errors;
  }

  int get pendingCount => _box.values
      .where((raw) => (raw as Map)['_syncStatus'] != 'synced')
      .length;

  Future<ApiResponse?> _trySync(Child child) async {
    final res = await BeneficiaryApi.syncChild(child);
    final existing = _box.get(child.id) as Map?;
    final map = Map<String, dynamic>.from(existing ?? child.toMap());
    if (res.success) {
      map['_syncStatus'] = 'synced';
      map.remove('_lastSyncError');
      map['_retryCount'] = 0;
    } else {
      map['_syncStatus'] = 'failed';
      map['_lastSyncError'] = res.message;
      map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
    }
    await _box.put(child.id, map);
    return res;
  }

  List<Child> search(String query, {required String barangay, int limit = 6}) {
    final lower = query.trim().toLowerCase();
    return getByBarangay(barangay)
        .where(
          (c) =>
              c.isActive &&
              (lower.isEmpty || c.fullName.toLowerCase().contains(lower)),
        )
        .take(limit)
        .toList();
  }

  List<Child> getByIds(List<String> ids) =>
      getAll().where((c) => ids.contains(c.id)).toList();

  /// Matches the OPT Plus sequence format seen in your wireframe:
  /// {barangay code}-{year}-{running count, zero-padded}
  String generateSequenceNo({required String barangayCode}) {
    final year = DateTime.now().year;
    final countThisYear = getAll()
        .where((c) => c.sequenceNo.contains('$barangayCode-$year'))
        .length;
    final nextNumber = (countThisYear + 1).toString().padLeft(3, '0');
    return '$barangayCode-$year-$nextNumber';
  }

  static String generateId() => const Uuid().v4();

  /// Single query point for the Masterlist — handles active/inactive,
  /// search text, and nutrition status filtering all in one place, so
  /// the screen never touches raw Hive data directly.
  List<Child> getFiltered({
    required String barangay,
    required bool activeOnly,
    String query = '',
    ChildStatusFilter? filter,
  }) {
    final lower = query.trim().toLowerCase();
    return getByBarangay(barangay).where((c) {
      final matchesActive = c.isActive == activeOnly;
      final matchesQuery =
          lower.isEmpty || c.fullName.toLowerCase().contains(lower);
      bool matchesFilter = true;
      if (filter != null) {
        if (filter.onlyNotWeighed) {
          matchesFilter = c.nutritionStatus == 'Not weighed';
        } else {
          if (filter.weightForAge != 'All' &&
              c.nutritionStatus != filter.weightForAge) {
            matchesFilter = false;
          }
          if (filter.heightForAge != 'All' &&
              c.stuntingStatus != filter.heightForAge) {
            matchesFilter = false;
          }
          if (filter.wasting != 'All' && c.wastingStatus != filter.wasting) {
            matchesFilter = false;
          }
        }
      }
      return matchesActive && matchesQuery && matchesFilter;
    }).toList();
  }

  int countActive(String barangay) =>
      getByBarangay(barangay).where((c) => c.isActive).length;
  int countInactive(String barangay) =>
      getByBarangay(barangay).where((c) => !c.isActive).length;
}
