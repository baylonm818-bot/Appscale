import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../models/child.dart';
import '../models/mother.dart';
import '../models/measurement.dart';
import '../models/program_schedule.dart';

class BeneficiaryApi {
  BeneficiaryApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'https://appscale-1.onrender.com/api' : 'https://appscale-1.onrender.com/api';
  }

  static Future<void> syncChild(Child child) async {
    final settings = SettingsRepository();
    await _post('/mobile/children', {
      'external_id': child.id,
      'full_name': child.fullName,
      'birth_date': _date(child.birthDate),
      'gender': child.gender,
      'address': child.address,
      'barangay': child.barangay,
      'guardian_name': child.guardian.fullName,
      'guardian_contact': child.guardian.contactNo,
      'mother_external_id': child.guardian.linkedMotherId,
      'encoded_by': settings.authUser?['user_id'],
    }, settings.authToken);
  }

  static Future<void> syncMother(Mother mother) async {
    final settings = SettingsRepository();
    await _post('/mobile/mothers', {
      'external_id': mother.id,
      'full_name': mother.fullName,
      'birth_date': _date(mother.birthDate),
      'contact_number': mother.contactNo,
      'address': mother.address,
      'barangay': mother.barangay,
      'linked_child_external_ids': mother.linkedChildIds,
      'encoded_by': settings.authUser?['user_id'],
    }, settings.authToken);
  }

  static Future<void> syncNutritionRecord(String childExternalId, Measurement measurement) async {
    final settings = SettingsRepository();
    await _post('/mobile/nutrition-records', {
      'child_external_id': childExternalId,
      'record_date': _date(measurement.date),
      'weight_kg': measurement.weightKg,
      'height_cm': measurement.heightCm,
      'muac_cm': measurement.muacCm,
      'weight_status': measurement.weightForAgeStatus,
      'height_status': measurement.heightForAgeStatus,
      'overall_status': measurement.effectiveWastingStatus,
      'recorded_by': settings.authUser?['user_id'],
    }, settings.authToken);
  }

  static Future<void> syncSchedule(ProgramSchedule schedule) async {
    final settings = SettingsRepository();
    await _post('/mobile/schedules', {
      'title': schedule.title,
      'schedule_type': schedule.programType,
      'schedule_date': _date(schedule.date),
      'schedule_time': schedule.startTime,
      'venue': schedule.location,
      'barangay': schedule.barangay,
      'target_role': 'bns',
      'notes': schedule.notes,
    }, settings.authToken);
  }

  // Fetch helpers used to seed local Hive boxes after login
  static Future<List<Map<String, dynamic>>> fetchChildrenForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/mobile/children?barangay=${Uri.encodeComponent(barangay)}');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 5));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    throw Exception('Failed to fetch children for barangay');
  }

  static Future<List<Map<String, dynamic>>> fetchMothersForBarangay(String barangay, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$_baseUrl/mobile/mothers?barangay=${Uri.encodeComponent(barangay)}');
    final resp = await http.get(uri, headers: headers).timeout(const Duration(seconds: 5));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final data = jsonDecode(resp.body) as List<dynamic>;
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    throw Exception('Failed to fetch mothers for barangay');
  }

  static Future<void> _post(
    String path,
    Map<String, dynamic> payload,
    String? token,
  ) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    final response = await http
        .post(
          Uri.parse('$_baseUrl$path'),
          headers: headers,
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 5));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic>? body;
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {}
      throw Exception(body?['message'] ?? 'Could not sync beneficiary.');
    }
  }

  static String _date(DateTime value) =>
      value.toIso8601String().split('T').first;
}
