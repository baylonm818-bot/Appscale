/// Single source of truth for all API endpoints and network configurations.
class ApiConstants {
  ApiConstants._();

  /// Root domain of the remote server.
  static const String serverHost = 'appscale-1.onrender.com';

  /// Base server origin without trailing slash.
  static String get serverOrigin {
    const configured = String.fromEnvironment('APP_BASE_URL');
    if (configured.isNotEmpty) {
      return configured.endsWith('/')
          ? configured.substring(0, configured.length - 1)
          : configured;
    }
    return 'https://$serverHost';
  }

  /// Base API URL with /api path without trailing slash.
  static String get apiBaseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) {
      return configured.endsWith('/')
          ? configured.substring(0, configured.length - 1)
          : configured;
    }
    return '$serverOrigin/api';
  }

  /// Default timeout for network calls. Longer (60s) to comfortably handle
  /// Render cold starts (typically 30-50s) without premature connection aborts.
  static const Duration requestTimeout = Duration(seconds: 60);

  /// Resolves relative media or profile picture URLs to full remote URLs.
  static String resolveMediaUrl(String? path) {
    if (path == null) return '';
    final trimmed = path.trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }

    if (trimmed.startsWith('/')) {
      final relative = trimmed.replaceFirst(RegExp(r'^/+'), '');
      if (relative.startsWith('uploads/')) {
        return '$serverOrigin/$relative';
      }
      if (relative.startsWith('profile-pictures/')) {
        return '$serverOrigin/uploads/$relative';
      }
      return '$serverOrigin/$relative';
    }

    if (trimmed.startsWith('uploads/')) {
      return '$serverOrigin/$trimmed';
    }
    if (trimmed.startsWith('profile-pictures/')) {
      return '$serverOrigin/uploads/$trimmed';
    }

    return '$serverOrigin/$trimmed';
  }
}
