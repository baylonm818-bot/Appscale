import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/referral.dart';

class ReferralApi {
  ReferralApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api';
  }

  static Future<void> submit(Referral referral) async {
    final trimmedBeneficiaryId = referral.beneficiaryId.trim();
    final payload = <String, dynamic>{
      'beneficiary_type': referral.beneficiaryType,
      'beneficiary_name': referral.beneficiaryName.trim(),
      'barangay': referral.barangay.trim(),
      'facility': referral.facility.trim(),
      'reason': referral.reason.trim(),
      'notes': referral.notes.trim(),
      'severity': 'medium',
    };

    if (trimmedBeneficiaryId.isNotEmpty && RegExp(r'^\d+$').hasMatch(trimmedBeneficiaryId)) {
      payload['child_id'] = trimmedBeneficiaryId;
    }

    final response = await http.post(
      Uri.parse('$_baseUrl/bhw/referrals'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic>? body;
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        body = null;
      }
      throw Exception(body?['message'] ?? 'Referral could not be sent to the web portal.');
    }
  }
}