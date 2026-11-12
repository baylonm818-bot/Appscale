import '../../../data/growth_standards/growth_classifier.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/local/mother_repository.dart';
import 'excel_table_data.dart';

class MissingDataRecord {
  final String beneficiaryName;
  final String beneficiaryType; // 'Child' or 'Mother'
  final String issue;
  final String details;

  const MissingDataRecord({
    required this.beneficiaryName,
    required this.beneficiaryType,
    required this.issue,
    required this.details,
  });
}

/// Central Source of Truth Service for Report Tables (Masterlists, OPT Plus, etc.).
/// Guarantees that Screen Preview, Export PDF, and Export Excel share the EXACT
/// same records, calculated fields, and missing data detection.
class ReportDataSourceService {
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _measurementRepo = MeasurementRepository();

  static String _fmtDateOnly(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Generates Masterlist of Lactating Mothers strictly from BNS encoded records.
  ExcelTableData buildLactatingMothersData(String barangay, int year) {
    final mothers = _motherRepo
        .getAll()
        .where((m) => m.barangay.trim().toLowerCase() == barangay.trim().toLowerCase() && m.isActive)
        .toList()
      ..sort((a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));

    int no = 1;
    final rows = mothers.map((m) {
      String ageStr = 'No data';
      if (m.birthDate != null) {
        final ageYears = DateTime(year, 12, 31).difference(m.birthDate!).inDays ~/ 365;
        ageStr = ageYears >= 0 ? '$ageYears' : 'No data';
      }

      final address = m.address.trim().isNotEmpty ? m.address.trim() : 'No data';
      final contact = m.contactNo.trim().isNotEmpty ? m.contactNo.trim() : 'No data';
      final practice = m.breastfeedingPractice.trim().isNotEmpty
          ? m.breastfeedingPractice.trim()
          : 'Lactating';

      return [
        '${no++}',
        m.fullName.trim().isNotEmpty ? m.fullName.trim() : 'Unnamed Mother',
        ageStr,
        address,
        contact,
        practice,
      ];
    }).toList();

    return ExcelTableData(
      headers: [
        'NO.',
        'NAME OF LACTATING MOTHER',
        'AGE',
        'ADDRESS',
        'CONTACT',
        'STATUS',
      ],
      rows: rows,
    );
  }

  /// Generates Children Masterlist strictly from BNS encoded records,
  /// with age and nutritional status computed dynamically from measurements.
  ExcelTableData buildChildrenMasterlistData(String barangay, int year) {
    final children = _childRepo
        .getByBarangay(barangay)
        .where((c) => c.isActive)
        .toList()
      ..sort((a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));

    final refDate = DateTime(year, 12, 31);
    int no = 1;

    final rows = children.map((c) {
      final ageMonths = c.ageInMonthsAt(refDate);
      final ageStr = ageMonths >= 0 ? '$ageMonths' : 'No data';
      final dobStr = _fmtDateOnly(c.birthDate);
      final address = c.address.trim().isNotEmpty ? c.address.trim() : 'No data';
      final guardianName = c.guardian.fullName.trim().isNotEmpty ? c.guardian.fullName.trim() : 'No data';
      final guardianContact = c.guardian.contactNo.trim().isNotEmpty ? c.guardian.contactNo.trim() : 'No data';

      // Evaluate latest valid measurement within the report year
      final allMeas = _measurementRepo.getForChild(c.id).where((m) => m.isPlausible).toList()
        ..sort((a, b) => b.date.compareTo(a.date));
      final yearMeas = allMeas.where((m) => m.date.year <= year).toList();

      String nutStatus = 'Not weighed';
      if (yearMeas.isNotEmpty) {
        final latest = yearMeas.first;
        final ageAtMeas = c.ageInMonthsAt(latest.date);
        nutStatus = GrowthClassifier.classifyWeightForAge(
          weightKg: latest.weightKg,
          ageMonths: ageAtMeas,
          gender: c.gender,
        );
      } else if (allMeas.isNotEmpty) {
        final latest = allMeas.first;
        final ageAtMeas = c.ageInMonthsAt(latest.date);
        nutStatus = '${GrowthClassifier.classifyWeightForAge(
          weightKg: latest.weightKg,
          ageMonths: ageAtMeas,
          gender: c.gender,
        )} (${latest.date.year})';
      }

      return [
        '${no++}',
        c.fullName.trim().isNotEmpty ? c.fullName.trim() : 'Unnamed Child',
        c.gender,
        dobStr,
        ageStr,
        address,
        guardianName,
        guardianContact,
        nutStatus,
        c.isActive ? 'Active' : 'Inactive',
      ];
    }).toList();

