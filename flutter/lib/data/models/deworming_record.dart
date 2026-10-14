import '../../core/utils/safe_parser.dart';

class DewormingRecord {
  final String id;
  final String childId;
  final String childName;
  final String barangay;
  final int ageInMonths;
  final DateTime dateGiven;
  final String drugName; // 'Albendazole 400mg' or 'Mebendazole 500mg'
  final String
  round; // '1st Round (Jan - Jun)', '2nd Round (Jul - Dec)', 'Catch-up'
  final String
  adverseEvents; // 'None', 'Mild Nausea', 'Abdominal Discomfort', etc.
  final String administeredBy;
  final String remarks;
  final DateTime? nextDueDate;
  final DateTime createdAt;

  const DewormingRecord({
    required this.id,
    required this.childId,
    required this.childName,
    required this.barangay,
    required this.ageInMonths,
    required this.dateGiven,
    required this.drugName,
    required this.round,
    this.adverseEvents = 'None',
    required this.administeredBy,
    this.remarks = '',
    this.nextDueDate,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'childId': childId,
    'childName': childName,
    'barangay': barangay,
    'ageInMonths': ageInMonths,
    'dateGiven': SafeParser.toDateString(dateGiven),
    'drugName': drugName,
    'round': round,
    'adverseEvents': adverseEvents,
    'administeredBy': administeredBy,
    'remarks': remarks,
    'nextDueDate': nextDueDate != null ? SafeParser.toDateString(nextDueDate!) : null,
    'createdAt': createdAt.toIso8601String(),
  };

  factory DewormingRecord.fromMap(Map<dynamic, dynamic> map) => DewormingRecord(
    id: SafeParser.asNonNullString(map['id'] ?? map['service_id'] ?? map['external_id']),
    childId: SafeParser.asNonNullString(map['childId'] ?? map['child_id'] ?? map['child_external_id']),
    childName: SafeParser.asNonNullString(map['childName'] ?? map['child_name'], 'Child'),
    barangay: SafeParser.asNonNullString(map['barangay']),
    ageInMonths: SafeParser.asNonNullInt(map['ageInMonths'] ?? map['age_in_months'], 0),
    dateGiven: SafeParser.asDate(map['dateGiven'] ?? map['service_date']) ?? DateTime.now(),
    drugName: SafeParser.asNonNullString(map['drugName'] ?? map['service_name'] ?? map['dosage'], 'Albendazole 400mg'),
    round: SafeParser.asNonNullString(map['round'] ?? map['notes'], '1st Round (Jan - Jun)'),
    adverseEvents: SafeParser.asNonNullString(map['adverseEvents'], 'None'),
    administeredBy: SafeParser.asNonNullString(map['administeredBy'] ?? map['provided_by'], 'BNS'),
    remarks: SafeParser.asNonNullString(map['remarks'] ?? map['notes']),
    nextDueDate: SafeParser.asDate(map['nextDueDate'] ?? map['next_schedule']),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
  );
}
