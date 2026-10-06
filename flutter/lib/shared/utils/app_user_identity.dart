import 'dart:core';

class AppUserIdentity {
  const AppUserIdentity._();

  static String resolveDisplayName(Map<String, dynamic>? user) {
    if (user == null || user.isEmpty) return 'Worker';

    final fullName = (user['full_name'] ?? user['name'] ?? '').toString().trim();
    if (fullName.isNotEmpty) return fullName;

    final firstName = (user['first_name'] ?? '').toString().trim();
    final lastName = (user['last_name'] ?? '').toString().trim();
    final combined = [firstName, lastName].where((v) => v.isNotEmpty).join(' ');
    if (combined.isNotEmpty) return combined;

    final username = (user['username'] ?? '').toString().trim();
    if (username.isNotEmpty) return username;

    final email = (user['email'] ?? '').toString().trim();
    if (email.isNotEmpty) return email;

    return 'Worker';
  }

  static String resolveBarangay(Map<String, dynamic>? user) {
    if (user == null || user.isEmpty) return 'Tiguion';

    final raw = (user['barangay'] ?? '').toString().trim();
    if (raw.isNotEmpty) return raw;

    final municipality = (user['municipality'] ?? '').toString().trim();
    return municipality.isNotEmpty ? municipality : 'Tiguion';
  }

  static String sanitizeMobileNumber(String? raw) {
    if (raw == null) return '';
    var digits = raw.replaceAll(RegExp(r'\D+'), '');
    if (digits.isEmpty) return '';
    if (digits.length == 10 && digits.startsWith('9')) {
      digits = '0$digits';
    }
    if (digits.startsWith('63') && digits.length == 12) {
      digits = '0${digits.substring(2)}';
    }
    return digits;
  }

  static bool isValidPhilippineContactNumber(String? raw) {
    if (raw == null || raw.trim().isEmpty) return false;
    final sanitized = sanitizeMobileNumber(raw);
    return RegExp(r'^09\d{9}$').hasMatch(sanitized);
  }
}
