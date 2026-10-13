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
    'birthDate': birthDate?.toIso8601String(),
  };

  factory Guardian.fromMap(Map map) => Guardian(
    fullName: (map['fullName'] ?? map['full_name'] ?? '') as String,
    relationship: (map['relationship'] ?? '') as String,
    contactNo: (map['contactNo'] ?? map['contact_number'] ?? '') as String,
    linkedMotherId: (map['linkedMotherId'] ?? map['mother_id']) as String?,
    birthDate: map['birthDate'] != null
        ? DateTime.tryParse(map['birthDate'] as String)
        : (map['birth_date'] != null
            ? DateTime.tryParse(map['birth_date'] as String)
            : null),
  );
}
