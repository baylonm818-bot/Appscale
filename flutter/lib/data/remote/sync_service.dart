import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../local/app_data_bus.dart';
import '../local/referral_repository.dart';

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
    final scheduleBox    = Hive.box(HiveBoxes.programSchedule);
    final notifBox       = Hive.box(HiveBoxes.notifications);
    final enrollBox      = Hive.box(HiveBoxes.feedingEnrollment);
    final settingsBox    = Hive.box(HiveBoxes.settings);
    final mealPlanBox    = Hive.box(HiveBoxes.mealPlans);
    final attendanceBox  = Hive.box(HiveBoxes.feedingAttendance);
    final feedingSchedBox= Hive.box(HiveBoxes.feedingSchedule);
    final vitABox        = Hive.box(HiveBoxes.vitaminA);
    final dewormBox      = Hive.box(HiveBoxes.deworming);
    final motherVisitBox = Hive.box(HiveBoxes.motherVisits);

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
      // Seed feeding enrollment flag if not already present
      if (_isTruthy(c['is_enrolled'])) {
        final existingEnr = enrollBox.get(key);
        if (existingEnr == null) {
          final now = DateTime.now().toIso8601String();
          await enrollBox.put(key, {
            'status': 'enrolled',
            'enrolled_at': now,
            'initial_enrolled_at': now,
            'unenrolled_at': null,
            'unenroll_reason': null,
            'cycle_number': 1,
            'history': [
              {'action': 'enrolled', 'date': now, 'notes': 'Seeded from child profile'}
            ],
            '_syncStatus': 'synced',
          });
        }
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
      // Keep any locally-pending records that have not yet been synced
      final pendingLocal = existingRaw
          .where((r) => (r as Map?)?['_syncStatus'] != 'synced')
          .toList();
      // Local pending records are the source of truth; never overwrite with server data
      final pendingDates = pendingLocal.map((r) => (r as Map)['date']).toSet();
      final nonCollidingServer = serverRecords
          .where((r) => !pendingDates.contains(r['date']))
          .toList();
      final merged = [...nonCollidingServer, ...pendingLocal];
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
    if (referrals.isNotEmpty) {
      final list = referrals
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();
      await ReferralRepository().processIncomingReferrals(list);
    }

    // ── 5. Schedules ──────────────────────────────────────────────────────────
    final schedules = (payload['schedules'] as List? ?? []);
    for (final s in schedules) {
      final key = s['schedule_id']?.toString() ?? '';
      if (key.isEmpty) continue;
      final existing = scheduleBox.get(key) as Map?;
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      // store server-provided `targets` if present so clients can show accurate visibility
      final targets = (s['targets'] as List?) ?? [];
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
        'targets': targets,
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

    // ── 8. Feeding Enrollment (from programEnrollments) ──────────────────────
    final enrollments = (payload['programEnrollments'] as List? ?? []);
    for (final e in enrollments) {
      final progType = (e['program_type'] ?? 'feeding').toString().toLowerCase();
      if (progType == 'feeding') {
        final extId = (e['child_external_id'] ?? '').toString();
        final srvId = (e['child_id'] ?? '').toString();
        // Resolve target key that matches local Hive child id
        String childKey = extId;
        if (childKey.isEmpty || !childBox.containsKey(childKey)) {
          if (childBox.containsKey(srvId)) {
            childKey = srvId;
          } else {
            // Find child by sequenceNo or mapped server id
            for (final k in childBox.keys) {
              final cMap = childBox.get(k) as Map?;
              if (cMap != null && (cMap['id'] == extId || cMap['id'] == srvId || k == extId || k == srvId)) {
                childKey = k.toString();
                break;
              }
            }
          }
        }
        if (childKey.isEmpty) childKey = extId.isNotEmpty ? extId : srvId;

        if (childKey.isNotEmpty) {
          final rawStatus = (e['status'] ?? 'enrolled').toString().toLowerCase();
          final isEnrolled = rawStatus == 'enrolled' || rawStatus == 'active';
          final existing = enrollBox.get(childKey) ?? (extId.isNotEmpty ? enrollBox.get(extId) : null) ?? (srvId.isNotEmpty ? enrollBox.get(srvId) : null);
          Map<String, dynamic>? existingMap;
          if (existing is Map) {
            existingMap = Map<String, dynamic>.from(existing);
          } else if (existing is String) {
            existingMap = {
              'status': 'enrolled',
              'enrolled_at': existing,
              'initial_enrolled_at': existing,
              'cycle_number': 1,
            };
          }

          // If local has a pending change, keep local pending until synced
          if (existingMap != null && existingMap['_syncStatus'] == 'pending') {
            continue;
          }

          final mergedData = <String, dynamic>{
            'status': isEnrolled ? 'enrolled' : 'unenrolled',
            'enrolled_at': e['enrolled_at'] ?? existingMap?['enrolled_at'] ?? DateTime.now().toIso8601String(),
            'initial_enrolled_at': existingMap?['initial_enrolled_at'] ?? e['enrolled_at'] ?? DateTime.now().toIso8601String(),
            'unenrolled_at': isEnrolled ? null : (e['unenrolled_at'] ?? DateTime.now().toIso8601String()),
            'unenroll_reason': isEnrolled ? null : (e['unenroll_reason'] ?? existingMap?['unenroll_reason']),
            'notes': e['notes'] ?? existingMap?['notes'],
            'cycle_number': (e['cycle_number'] as num?)?.toInt() ?? existingMap?['cycle_number'] ?? 1,
            'history': existingMap?['history'] ?? [],
            '_syncStatus': 'synced',
          };
          await enrollBox.put(childKey, mergedData);
        }
      }
    }

    // ── 9. Meal Plans ────────────────────────────────────────────────────────
    final mealPlans = (payload['mealPlans'] as List? ?? []);
    for (final p in mealPlans) {
      final key = (p['external_id'] ?? p['plan_id'] ?? '').toString();
      if (key.isEmpty) continue;
      final existing = mealPlanBox.get(key) as Map?;
      if (existing != null && existing['_syncStatus'] == 'pending') continue;
      List<String> items = [];
      if (p['ingredients'] != null) {
        try {
          final decoded = jsonDecode(p['ingredients'].toString());
          if (decoded is List) items = decoded.map((e) => e.toString()).toList();
        } catch (_) {
          items = p['ingredients'].toString().split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
        }
      }
      if (items.isEmpty && p['meal_name'] != null) {
        items = [p['meal_name'].toString()];
      }
      await mealPlanBox.put(key, {
        'id': key,
        'foodItems': items,
        'effectiveFrom': _dateOnly(p['effective_from'] ?? p['created_at']),
        'effectiveTo': p['effective_to'] != null ? _dateOnly(p['effective_to']) : null,
        'barangay': (p['barangay'] ?? barangay).toString(),
        'createdAt': (p['created_at'] ?? DateTime.now().toIso8601String()).toString(),
        '_syncStatus': 'synced',
      });
    }

    // ── 10. Feeding Attendance ───────────────────────────────────────────────
    final attendanceList = (payload['feedingAttendance'] as List? ?? []);
    final Map<String, Map<String, String>> groupedAtt = {};
    for (final a in attendanceList) {
      final b = (a['barangay'] ?? barangay).toString();
      final dateStr = _dateOnly(a['attendance_date']);
      final childKey = (a['child_external_id'] ?? a['child_id'] ?? '').toString();
      if (childKey.isEmpty) continue;
      final groupKey = '$b|$dateStr';
      groupedAtt.putIfAbsent(groupKey, () => <String, String>{});
      groupedAtt[groupKey]![childKey] = (a['status'] ?? 'Present').toString();
    }
    for (final entry in groupedAtt.entries) {
      final existing = (attendanceBox.get(entry.key) as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {};
      final merged = {...entry.value, ...existing}; // local pending takes precedence
      await attendanceBox.put(entry.key, merged);
    }

    // ── 11. Feeding Schedule ─────────────────────────────────────────────────
    final fs = payload['feedingSchedule'];
    if (fs is Map) {
      final fsBarangay = (fs['barangay'] ?? barangay).toString();
      final existing = feedingSchedBox.get(fsBarangay) as Map?;
      if (existing == null || existing['_syncStatus'] != 'pending') {
        List<int> days = [1, 2, 3, 4, 5];
        if (fs['days_of_week'] != null) {
          final rawDays = fs['days_of_week'].toString().toLowerCase();
          days = [];
          if (rawDays.contains('mon')) days.add(1);
          if (rawDays.contains('tue')) days.add(2);
          if (rawDays.contains('wed')) days.add(3);
          if (rawDays.contains('thu')) days.add(4);
          if (rawDays.contains('fri')) days.add(5);
          if (rawDays.contains('sat')) days.add(6);
          if (rawDays.contains('sun')) days.add(7);
          if (days.isEmpty) days = [1, 2, 3, 4, 5];
        }
        await feedingSchedBox.put(fsBarangay, {
          'daysOfWeek': days,
          'startTime': fs['start_time'] ?? fs['feeding_time'] ?? '10:00 AM',
          'endTime': fs['end_time'] ?? '11:00 AM',
          'location': fs['venue'] ?? 'Barangay Health Center',
          'startDate': DateTime.now().toIso8601String(),
          'endDate': null,
          'barangay': fsBarangay,
          'createdAt': DateTime.now().toIso8601String(),
          '_syncStatus': 'synced',
        });
      }
    }

    // ── 12. Child Services (Vitamin A & Deworming) ────────────────────────────
    final childServices = (payload['childServices'] as List? ?? []);
    for (final cs in childServices) {
      final key = (cs['external_id'] ?? cs['service_id'] ?? '').toString();
      if (key.isEmpty) continue;
      final st = (cs['service_type'] ?? '').toString().toLowerCase();
      final childId = (cs['child_external_id'] ?? cs['child_id'] ?? '').toString();

      if (st.contains('vitamin') || st.contains('vit a')) {
        final existing = vitABox.get(key) as Map?;
        if (existing != null && existing['_syncStatus'] == 'pending') continue;
        await vitABox.put(key, {
          'id': key,
          'childId': childId,
          'childName': cs['child_name'] ?? 'Child',
          'barangay': barangay,
          'ageInMonths': cs['age_in_months'] ?? 12,
          'dateGiven': _dateOnly(cs['service_date']),
          'dosage': cs['dosage'] ?? '100,000 IU (Blue)',
          'doseType': cs['service_name'] ?? 'Routine',
          'administeredBy': cs['provided_by'] ?? 'BNS',
          'remarks': cs['notes'] ?? '',
          'nextDueDate': cs['next_schedule'] != null ? _dateOnly(cs['next_schedule']) : null,
          'createdAt': DateTime.now().toIso8601String(),
          '_syncStatus': 'synced',
        });
      } else if (st.contains('deworm')) {
        final existing = dewormBox.get(key) as Map?;
        if (existing != null && existing['_syncStatus'] == 'pending') continue;
        await dewormBox.put(key, {
          'id': key,
          'childId': childId,
          'childName': cs['child_name'] ?? 'Child',
          'barangay': barangay,
          'ageInMonths': cs['age_in_months'] ?? 12,
          'dateGiven': _dateOnly(cs['service_date']),
          'drugName': cs['dosage'] ?? cs['service_name'] ?? 'Albendazole 400mg',
          'round': cs['notes'] ?? '1st Round (Jan - Jun)',
          'adverseEvents': 'None',
          'administeredBy': cs['provided_by'] ?? 'BNS',
          'remarks': cs['notes'] ?? '',
          'nextDueDate': cs['next_schedule'] != null ? _dateOnly(cs['next_schedule']) : null,
          'createdAt': DateTime.now().toIso8601String(),
          '_syncStatus': 'synced',
        });
      }
    }

    // ── 13. Mother Services (Maternal Counseling / Visits) ────────────────────
    final motherServices = (payload['motherServices'] as List? ?? []);
    final Map<String, List<Map<String, dynamic>>> groupedMv = {};
    for (final ms in motherServices) {
      final motherId = (ms['mother_external_id'] ?? ms['mother_id'] ?? '').toString();
      if (motherId.isEmpty) continue;
      groupedMv.putIfAbsent(motherId, () => []);
      groupedMv[motherId]!.add({
        'date': _dateOnly(ms['service_date']),
        'present': true,
        'breastfeedingPractice': 'Exclusively breastfeeding',
        'topicsCounseled': [ms['service_name'] ?? 'Maternal Counseling'],
        'hasMedicalConcern': false,
        'concernNote': null,
        'observation': 'Appears well',
        'observationNote': ms['notes'],
        'needsReferral': false,
        'createdAt': DateTime.now().toIso8601String(),
        '_syncStatus': 'synced',
      });
    }
    for (final entry in groupedMv.entries) {
      final motherId = entry.key;
      final existingRaw = (motherVisitBox.get(motherId) as List?) ?? [];
      final pendingLocal = existingRaw
          .where((v) => (v as Map?)?['_syncStatus'] == 'pending')
          .toList();
      final pendingDates = pendingLocal.map((v) => (v as Map)['date']).toSet();
      final nonColliding = entry.value.where((v) => !pendingDates.contains(v['date'])).toList();
      final merged = [...nonColliding, ...pendingLocal];
      await motherVisitBox.put(motherId, merged);
    }

    debugPrint(
      '[SyncService] Seeded '
      '${children.length} children, '
      '${nutritionRecords.length} nutrition records, '
      '${mothers.length} mothers, '
      '${referrals.length} referrals, '
      '${schedules.length} schedules, '
      '${notifications.length} notifications, '
      '${enrollments.length} enrollments, '
      '${mealPlans.length} meal plans',
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
