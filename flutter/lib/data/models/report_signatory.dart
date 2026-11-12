import 'package:flutter/foundation.dart';
import '../../core/utils/safe_parser.dart';

class SignatoryItem {
  final String roleTitle; // 'PREPARED BY:', 'APPROVED BY:', 'NOTED BY:'
  final String name; // The signatory name or 'Not set'
  final String position; // The position title
  final String dateLine; // 'Date: ____________________'

  const SignatoryItem({
    required this.roleTitle,
    required this.name,
    required this.position,
    this.dateLine = 'Date: ____________________',
  });

  Map<String, dynamic> toMap() => {
    'roleTitle': roleTitle,
    'name': name,
    'position': position,
    'dateLine': dateLine,
  };

  factory SignatoryItem.fromMap(Map map) => SignatoryItem(
    roleTitle: SafeParser.asNonNullString(map['roleTitle'], 'APPROVED BY:'),
    name: SafeParser.asNonNullString(map['name'], 'Not set'),
    position: SafeParser.asNonNullString(map['position'], ''),
    dateLine: SafeParser.asNonNullString(
      map['dateLine'],
      'Date: ____________________',
    ),
  );
}

class ReportSignatory {
  final String barangay;
  final String bnsName;
  final String punongBarangayName;
  final String mnaoAdminAideName;
  final String dnpcName;
  final String bnsPosition;
  final String punongBarangayPosition;
  final String mnaoAdminAidePosition;
  final String dnpcPosition;
  final String barangayLogoPath;

  // Dynamic items list
  final List<SignatoryItem> items;

  const ReportSignatory({
    required this.barangay,
    this.bnsName = '',
    this.punongBarangayName = '',
    this.mnaoAdminAideName = '',
    this.dnpcName = '',
    this.bnsPosition = 'Barangay Nutrition Scholar (BNS)',
    this.punongBarangayPosition = 'Punong Barangay',
    this.mnaoAdminAidePosition = 'Admin Aide IV- MNAO OIC',
    this.dnpcPosition = 'DNPC',
    this.barangayLogoPath = '',
    this.items = const [],
  });

  /// Dynamic Prepared By name
  String get preparedByName {
    for (final it in items) {
      if (it.roleTitle.toUpperCase().contains('PREPARED') ||
          it.roleTitle.toUpperCase().contains('SUBMITTED')) {
        return it.name;
      }
    }
    if (items.isNotEmpty) return items.first.name;
    return bnsName.isNotEmpty ? bnsName : 'Not set';
  }

  /// Dynamic Prepared By position
  String get preparedByPosition {
    for (final it in items) {
      if (it.roleTitle.toUpperCase().contains('PREPARED') ||
          it.roleTitle.toUpperCase().contains('SUBMITTED')) {
        return it.position;
      }
    }
    if (items.isNotEmpty) return items.first.position;
    return bnsPosition.isNotEmpty
        ? bnsPosition
        : 'Barangay Nutrition Scholar (BNS)';
  }

  /// Dynamic Approved By name
  String get approvedByName {
    for (final it in items.reversed) {
      if (it.roleTitle.toUpperCase().contains('APPROVED')) {
        return it.name;
      }
    }
    if (items.length > 1) return items.last.name;
    if (dnpcName.isNotEmpty) return dnpcName;
    if (mnaoAdminAideName.isNotEmpty) return mnaoAdminAideName;
    return 'Not set';
  }

  /// Dynamic Approved By position
  String get approvedByPosition {
    for (final it in items.reversed) {
      if (it.roleTitle.toUpperCase().contains('APPROVED')) {
        return it.position;
      }
    }
    if (items.length > 1) return items.last.position;
    if (dnpcPosition.isNotEmpty) return dnpcPosition;
    if (mnaoAdminAidePosition.isNotEmpty) return mnaoAdminAidePosition;
    return 'Municipal Nutrition Action Officer (MNAO)';
  }

  ReportSignatory copyWith({
    String? barangay,
    String? bnsName,
    String? punongBarangayName,
    String? mnaoAdminAideName,
    String? dnpcName,
    String? bnsPosition,
    String? punongBarangayPosition,
    String? mnaoAdminAidePosition,
    String? dnpcPosition,
    String? barangayLogoPath,
    List<SignatoryItem>? items,
  }) {
    return ReportSignatory(
      barangay: barangay ?? this.barangay,
      bnsName: bnsName ?? this.bnsName,
      punongBarangayName: punongBarangayName ?? this.punongBarangayName,
      mnaoAdminAideName: mnaoAdminAideName ?? this.mnaoAdminAideName,
      dnpcName: dnpcName ?? this.dnpcName,
      bnsPosition: bnsPosition ?? this.bnsPosition,
      punongBarangayPosition:
          punongBarangayPosition ?? this.punongBarangayPosition,
      mnaoAdminAidePosition:
          mnaoAdminAidePosition ?? this.mnaoAdminAidePosition,
      dnpcPosition: dnpcPosition ?? this.dnpcPosition,
      barangayLogoPath: barangayLogoPath ?? this.barangayLogoPath,
      items: items ?? this.items,
    );
  }

  Map<String, dynamic> toMap() => {
    'barangay': barangay,
    'bnsName': bnsName,
    'punongBarangayName': punongBarangayName,
    'mnaoAdminAideName': mnaoAdminAideName,
    'dnpcName': dnpcName,
    'bnsPosition': bnsPosition,
    'punongBarangayPosition': punongBarangayPosition,
    'mnaoAdminAidePosition': mnaoAdminAidePosition,
    'dnpcPosition': dnpcPosition,
    'barangayLogoPath': barangayLogoPath,
    'items': items.map((i) => i.toMap()).toList(),
  };

