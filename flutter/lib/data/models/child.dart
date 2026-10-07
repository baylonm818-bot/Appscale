import '../../shared/utils/app_user_identity.dart';
import 'guardian.dart';

class Child {
  final String id;
  final String sequenceNo;
  final String fullName;
  final DateTime birthDate;
  final String gender;
  final String address;
  final String barangay;
  final bool belongsToIpGroup;
  final String disability;
  final Guardian guardian;
  final DateTime createdAt;
  final String
  nutritionStatus; // 'Normal', 'Underweight', 'Severely Underweight', 'Overweight', 'Obese', 'Stunted', 'Not weighed'
  final String
  stuntingStatus; // 'Normal', 'Stunted', 'Severely Stunted', 'Not weighed'
  final DateTime? lastWeighedAt;
  final bool isActive;
  final String? inactiveReason; // 'Graduated', 'Transferred', 'Deceased'
  final String
  wastingStatus; // 'SAM', 'MAM', 'Normal', 'Overweight', 'Obese', 'Not weighed'

  const Child({
    required this.id,
    required this.sequenceNo,
    required this.fullName,
    required this.birthDate,
    required this.gender,
    required this.address,
    required this.barangay,
    required this.belongsToIpGroup,
    required this.disability,
    required this.guardian,
    required this.createdAt,
    this.nutritionStatus = 'Not weighed',
    this.stuntingStatus = 'Not weighed',
    this.lastWeighedAt,
    this.isActive = true,
    this.inactiveReason,
    this.wastingStatus = 'Not weighed',
  });

  int get ageInMonths {
    final now = DateTime.now();
    return (now.year - birthDate.year) * 12 + (now.month - birthDate.month);
  }

  /// "2 yr. 4 mo." for a profile header, vs the shorter "28 mos" used in list rows.
  String get ageLabel {
    final months = ageInMonths;
    if (months < 12) return '$months mo.';
    final years = months ~/ 12;
    final remainder = months % 12;
    return '$years yr. $remainder mo.';
  }

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts.isNotEmpty ? parts[0][0].toUpperCase() : '?';
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'sequenceNo': sequenceNo,
    'fullName': fullName,
    'birthDate': birthDate.toIso8601String(),
    'gender': gender,
    'address': address,
    'barangay': barangay,
    'belongsToIpGroup': belongsToIpGroup,
    'disability': disability,
    'guardian': guardian.toMap(),
    'createdAt': createdAt.toIso8601String(),
    'nutritionStatus': nutritionStatus,
    'stuntingStatus': stuntingStatus,
    'lastWeighedAt': lastWeighedAt?.toIso8601String(),
    'isActive': isActive,
    'inactiveReason': inactiveReason,
    'wastingStatus': wastingStatus,
  };

  factory Child.fromMap(Map map) {
    // Support both camelCase (local) and snake_case (API/legacy) keys.
    String strVal(String camel, String snake) =>
        ((map[camel] ?? map[snake]) as String?) ?? '';
    bool boolVal(String camel, String snake, bool def) =>
        (map[camel] ?? map[snake] ?? def) as bool;

    final firstName = map['first_name'] as String? ?? '';
    final middleInitial = map['middle_initial'] as String? ?? '';
    final lastName = map['last_name'] as String? ?? '';
    final apiFullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
        .where((s) => s.isNotEmpty)
        .join(' ');

    final rawGuardian = map['guardian'];
    Guardian guardian;
    if (rawGuardian is Map) {
      guardian = Guardian.fromMap(rawGuardian);
    } else {
      guardian = Guardian(
        fullName: map['guardian_name'] as String? ?? '',
        relationship: 'Guardian',
        contactNo: map['guardian_contact'] as String? ?? '',
        linkedMotherId: null,
      );
    }

    final rawId = (map['id'] ?? map['external_id'] ?? map['child_id'] ?? '').toString();
    final rawBirth = strVal('birthDate', 'birth_date');
    final normalizedFullName = AppUserIdentity.normalizeDisplayName(
      strVal('fullName', 'full_name').isNotEmpty
          ? strVal('fullName', 'full_name')
          : apiFullName,
    );

    return Child(
      id: rawId,
      sequenceNo: strVal('sequenceNo', 'sequence_no').isNotEmpty
          ? strVal('sequenceNo', 'sequence_no')
          : rawId,
      fullName: normalizedFullName,
      birthDate: DateTime.parse(
          rawBirth.isNotEmpty ? rawBirth.split('T').first : DateTime.now().toIso8601String()),
      gender: strVal('gender', 'sex').isNotEmpty ? strVal('gender', 'sex') : 'Male',
      address: strVal('address', 'purok'),
      barangay: strVal('barangay', 'barangay'),
      belongsToIpGroup: boolVal('belongsToIpGroup', 'belongs_to_ip_group', false),
      disability: strVal('disability', 'disability'),
      guardian: guardian,
      createdAt: map['createdAt'] != null
          ? DateTime.parse(map['createdAt'] as String)
          : DateTime.now(),
      nutritionStatus: strVal('nutritionStatus', 'weight_status').isNotEmpty
          ? strVal('nutritionStatus', 'weight_status')
          : 'Not weighed',
      stuntingStatus: strVal('stuntingStatus', 'height_status').isNotEmpty
          ? strVal('stuntingStatus', 'height_status')
          : 'Not weighed',
      lastWeighedAt: (map['lastWeighedAt'] ?? map['last_visit']) != null
          ? DateTime.tryParse(
              ((map['lastWeighedAt'] ?? map['last_visit']) as String).split('T').first)
          : null,
      isActive: map['isActive'] != null
          ? map['isActive'] as bool
          : (map['status'] as String? ?? 'active') == 'active',
      inactiveReason: map['inactiveReason'] as String?,
      wastingStatus: strVal('wastingStatus', 'overall_status').isNotEmpty
          ? strVal('wastingStatus', 'overall_status')
          : 'Not weighed',
    );
  }

  Child copyWith({
    Guardian? guardian,
    String? nutritionStatus,
    String? stuntingStatus,
    String? wastingStatus,
    DateTime? lastWeighedAt,
    bool? isActive,
    String? inactiveReason,
  }) => Child(
    id: id,
    sequenceNo: sequenceNo,
    fullName: fullName,
    birthDate: birthDate,
    gender: gender,
    address: address,
    barangay: barangay,
    belongsToIpGroup: belongsToIpGroup,
    disability: disability,
    guardian: guardian ?? this.guardian,
    createdAt: createdAt,
    nutritionStatus: nutritionStatus ?? this.nutritionStatus,
    lastWeighedAt: lastWeighedAt ?? this.lastWeighedAt,
    isActive: isActive ?? this.isActive,
    inactiveReason: inactiveReason ?? this.inactiveReason,
    stuntingStatus: stuntingStatus ?? this.stuntingStatus,
    wastingStatus: wastingStatus ?? this.wastingStatus,
  );
}
