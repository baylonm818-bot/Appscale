import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/mother.dart';
import 'hive_boxes.dart';
import 'app_data_bus.dart';
import '../remote/beneficiary_api.dart';

class MotherRepository {
  Box get _box => Hive.box(HiveBoxes.mothers);

  Future<Mother> add(Mother mother) async {
    final map = mother.toMap()..['_syncStatus'] = 'pending';
    await _box.put(mother.id, map);
    AppDataBus.notifyChanged();
    await _trySync(mother);
    return mother;
  }

  Mother? getById(String id) {
    final map = _box.get(id);
    return map == null ? null : Mother.fromMap(map as Map);
  }

  List<Mother> getAll() =>
      _box.values.map((m) => Mother.fromMap(m as Map)).toList();

  Future<void> update(Mother mother) async {
    final map = mother.toMap()..['_syncStatus'] = 'pending';
    await _box.put(mother.id, map);
    AppDataBus.notifyChanged();
    await _trySync(mother);
  }

  Future<List<String>> syncPending() async {
    final errors = <String>[];
    for (final raw in List.from(_box.values)) {
      final map = Map<String, dynamic>.from(raw as Map);
      if (map['_syncStatus'] != 'synced') {
        final res = await _trySync(Mother.fromMap(map));
        if (res != null && !res.success) {
          errors.add('${map['fullName'] ?? 'Mother'}: ${res.message}');
        }
      }
    }
    return errors;
  }

  int get pendingCount => _box.values
      .where((raw) => (raw as Map)['_syncStatus'] != 'synced')
      .length;

  Future<ApiResponse?> _trySync(Mother mother) async {
    final res = await BeneficiaryApi.syncMother(mother);
    final existing = _box.get(mother.id) as Map?;
    final map = Map<String, dynamic>.from(existing ?? mother.toMap());
    if (res.success) {
      map['_syncStatus'] = 'synced';
      map.remove('_lastSyncError');
      map['_retryCount'] = 0;
    } else {
      map['_syncStatus'] = 'failed';
      map['_lastSyncError'] = res.message;
      map['_retryCount'] = ((map['_retryCount'] as int?) ?? 0) + 1;
    }
    await _box.put(mother.id, map);
    return res;
  }

  /// Used by the Link Mother search field — filters by barangay first,
  /// then by name, and caps results so the list never overwhelms the screen.
  List<Mother> search(String query, {required String barangay, int limit = 6}) {
    final lower = query.trim().toLowerCase();
    final results = getAll().where((m) {
      final matchesBarangay =
          m.barangay.toLowerCase() == barangay.toLowerCase();
      final matchesName =
          lower.isEmpty || m.fullName.toLowerCase().contains(lower);
      return matchesBarangay && matchesName;
    }).toList();
    return results.take(limit).toList();
  }

  static String generateId() => const Uuid().v4();

  List<Mother> getFiltered({
    required String barangay,
    required bool activeOnly,
    String query = '',
  }) {
    final lower = query.trim().toLowerCase();
    return getAll().where((m) {
      final matchesBarangay =
          m.barangay.toLowerCase() == barangay.toLowerCase();
      final matchesActive = m.isActive == activeOnly;
      final matchesQuery =
          lower.isEmpty || m.fullName.toLowerCase().contains(lower);
      return matchesBarangay && matchesActive && matchesQuery;
    }).toList();
  }

  int countActive(String barangay) =>
      getAll().where((m) => m.barangay == barangay && m.isActive).length;
  int countInactive(String barangay) =>
      getAll().where((m) => m.barangay == barangay && !m.isActive).length;
}
