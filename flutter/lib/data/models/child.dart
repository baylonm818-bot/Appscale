import '../../core/utils/safe_parser.dart';
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
  final DateTime? inactiveDate;
  final bool isTransferPending;
  final String? pendingTargetBarangay;
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
    this.inactiveDate,
    this.isTransferPending = false,
    this.pendingTargetBarangay,
    this.wastingStatus = 'Not weighed',
  });

  static int monthsBetween(DateTime start, DateTime end) {
    if (end.isBefore(start)) return 0;
    int months = (end.year - start.year) * 12 + (end.month - start.month);
    final lastDayInEndMonth = DateTime(end.year, end.month + 1, 0).day;
    final effectiveStartDay =
        start.day > lastDayInEndMonth ? lastDayInEndMonth : start.day;
    if (end.day < effectiveStartDay) {
      months--;
    }
    return months < 0 ? 0 : months;
  }

  static String ageDisplayAt(DateTime birthDate, {DateTime? asOf}) {
    final ref = asOf ?? DateTime.now();
    final months = monthsBetween(birthDate, ref);
    if (months == 0) {
      final s = DateTime(birthDate.year, birthDate.month, birthDate.day);
      final e = DateTime(ref.year, ref.month, ref.day);
      final days = e.difference(s).inDays;
      if (days <= 0) return '0 days';
      if (days < 7) {
        return '$days ${days == 1 ? "day" : "days"}';
      }
      final weeks = days ~/ 7;
      final remDays = days % 7;
      if (remDays == 0) {
        return '$weeks ${weeks == 1 ? "wk" : "wks"}';
      }
      return '$weeks ${weeks == 1 ? "wk" : "wks"} $remDays ${remDays == 1 ? "day" : "days"}';
    }
    if (months < 12) {
      return '$months ${months == 1 ? "mo." : "mos"}';
    }
    final years = months ~/ 12;
    final remainder = months % 12;
    if (remainder == 0) {
      return '$years ${years == 1 ? "yr" : "yrs"}';
    }
    return '$years ${years == 1 ? "yr" : "yrs"} $remainder ${remainder == 1 ? "mo" : "mos"}';
  }

  int ageInMonthsAt(DateTime referenceDate) => monthsBetween(birthDate, referenceDate);

  int get ageInMonths => ageInMonthsAt(DateTime.now());

  /// Full label: "2 yr. 4 mo." or "3 mos." or "8 days" / "1 wk. 1 day" for infants under 1 month.
  String ageLabelAt(DateTime referenceDate) {
    final months = ageInMonthsAt(referenceDate);
    if (months == 0) {
      final s = DateTime(birthDate.year, birthDate.month, birthDate.day);
      final e = DateTime(referenceDate.year, referenceDate.month, referenceDate.day);
      final days = e.difference(s).inDays;
      if (days <= 0) return '0 days';
      if (days < 7) {
        return '$days ${days == 1 ? "day" : "days"}';
      }
      final weeks = days ~/ 7;
      final remDays = days % 7;
      if (remDays == 0) {
        return '$weeks ${weeks == 1 ? "wk." : "wks."}';
      }
      return '$weeks ${weeks == 1 ? "wk." : "wks."} $remDays ${remDays == 1 ? "day" : "days"}';
    }
    if (months < 12) {
      return '$months ${months == 1 ? "mo." : "mos."}';
    }
    final years = months ~/ 12;
    final remainder = months % 12;
    if (remainder == 0) {
      return '$years ${years == 1 ? "yr." : "yrs."}';
    }
    return '$years ${years == 1 ? "yr." : "yrs."} $remainder ${remainder == 1 ? "mo." : "mos."}';
  }

  String get ageLabel => ageLabelAt(DateTime.now());

  /// Short display for list tiles / pills, e.g. "2 mos", "1 wk 1 day", "3 yrs"
  String get ageDisplay {
    final months = ageInMonths;
    if (months == 0) return ageLabel;
    return '$months ${months == 1 ? "mo" : "mos"}';
  }

  static String normalizePurok(String? raw) {
    if (raw == null) return 'Purok 1';
    final t = raw.trim().toLowerCase();
    if (t.isEmpty) return 'Purok 1';
    if (t == 'uni' || t == 'uno' || t == 'isa' || t == '1' || t == 'purok 1' || t == 'purok1') return 'Purok 1';
    if (t == 'dos' || t == 'dalawa' || t == '2' || t == 'purok 2' || t == 'purok2') return 'Purok 2';
    if (t == 'tres' || t == 'tatlo' || t == '3' || t == 'purok 3' || t == 'purok3') return 'Purok 3';
    if (t == 'cuatro' || t == 'apat' || t == '4' || t == 'purok 4' || t == 'purok4') return 'Purok 4';
    if (t == 'cinco' || t == 'lima' || t == '5' || t == 'purok 5' || t == 'purok5') return 'Purok 5';
    if (t == 'seis' || t == 'anim' || t == '6' || t == 'purok 6' || t == 'purok6') return 'Purok 6';
    if (t == 'siete' || t == 'pito' || t == '7' || t == 'purok 7' || t == 'purok7') return 'Purok 7';
    if (RegExp(r'^\d+$').hasMatch(t)) return 'Purok $t';
    if (t.startsWith('purok')) {
      final numMatch = RegExp(r'\d+').firstMatch(t);
      if (numMatch != null) return 'Purok ${numMatch.group(0)}';
    }
    return raw.trim();
  }

  String get formattedAddress => normalizePurok(address);

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts.isNotEmpty ? parts[0][0].toUpperCase() : '?';
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'sequenceNo': sequenceNo,
    'fullName': fullName,
    'birthDate': SafeParser.toDateString(birthDate),
    'gender': gender,
    'address': address,
    'barangay': barangay,
    'belongsToIpGroup': belongsToIpGroup,
    'disability': disability,
    'guardian': guardian.toMap(),
    'createdAt': createdAt.toIso8601String(),
    'nutritionStatus': nutritionStatus,
    'stuntingStatus': stuntingStatus,
    'lastWeighedAt': lastWeighedAt != null ? SafeParser.toDateString(lastWeighedAt!) : null,
    'isActive': isActive,
    'inactiveReason': inactiveReason,
    'inactiveDate': inactiveDate != null ? SafeParser.toDateString(inactiveDate!) : null,
    'isTransferPending': isTransferPending,
    'pendingTargetBarangay': pendingTargetBarangay,
    'wastingStatus': wastingStatus,
  };

  factory Child.fromMap(Map map) {
    // Support both camelCase (local) and snake_case (API/legacy) keys safely.
    String strVal(String camel, String snake) =>
        SafeParser.asString(map[camel] ?? map[snake]) ?? '';
    bool boolVal(String camel, String snake, bool def) =>
        SafeParser.asBool(map[camel] ?? map[snake], def) ?? def;

    final firstName = SafeParser.asNonNullString(map['first_name']);
    final middleInitial = SafeParser.asNonNullString(map['middle_initial']);
    final lastName = SafeParser.asNonNullString(map['last_name']);
    final apiFullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
        .where((s) => s.isNotEmpty)
        .join(' ');

    final rawGuardian = map['guardian'];
    final motherIdFromMap =
        SafeParser.asString(map['mother_external_id'] ?? map['mother_id']);
    Guardian guardian;
    if (rawGuardian is Map) {
      final gMotherId = SafeParser.asString(rawGuardian['linkedMotherId']) ??
          (motherIdFromMap != null && motherIdFromMap.isNotEmpty ? motherIdFromMap : null);
      guardian = Guardian(
        fullName: SafeParser.asNonNullString(rawGuardian['fullName'] ?? rawGuardian['full_name']),
        relationship: SafeParser.asNonNullString(rawGuardian['relationship'], 'Guardian'),
        contactNo: SafeParser.asNonNullString(rawGuardian['contactNo'] ?? rawGuardian['contact_no']),
        linkedMotherId: gMotherId,
      );
    } else {
      guardian = Guardian(
        fullName: SafeParser.asNonNullString(map['guardian_name']),
        relationship: 'Guardian',
        contactNo: SafeParser.asNonNullString(map['guardian_contact']),
        linkedMotherId: motherIdFromMap != null && motherIdFromMap.isNotEmpty ? motherIdFromMap : null,
      );
    }

    final rawId = SafeParser.asNonNullString(map['id'] ?? map['external_id'] ?? map['child_id']);
    final rawBirth = map['birthDate'] ?? map['birth_date'];
    final normalizedFullName = AppUserIdentity.normalizeDisplayName(
      strVal('fullName', 'full_name').isNotEmpty
          ? strVal('fullName', 'full_name')
          : apiFullName,
    );

    final rawInactiveDate = map['inactiveDate'] ?? map['inactive_date'];

    return Child(
      id: rawId,
      sequenceNo: strVal('sequenceNo', 'sequence_no').isNotEmpty
          ? strVal('sequenceNo', 'sequence_no')
          : rawId,
      fullName: normalizedFullName,
      birthDate: SafeParser.asDate(rawBirth) ?? DateTime.now(),
      gender: strVal('gender', 'sex').isNotEmpty ? strVal('gender', 'sex') : 'Male',
      address: strVal('address', 'purok'),
      barangay: strVal('barangay', 'barangay'),
      belongsToIpGroup: boolVal('belongsToIpGroup', 'belongs_to_ip_group', false),
      disability: strVal('disability', 'disability'),
      guardian: guardian,
      createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
      nutritionStatus: strVal('nutritionStatus', 'weight_status').isNotEmpty
          ? strVal('nutritionStatus', 'weight_status')
          : 'Not weighed',
      stuntingStatus: strVal('stuntingStatus', 'height_status').isNotEmpty
          ? strVal('stuntingStatus', 'height_status')
          : 'Not weighed',
      lastWeighedAt: SafeParser.asDate(map['lastWeighedAt'] ?? map['last_visit']),
      isActive: map['isActive'] != null
          ? SafeParser.asNonNullBool(map['isActive'], true)
          : (SafeParser.asString(map['status']) ?? 'active').toLowerCase() == 'active',
      inactiveReason: SafeParser.asString(map['inactiveReason'] ?? map['inactive_reason']),
      inactiveDate: SafeParser.asDate(rawInactiveDate),
      isTransferPending:
          SafeParser.asNonNullBool(map['isTransferPending'] ?? map['_transferPending'], false),
      pendingTargetBarangay:
          SafeParser.asString(map['pendingTargetBarangay'] ?? map['_pendingTargetBarangay']),
      wastingStatus: strVal('wastingStatus', 'overall_status').isNotEmpty
          ? strVal('wastingStatus', 'overall_status')
          : 'Not weighed',
    );
  }

  Child copyWith({
    String? barangay,
    String? disability,
    Guardian? guardian,
    String? nutritionStatus,
    String? stuntingStatus,
    String? wastingStatus,
    DateTime? lastWeighedAt,
    bool? isActive,
    String? inactiveReason,
    DateTime? inactiveDate,
    bool? isTransferPending,
    String? pendingTargetBarangay,
  }) => Child(
    id: id,
    sequenceNo: sequenceNo,
    fullName: fullName,
    birthDate: birthDate,
    gender: gender,
    address: address,
    barangay: barangay ?? this.barangay,
    belongsToIpGroup: belongsToIpGroup,
    disability: disability ?? this.disability,
    guardian: guardian ?? this.guardian,
    createdAt: createdAt,
    nutritionStatus: nutritionStatus ?? this.nutritionStatus,
    lastWeighedAt: lastWeighedAt ?? this.lastWeighedAt,
    isActive: isActive ?? this.isActive,
    inactiveReason: inactiveReason ?? this.inactiveReason,
    inactiveDate: inactiveDate ?? this.inactiveDate,
    isTransferPending: isTransferPending ?? this.isTransferPending,
    pendingTargetBarangay: pendingTargetBarangay ?? this.pendingTargetBarangay,
    stuntingStatus: stuntingStatus ?? this.stuntingStatus,
    wastingStatus: wastingStatus ?? this.wastingStatus,
  );
}
