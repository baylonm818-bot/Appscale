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
    'date': date.toIso8601String(),
    'startTime': startTime,
    'endTime': endTime,
    'location': location,
    'targetGroup': targetGroup,
    'notes': notes,
    'barangay': barangay,
    'createdBy': createdBy,
    'createdAt': createdAt.toIso8601String(),
  };

  factory ProgramSchedule.fromMap(Map<dynamic, dynamic> map) => ProgramSchedule(
    id: (map['id'] ?? '').toString(),
    title: (map['title'] ?? 'Activity').toString(),
    programType: normalizeProgramType(
      (map['programType'] ?? map['schedule_type'] ?? 'Feeding').toString(),
    ),
    date: DateTime.tryParse((map['date'] ?? '').toString()) ?? DateTime.now(),
    startTime: (map['startTime'] ?? map['schedule_time'] ?? '08:00 AM').toString(),
    endTime: (map['endTime'] ?? '12:00 PM').toString(),
    location: (map['location'] ?? map['venue'] ?? 'Health Center').toString(),
    targetGroup: (map['targetGroup'] ?? map['target_role'] ?? 'All Beneficiaries').toString(),
    notes: (map['notes'] ?? '').toString(),
    barangay: (map['barangay'] ?? '').toString(),
    createdBy: (map['createdBy'] ?? map['facilitator'] ?? (map['assigned_to'] ?? 'RHU Web Admin')).toString(),
    createdAt: DateTime.tryParse((map['createdAt'] ?? '').toString()) ?? DateTime.now(),
  );
}
