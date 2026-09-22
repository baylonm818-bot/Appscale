import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../models/child.dart';
import '../models/mother.dart';

class BeneficiaryApi {
  BeneficiaryApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api';
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

  static Future<void> _post(String path, Map<String, dynamic> payload, String? token) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    final response = await http.post(Uri.parse('$_baseUrl$path'), headers: headers, body: jsonEncode(payload)).timeout(const Duration(seconds: 5));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic>? body;
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {}
      throw Exception(body?['message'] ?? 'Could not sync beneficiary.');
    }
  }

  static String _date(DateTime value) => value.toIso8601String().split('T').first;
}