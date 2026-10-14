import '../../core/utils/safe_parser.dart';

class Guardian {
  final String fullName;
  final String relationship;
  final String contactNo;
  final String? linkedMotherId; // set only if guardian is also a monitored mother
  final DateTime? birthDate;

  const Guardian({
    required this.fullName,
    required this.relationship,
    required this.contactNo,
    this.linkedMotherId,
    this.birthDate,
  });

  int? get age {
    if (birthDate == null) return null;
    return (DateTime.now().difference(birthDate!).inDays / 365).floor();
  }

  String get ageLabel {
    if (age == null) return 'Not recorded';
    return '$age yrs. old';
  }

  bool get isAdolescent {
    final a = age;
    return a != null && a < 18;
  }

  Map<String, dynamic> toMap() => {
    'fullName': fullName,
    'relationship': relationship,
    'contactNo': contactNo,
    'linkedMotherId': linkedMotherId,
    'birthDate': birthDate != null ? SafeParser.toDateString(birthDate!) : null,
  };

  factory Guardian.fromMap(Map map) => Guardian(
    fullName: SafeParser.asNonNullString(map['fullName'] ?? map['full_name']),
    relationship: SafeParser.asNonNullString(map['relationship'], 'Guardian'),
    contactNo: SafeParser.asNonNullString(map['contactNo'] ?? map['contact_number']),
    linkedMotherId: SafeParser.asString(map['linkedMotherId'] ?? map['mother_id']),
    birthDate: SafeParser.asDate(map['birthDate'] ?? map['birth_date']),
  );
}
