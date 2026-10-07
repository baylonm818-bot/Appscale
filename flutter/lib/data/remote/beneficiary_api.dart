import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/feeding_enrollment_repository.dart';
import '../local/hive_boxes.dart';
import '../models/child.dart';
import '../models/mother.dart';
import '../models/measurement.dart';
import '../models/program_schedule.dart';

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

    return _post('/mobile/children', {
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
      'mother_external_id': child.guardian.linkedMotherId,
      'status': child.isActive ? 'active' : 'inactive',
      'is_enrolled': isEnrolled,
      'encoded_by': settings.authUser?['user_id'],
    }, token);
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

    return _post('/mobile/mothers', {
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

    return _post('/mobile/nutrition-records', {
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

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return ApiResponse(
          success: true,
          statusCode: response.statusCode,
          message: 'OK',
        );
      }

      String errMsg = 'Server error (${response.statusCode})';
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>?;
        if (body?['message'] != null) {
          errMsg = body!['message'].toString();
        }
      } catch (_) {}

      if (response.statusCode == 401) {
        errMsg = 'Session expired. Please log in again.';
      }

      return ApiResponse(
        success: false,
        statusCode: response.statusCode,
        message: errMsg,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Network error: ${e.toString().replaceFirst('Exception: ', '')}',
      );
    }
  }

  static String _date(DateTime value) =>
      value.toIso8601String().split('T').first;
}
