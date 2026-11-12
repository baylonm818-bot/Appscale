import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import '../models/report_signatory.dart';
import '../remote/beneficiary_api.dart';
import '../../shared/utils/app_user_identity.dart';

class ReportSignatoryRepository {
  Box get _box => Hive.box(HiveBoxes.reportSignatories);

  String _userKey(String userId) => 'remembered_user_$userId';

  /// Save remembered signatories specifically for a user
  Future<void> saveRemembered(String userId, ReportSignatory signatory) async {
    if (userId.isEmpty) return;
    await _box.put(_userKey(userId), signatory.toMap());
    AppDataBus.notifyChanged();
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
    AppDataBus.notifyChanged();
  }

  /// Check if user has remembered signatories saved
  bool hasRemembered(String userId) {
    if (userId.isEmpty) return false;
    return _box.containsKey(_userKey(userId));
  }

  /// Resolves the active signatory for the logged-in user.
  /// - Admin-configured signatories for this barangay or 'All Barangays' take priority.
  /// - If prepared by is not set, falls back to the logged-in user's display name.
  /// - If nothing is configured, returns dynamic 'Not set' fallback with logged reason.
  ReportSignatory resolveForUser(Map<String, dynamic>? authUser) {
    final bnsName = AppUserIdentity.resolveDisplayName(authUser);
    final barangay = AppUserIdentity.resolveBarangay(authUser);
    final userId = authUser?['id']?.toString() ??
        authUser?['user_id']?.toString() ??
        authUser?['username']?.toString() ??
        '';

    // 1. Check admin-configured for specific barangay
    final adminConfigured = get(barangay) ?? get('All Barangays');
    if (adminConfigured != null) {
      if ((adminConfigured.preparedByName == 'Not set' ||
              adminConfigured.bnsName.isEmpty) &&
          bnsName.isNotEmpty) {
        return adminConfigured.copyWith(
          bnsName: bnsName,
          items: adminConfigured.items.map((item) {
            if (item.roleTitle.toUpperCase().contains('PREPARED') ||
                item.roleTitle.toUpperCase().contains('SUBMITTED')) {
              return SignatoryItem(
                roleTitle: item.roleTitle,
                name: bnsName,
                position: item.position,
                dateLine: item.dateLine,
              );
            }
            return item;
          }).toList(),
        );
      }
      return adminConfigured;
    }

    // 2. Check user-remembered
    final remembered = getRemembered(userId);
    if (remembered != null) {
      return remembered.copyWith(
        barangay: barangay,
        bnsName: bnsName.isNotEmpty ? bnsName : remembered.bnsName,
      );
    }

    // 3. Fallback when nothing is configured
    debugPrint(
      '[ReportSignatory] Fallback applied: No signatories found for Barangay "$barangay" in local storage. Returning default "Not set" placeholders.',
    );
    return ReportSignatory.fromBackendRows(barangay, []);
  }

  /// Fallback get by barangay (no hardcoded defaults)
  ReportSignatory? get(String barangay) {
    final raw = _box.get(barangay);
    return raw == null
        ? null
        : ReportSignatory.fromMap(Map<String, dynamic>.from(raw as Map));
  }

  /// Save by barangay
  Future<void> save(ReportSignatory signatory) async {
    await _box.put(signatory.barangay, signatory.toMap());
    AppDataBus.notifyChanged();
  }

  /// Fetches fresh signatories from the backend (/api/reports/signatories)
  /// and updates the local Hive cache immediately, triggering live listeners.
  Future<ReportSignatory> fetchAndCacheForBarangay(String barangay) async {
    try {
      final rows = await BeneficiaryApi.fetchSignatories(barangay);
      if (rows.isNotEmpty) {
        final signatory = ReportSignatory.fromBackendRows(barangay, rows);
        await save(signatory);
        debugPrint(
          '[ReportSignatory] Successfully fetched and cached ${signatory.items.length} signatories for Barangay "$barangay".',
        );
        return signatory;
      }
    } catch (e) {
      debugPrint('[ReportSignatory] fetchAndCacheForBarangay error: $e');
    }

    // Return existing cached or fallback
    return get(barangay) ?? ReportSignatory.fromBackendRows(barangay, []);
  }
}
