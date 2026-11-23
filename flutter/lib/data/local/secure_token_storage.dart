import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStorage {
  SecureTokenStorage._();

  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _keyAccessToken = 'appscale_access_token';
  static const String _keyRefreshToken = 'appscale_refresh_token';
  static const String _keyOfflineEmail = 'appscale_offline_email';
  static const String _keyOfflineSalt = 'appscale_offline_salt';
  static const String _keyOfflineHash = 'appscale_offline_hash';

  /// Saves the active access token and optional refresh token securely.
  static Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _storage.write(key: _keyRefreshToken, value: refreshToken);
    }
  }

  /// Retrieves the stored access token.
  static Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  /// Retrieves the stored refresh token.
  static Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  /// Removes all stored tokens and sessions upon logout.
  static Future<void> clearTokens() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
  }

  /// Securely stores salted password hash for offline verification.
  /// Plain text password is NEVER persisted.
  static Future<void> saveOfflineCredentials({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final salt = sha256.convert(utf8.encode('$normalizedEmail:${DateTime.now().millisecondsSinceEpoch}')).toString().substring(0, 16);
    final hash = sha256.convert(utf8.encode('$salt:$password')).toString();

    await _storage.write(key: _keyOfflineEmail, value: normalizedEmail);
    await _storage.write(key: _keyOfflineSalt, value: salt);
    await _storage.write(key: _keyOfflineHash, value: hash);
  }

  /// Verifies entered password against locally stored salted hash during offline login.
  static Future<bool> verifyOfflineCredentials({
    required String email,
    required String password,
  }) async {
    final storedEmail = await _storage.read(key: _keyOfflineEmail);
    final salt = await _storage.read(key: _keyOfflineSalt);
    final storedHash = await _storage.read(key: _keyOfflineHash);

    if (storedEmail == null || salt == null || storedHash == null) {
      return false;
    }

    final normalizedInput = email.trim().toLowerCase();
    if (storedEmail != normalizedInput) {
      return false;
    }

    final computedHash = sha256.convert(utf8.encode('$salt:$password')).toString();
    return computedHash == storedHash;
  }
}
