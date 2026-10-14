import '../../core/utils/safe_parser.dart';

class ProgramSchedule {
  final String id;
  final String title;
  final String programType; // 'Feeding', 'Vitamin A', 'Deworming', 'OPT Plus'
  final DateTime date;
  final String startTime;
  final String endTime;
  final String location;
  final String targetGroup;
  final String notes;
  final String barangay;
  final String createdBy; // 'BNS Mobile', 'RHU Web Admin', 'BHW'
  final DateTime createdAt;

  const ProgramSchedule({
    required this.id,
    required this.title,
    required this.programType,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.location,
    required this.targetGroup,
    this.notes = '',
    required this.barangay,
    this.createdBy = 'BNS Mobile',
    required this.createdAt,
  });

  static String normalizeProgramType(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) return 'Feeding';

    switch (normalized.toLowerCase()) {
      case 'feeding':
        return 'Feeding';
      case 'vitamin_a':
      case 'vitamin a':
        return 'Vitamin A';
      case 'deworming':
        return 'Deworming';
      case 'opt_plus':
      case 'opt plus':
        return 'OPT Plus';
      case 'home_visit':
      case 'home visit':
        return 'Home Visit';
      case 'immunization':
        return 'Immunization';
      case 'checkup':
        return 'Checkup';
      default:
        return normalized;
    }
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'programType': programType,
    'date': SafeParser.toDateString(date),
    'startTime': startTime,
    'endTime': endTime,
    'location': location,
    'targetGroup': targetGroup,
    'notes': notes,
    'barangay': barangay,
    'createdBy': createdBy,
    'createdAt': createdAt.toIso8601String(),
  };

  factory ProgramSchedule.fromMap(Map map) => ProgramSchedule(
    id: SafeParser.asNonNullString(map['id']),
    title: SafeParser.asNonNullString(map['title'], 'Activity'),
    programType: normalizeProgramType(
      SafeParser.asNonNullString(map['programType'] ?? map['schedule_type'], 'Feeding'),
    ),
    date: SafeParser.asDate(map['date'] ?? map['schedule_date']) ?? DateTime.now(),
    startTime: SafeParser.asNonNullString(map['startTime'] ?? map['schedule_time'], '08:00 AM'),
    endTime: SafeParser.asNonNullString(map['endTime'] ?? map['end_time'], '12:00 PM'),
    location: SafeParser.asNonNullString(map['location'] ?? map['venue'], 'Health Center'),
    targetGroup: SafeParser.asNonNullString(map['targetGroup'] ?? map['target_role'], 'All Beneficiaries'),
    notes: SafeParser.asNonNullString(map['notes']),
    barangay: SafeParser.asNonNullString(map['barangay']),
    createdBy: SafeParser.asNonNullString(map['createdBy'] ?? map['facilitator'] ?? map['assigned_to'], 'RHU Web Admin'),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
  );
}
