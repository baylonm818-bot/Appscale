import '../../shared/utils/app_user_identity.dart';

class Mother {
  final String id;
  final String fullName;
  final DateTime birthDate;
  final String contactNo;
  final String address;
  final String barangay;
  final String breastfeedingPractice;
  final bool belongsToIpGroup;
  final String disability;
  final DateTime createdAt;
  final String riskStatus; // 'Normal' or 'At-risk'
  final bool isActive;
  final String?
  inactiveReason; // 'Stopped breastfeeding', 'Transferred', 'Deceased'
  final List<String> linkedChildIds;

  const Mother({
    required this.id,
    required this.fullName,
    required this.birthDate,
    required this.contactNo,
    required this.address,
    required this.barangay,
    required this.breastfeedingPractice,
    required this.belongsToIpGroup,
    required this.disability,
    required this.createdAt,
    this.riskStatus = 'Not visited',
    this.isActive = true,
    this.inactiveReason,
    this.linkedChildIds = const [],
  });

  int get age => (DateTime.now().difference(birthDate).inDays / 365).floor();

  int? get contactNoAsInt {
    final digits = contactNo.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return null;
    return int.tryParse(digits);
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'fullName': fullName,
    'birthDate': birthDate.toIso8601String(),
    'contactNo': contactNo,
    'address': address,
    'barangay': barangay,
    'breastfeedingPractice': breastfeedingPractice,
    'belongsToIpGroup': belongsToIpGroup,
    'disability': disability,
    'createdAt': createdAt.toIso8601String(),
    'riskStatus': riskStatus,
    'isActive': isActive,
    'inactiveReason': inactiveReason,
    'linkedChildIds': linkedChildIds,
  };

  factory Mother.fromMap(Map map) {
    // Support both camelCase (local) and snake_case (API/legacy) keys.
    String strVal(String camel, String snake) =>
        ((map[camel] ?? map[snake]) as String?) ?? '';

    final firstName = map['first_name'] as String? ?? '';
    final middleInitial = map['middle_initial'] as String? ?? '';
    final lastName = map['last_name'] as String? ?? '';
    final apiFullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
        .where((s) => s.isNotEmpty)
        .join(' ');

    final rawId = (map['id'] ?? map['external_id'] ?? map['mother_id'] ?? '').toString();
    final rawBirth = strVal('birthDate', 'birth_date');
    final normalizedFullName = AppUserIdentity.normalizeDisplayName(
      strVal('fullName', 'full_name').isNotEmpty
          ? strVal('fullName', 'full_name')
          : apiFullName,
    );

    return Mother(
      id: rawId,
      fullName: normalizedFullName,
      birthDate: DateTime.parse(
          rawBirth.isNotEmpty ? rawBirth.split('T').first : DateTime.now().toIso8601String()),
      contactNo: strVal('contactNo', 'contact_number'),
      address: strVal('address', 'purok'),
      barangay: strVal('barangay', 'barangay'),
      breastfeedingPractice: strVal('breastfeedingPractice', 'breastfeeding_practice'),
      belongsToIpGroup: (map['belongsToIpGroup'] ?? map['belongs_to_ip_group'] ?? false) as bool,
      disability: strVal('disability', 'disability'),
      createdAt: map['createdAt'] != null
          ? DateTime.parse(map['createdAt'] as String)
          : DateTime.now(),
      riskStatus: strVal('riskStatus', 'risk_status').isNotEmpty
          ? strVal('riskStatus', 'risk_status')
          : 'Not visited',
      isActive: map['isActive'] != null
          ? map['isActive'] as bool
          : (map['status'] as String? ?? 'active') == 'active',
      inactiveReason: map['inactiveReason'] as String?,
      linkedChildIds:
          (map['linkedChildIds'] as List?)?.map((e) => e.toString()).toList() ??
          [],
    );
  }

  Mother copyWith({
    List<String>? linkedChildIds,
    String? riskStatus,
    String? breastfeedingPractice,
    bool? isActive,
    String? inactiveReason,
  }) => Mother(
    id: id,
    fullName: fullName,
    birthDate: birthDate,
    contactNo: contactNo,
    address: address,
    barangay: barangay,
    breastfeedingPractice: breastfeedingPractice ?? this.breastfeedingPractice,
    belongsToIpGroup: belongsToIpGroup,
    disability: disability,
    createdAt: createdAt,
    riskStatus: riskStatus ?? this.riskStatus,
    isActive: isActive ?? this.isActive,
    inactiveReason: inactiveReason ?? this.inactiveReason,
    linkedChildIds: linkedChildIds ?? this.linkedChildIds,
  );

  String get ageLabel => '$age yrs. old';

  String get formattedAddress {
    final trimmed = address.trim();
    if (trimmed.isEmpty) return 'Purok 1';
    if (RegExp(r'^\d+$').hasMatch(trimmed)) {
      return 'Purok $trimmed';
    }
    return trimmed;
  }

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts.isNotEmpty ? parts[0][0].toUpperCase() : '?';
  }
}