  factory ReportSignatory.fromMap(Map<dynamic, dynamic> map) {
    List<SignatoryItem> parsedItems = [];
    if (map['items'] is List) {
      parsedItems = (map['items'] as List)
          .whereType<Map>()
          .map((m) => SignatoryItem.fromMap(m))
          .toList();
    }

    final bName = SafeParser.asNonNullString(map['bnsName'], '');
    final pbName = SafeParser.asNonNullString(map['punongBarangayName'], '');
    final mName = SafeParser.asNonNullString(map['mnaoAdminAideName'], '');
    final dName = SafeParser.asNonNullString(map['dnpcName'], '');

    final bPos = SafeParser.asNonNullString(
      map['bnsPosition'],
      'Barangay Nutrition Scholar (BNS)',
    );
    final pbPos = SafeParser.asNonNullString(
      map['punongBarangayPosition'],
      'Punong Barangay',
    );
    final mPos = SafeParser.asNonNullString(
      map['mnaoAdminAidePosition'],
      'Admin Aide IV- MNAO OIC',
    );
    final dPos = SafeParser.asNonNullString(map['dnpcPosition'], 'DNPC');

    // Synthesize items if missing from older serialized maps
    if (parsedItems.isEmpty) {
      parsedItems = [
        SignatoryItem(
          roleTitle: 'PREPARED BY:',
          name: bName.isNotEmpty ? bName : 'Not set',
          position: bPos,
        ),
        if (pbName.isNotEmpty)
          SignatoryItem(
            roleTitle: 'NOTED BY:',
            name: pbName,
            position: pbPos,
          ),
        if (mName.isNotEmpty)
          SignatoryItem(
            roleTitle: 'APPROVED BY:',
            name: mName,
            position: mPos,
          ),
        SignatoryItem(
          roleTitle: 'APPROVED BY:',
          name: dName.isNotEmpty ? dName : (mName.isNotEmpty ? mName : 'Not set'),
          position: dName.isNotEmpty ? dPos : (mName.isNotEmpty ? mPos : 'DNPC'),
        ),
      ];
    }

    return ReportSignatory(
      barangay: SafeParser.asNonNullString(map['barangay'], ''),
      bnsName: bName,
      punongBarangayName: pbName,
      mnaoAdminAideName: mName,
      dnpcName: dName,
      bnsPosition: bPos,
      punongBarangayPosition: pbPos,
      mnaoAdminAidePosition: mPos,
      dnpcPosition: dPos,
      barangayLogoPath: SafeParser.asNonNullString(map['barangayLogoPath'], ''),
      items: parsedItems,
    );
  }

  /// Parses an array of rows returned by the Admin backend API:
  /// `[{ position, name, sort_order }, ...]`
  factory ReportSignatory.fromBackendRows(
    String barangay,
    List<dynamic> rows,
  ) {
    if (rows.isEmpty) {
      debugPrint(
        '[ReportSignatory] Fallback applied: No signatories found for Barangay "$barangay". Displaying "Not set".',
      );
      return ReportSignatory(
        barangay: barangay,
        bnsName: 'Not set',
        dnpcName: 'Not set',
        items: const [
          SignatoryItem(
            roleTitle: 'PREPARED BY:',
            name: 'Not set',
            position: 'Barangay Nutrition Scholar (BNS)',
          ),
          SignatoryItem(
            roleTitle: 'APPROVED BY:',
            name: 'Not set',
            position: 'Municipal Nutrition Action Officer (MNAO)',
          ),
        ],
      );
    }

    final sorted = List<Map<String, dynamic>>.from(
      rows.whereType<Map>().map((m) => Map<String, dynamic>.from(m)),
    );
    sorted.sort(
      (a, b) => (SafeParser.asInt(a['sort_order']) ?? 0).compareTo(
        SafeParser.asInt(b['sort_order']) ?? 0,
      ),
    );

    final List<SignatoryItem> items = [];
    for (int i = 0; i < sorted.length; i++) {
      final r = sorted[i];
      final pos = SafeParser.asNonNullString(r['position']).trim();
      final rawName = SafeParser.asNonNullString(r['name']).trim();
      final name = rawName.isNotEmpty ? rawName : 'Not set';

      if (rawName.isEmpty) {
        debugPrint(
          '[ReportSignatory] Fallback applied: Signatory for position "$pos" in Barangay "$barangay" is empty. Displaying "Not set".',
        );
      }

      String roleTitle;
      final upperPos = pos.toUpperCase();
      if (i == 0) {
        roleTitle = 'PREPARED BY:';
      } else if (i == sorted.length - 1) {
        roleTitle = 'APPROVED BY:';
      } else if (upperPos.contains('APPROVED')) {
        roleTitle = 'APPROVED BY:';
      } else {
        roleTitle = 'NOTED BY:';
      }

      items.add(
        SignatoryItem(
          roleTitle: roleTitle,
          name: name,
          position: pos,
          dateLine: 'Date: ____________________',
        ),
      );
    }

    // Ensure we have at least PREPARED BY and APPROVED BY
    if (items.length == 1) {
      items.add(
        const SignatoryItem(
          roleTitle: 'APPROVED BY:',
          name: 'Not set',
          position: 'Municipal Nutrition Action Officer (MNAO)',
        ),
      );
    }

    return ReportSignatory(
      barangay: barangay,
      bnsName: items.isNotEmpty ? items.first.name : 'Not set',
      bnsPosition: items.isNotEmpty ? items.first.position : 'BNS',
      dnpcName: items.length > 1 ? items.last.name : 'Not set',
      dnpcPosition: items.length > 1 ? items.last.position : 'DNPC',
      mnaoAdminAideName: items.length > 2 ? items[items.length - 2].name : '',
      punongBarangayName: items.length > 3 ? items[1].name : '',
      items: items,
    );
  }
}
