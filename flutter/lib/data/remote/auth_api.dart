import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AuthUser {
  final int userId;
  final String username;
  final String fullName;
  final String role;
  final String? barangay;
  final String? municipality;
  final String? profilePicture;

  const AuthUser({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.role,
    this.barangay,
    this.municipality,
    this.profilePicture,
  });

  factory AuthUser.fromMap(Map<String, dynamic> map) {
    return AuthUser(
      userId: map['user_id'] is int
          ? map['user_id'] as int
          : int.tryParse('${map['user_id']}') ?? 0,
      username: (map['username'] ?? '').toString(),
      fullName: (map['full_name'] ?? '').toString(),
      role: (map['role'] ?? '').toString(),
      barangay: map['barangay']?.toString(),
      municipality: map['municipality']?.toString(),
      profilePicture: map['profile_picture']?.toString(),
    );
  }
}

class AuthSession {
  final String token;
  final AuthUser user;

  const AuthSession({required this.token, required this.user});

  Map<String, dynamic> toMap() => {
    'token': token,
    'user': {
      'user_id': user.userId,
      'username': user.username,
      'full_name': user.fullName,
      'role': user.role,
      'barangay': user.barangay,
      'municipality': user.municipality,
      'profile_picture': user.profilePicture,
    },
  };

  factory AuthSession.fromMap(Map<String, dynamic> map) {
    return AuthSession(
      token: (map['token'] ?? '').toString(),
      user: AuthUser.fromMap(Map<String, dynamic>.from(map['user'] ?? {})),
    );
  }
}

class AuthApi {
  AuthApi._();

  static String get _baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    return kIsWeb ? 'https://appscale-1.onrender.com/api' : 'https://appscale-1.onrender.com/api';
  }

  static Map<String, dynamic> _decodeJson(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};
    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    throw const FormatException('Unexpected response format from server.');
  }

  static AuthSession parseLoginResponse(Map<String, dynamic> payload) {
    final token = (payload['token'] ?? '').toString();
    final userMap = payload['user'];
    if (token.isEmpty || userMap == null) {
      throw const FormatException('Invalid login response from server.');
    }
    return AuthSession(
      token: token,
      user: AuthUser.fromMap(Map<String, dynamic>.from(userMap)),
    );
  }

  static Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim(), 'password': password}),
    );

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Login failed.';
      throw Exception(message);
    }

    return parseLoginResponse(body);
  }

  static Future<String> forgotPassword({required String email}) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim()}),
    );

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Unable to send OTP.';
      throw Exception(message);
    }

    return (body['message'] ?? 'OTP sent successfully.').toString();
  }

  static Future<String> verifyOtp({
    required String email,
    required String otp,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/verify-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim(), 'otp': otp.trim()}),
    );

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'OTP verification failed.';
      throw Exception(message);
    }

    return (body['message'] ?? 'OTP verified.').toString();
  }

  static Future<String> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim(), 'newPassword': newPassword}),
    );

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Password reset failed.';
      throw Exception(message);
    }

    return (body['message'] ?? 'Password reset successful.').toString();
  }
}
