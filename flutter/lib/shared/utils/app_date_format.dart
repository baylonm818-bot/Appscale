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
}
