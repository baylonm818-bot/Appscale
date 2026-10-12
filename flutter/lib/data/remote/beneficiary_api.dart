import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/feeding_enrollment_repository.dart';
import '../local/hive_boxes.dart';
import '../local/sync_id_mapper.dart';
import '../models/child.dart';
import '../models/mother.dart';
import '../models/measurement.dart';
import '../models/program_schedule.dart';
import '../models/meal_plan.dart';
import '../models/feeding_schedule.dart';

class ApiResponse {
  final bool success;
  final int statusCode;
  final String message;
  final Map<String, dynamic>? data;
  const ApiResponse({
    required this.success,
    required this.statusCode,
    required this.message,
    this.data,
  });
}

class BeneficiaryApi {
  BeneficiaryApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'https://appscale-1.onrender.com/api' : 'https://appscale-1.onrender.com/api';
  }

  static Future<ApiResponse> syncChild(Child child) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final nameParts = child.fullName.trim().split(RegExp(r'\s+'));
    final firstName = nameParts.isNotEmpty ? nameParts.first : '';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
    final isEnrolled = FeedingEnrollmentRepository().isEnrolled(child.id);

    final resolvedMotherServerId =
        SyncIdMapper.instance.getMotherServerId(child.guardian.linkedMotherId);

    final res = await _post('/mobile/children', {
      'external_id': child.id,
      'first_name': firstName,
      'last_name': lastName,
      'full_name': child.fullName,
      'birth_date': _date(child.birthDate),
      'gender': child.gender,
      'address': child.address,
      'barangay': child.barangay,
      'guardian_name': child.guardian.fullName,
      'guardian_contact': child.guardian.contactNo,
      'mother_id': resolvedMotherServerId,
      'mother_external_id': child.guardian.linkedMotherId,
      'status': child.isActive ? 'active' : 'inactive',
      'is_enrolled': isEnrolled,
      'encoded_by': settings.authUser?['user_id'],
    }, token);

    if (res.success && res.data != null) {
      final serverId = res.data!['child_id'] ?? res.data!['server_id'];
      if (serverId != null) {
        SyncIdMapper.instance.saveChildId(child.id, serverId);
      }
    }
    return res;
  }

  static Future<ApiResponse> syncMother(Mother mother) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final nameParts = mother.fullName.trim().split(RegExp(r'\s+'));
    final firstName = nameParts.isNotEmpty ? nameParts.first : '';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

    final res = await _post('/mobile/mothers', {
      'external_id': mother.id,
      'first_name': firstName,
      'last_name': lastName,
      'full_name': mother.fullName,
      'birth_date': _date(mother.birthDate),
      'contact_number': mother.contactNo,
      'address': mother.address,
      'barangay': mother.barangay,
      'linked_child_external_ids': mother.linkedChildIds,
      'status': mother.isActive ? 'active' : 'inactive',
      'encoded_by': settings.authUser?['user_id'],
    }, token);

    if (res.success && res.data != null) {
      final serverId = res.data!['mother_id'] ?? res.data!['server_id'];
      if (serverId != null) {
        SyncIdMapper.instance.saveMotherId(mother.id, serverId);
      }
    }
    return res;
  }

  static Future<ApiResponse> syncNutritionRecord(String childExternalId, Measurement measurement) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }

    final resolvedChildServerId =
        SyncIdMapper.instance.getChildServerId(childExternalId);

    return _post('/mobile/nutrition-records', {
      'child_id': resolvedChildServerId,
      'child_external_id': childExternalId,
      'record_date': _date(measurement.date),
      'weight_kg': measurement.weightKg,
      'height_cm': measurement.heightCm,
      'muac_cm': measurement.muacCm,
      'weight_status': measurement.weightForAgeStatus,
      'height_status': measurement.heightForAgeStatus,
      'overall_status': measurement.effectiveWastingStatus,
      'recorded_by': settings.authUser?['user_id'],
    }, token);
  }

  static Future<ApiResponse> syncSchedule(ProgramSchedule schedule) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }

    return _post('/mobile/schedules', {
      'title': schedule.title,
      'schedule_type': schedule.programType,
      'schedule_date': _date(schedule.date),
      'schedule_time': schedule.startTime,
      'venue': schedule.location,
      'barangay': schedule.barangay,
      'target_role': 'bns',
      'notes': schedule.notes,
    }, token);
  }

  static Future<ApiResponse> syncProgramEnrollment({
    required String childId,
    required bool isEnrolled,
    required String barangay,
    String? beneficiaryName,
    String? unenrollReason,
    String? notes,
  }) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final payload = {
      'program_type': 'feeding',
      'beneficiary_type': 'child',
      'child_external_id': childId,
      'beneficiary_name': beneficiaryName,
      'barangay': barangay,
      'status': isEnrolled ? 'enrolled' : 'unenrolled',
      'enrolled_at': DateTime.now().toIso8601String(),
      if (!isEnrolled) 'unenroll_reason': unenrollReason,
    };
    if (notes != null) {
      payload['notes'] = notes;
    }
    return _post('/mobile/program-enrollments', payload, token);
  }

  static Future<ApiResponse> syncMealPlan(MealPlan plan) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    return _post('/mobile/meal-plans', {
      'external_id': plan.id,
      'barangay': plan.barangay,
      'meal_name': plan.itemsSummary,
      'ingredients': plan.foodItems,
      'effective_from': plan.effectiveFrom.toIso8601String(),
      'effective_to': plan.effectiveTo?.toIso8601String(),
    }, token);
  }

  static Future<ApiResponse> syncFeedingAttendance({
    required String barangay,
    required DateTime date,
    required Map<String, String> statuses,
  }) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final entries = statuses.entries.map((e) => {
      'child_external_id': e.key,
      'barangay': barangay,
      'attendance_date': _date(date),
      'status': e.value,
    }).toList();
    return _post('/mobile/feeding-attendance', {
      'barangay': barangay,
      'attendance_date': _date(date),
      'entries': entries,
    }, token);
  }

  static Future<ApiResponse> syncFeedingSchedule(FeedingSchedule schedule) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    return _post('/mobile/feeding-schedules', {
      'barangay': schedule.barangay,
      'feeding_time': schedule.startTime,
      'start_time': schedule.startTime,
      'end_time': schedule.endTime,
      'venue': schedule.location,
      'days_of_week': schedule.daysSummary,
      'notes': 'Daily feeding routine',
    }, token);
  }

  static Future<ApiResponse> syncChildService({
    required String externalId,
    required String childExternalId,
    required String serviceType,
    required String serviceName,
    required String dosage,
    required DateTime serviceDate,
    DateTime? nextSchedule,
    String? providedBy,
    String? notes,
  }) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    return _post('/mobile/child-services', {
      'external_id': externalId,
      'child_external_id': childExternalId,
      'service_type': serviceType,
      'service_name': serviceName,
      'dosage': dosage,
      'service_date': _date(serviceDate),
      'next_schedule': nextSchedule != null ? _date(nextSchedule) : null,
      'provided_by': providedBy ?? 'BNS',
      'notes': notes,
    }, token);
  }

  static Future<ApiResponse> syncMotherService({
    required String externalId,
    required String motherExternalId,
    required String serviceType,
    required String serviceName,
    required DateTime serviceDate,
    String? dosage,
    DateTime? nextSchedule,
    String? providedBy,
    String? notes,
  }) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    return _post('/mobile/mother-services', {
      'external_id': externalId,
      'mother_external_id': motherExternalId,
      'service_type': serviceType,
      'service_name': serviceName,
      'dosage': dosage,
      'service_date': _date(serviceDate),
      'next_schedule': nextSchedule != null ? _date(nextSchedule) : null,
      'provided_by': providedBy ?? 'BNS',
      'notes': notes,
    }, token);
  }

  // Fetch helpers used to seed local Hive boxes after login
  static Future<List<Map<String, dynamic>>> fetchChildrenForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/mobile/children?barangay=${Uri.encodeComponent(barangay)}');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    throw Exception('Failed to fetch children for barangay (${resp.statusCode})');
  }

  static Future<List<Map<String, dynamic>>> fetchMothersForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/mobile/mothers?barangay=${Uri.encodeComponent(barangay)}');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    throw Exception('Failed to fetch mothers for barangay (${resp.statusCode})');
  }

  static Future<List<Map<String, dynamic>>> fetchMeasurementsForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/mobile/children?barangay=${Uri.encodeComponent(barangay)}');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where((c) => c['last_weight'] != null || c['last_height'] != null)
          .toList();
    }
    return [];
  }

  static Future<List<Map<String, dynamic>>> fetchReferralsForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/bhw/referrals');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  static Future<List<Map<String, dynamic>>> fetchSchedulesForBarangay(String barangay, String? token) async {
    final settings = SettingsRepository();
    final role = (settings.authUser?['role'] ?? '').toString().toLowerCase();
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';

    final uri = Uri.parse(
      role == 'admin'
          ? '$_baseUrl/schedule'
          : '$_baseUrl/mobile/schedules?barangay=${Uri.encodeComponent(barangay)}',
    );

    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final body = jsonDecode(resp.body);
      if (body is List) {
        return body.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      if (body is Map && body['schedules'] is List) {
        return (body['schedules'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
    }
    return [];
  }

  static Future<List<Map<String, dynamic>>> fetchNotificationsForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/bhw/notifications');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['notifications'] as List<dynamic>?) ?? [];
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  static Future<ApiResponse> deactivateAccount(int userId, String password, String reason) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    return _post('/profile/$userId/deactivate', {
      'password': password,
      'reason': reason,
    }, token);
  }

  static Future<ApiResponse> _post(
    String path,
    Map<String, dynamic> payload,
    String? token,
  ) async {
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl$path'),
            headers: headers,
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 25));

      Map<String, dynamic>? data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>?;
      } catch (_) {}

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return ApiResponse(
          success: true,
          statusCode: response.statusCode,
          message: data?['message']?.toString() ?? 'OK',
          data: data,
        );
      }

      // Idempotency: HTTP 409 Conflict or server indicating duplicate / already exists
      final isDuplicate = response.statusCode == 409 ||
          data?['duplicate'] == true ||
          (data?['message']?.toString().toLowerCase().contains('already exists') ?? false);

      if (isDuplicate) {
        return ApiResponse(
          success: true,
          statusCode: response.statusCode,
          message: data?['message']?.toString() ?? 'Record already exists on server (synced)',
          data: data,
        );
      }

      String errMsg = 'Server error (${response.statusCode})';
      if (data?['message'] != null) {
        errMsg = data!['message'].toString();
      } else if (data?['error'] != null) {
        errMsg = data!['error'].toString();
      }

      if (response.statusCode == 401) {
        errMsg = 'Session expired. Please log in again.';
      }

      return ApiResponse(
        success: false,
        statusCode: response.statusCode,
        message: errMsg,
        data: data,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Network error: ${e.toString().replaceFirst('Exception: ', '')}',
      );
    }
  }

  static Future<List<String>> fetchBarangays() async {
    try {
      final settings = SettingsRepository();
      final token = settings.authToken;
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';

      final uri = Uri.parse('$_baseUrl/mobile/barangays');
      final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 10));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final list = (jsonDecode(resp.body) as List).map((e) => e.toString()).toList();
        if (list.isNotEmpty) return list;
      }
    } catch (_) {}
    return defaultBarangays;
  }

  static const defaultBarangays = [
    'Antipolo',
    'B. Ibaba',
    'B. Ilaya',
    'Bacong-Bacong',
    'Bahi',
    'Bangbang',
    'Banot',
    'Banuyo',
    'Bognuyan',
    'Cabugao',
    'Dawis',
    'Dili',
    'Libtangin',
    'Mahunig',
    'Mangiliol',
    'Masiga',
    'Mat. Gasan',
    'Pangi',
    'Pinggan',
    'Tabionan',
    'Tiguion',
    'Brgy. Uno',
    'Brgy. Dos',
    'Brgy. Tres',
    'Tapuyan',
  ];

  static Future<ApiResponse> transferBeneficiary({
    required String entityType,
    required String entityId,
    required String targetBarangay,
    required String reason,
    required DateTime transferDate,
    bool alsoTransferLinked = false,
  }) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }

    return _post('/mobile/transfer', {
      'entityType': entityType,
      'entityId': entityId,
      'targetBarangay': targetBarangay,
      'reason': reason,
      'transferDate': _date(transferDate),
      'alsoTransferLinked': alsoTransferLinked,
      'encoded_by': settings.authUser?['user_id'],
    }, token);
  }

  static Future<bool> checkDuplicate({
    required String entityType,
    required String targetBarangay,
    required String fullName,
    DateTime? birthDate,
  }) async {
    try {
      final settings = SettingsRepository();
      final token = settings.authToken;
      final uri = Uri.parse('$_baseUrl/mobile/check-duplicate').replace(
        queryParameters: {
          'type': entityType,
          'targetBarangay': targetBarangay,
          'fullName': fullName,
          if (birthDate != null) 'birthDate': _date(birthDate),
        },
      );
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final resp = await http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        return data['duplicateExists'] == true;
      }
    } catch (e) {
      debugPrint('Duplicate check remote error: $e');
    }
    return false;
  }

  static String _date(DateTime value) =>
      value.toIso8601String().split('T').first;
}
