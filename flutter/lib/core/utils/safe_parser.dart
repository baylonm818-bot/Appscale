/// Safe type parsers for deserializing maps from JSON and Hive.
/// Accepts int, double, String, num, bool, and date variations without throwing cast exceptions.
class SafeParser {
  SafeParser._();

  /// Converts any value to a String?, or returns fallback if null/empty.
  static String? asString(dynamic v, [String? fallback]) {
    if (v == null) return fallback;
    final s = v.toString();
    return s.isEmpty ? fallback : s;
  }

  /// Converts any value to a non-null String, returning fallback if null.
  static String asNonNullString(dynamic v, [dynamic fallbackOrNamed = '']) {
    final String fallback = fallbackOrNamed is String ? fallbackOrNamed : '';
    if (v == null) return fallback;
    return v.toString();
  }

  /// Safely parses an integer from int, double, num, or String.
  static int? asInt(dynamic v, [int? fallback]) {
    if (v == null) return fallback;
    if (v is int) return v;
    if (v is num) return v.toInt();
    final parsed = int.tryParse(v.toString().trim());
    if (parsed != null) return parsed;
    final dbl = double.tryParse(v.toString().trim());
    return dbl?.toInt() ?? fallback;
  }

  /// Safely parses an integer, defaulting to fallback if null or invalid.
  static int asNonNullInt(dynamic v, [int fallback = 0]) {
    return asInt(v, fallback) ?? fallback;
  }

  /// Safely parses a double from num, int, or String.
  static double? asDouble(dynamic v, [double? fallback]) {
    if (v == null) return fallback;
    if (v is double) return v;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString().trim()) ?? fallback;
  }

  /// Safely parses a double, defaulting to fallback if null or invalid.
  static double asNonNullDouble(dynamic v, [double fallback = 0.0]) {
    return asDouble(v, fallback) ?? fallback;
  }

  /// Safely parses a boolean from bool, int (1/0), num, or String ('true', '1', 'yes').
  static bool? asBool(dynamic v, [bool? fallback]) {
    if (v == null) return fallback;
    if (v is bool) return v;
    if (v is num) return v != 0;
    final s = v.toString().trim().toLowerCase();
    if (s == 'true' || s == '1' || s == 'yes') return true;
    if (s == 'false' || s == '0' || s == 'no') return false;
    return fallback;
  }

  /// Safely parses a boolean, defaulting to fallback if null or invalid.
  static bool asNonNullBool(dynamic v, [bool fallback = false]) {
    return asBool(v, fallback) ?? fallback;
  }

  /// Parses a DateTime calendar date without timezone shift.
  /// If input is '2026-08-28' or '2026-08-28T00:00:00.000Z', parses year, month, day
  /// directly into a local DateTime(year, month, day).
  static DateTime? asDate(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return DateTime(v.year, v.month, v.day);
    final raw = v.toString().trim();
    if (raw.isEmpty) return null;

    final datePart = raw.split('T').first.split(' ').first;
    final match = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})$').firstMatch(datePart);
    if (match != null) {
      final y = int.tryParse(match.group(1)!);
      final m = int.tryParse(match.group(2)!);
      final d = int.tryParse(match.group(3)!);
      if (y != null && m != null && d != null) {
        return DateTime(y, m, d);
      }
    }

    final parsed = DateTime.tryParse(raw);
    if (parsed != null) {
      return DateTime(parsed.year, parsed.month, parsed.day);
    }
    return null;
  }

  /// Parses a full DateTime timestamp (preserving hours, minutes, seconds).
  /// If the string is ISO format without timezone or offset, it normalizes it so that
  /// server UTC timestamps are parsed consistently.
  static DateTime? asDateTime(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    final raw = v.toString().trim();
    if (raw.isEmpty) return null;
    final parsed = DateTime.tryParse(raw);
    if (parsed != null) return parsed;
    // If lacks 'T' or timezone, attempt normalization
    final normalized = raw.replaceAll(' ', 'T');
    return DateTime.tryParse(normalized);
  }

  /// Parses a DateTime explicitly in UTC.
  static DateTime? asUtcDateTime(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v.toUtc();
    final raw = v.toString().trim();
    if (raw.isEmpty) return null;
    var norm = raw.replaceAll(' ', 'T');
    if (!norm.contains('Z') && !norm.contains('+') && !RegExp(r'-\d\d:?\d\d$').hasMatch(norm)) {
      norm = '${norm}Z';
    }
    return DateTime.tryParse(norm)?.toUtc() ?? DateTime.tryParse(raw)?.toUtc();
  }

  /// Formats a DateTime as date-only string 'yyyy-MM-dd' without UTC conversion.
  static String toDateString(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  /// Formats dynamic input or DateTime to date-only string 'yyyy-MM-dd'.
  static String toDateOnlyString(dynamic v, [String fallback = '']) {
    if (v == null) return fallback;
    if (v is DateTime) return toDateString(v);
    final d = asDate(v);
    if (d != null) return toDateString(d);
    return v.toString().split('T').first.split(' ').first;
  }

  /// Formats network error messages cleanly for the UI while keeping details for logs.
  static String friendlyNetworkError(dynamic rawError) {
    if (rawError == null) return 'No internet connection or server not reachable. Will retry automatically.';
    final text = rawError.toString();
    final lower = text.toLowerCase();
    if (lower.contains('socketfailed') ||
        lower.contains('no address associated with hostname') ||
        lower.contains('failed host lookup') ||
        lower.contains('network error') ||
        lower.contains('connection refused') ||
        lower.contains('timed out') ||
        lower.contains('timeout') ||
        lower.contains('clientexception') ||
        lower.contains('socketexception') ||
        lower.contains('handshake') ||
        lower.contains('errno = 7')) {
      return 'No internet connection or server not reachable. Will retry automatically.';
    }
    return text;
  }
}
