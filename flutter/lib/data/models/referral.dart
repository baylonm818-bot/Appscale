import 'package:hive_flutter/hive_flutter.dart';
import '../local/hive_boxes.dart';

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
      return 'Ongoing';
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

  String? get formattedCompletedDate {
    final d = updatedAt ?? (isCompleted ? createdAt : null);
    if (d == null) return null;
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

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

  factory Referral.fromMap(Map<String, dynamic> map) {
    final itemsRaw = map['itemsGiven'] ?? map['items_given'];
    List<Map<String, dynamic>> parsedItems = const [];
    if (itemsRaw is List) {
      parsedItems = itemsRaw.map((i) {
        if (i is Map) return Map<String, dynamic>.from(i);
        return <String, dynamic>{'item_name': i.toString(), 'quantity': 1};
      }).toList();
    }

    final updatedRaw = map['updatedAt'] ?? map['updated_at'];
    DateTime? updatedDt;
    if (updatedRaw != null) {
      updatedDt = DateTime.tryParse(updatedRaw.toString());
    }

    final archivedRaw = map['archived_at'] ?? map['archivedAt'];
    DateTime? archivedDt;
    if (archivedRaw != null) {
      archivedDt = DateTime.tryParse(archivedRaw.toString());
    }

    final createdRaw = map['createdAt'] ?? map['created_at'];
    final createdDt = createdRaw != null
        ? DateTime.tryParse(createdRaw.toString()) ?? DateTime.now()
        : DateTime.now();

    return Referral(
      id: map['id']?.toString() ?? '',
      serverId: map['server_id']?.toString() ?? map['serverId']?.toString(),
      beneficiaryType: map['beneficiaryType']?.toString() ??
          map['beneficiary_type']?.toString() ??
          'child',
      beneficiaryId: map['beneficiaryId']?.toString() ??
          map['child_external_id']?.toString() ??
          map['child_id']?.toString() ??
          map['mother_id']?.toString() ??
          '',
      beneficiaryName: (map['beneficiaryName'] ?? map['beneficiary_name'])?.toString() ?? '',
      barangay: map['barangay']?.toString() ?? '',
      reason: map['reason']?.toString() ?? '',
      facility: map['facility']?.toString() ?? map['referred_to']?.toString() ?? '',
      notes: (map['notes'] ?? map['response_notes'])?.toString() ?? '',
      status: normalizeStatus(map['status']?.toString()),
      createdAt: createdDt,
      updatedAt: updatedDt,
      archivedAt: archivedDt,
      archivedBy: map['archived_by'] ?? map['archivedBy'],
      itemsGiven: parsedItems,
    );
  }
}
