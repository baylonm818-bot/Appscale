import 'package:hive_flutter/hive_flutter.dart';
import 'hive_boxes.dart';

/// Centralized mapping service for local client IDs (e.g. Hive UUIDs) to server IDs (auto-increment INTs).
/// Ensures that child records use the server-assigned mother ID, and measurements use the server-assigned child ID.
class SyncIdMapper {
  SyncIdMapper._();
  static final SyncIdMapper instance = SyncIdMapper._();

  static const String _motherMapKey = 'id_map_mothers';
  static const String _childMapKey = 'id_map_children';

  final Map<String, dynamic> _motherMemoryMap = {};
  final Map<String, dynamic> _childMemoryMap = {};
  bool _initialized = false;

  void _ensureInitialized() {
    if (_initialized) return;
    try {
      final box = Hive.box(HiveBoxes.settings);
      final rawMothers = box.get(_motherMapKey);
      if (rawMothers is Map) {
        _motherMemoryMap.addAll(Map<String, dynamic>.from(rawMothers));
      }
      final rawChildren = box.get(_childMapKey);
      if (rawChildren is Map) {
        _childMemoryMap.addAll(Map<String, dynamic>.from(rawChildren));
      }
      _initialized = true;
    } catch (_) {}
  }

  void saveMotherId(String localId, dynamic serverId) {
    if (localId.isEmpty || serverId == null) return;
    _ensureInitialized();
    _motherMemoryMap[localId] = serverId;
    try {
      Hive.box(HiveBoxes.settings).put(_motherMapKey, _motherMemoryMap);
    } catch (_) {}
  }

  dynamic getMotherServerId(String? localId) {
    if (localId == null || localId.trim().isEmpty) return null;
    _ensureInitialized();
    final clean = localId.trim();
    if (RegExp(r'^\d+$').hasMatch(clean)) {
      return int.tryParse(clean) ?? clean;
    }
    return _motherMemoryMap[clean];
  }

  void saveChildId(String localId, dynamic serverId) {
    if (localId.isEmpty || serverId == null) return;
    _ensureInitialized();
    _childMemoryMap[localId] = serverId;
    try {
      Hive.box(HiveBoxes.settings).put(_childMapKey, _childMemoryMap);
    } catch (_) {}
  }

  dynamic getChildServerId(String? localId) {
    if (localId == null || localId.trim().isEmpty) return null;
    _ensureInitialized();
    final clean = localId.trim();
    if (RegExp(r'^\d+$').hasMatch(clean)) {
      return int.tryParse(clean) ?? clean;
    }
    return _childMemoryMap[clean];
  }
}
