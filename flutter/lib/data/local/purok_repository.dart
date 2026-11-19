import 'package:hive_flutter/hive_flutter.dart';
import '../models/purok.dart';
import 'hive_boxes.dart';

class PurokRepository {
  final _box = Hive.box(HiveBoxes.puroks);

  List<Purok> getAll() {
    final list = <Purok>[];
    for (final raw in _box.values) {
      if (raw is Map) {
        final p = Purok.fromMap(raw);
        if (p.isActive) list.add(p);
      }
    }
    return list;
  }

  List<Purok> getByBarangay(String barangay) {
    if (barangay.isEmpty) return getAll();
    final lower = barangay.trim().toLowerCase();
    final matches = <Purok>[];
    for (final raw in _box.values) {
      if (raw is Map) {
        final p = Purok.fromMap(raw);
        if (p.isActive && p.barangayName.trim().toLowerCase() == lower) {
          matches.add(p);
        }
      }
    }
    return matches;
  }

  Future<void> saveAll(List<Purok> puroks) async {
    final map = <dynamic, dynamic>{};
    for (final p in puroks) {
      map[p.id > 0 ? p.id.toString() : '${p.barangayName}_${p.name}'] = p.toMap();
    }
    await _box.putAll(map);
  }

  Future<void> clear() => _box.clear();
}
