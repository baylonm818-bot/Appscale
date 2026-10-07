import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../local/hive_boxes.dart';
import '../models/referral.dart';
import 'beneficiary_api.dart';

class ReferralApi {
  ReferralApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'https://appscale-1.onrender.com/api' : 'https://appscale-1.onrender.com/api';
  }

  static Future<ApiResponse> submit(Referral referral) async {
    final settings = SettingsRepository();
    final token = settings.authToken;
    if (token == null || token.isEmpty) {
      return const ApiResponse(
        success: false,
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      );
    }
    final userId = settings.authUser?['user_id'];

    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };

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

    if (trimmedBeneficiaryId.isNotEmpty) {
      if (referral.beneficiaryType == 'mother') {
        payload['mother_id'] = trimmedBeneficiaryId;
      } else {
        payload['child_id'] = trimmedBeneficiaryId;
      }
    }

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/bhw/referrals'),
            headers: headers,
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 25));

      Map<String, dynamic>? body;
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {}

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final successMsg = body?['message'] as String? ?? 'Referral submitted successfully.';
        final rid = body?['referral_id']?.toString();
        // Return structured referral_id in the response data when available
        final combined = rid != null ? '$successMsg (id: $rid)' : successMsg;
        return ApiResponse(
          success: true,
          statusCode: response.statusCode,
          message: combined,
          data: rid != null ? {'referral_id': rid} : null,
        );
      }

      final msg = body?['message'] ??
          'HTTP ${response.statusCode}: Referral could not be sent to the web portal.';
      return ApiResponse(
        success: false,
        statusCode: response.statusCode,
        message: msg,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Network error submitting referral: $e',
      );
    }
  }
}