    return ExcelTableData(
      headers: [
        'NO.',
        'NAME OF CHILD',
        'SEX',
        'BIRTHDAY',
        'AGE (MO)',
        'ADDRESS',
        'GUARDIAN NAME',
        'GUARDIAN CONTACT',
        'NUTRITIONAL STATUS',
        'STATUS',
      ],
      rows: rows,
    );
  }

  /// Generates OPT Plus Report data dynamically from measurements.
  ExcelTableData buildOptPlusData(String barangay, int year) {
    final children = _childRepo
        .getByBarangay(barangay)
        .where((c) => c.isActive)
        .toList()
      ..sort((a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));

    final rows = children.map((c) {
      final meas = _measurementRepo.getForChild(c.id).where((m) => m.isPlausible).toList()
        ..sort((a, b) => b.date.compareTo(a.date));
      final inYearMeas = meas.where((m) => m.date.year == year).toList();
      final latest = inYearMeas.isNotEmpty ? inYearMeas.first : (meas.isNotEmpty ? meas.first : null);

      String ageStr = 'No data';
      String weightStr = '—';
      String heightStr = '—';
      String muacStr = '—';
      String edemaStr = 'No';
      String wfaStr = 'Not weighed';
      String hfaStr = 'Not weighed';
      String wflStr = 'Not weighed';

      if (latest != null) {
        final ageAtMeas = c.ageInMonthsAt(latest.date);
        ageStr = '$ageAtMeas';
        weightStr = latest.weightKg.toStringAsFixed(1);
        heightStr = latest.heightCm.toStringAsFixed(1);
        if (latest.muacCm != null) muacStr = latest.muacCm!.toStringAsFixed(1);
        edemaStr = latest.bilateralPittingEdema ? 'Yes' : 'No';

        wfaStr = GrowthClassifier.classifyWeightForAge(
          weightKg: latest.weightKg,
          ageMonths: ageAtMeas,
          gender: c.gender,
        );
        hfaStr = GrowthClassifier.classifyHeightForAge(
          heightCm: latest.heightCm,
          ageMonths: ageAtMeas,
          gender: c.gender,
        );
        wflStr = GrowthClassifier.classifyWeightForLength(
          weightKg: latest.weightKg,
          heightCm: latest.heightCm,
          gender: c.gender,
        );
      } else {
        ageStr = '${c.ageInMonthsAt(DateTime(year, 12, 31))}';
      }

      return [
        c.sequenceNo.isNotEmpty ? c.sequenceNo : '—',
        c.fullName,
        c.gender,
        _fmtDateOnly(c.birthDate),
        ageStr,
        c.belongsToIpGroup ? 'Yes' : 'No',
        c.disability.isNotEmpty ? c.disability : 'None',
        weightStr,
        heightStr,
        muacStr,
        edemaStr,
        wfaStr,
        hfaStr,
        wflStr,
      ];
    }).toList();

    return ExcelTableData(
      headers: [
        'Seq No', 'Name', 'Sex', 'DOB', 'Age (mo)', 'IP Group', 'Disability',
        'Weight (kg)', 'Height (cm)', 'MUAC (cm)', 'Edema', 'Weight Status',
        'Height Status', 'Wasting Status',
      ],
      rows: rows,
    );
  }

  /// Scans records in the barangay for missing data to alert BNS.
  List<MissingDataRecord> checkMissingData(String reportTypeId, String barangay, int year) {
    final issues = <MissingDataRecord>[];

    if (reportTypeId == 'lactating_mothers_masterlist') {
      final mothers = _motherRepo
          .getAll()
          .where((m) => m.barangay.trim().toLowerCase() == barangay.trim().toLowerCase() && m.isActive);

      for (final m in mothers) {
        if (m.birthDate == null) {
          issues.add(MissingDataRecord(
            beneficiaryName: m.fullName,
            beneficiaryType: 'Mother',
            issue: 'No birthdate recorded',
            details: 'Cannot calculate exact age in report.',
          ));
        }
        if (m.address.trim().isEmpty) {
          issues.add(MissingDataRecord(
            beneficiaryName: m.fullName,
            beneficiaryType: 'Mother',
            issue: 'Missing purok/address',
            details: 'Address is blank in mother profile.',
          ));
        }
        if (m.contactNo.trim().isEmpty) {
          issues.add(MissingDataRecord(
            beneficiaryName: m.fullName,
            beneficiaryType: 'Mother',
            issue: 'Missing contact number',
            details: 'No phone or mobile contact recorded.',
          ));
        }
      }
      return issues;
    }

    final children = _childRepo.getByBarangay(barangay).where((c) => c.isActive).toList();

    for (final c in children) {
      if (c.address.trim().isEmpty) {
        issues.add(MissingDataRecord(
          beneficiaryName: c.fullName,
          beneficiaryType: 'Child',
          issue: 'Missing purok/address',
          details: 'Address is blank in child record.',
        ));
      }
      if (c.guardian.fullName.trim().isEmpty) {
        issues.add(MissingDataRecord(
          beneficiaryName: c.fullName,
          beneficiaryType: 'Child',
          issue: 'Missing guardian name',
          details: 'No parent or guardian name recorded.',
        ));
      }

      // Check weighing records for the year
      final meas = _measurementRepo.getForChild(c.id).where((m) => m.isPlausible && m.date.year == year).toList();
      if (meas.isEmpty) {
        issues.add(MissingDataRecord(
          beneficiaryName: c.fullName,
          beneficiaryType: 'Child',
          issue: 'No weighing record in $year',
          details: 'Child will appear as "Not weighed" or "Hindi natimbang".',
        ));
      }
    }

    return issues;
  }
}
