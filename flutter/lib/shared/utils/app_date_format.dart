class AppDateFormat {
  AppDateFormat._();

  static const List<String> _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /// Standard app-wide date format: "Oct 13, 2026"
  static String format(DateTime? date) {
    if (date == null) return '';
    final monthStr = (date.month >= 1 && date.month <= 12)
        ? _months[date.month - 1]
        : '';
    return '$monthStr ${date.day}, ${date.year}';
  }

  /// Format as date with short time, e.g. "Oct 13, 2026 · 08:30 AM"
  static String formatWithTime(DateTime? date) {
    if (date == null) return '';
    final dateStr = format(date);
    final hour = date.hour == 0 ? 12 : (date.hour > 12 ? date.hour - 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minuteStr = date.minute.toString().padLeft(2, '0');
    return '$dateStr · ${hour.toString().padLeft(2, '0')}:$minuteStr $period';
  }

  /// Normalizes any raw time string (e.g. '09:00:00', '09:00', '9:00 AM', '14:30')
  /// into a clean 12-hour format: '9:00 AM' (no seconds).
  static String formatTime(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '';
    final trimmed = raw.trim();

    // Already 12h format e.g. "09:00 AM" or "9:30 PM"
    final ampmMatch = RegExp(r'^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$').firstMatch(trimmed);
    if (ampmMatch != null) {
      final hour = int.tryParse(ampmMatch.group(1)!) ?? 12;
      final minute = ampmMatch.group(2)!;
      final ampm = ampmMatch.group(3)!.toUpperCase();
      return '$hour:$minute $ampm';
    }

    // 24h format e.g. "09:00:00" or "14:30"
    final h24Match = RegExp(r'^(\d{1,2}):(\d{2})(?::\d{2})?$').firstMatch(trimmed);
    if (h24Match != null) {
      final rawH = int.tryParse(h24Match.group(1)!) ?? 0;
      final minute = h24Match.group(2)!;
      final period = rawH >= 12 ? 'PM' : 'AM';
      final hour = rawH == 0 ? 12 : (rawH > 12 ? rawH - 12 : rawH);
      return '$hour:$minute $period';
    }

    return trimmed;
  }

  /// Formats a start and end time pair cleanly, e.g. "9:00 AM - 12:00 PM"
  static String formatTimeRange(String? start, String? end) {
    final cleanStart = formatTime(start);
    final cleanEnd = formatTime(end);
    if (cleanStart.isNotEmpty && cleanEnd.isNotEmpty) {
      return '$cleanStart – $cleanEnd';
    }
    return cleanStart.isNotEmpty ? cleanStart : cleanEnd;
  }
}
