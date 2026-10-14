import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../../core/constants/api_constants.dart';

class AuthUser {
  final int userId;
  final String username;
  final String fullName;
  final String role;
  final String? barangay;
  final String? municipality;
  final String? profilePicture;
  final String? firstName;
  final String? lastName;
  final String? contactNumber;
  final String? email;

  const AuthUser({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.role,
    this.barangay,
    this.municipality,
    this.profilePicture,
    this.firstName,
    this.lastName,
    this.contactNumber,
    this.email,
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
      firstName: map['first_name']?.toString(),
      lastName: map['last_name']?.toString(),
      contactNumber: map['contact_number']?.toString(),
      email: map['email']?.toString(),
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
      'first_name': user.firstName,
      'last_name': user.lastName,
      'contact_number': user.contactNumber,
      'email': user.email,
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

  static String get _baseUrl => ApiConstants.apiBaseUrl;

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
    ).timeout(const Duration(seconds: 15));

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Login failed.';
      throw Exception(message);
    }

    // Normalize profile_picture to absolute URL if server returned relative path
    if (body['user'] is Map && body['user']['profile_picture'] is String) {
      final pic = (body['user']['profile_picture'] as String).trim();
      if (pic.isNotEmpty) {
        body['user']['profile_picture'] = ApiConstants.resolveMediaUrl(pic);
      }
    }

    return parseLoginResponse(body);
  }

  static Future<String> forgotPassword({required String email}) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim()}),
    ).timeout(const Duration(seconds: 15));

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

  static Future<Map<String, dynamic>?> uploadProfilePicture({
    required String userId,
    required String filePath,
    required String token,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_baseUrl/profile/$userId/picture'),
    );
    if (token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final ext = filePath.split('.').last.toLowerCase();
    final subtype = (ext == 'png') ? 'png' : (ext == 'webp' ? 'webp' : 'jpeg');

    request.files.add(
      await http.MultipartFile.fromPath(
        'profile_picture',
        filePath,
        contentType: MediaType('image', subtype),
      ),
    );

    final streamedResponse = await request.send().timeout(const Duration(seconds: 15));
    final responseBody = await streamedResponse.stream.bytesToString();
    if (streamedResponse.statusCode >= 200 && streamedResponse.statusCode < 300) {
      final parsed = responseBody.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(responseBody) as Map);
      return parsed;
    }

    String message = 'Upload failed with status ${streamedResponse.statusCode}';
    try {
      if (responseBody.isNotEmpty) {
        final decoded = jsonDecode(responseBody);
        if (decoded is Map && decoded['message'] != null) {
          message = decoded['message'].toString();
        }
      }
    } catch (_) {}
    throw Exception(message);
  }

  static Future<Map<String, dynamic>> getCurrentUser({
    required String token,
  }) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/auth/me'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(const Duration(seconds: 15));

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Failed to fetch current user.';
      throw Exception(message);
    }

    if (body['profile_picture'] is String) {
      final pic = (body['profile_picture'] as String).trim();
      if (pic.isNotEmpty) {
        body['profile_picture'] = ApiConstants.resolveMediaUrl(pic);
      }
    }

    return body;
  }

  static Future<Map<String, dynamic>> updateProfile({
    required String userId,
    required String token,
    required Map<String, dynamic> data,
  }) async {
    final response = await http.put(
      Uri.parse('$_baseUrl/profile/$userId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(data),
    ).timeout(const Duration(seconds: 15));

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Failed to update profile.';
      throw Exception(message);
    }

    return body;
  }

  static Future<String> changePassword({
    required String userId,
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl/profile/$userId/password'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'current_password': currentPassword,
        'new_password': newPassword,
      }),
    ).timeout(const Duration(seconds: 15));

    final body = _decodeJson(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body['message'] ?? 'Failed to change password.';
      throw Exception(message);
    }

    return (body['message'] ?? 'Password changed successfully.').toString();
  }
}
