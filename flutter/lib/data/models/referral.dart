import 'package:hive_flutter/hive_flutter.dart';
import '../../core/utils/safe_parser.dart';
import '../local/hive_boxes.dart';
import '../../shared/utils/app_date_format.dart';

class Referral {
  final String id;
  final String? serverId;
  final String beneficiaryType; // 'child' or 'mother'
  final String beneficiaryId;
  final String beneficiaryName;
  final String barangay;
  final String reason;
  final String facility;
  final String notes;
  final String status; // 'Pending', 'In Progress', 'Completed', 'Cancelled'
  final DateTime createdAt;
  final DateTime? updatedAt;
  final DateTime? archivedAt;
  final dynamic archivedBy;
  final List<Map<String, dynamic>> itemsGiven;

  const Referral({
    required this.id,
    this.serverId,
    required this.beneficiaryType,
    required this.beneficiaryId,
    required this.beneficiaryName,
    required this.barangay,
    required this.reason,
    required this.facility,
    required this.notes,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    this.archivedAt,
    this.archivedBy,
    this.itemsGiven = const [],
  });

  /// Normalize status values from any source (server, DB, client) to a
  /// consistent title-cased set: Pending, Ongoing, Completed, Cancelled.
  /// If unrecognized, returns the trimmed value or 'Unknown' (never defaults to Pending).
  static String normalizeStatus(String? raw) {
    if (raw == null) return 'Unknown';
    final s = raw.trim().toLowerCase();
    if (s.isEmpty) return 'Unknown';
    if (s == 'completed' || s == 'complete' || s == 'closed' || s == 'resolved') {
      return 'Completed';
    }
    if (s == 'in progress' ||
        s == 'in_progress' ||
        s == 'ongoing' ||
        s == 'received' ||
        s == 'responded') {
      return 'In Progress';
    }
    if (s == 'pending' || s == 'open') {
      return 'Pending';
    }
    if (s == 'cancelled' || s == 'canceled' || s == 'rejected') {
      return 'Cancelled';
    }
    return raw.trim();
  }

  bool get isCompleted => normalizeStatus(status) == 'Completed';
  bool get isPending => normalizeStatus(status) == 'Pending';
  bool get isOngoing => normalizeStatus(status) == 'Ongoing';
  bool get isInProgress => isOngoing; // backward compatibility alias
  bool get isCancelled => normalizeStatus(status) == 'Cancelled';
  bool get isArchived => archivedAt != null;
  String get statusDisplay => isArchived ? 'Archived' : normalizeStatus(status);

  /// Returns the person's full name, resolving from local Hive records
  /// if beneficiaryName is missing, numeric, or a placeholder like "Child #12".
  /// Falls back to "a child" or "a mother", never an ID or empty string.
  String get resolvedBeneficiaryName {
    final raw = beneficiaryName.trim();
    if (raw.isNotEmpty &&
        !RegExp(r'^\d+$').hasMatch(raw) &&
        !raw.toLowerCase().startsWith('child #') &&
        !raw.toLowerCase().startsWith('mother #') &&
        raw.toLowerCase() != 'beneficiary') {
      return raw;
    }

    final isMother = beneficiaryType.toLowerCase() == 'mother' ||
        beneficiaryType.toLowerCase() == 'lactating_mother' ||
        beneficiaryType.toLowerCase() == 'pregnant';

    try {
      if (isMother) {
        if (Hive.isBoxOpen(HiveBoxes.mothers)) {
          final m = Hive.box(HiveBoxes.mothers).get(beneficiaryId);
          if (m is Map && (m['fullName'] ?? '').toString().trim().isNotEmpty) {
            return m['fullName'].toString().trim();
          }
        }
      } else {
        if (Hive.isBoxOpen(HiveBoxes.children)) {
          final c = Hive.box(HiveBoxes.children).get(beneficiaryId);
          if (c is Map && (c['fullName'] ?? '').toString().trim().isNotEmpty) {
            return c['fullName'].toString().trim();
          }
        }
      }
    } catch (_) {}

    return isMother ? 'a mother' : 'a child';
  }

  /// Checks if the linked beneficiary exists in local storage and is marked active.
  /// If the record is deactivated or transferred, returns false.
  bool get isBeneficiaryActive {
    final isMother = beneficiaryType.toLowerCase() == 'mother' ||
        beneficiaryType.toLowerCase() == 'lactating_mother' ||
        beneficiaryType.toLowerCase() == 'pregnant';

    try {
      if (isMother) {
        if (Hive.isBoxOpen(HiveBoxes.mothers)) {
          final m = Hive.box(HiveBoxes.mothers).get(beneficiaryId);
          if (m is Map) {
            return m['isActive'] != false;
          }
        }
      } else {
        if (Hive.isBoxOpen(HiveBoxes.children)) {
          final c = Hive.box(HiveBoxes.children).get(beneficiaryId);
          if (c is Map) {
            return c['isActive'] != false;
          }
        }
      }
    } catch (_) {}
    return true;
  }

