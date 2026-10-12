import 'package:hive_flutter/hive_flutter.dart';
import 'app_data_bus.dart';
import 'child_repository.dart';
import 'hive_boxes.dart';
import '../models/child.dart';
import '../remote/beneficiary_api.dart';

/// Feeding enrollment repository ensures ZERO DATA LOSS:
/// Enrolling marks the child as enrolled.
/// Unenrolling only changes the status to 'unenrolled' and records the
/// unenroll date, reason, and preserves the full cycle history.
class FeedingEnrollmentRepository {
  Box get _box => Hive.box(HiveBoxes.feedingEnrollment);

  bool isPendingSync(String childId) {
    final data = getEnrollmentData(childId);
    return data?['_syncStatus'] == 'pending';
  }

  Future<void> enroll(String childId, {String? notes}) async {
    final now = DateTime.now().toIso8601String();
    final existing = getEnrollmentData(childId);
    final history = (existing?['history'] as List<dynamic>?)
            ?.map((e) => Map<String, dynamic>.from(e as Map))
            .toList() ??
        [];

    final isReEnroll = existing != null && existing['status'] == 'unenrolled';
    history.add({
      'action': isReEnroll ? 're_enrolled' : 'enrolled',
      'date': now,
      'notes': notes ?? (isReEnroll ? 'Re-enrolled into feeding program' : 'Initial enrollment'),
    });

    final data = <String, dynamic>{
      'status': 'enrolled',
      'enrolled_at': isReEnroll ? now : (existing?['enrolled_at'] ?? now),
      'initial_enrolled_at': existing?['initial_enrolled_at'] ?? (existing?['enrolled_at'] ?? now),
      'unenrolled_at': null,
      'unenroll_reason': null,
      'notes': notes ?? existing?['notes'],
      'cycle_number': ((existing?['cycle_number'] as num?)?.toInt() ?? 1) + (isReEnroll ? 1 : 0),
      'history': history,
      '_syncStatus': 'pending',
    };
    await _box.put(childId, data);

    final childRepo = ChildRepository();
    final child = childRepo.getAll().firstWhere(
          (c) => c.id == childId,
          orElse: () => throw Exception('Child not found'),
        );
    await childRepo.update(child);
    AppDataBus.notifyChanged();

    try {
      final res = await BeneficiaryApi.syncProgramEnrollment(
        childId: childId,
        isEnrolled: true,
        barangay: child.barangay,
        beneficiaryName: child.fullName,
        notes: notes,
      );
      if (res.success) {
        data['_syncStatus'] = 'synced';
        await _box.put(childId, data);
        AppDataBus.notifyChanged();
      }
    } catch (_) {}
  }

  Future<void> unenroll(String childId, {String reason = 'Completed feeding cycle', String? notes}) async {
    final now = DateTime.now().toIso8601String();
    final existing = getEnrollmentData(childId);
    final history = (existing?['history'] as List<dynamic>?)
            ?.map((e) => Map<String, dynamic>.from(e as Map))
            .toList() ??
        [];

    history.add({
      'action': 'unenrolled',
      'date': now,
      'reason': reason,
      'notes': notes,
    });

    final data = <String, dynamic>{
      'status': 'unenrolled',
      'enrolled_at': existing?['enrolled_at'] ?? now,
      'initial_enrolled_at': existing?['initial_enrolled_at'] ?? existing?['enrolled_at'] ?? now,
      'unenrolled_at': now,
      'unenroll_reason': reason,
      'notes': notes ?? existing?['notes'],
      'cycle_number': (existing?['cycle_number'] as num?)?.toInt() ?? 1,
      'history': history,
      '_syncStatus': 'pending',
    };

    // ZERO DATA LOSS: DO NOT DELETE FROM HIVE BOX. Update status!
    await _box.put(childId, data);

    final childRepo = ChildRepository();
    final child = childRepo.getAll().firstWhere(
          (c) => c.id == childId,
          orElse: () => throw Exception('Child not found'),
        );
    await childRepo.update(child);
    AppDataBus.notifyChanged();

    try {
      final res = await BeneficiaryApi.syncProgramEnrollment(
        childId: childId,
        isEnrolled: false,
        barangay: child.barangay,
        beneficiaryName: child.fullName,
        unenrollReason: reason,
        notes: notes,
      );
      if (res.success) {
        data['_syncStatus'] = 'synced';
        await _box.put(childId, data);
        AppDataBus.notifyChanged();
      }
    } catch (_) {}
  }

  Future<void> syncPending() async {
    final childRepo = ChildRepository();
    for (final key in _box.keys) {
      final childId = key.toString();
      final data = getEnrollmentData(childId);
      if (data != null && data['_syncStatus'] == 'pending') {
        try {
          final child = childRepo.getById(childId);
          if (child == null) continue;
          final isEnr = data['status'] == 'enrolled';
          final res = await BeneficiaryApi.syncProgramEnrollment(
            childId: childId,
            isEnrolled: isEnr,
            barangay: child.barangay,
            beneficiaryName: child.fullName,
            unenrollReason: isEnr ? null : (data['unenroll_reason']?.toString() ?? 'Withdrawn'),
            notes: data['notes']?.toString(),
          );
          if (res.success) {
            data['_syncStatus'] = 'synced';
            await _box.put(childId, data);
          }
        } catch (_) {}
      }
    }
  }

  Map<String, dynamic>? getEnrollmentData(String childId) {
    final raw = _box.get(childId);
    if (raw == null) return null;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String) {
      return {
        'status': 'enrolled',
        'enrolled_at': raw,
        'initial_enrolled_at': raw,
        'unenrolled_at': null,
        'unenroll_reason': null,
        'cycle_number': 1,
        'history': [
          {'action': 'enrolled', 'date': raw, 'reason': 'Initial enrollment'}
        ],
      };
    }
    return null;
  }

  bool isEnrolled(String childId) {
    final data = getEnrollmentData(childId);
    if (data == null) return false;
    return data['status'] == 'enrolled';
  }

  bool wasEverEnrolled(String childId) {
    return _box.containsKey(childId);
  }

  DateTime? enrolledAt(String childId) {
    final data = getEnrollmentData(childId);
    final raw = data?['enrolled_at'] as String?;
    return raw == null ? null : DateTime.tryParse(raw);
  }

  DateTime? unenrolledAt(String childId) {
    final data = getEnrollmentData(childId);
    final raw = data?['unenrolled_at'] as String?;
    return raw == null ? null : DateTime.tryParse(raw);
  }

  String? unenrollReason(String childId) {
    final data = getEnrollmentData(childId);
    return data?['unenroll_reason'] as String?;
  }

  List<Map<String, dynamic>> getHistory(String childId) {
    final data = getEnrollmentData(childId);
    final hist = data?['history'] as List<dynamic>?;
    if (hist == null) return [];
    return hist.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Child> getEnrolledChildren(String barangay) {
    return ChildRepository()
        .getByBarangay(barangay)
        .where((c) => c.isActive && isEnrolled(c.id))
        .toList();
  }

  List<Child> getUnenrolledChildren(String barangay) {
    return ChildRepository()
        .getByBarangay(barangay)
        .where((c) => c.isActive && wasEverEnrolled(c.id) && !isEnrolled(c.id))
        .toList();
  }

  List<Child> getHistoricalChildren(String barangay) {
    return ChildRepository()
        .getByBarangay(barangay)
        .where((c) => wasEverEnrolled(c.id))
        .toList();
  }
}
