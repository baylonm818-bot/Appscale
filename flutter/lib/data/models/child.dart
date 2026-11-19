import '../../core/utils/safe_parser.dart';
import '../../shared/utils/app_user_identity.dart';
import '../local/hive_boxes.dart';
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

  /// Formatted age string respecting the user's detailed days preference.
  String formatAge({bool? includeDays, DateTime? referenceDate}) {
    final ref = referenceDate ?? DateTime.now();
    bool withDays = false;
    try {
      withDays = includeDays ?? SettingsRepository().ageFormatDays;
    } catch (_) {}

    if (!withDays) {
      final m = ageInMonthsAt(ref);
      return '$m ${m == 1 ? "month" : "months"}';
    }

    DateTime cur = DateTime(birthDate.year, birthDate.month, birthDate.day);
    int m = 0;
    while (true) {
      final nextMonth = DateTime(cur.year, cur.month + 1, cur.day);
      if (nextMonth.isAfter(ref)) break;
      cur = nextMonth;
      m++;
    }
    final remainingDays = ref.difference(cur).inDays;
    if (m == 0) {
      return '$remainingDays ${remainingDays == 1 ? "day" : "days"}';
    }
    if (remainingDays <= 0) {
      return '$m ${m == 1 ? "month" : "months"}';
    }
    return '$m ${m == 1 ? "month" : "months"} and $remainingDays ${remainingDays == 1 ? "day" : "days"}';
  }

  /// Full label: "2 yr. 4 mo." or "3 mos." or "8 days" / "1 wk. 1 day" for infants under 1 month.
  String ageLabelAt(DateTime referenceDate) {
    bool withDays = false;
    try {
      withDays = SettingsRepository().ageFormatDays;
    } catch (_) {}
    if (withDays) {
      return formatAge(includeDays: true, referenceDate: referenceDate);
    }
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
    if (raw == null) return '';
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return '';

    final lower = trimmed.toLowerCase();
    if (lower == 'uni' || lower == 'uno' || lower == 'isa') return 'Purok 1';
    if (lower == 'dos' || lower == 'dalawa') return 'Purok 2';
    if (lower == 'tres' || lower == 'tatlo') return 'Purok 3';
    if (lower == 'cuatro' || lower == 'kwatro' || lower == 'apat') return 'Purok 4';
    if (lower == 'cinco' || lower == 'singko' || lower == 'lima') return 'Purok 5';
    if (lower == 'seis' || lower == 'anim') return 'Purok 6';
    if (lower == 'siete' || lower == 'syete' || lower == 'pito') return 'Purok 7';
    if (lower == 'ocho' || lower == 'otso' || lower == 'walo') return 'Purok 8';

    // Pure number like "1", "7", "12" -> "Purok 1", "Purok 7"
    if (RegExp(r'^\d+$').hasMatch(lower)) {
      return 'Purok $lower';
    }

    // Match variations like "prk 1", "prk. 1", "prk1", "purok 1", "purok-1", "purok1"
    final purokNumMatch = RegExp(r'^(?:purok|prk\.?)\s*[-#]?\s*(\d+)$', caseSensitive: false).firstMatch(trimmed);
    if (purokNumMatch != null) {
      return 'Purok ${purokNumMatch.group(1)}';
    }

    // Match "prk <name>" or "purok <name>" -> "Purok <Title Case Name>"
    final purokNamedMatch = RegExp(r'^(?:purok|prk\.?)\s*[-#]?\s*(.+)$', caseSensitive: false).firstMatch(trimmed);
    if (purokNamedMatch != null) {
      final rest = purokNamedMatch.group(1)!.trim();
      return 'Purok ${_toTitleCase(rest)}';
    }

    // Otherwise, normalize spaces and title case each word (e.g. "sitio maligaya" -> "Sitio Maligaya")
    return _toTitleCase(trimmed);
  }

  static String _toTitleCase(String text) {
    return text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).map((word) {
      if (RegExp(r'^(?:[ivxlcdm]+)$', caseSensitive: false).hasMatch(word)) {
        return word.toUpperCase();
      }
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
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
