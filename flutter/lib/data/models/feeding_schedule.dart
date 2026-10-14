import '../../core/utils/safe_parser.dart';

class FeedingSchedule {
  final List<int> daysOfWeek; // DateTime.monday=1 ... sunday=7
  final String startTime;
  final String endTime;
  final String location;
  final DateTime startDate;
  final DateTime? endDate; // null = ongoing
  final String barangay;
  final DateTime createdAt;

  const FeedingSchedule({
    required this.daysOfWeek,
    required this.startTime,
    required this.endTime,
    required this.location,
    required this.startDate,
    this.endDate,
    required this.barangay,
    required this.createdAt,
  });

  static const _dayLabels = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  };
  String get daysSummary {
    final sorted = [...daysOfWeek]..sort();
    return sorted.map((d) => _dayLabels[d]).join(', ');
  }

  Map<String, dynamic> toMap() => {
    'daysOfWeek': daysOfWeek,
    'startTime': startTime,
    'endTime': endTime,
    'location': location,
    'startDate': SafeParser.toDateString(startDate),
    'endDate': endDate != null ? SafeParser.toDateString(endDate!) : null,
    'barangay': barangay,
    'createdAt': createdAt.toIso8601String(),
  };

  factory FeedingSchedule.fromMap(Map map) => FeedingSchedule(
    daysOfWeek: (map['daysOfWeek'] as List?)
            ?.map((e) => SafeParser.asInt(e))
            .whereType<int>()
            .toList() ??
        const [1, 2, 3, 4, 5],
    startTime: SafeParser.asNonNullString(map['startTime'] ?? map['start_time'] ?? map['feeding_time'], '10:00 AM'),
    endTime: SafeParser.asNonNullString(map['endTime'] ?? map['end_time'], '11:00 AM'),
    location: SafeParser.asNonNullString(map['location'] ?? map['venue'], 'Health Center'),
    startDate: SafeParser.asDate(map['startDate']) ?? DateTime.now(),
    endDate: SafeParser.asDate(map['endDate']),
    barangay: SafeParser.asNonNullString(map['barangay']),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
  );
}
