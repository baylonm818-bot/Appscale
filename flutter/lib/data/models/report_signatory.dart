import '../../core/utils/safe_parser.dart';

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
  /// Local file path of the barangay logo image picked by the user.
  final String barangayLogoPath;

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
  });

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
  };

  factory ReportSignatory.fromMap(Map<dynamic, dynamic> map) => ReportSignatory(
    barangay: SafeParser.asNonNullString(map['barangay'], ''),
    bnsName: SafeParser.asNonNullString(map['bnsName'], ''),
    punongBarangayName: SafeParser.asNonNullString(map['punongBarangayName'], ''),
    mnaoAdminAideName: SafeParser.asNonNullString(map['mnaoAdminAideName'], ''),
    dnpcName: SafeParser.asNonNullString(map['dnpcName'], ''),
    bnsPosition: SafeParser.asNonNullString(map['bnsPosition'], 'Barangay Nutrition Scholar (BNS)'),
    punongBarangayPosition: SafeParser.asNonNullString(map['punongBarangayPosition'], 'Punong Barangay'),
    mnaoAdminAidePosition: SafeParser.asNonNullString(map['mnaoAdminAidePosition'], 'Admin Aide IV- MNAO OIC'),
    dnpcPosition: SafeParser.asNonNullString(map['dnpcPosition'], 'DNPC'),
    barangayLogoPath: SafeParser.asNonNullString(map['barangayLogoPath'], ''),
  );
}
