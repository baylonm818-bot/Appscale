import '../../shared/utils/app_user_identity.dart';

class Mother {
  final String id;
  final String fullName;
  final DateTime? birthDate;
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
  final DateTime? inactiveDate;
  final bool isTransferPending;
  final String? pendingTargetBarangay;
  final List<String> linkedChildIds;

  const Mother({
    required this.id,
    required this.fullName,
    this.birthDate,
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
    this.inactiveDate,
    this.isTransferPending = false,
    this.pendingTargetBarangay,
    this.linkedChildIds = const [],
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

  int? get contactNoAsInt {
    final digits = contactNo.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return null;
    return int.tryParse(digits);
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'fullName': fullName,
    'birthDate': birthDate?.toIso8601String(),
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
    'inactiveDate': inactiveDate?.toIso8601String(),
    'isTransferPending': isTransferPending,
    'pendingTargetBarangay': pendingTargetBarangay,
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

    final rawInactiveDate = (map['inactiveDate'] ?? map['inactive_date']) as String?;

    return Mother(
      id: rawId,
      fullName: normalizedFullName,
      birthDate: rawBirth.isNotEmpty ? DateTime.tryParse(rawBirth.split('T').first) : null,
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
      inactiveDate: rawInactiveDate != null
          ? DateTime.tryParse(rawInactiveDate.split('T').first)
          : null,
      isTransferPending:
          (map['isTransferPending'] ?? map['_transferPending'] ?? false) as bool,
      pendingTargetBarangay:
          (map['pendingTargetBarangay'] ?? map['_pendingTargetBarangay']) as String?,
      linkedChildIds:
          (map['linkedChildIds'] as List?)?.map((e) => e.toString()).toList() ??
          [],
    );
  }

  Mother copyWith({
    String? fullName,
    DateTime? birthDate,
    String? contactNo,
    String? address,
    String? barangay,
    String? breastfeedingPractice,
    bool? belongsToIpGroup,
    String? disability,
    DateTime? createdAt,
    List<String>? linkedChildIds,
    String? riskStatus,
    bool? isActive,
    String? inactiveReason,
    DateTime? inactiveDate,
    bool? isTransferPending,
    String? pendingTargetBarangay,
  }) => Mother(
    id: id,
    fullName: fullName ?? this.fullName,
    birthDate: birthDate ?? this.birthDate,
    contactNo: contactNo ?? this.contactNo,
    address: address ?? this.address,
    barangay: barangay ?? this.barangay,
    breastfeedingPractice: breastfeedingPractice ?? this.breastfeedingPractice,
    belongsToIpGroup: belongsToIpGroup ?? this.belongsToIpGroup,
    disability: disability ?? this.disability,
    createdAt: createdAt ?? this.createdAt,
    riskStatus: riskStatus ?? this.riskStatus,
    isActive: isActive ?? this.isActive,
    inactiveReason: inactiveReason ?? this.inactiveReason,
    inactiveDate: inactiveDate ?? this.inactiveDate,
    isTransferPending: isTransferPending ?? this.isTransferPending,
    pendingTargetBarangay: pendingTargetBarangay ?? this.pendingTargetBarangay,
    linkedChildIds: linkedChildIds ?? this.linkedChildIds,
  );

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
