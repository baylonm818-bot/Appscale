import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../models/referral.dart';

class ReferralApi {
  ReferralApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'https://appscale-1.onrender.com/api' : 'https://appscale-1.onrender.com/api';
  }

  static Future<void> submit(Referral referral) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    final userId = settings.authUser?['user_id'];

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final trimmedBeneficiaryId = referral.beneficiaryId.trim();
    final payload = <String, dynamic>{
      'beneficiary_type': referral.beneficiaryType,
      'beneficiary_name': referral.beneficiaryName.trim(),
      'barangay': referral.barangay.trim(),
      'facility': referral.facility.trim(),
      'reason': referral.reason.trim(),
      'notes': referral.notes.trim(),
      'severity': 'medium',
      'referred_by': userId,
    };

    if (trimmedBeneficiaryId.isNotEmpty &&
        RegExp(r'^\d+$').hasMatch(trimmedBeneficiaryId)) {
      payload['child_id'] = trimmedBeneficiaryId;
    }

    final response = await http
        .post(
          Uri.parse('$_baseUrl/bhw/referrals'),
          headers: headers,
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 5));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic>? body;
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        body = null;
      }
      throw Exception(
        body?['message'] ?? 'Referral could not be sent to the web portal.',
      );
    }
  }
}
