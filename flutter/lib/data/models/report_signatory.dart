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

  factory ReportSignatory.fromMap(Map<String, dynamic> map) => ReportSignatory(
    barangay: (map['barangay'] as String?) ?? '',
    bnsName: (map['bnsName'] as String?) ?? '',
    punongBarangayName: (map['punongBarangayName'] as String?) ?? '',
    mnaoAdminAideName: (map['mnaoAdminAideName'] as String?) ?? '',
    dnpcName: (map['dnpcName'] as String?) ?? '',
    bnsPosition: (map['bnsPosition'] as String?) ?? 'Barangay Nutrition Scholar (BNS)',
    punongBarangayPosition: (map['punongBarangayPosition'] as String?) ?? 'Punong Barangay',
    mnaoAdminAidePosition: (map['mnaoAdminAidePosition'] as String?) ?? 'Admin Aide IV- MNAO OIC',
    dnpcPosition: (map['dnpcPosition'] as String?) ?? 'DNPC',
    barangayLogoPath: (map['barangayLogoPath'] as String?) ?? '',
  );
}
