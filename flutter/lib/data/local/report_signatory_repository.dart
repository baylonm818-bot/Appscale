import 'package:hive_flutter/hive_flutter.dart';
import 'hive_boxes.dart';
import '../models/report_signatory.dart';
import '../../shared/utils/app_user_identity.dart';

class ReportSignatoryRepository {
  Box get _box => Hive.box(HiveBoxes.reportSignatories);

  String _userKey(String userId) => 'remembered_user_$userId';

  /// Save remembered signatories specifically for a user
  Future<void> saveRemembered(String userId, ReportSignatory signatory) async {
    if (userId.isEmpty) return;
    await _box.put(_userKey(userId), signatory.toMap());
  }

  /// Get remembered signatories for a specific user.
  /// Returns null if user has not opted to remember signatories.
  ReportSignatory? getRemembered(String userId) {
    if (userId.isEmpty) return null;
    final raw = _box.get(_userKey(userId));
    if (raw == null) return null;
    return ReportSignatory.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  /// Clear remembered signatories for a user
  Future<void> clearRemembered(String userId) async {
    if (userId.isEmpty) return;
    await _box.delete(_userKey(userId));
  }

  /// Check if user has remembered signatories saved
  bool hasRemembered(String userId) {
    if (userId.isEmpty) return false;
    return _box.containsKey(_userKey(userId));
  }

  /// Resolves the active signatory for the logged-in user.
  /// - BNS name is ALWAYS auto-filled with the logged-in user's display name from Hive.
  /// - Other signatories are blank by default, unless remembered by this user.
  ReportSignatory resolveForUser(Map<String, dynamic>? authUser) {
    final bnsName = AppUserIdentity.resolveDisplayName(authUser);
    final barangay = AppUserIdentity.resolveBarangay(authUser);
    final userId = authUser?['id']?.toString() ??
        authUser?['user_id']?.toString() ??
        authUser?['username']?.toString() ??
        '';

    final remembered = getRemembered(userId);
    if (remembered != null) {
      return ReportSignatory(
        barangay: barangay,
        bnsName: bnsName, // Always current logged-in user
        punongBarangayName: remembered.punongBarangayName,
        mnaoAdminAideName: remembered.mnaoAdminAideName,
        dnpcName: remembered.dnpcName,
        bnsPosition: remembered.bnsPosition,
        punongBarangayPosition: remembered.punongBarangayPosition,
        mnaoAdminAidePosition: remembered.mnaoAdminAidePosition,
        dnpcPosition: remembered.dnpcPosition,
        barangayLogoPath: remembered.barangayLogoPath,
      );
    }

    return ReportSignatory(
      barangay: barangay,
      bnsName: bnsName,
      punongBarangayName: '',
      mnaoAdminAideName: '',
      dnpcName: '',
    );
  }

  /// Fallback get by barangay (no hardcoded defaults)
  ReportSignatory? get(String barangay) {
    final raw = _box.get(barangay);
    return raw == null
        ? null
        : ReportSignatory.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  /// Fallback save by barangay
  Future<void> save(ReportSignatory signatory) async {
    await _box.put(signatory.barangay, signatory.toMap());
  }
}
