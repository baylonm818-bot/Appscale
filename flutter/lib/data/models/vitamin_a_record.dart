import '../../core/utils/safe_parser.dart';

class VitaminARecord {
  final String id;
  final String childId;
  final String childName;
  final String barangay;
  final int ageInMonths;
  final DateTime dateGiven;
  final String dosage; // '100,000 IU (Blue)' or '200,000 IU (Red)'
  final String
  doseType; // 'Routine (6-11 mos)', 'Routine (12-59 mos)', 'High Risk / Sick Child'
  final String administeredBy;
  final String remarks;
  final DateTime? nextDueDate;
  final DateTime createdAt;

  const VitaminARecord({
    required this.id,
    required this.childId,
    required this.childName,
    required this.barangay,
    required this.ageInMonths,
    required this.dateGiven,
    required this.dosage,
    required this.doseType,
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
    'dosage': dosage,
    'doseType': doseType,
    'administeredBy': administeredBy,
    'remarks': remarks,
    'nextDueDate': nextDueDate != null ? SafeParser.toDateString(nextDueDate!) : null,
    'createdAt': createdAt.toIso8601String(),
  };

  factory VitaminARecord.fromMap(Map<dynamic, dynamic> map) => VitaminARecord(
    id: SafeParser.asNonNullString(map['id'] ?? map['service_id'] ?? map['external_id']),
    childId: SafeParser.asNonNullString(map['childId'] ?? map['child_id'] ?? map['child_external_id']),
    childName: SafeParser.asNonNullString(map['childName'] ?? map['child_name'], 'Child'),
    barangay: SafeParser.asNonNullString(map['barangay']),
    ageInMonths: SafeParser.asNonNullInt(map['ageInMonths'] ?? map['age_in_months'], 0),
    dateGiven: SafeParser.asDate(map['dateGiven'] ?? map['service_date']) ?? DateTime.now(),
    dosage: SafeParser.asNonNullString(map['dosage'], '100,000 IU (Blue)'),
    doseType: SafeParser.asNonNullString(map['doseType'] ?? map['service_name'], 'Routine'),
    administeredBy: SafeParser.asNonNullString(map['administeredBy'] ?? map['provided_by'], 'BNS'),
    remarks: SafeParser.asNonNullString(map['remarks'] ?? map['notes']),
    nextDueDate: SafeParser.asDate(map['nextDueDate'] ?? map['next_schedule']),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
  );
}
