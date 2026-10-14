import '../../core/utils/safe_parser.dart';
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
    'birthDate': birthDate != null ? SafeParser.toDateString(birthDate!) : null,
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
    'inactiveDate': inactiveDate != null ? SafeParser.toDateString(inactiveDate!) : null,
    'isTransferPending': isTransferPending,
    'pendingTargetBarangay': pendingTargetBarangay,
    'linkedChildIds': linkedChildIds,
  };

  factory Mother.fromMap(Map map) {
    // Support both camelCase (local) and snake_case (API/legacy) keys safely.
    String strVal(String camel, String snake) =>
        SafeParser.asString(map[camel] ?? map[snake]) ?? '';

    final firstName = SafeParser.asNonNullString(map['first_name']);
    final middleInitial = SafeParser.asNonNullString(map['middle_initial']);
    final lastName = SafeParser.asNonNullString(map['last_name']);
    final apiFullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
        .where((s) => s.isNotEmpty)
        .join(' ');

    final rawId = SafeParser.asNonNullString(map['id'] ?? map['external_id'] ?? map['mother_id']);
    final rawBirth = map['birthDate'] ?? map['birth_date'];
    final normalizedFullName = AppUserIdentity.normalizeDisplayName(
      strVal('fullName', 'full_name').isNotEmpty
          ? strVal('fullName', 'full_name')
          : apiFullName,
    );

    final rawInactiveDate = map['inactiveDate'] ?? map['inactive_date'];

    return Mother(
      id: rawId,
      fullName: normalizedFullName,
      birthDate: SafeParser.asDate(rawBirth),
      contactNo: strVal('contactNo', 'contact_number'),
      address: strVal('address', 'purok'),
      barangay: strVal('barangay', 'barangay'),
      breastfeedingPractice: strVal('breastfeedingPractice', 'breastfeeding_practice'),
      belongsToIpGroup: SafeParser.asNonNullBool(map['belongsToIpGroup'] ?? map['belongs_to_ip_group'], false),
      disability: strVal('disability', 'disability'),
      createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
      riskStatus: strVal('riskStatus', 'risk_status').isNotEmpty
          ? strVal('riskStatus', 'risk_status')
          : 'Not visited',
      isActive: map['isActive'] != null
          ? SafeParser.asNonNullBool(map['isActive'], true)
          : (SafeParser.asString(map['status']) ?? 'active').toLowerCase() == 'active',
      inactiveReason: SafeParser.asString(map['inactiveReason'] ?? map['inactive_reason']),
      inactiveDate: SafeParser.asDate(rawInactiveDate),
      isTransferPending:
          SafeParser.asNonNullBool(map['isTransferPending'] ?? map['_transferPending'], false),
      pendingTargetBarangay:
          SafeParser.asString(map['pendingTargetBarangay'] ?? map['_pendingTargetBarangay']),
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
