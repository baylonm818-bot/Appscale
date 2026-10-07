import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../local/app_data_bus.dart';

/// Central service that is the single source of truth for pulling server data
/// into the local Hive cache. Called after login and on reconnect.
class SyncService {
  SyncService._();
  static final instance = SyncService._();

  static const _baseUrl = 'https://appscale-1.onrender.com/api';

  /// Fetches ALL barangay data from the server in a single request
  /// (`GET /api/mobile/sync`) and merges it into local Hive boxes.
  ///
  /// Conflict rule: server wins unless the local record has `_syncStatus == 'pending'`
  /// (meaning a local change hasn't been uploaded yet — we never overwrite those).
  Future<SyncResult> pullFromServer({
    required String barangay,
    required String token,
    String? since,
  }) async {
    try {
      final uri = Uri.parse(
        '$_baseUrl/mobile/sync?barangay=${Uri.encodeComponent(barangay)}'
        '${since != null ? '&since=${Uri.encodeComponent(since)}' : ''}',
      );
      final resp = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 20));

      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        debugPrint('[SyncService] Pull failed: ${resp.statusCode} ${resp.body}');
        return SyncResult(success: false, error: 'Server error ${resp.statusCode}');
      }

      final payload = jsonDecode(resp.body) as Map<String, dynamic>;
      await _seedAll(payload, barangay: barangay);
      AppDataBus.notifyChanged();
      return SyncResult(success: true, syncedAt: payload['syncedAt'] as String?);
    } catch (e) {
      debugPrint('[SyncService] Pull error: $e');
      return SyncResult(success: false, error: e.toString());
    }
  }

  Future<void> _seedAll(
    Map<String, dynamic> payload, {
    required String barangay,
  }) async {
    final childBox       = Hive.box(HiveBoxes.children);
    final motherBox      = Hive.box(HiveBoxes.mothers);
    final measurementBox = Hive.box(HiveBoxes.measurements);
    final referralBox    = Hive.box(HiveBoxes.referrals);
    final scheduleBox    = Hive.box(HiveBoxes.programSchedule);
    final notifBox       = Hive.box(HiveBoxes.notifications);
    final enrollBox      = Hive.box(HiveBoxes.feedingEnrollment);
    final settingsBox    = Hive.box(HiveBoxes.settings);

    // ── 1. Children ──────────────────────────────────────────────────────────
    final children = (payload['children'] as List? ?? []);
    for (final c in children) {
      final key = (c['external_id'] ?? c['child_id']).toString();
      final existing = childBox.get(key) as Map?;
      // Never overwrite a locally-pending record
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      final fullName = _buildFullName(
        c['first_name'], c['middle_initial'], c['last_name'],
      );
      await childBox.put(key, {
        'id': key,
        'sequenceNo': key,
        'fullName': fullName,
        'birthDate': _dateOnly(c['birth_date']),
        'gender': _mapGender(c['sex']),
        'address': c['purok'] as String? ?? '',
        'barangay': c['barangay'] as String? ?? barangay,
        'belongsToIpGroup': false,
        'disability': '',
        'guardian': {
          'fullName': c['guardian_name'] as String? ?? '',
          'relationship': 'Guardian',
          'contactNo': c['guardian_contact'] as String? ?? '',
          'linkedMotherId': null,
        },
        'createdAt': existing?['createdAt'] ?? DateTime.now().toIso8601String(),
        'nutritionStatus': _statusOrFallback(c['weight_status'], existing?['nutritionStatus']),
        'stuntingStatus': _statusOrFallback(c['height_status'], existing?['stuntingStatus']),
        'wastingStatus': _statusOrFallback(c['overall_status'], existing?['wastingStatus']),
        'lastWeighedAt': c['last_visit'] != null
            ? (c['last_visit'] as String).split('T').first
            : existing?['lastWeighedAt'],
        'isActive': (c['status'] as String? ?? 'active') == 'active',
        'inactiveReason': null,
        '_syncStatus': 'synced',
      });
      // Seed feeding enrollment flag
      if (_isTruthy(c['is_enrolled'])) {
        await enrollBox.put(key, DateTime.now().toIso8601String());
      }
    }

    // ── 2. Nutrition Records (full history) ───────────────────────────────────
    final nutritionRecords = (payload['nutritionRecords'] as List? ?? []);
    // Group by child external_id so we can store as lists in Hive
    final Map<String, List<Map<String, dynamic>>> groupedNr = {};
    for (final nr in nutritionRecords) {
      final childExtId = (nr['child_external_id'] ?? '').toString();
      if (childExtId.isEmpty) continue;
      groupedNr.putIfAbsent(childExtId, () => []);
      groupedNr[childExtId]!.add({
        'childId': childExtId,
        'date': _dateOnly(nr['record_date']),
        'weightKg': _toDouble(nr['weight_kg']),
        'heightCm': _toDouble(nr['height_cm']),
        'muacCm': _toOptionalDouble(nr['muac_cm']),
        'bilateralPittingEdema': nr['bilateral_pitting_edema'] == 1 || nr['bilateral_pitting_edema'] == true,
        'weightForAgeStatus': _displayStatus(nr['weight_status']),
        'heightForAgeStatus': _displayStatus(nr['height_status']),
        'weightForLengthStatus': _displayStatus(nr['overall_status']),
        'customBmi': null,
        'customBmiStatus': null,
        '_syncStatus': 'synced',
        '_serverId': nr['record_id']?.toString(),
      });
    }
    // Merge into Hive (preserving pending-only local records for each child)
    for (final entry in groupedNr.entries) {
      final childId = entry.key;
      final serverRecords = entry.value;
      final existingRaw = (measurementBox.get(childId) as List?) ?? [];
      // Keep any locally-pending records that the server doesn't know about yet
      final pendingLocal = existingRaw
          .where((r) => (r as Map?)?['_syncStatus'] != 'synced')
          .toList();
      // Merge: server records + pending local (deduplicated by date)
      final serverDates = serverRecords.map((r) => r['date']).toSet();
      final mergedPending = pendingLocal
          .where((r) => !serverDates.contains((r as Map?)?['date']))
          .toList();
      final merged = [...serverRecords, ...mergedPending];
      merged.sort((a, b) {
        final aDate = (a as Map?)?['date'] ?? '';
        final bDate = (b as Map?)?['date'] ?? '';
        return (aDate as String).compareTo(bDate as String);
      });
      await measurementBox.put(childId, merged);
    }

    // ── 3. Mothers ────────────────────────────────────────────────────────────
    final mothers = (payload['mothers'] as List? ?? []);
    for (final m in mothers) {
      final key = (m['external_id'] ?? m['mother_id']).toString();
      final existing = motherBox.get(key) as Map?;
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      final fullName = _buildFullName(
        m['first_name'], m['middle_initial'], m['last_name'],
      );
      await motherBox.put(key, {
        'id': key,
        'fullName': fullName,
        'birthDate': _dateOnly(m['birth_date']),
        'contactNo': m['contact_number'] as String? ?? '',
        'address': m['purok'] as String? ?? '',
        'barangay': m['barangay'] as String? ?? barangay,
        'linkedChildIds': existing?['linkedChildIds'] ?? <String>[],
        'isActive': (m['status'] as String? ?? 'active') == 'active',
        'inactiveReason': null,
        'createdAt': existing?['createdAt'] ?? DateTime.now().toIso8601String(),
        '_syncStatus': 'synced',
      });
    }

    // ── 4. Referrals ──────────────────────────────────────────────────────────
    final referrals = (payload['referrals'] as List? ?? []);
    for (final r in referrals) {
      final key = r['referral_id']?.toString() ?? '';
      if (key.isEmpty) continue;
      final existing = referralBox.get(key) as Map?;
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      await referralBox.put(key, {
        'id': key,
        'beneficiaryId': (r['child_external_id'] ?? r['child_id'] ?? r['mother_id'])?.toString() ?? '',
        'beneficiaryType': 'child',
        'beneficiaryName': '${r['beneficiary_first_name'] ?? ''} ${r['beneficiary_last_name'] ?? ''}'.trim(),
        'barangay': r['barangay'] as String? ?? barangay,
        'facility': r['referred_to']?.toString() ?? '',
        'reason': r['reason'] as String? ?? '',
        'notes': (r['notes'] ?? r['response_notes'] ?? '').toString(),
        'status': r['status'] as String? ?? 'Pending',
        'createdAt': r['created_at'] as String? ?? DateTime.now().toIso8601String(),
        '_syncStatus': 'synced',
      });
    }

    // ── 5. Schedules ──────────────────────────────────────────────────────────
    final schedules = (payload['schedules'] as List? ?? []);
    for (final s in schedules) {
      final key = s['schedule_id']?.toString() ?? '';
      if (key.isEmpty) continue;
      final existing = scheduleBox.get(key) as Map?;
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      await scheduleBox.put(key, {
        'id': key,
        'title': s['title'] as String? ?? 'Activity',
        'programType': _normalizeScheduleType(s['schedule_type'] as String? ?? 'Feeding'),
        'date': _dateOnly(s['schedule_date']),
        'startTime': s['schedule_time'] as String? ?? '08:00 AM',
        'endTime': s['end_time'] as String? ?? '12:00 PM',
        'location': s['venue'] as String? ?? 'Health Center',
        'targetGroup': (s['target_role'] as String? ?? 'All Beneficiaries').toString(),
        'notes': s['notes'] as String? ?? '',
        'barangay': s['barangay'] as String? ?? barangay,
        'createdBy': (s['facilitator'] as String? ?? 'RHU Web Admin').toString(),
        'createdAt': (s['created_at'] as String? ?? DateTime.now().toIso8601String()),
        'status': s['status'] as String? ?? 'pending',
        '_syncStatus': 'synced',
      });
    }

    // ── 6. Notifications ──────────────────────────────────────────────────────
    final notifications = (payload['notifications'] as List? ?? []);
    for (final n in notifications) {
      final key = n['notification_id']?.toString() ?? n['id']?.toString() ?? '';
      if (key.isEmpty) continue;
      // Don't overwrite local read state — preserve if already read locally
      final existing = notifBox.get(key) as Map?;
      final serverIsRead = (n['is_read'] as int? ?? 0) == 1;
      final localIsRead = existing?['isRead'] as bool? ?? false;
      await notifBox.put(key, {
        'id': key,
        'title': n['title'] as String? ?? 'Notification',
        'message': n['message'] as String? ?? '',
        'type': n['type'] as String? ?? 'general',
        'referralId': n['related_id']?.toString(),
        'timestamp': (n['created_at'] as String?) ?? DateTime.now().toIso8601String(),
        'isRead': serverIsRead || localIsRead, // once read = always read
      });
    }

    // ── 7. Profile picture URL ───────────────────────────────────────────────
    final profilePic = payload['profilePicture'] as String?;
    if (profilePic != null && profilePic.isNotEmpty) {
      final authUser = settingsBox.get('auth_user') as Map?;
      if (authUser != null) {
        final updated = Map<String, dynamic>.from(authUser)
          ..['profile_picture'] = profilePic;
        await settingsBox.put('auth_user', updated);
      }
    }

    debugPrint(
      '[SyncService] Seeded '
      '${children.length} children, '
      '${nutritionRecords.length} nutrition records, '
      '${mothers.length} mothers, '
      '${referrals.length} referrals, '
      '${schedules.length} schedules, '
      '${notifications.length} notifications',
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  String _buildFullName(dynamic first, dynamic middle, dynamic last) {
    final parts = [
      (first ?? '').toString().trim(),
      if ((middle ?? '').toString().trim().isNotEmpty) middle.toString().trim(),
      (last ?? '').toString().trim(),
    ].where((s) => s.isNotEmpty);
    return parts.join(' ');
  }

  String _dateOnly(dynamic raw) {
    if (raw == null) return DateTime.now().toIso8601String().split('T').first;
    return raw.toString().split('T').first;
  }

  String _mapGender(dynamic raw) {
    final s = (raw ?? '').toString().toLowerCase();
    return (s == 'female' || s == 'f') ? 'Female' : 'Male';
  }

  String _normalizeScheduleType(String? value) {
    final normalized = (value ?? 'Feeding').trim();
    switch (normalized.toLowerCase()) {
      case 'feeding':
        return 'Feeding';
      case 'vitamin_a':
      case 'vitamin a':
        return 'Vitamin A';
      case 'deworming':
        return 'Deworming';
      case 'opt_plus':
      case 'opt plus':
        return 'OPT Plus';
      default:
        return normalized.isEmpty ? 'Feeding' : normalized;
    }
  }

  String _statusOrFallback(dynamic serverVal, dynamic localFallback) {
    if (serverVal != null && serverVal.toString().isNotEmpty &&
        serverVal.toString() != 'Not weighed') {
      return _displayStatus(serverVal);
    }
    return (localFallback ?? 'Not weighed').toString();
  }

  String _displayStatus(dynamic raw) {
    final s = (raw ?? '').toString().trim();
    if (s.isEmpty) return 'Normal';
    // Convert snake_case to Title Case
    return s
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  bool _isTruthy(dynamic val) {
    if (val == null) return false;
    if (val is bool) return val;
    if (val is int) return val == 1;
    if (val is String) return val == '1' || val.toLowerCase() == 'true';
    return false;
  }

  double _toDouble(dynamic val, {double fallback = 0.0}) {
    if (val == null) return fallback;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? fallback;
    return fallback;
  }

  double? _toOptionalDouble(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val);
    return null;
  }
}

class SyncResult {
  final bool success;
  final String? error;
  final String? syncedAt;
  const SyncResult({required this.success, this.error, this.syncedAt});
}