  String? get formattedCompletedDate {
    final d = updatedAt ?? (isCompleted ? createdAt : null);
    if (d == null) return null;
    return AppDateFormat.format(d);
  }

  /// Extracts the genuine clinical/status note written by RHU or BHW,
  /// stripping out any synthetic internal tags like 'Facility: ...'.
  String get clinicalNotes {
    final raw = notes.replaceAll(RegExp(r'Facility:\s*[^|\n]+(\||$)?'), '').trim();
    return raw;
  }

  /// Whether a genuine clinical observation / resolution was recorded
  bool get hasClinicalNotes => clinicalNotes.isNotEmpty;

  String get itemsGivenFormatted {
    if (itemsGiven.isEmpty) return 'None recorded';
    return itemsGiven.map((item) {
      final name = item['item_name'] ?? item['name'] ?? 'Item';
      final qty = item['quantity'] ?? item['qty'] ?? 1;
      final unit = item['unit']?.toString() ?? '';
      return unit.isNotEmpty ? '$qty $unit $name' : '$qty $name';
    }).join(', ');
  }

  Referral copyWith({
    String? id,
    String? serverId,
    String? beneficiaryType,
    String? beneficiaryId,
    String? beneficiaryName,
    String? barangay,
    String? reason,
    String? facility,
    String? notes,
    String? status,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? archivedAt,
    dynamic archivedBy,
    List<Map<String, dynamic>>? itemsGiven,
  }) => Referral(
    id: id ?? this.id,
    serverId: serverId ?? this.serverId,
    beneficiaryType: beneficiaryType ?? this.beneficiaryType,
    beneficiaryId: beneficiaryId ?? this.beneficiaryId,
    beneficiaryName: beneficiaryName ?? this.beneficiaryName,
    barangay: barangay ?? this.barangay,
    reason: reason ?? this.reason,
    facility: facility ?? this.facility,
    notes: notes ?? this.notes,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    archivedAt: archivedAt ?? this.archivedAt,
    archivedBy: archivedBy ?? this.archivedBy,
    itemsGiven: itemsGiven ?? this.itemsGiven,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    if (serverId != null) 'server_id': serverId,
    'beneficiaryType': beneficiaryType,
    'beneficiaryId': beneficiaryId,
    'beneficiaryName': beneficiaryName,
    'barangay': barangay,
    'reason': reason,
    'facility': facility,
    'notes': notes,
    'status': status,
    'createdAt': createdAt.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    if (archivedAt != null) 'archived_at': archivedAt!.toIso8601String(),
    if (archivedBy != null) 'archived_by': archivedBy,
    'itemsGiven': itemsGiven,
  };

  factory Referral.fromMap(Map map) {
    final itemsRaw = map['itemsGiven'] ?? map['items_given'];
    List<Map<String, dynamic>> parsedItems = const [];
    if (itemsRaw is List) {
      parsedItems = itemsRaw.map((i) {
        if (i is Map) return Map<String, dynamic>.from(i);
        return <String, dynamic>{'item_name': i.toString(), 'quantity': 1};
      }).toList();
    }

    final updatedRaw = map['updatedAt'] ?? map['updated_at'];
    DateTime? updatedDt = SafeParser.asDateTime(updatedRaw);

    final archivedRaw = map['archived_at'] ?? map['archivedAt'];
    DateTime? archivedDt = SafeParser.asDateTime(archivedRaw);

    final createdRaw = map['createdAt'] ?? map['created_at'];
    final createdDt = SafeParser.asDateTime(createdRaw) ?? DateTime.now();

    return Referral(
      id: SafeParser.asNonNullString(map['id']),
      serverId: SafeParser.asString(map['server_id'] ?? map['serverId']),
      beneficiaryType: SafeParser.asNonNullString(
        map['beneficiaryType'] ?? map['beneficiary_type'],
        'child',
      ),
      beneficiaryId: SafeParser.asNonNullString(
        map['beneficiaryId'] ?? map['child_external_id'] ?? map['child_id'] ?? map['mother_id'],
      ),
      beneficiaryName: SafeParser.asNonNullString(map['beneficiaryName'] ?? map['beneficiary_name']),
      barangay: SafeParser.asNonNullString(map['barangay']),
      reason: SafeParser.asNonNullString(map['reason']),
      facility: SafeParser.asNonNullString(map['facility'] ?? map['referred_to']),
      notes: SafeParser.asNonNullString(map['notes'] ?? map['response_notes']),
      status: normalizeStatus(SafeParser.asString(map['status'])),
      createdAt: createdDt,
      updatedAt: updatedDt,
      archivedAt: archivedDt,
      archivedBy: map['archived_by'] ?? map['archivedBy'],
      itemsGiven: parsedItems,
    );
  }
}
