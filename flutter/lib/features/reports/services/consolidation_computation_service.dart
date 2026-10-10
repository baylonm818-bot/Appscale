import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';

class ConsolidationRowData {
  final String label;
  final List<int> values;
  const ConsolidationRowData({required this.label, required this.values});
}

class ConsolidationMatrixData {
  final String reportTypeId;
  final String title;
  final String barangay;
  final int year;
  final List<String> mainHeaders;
  final List<String> subHeaders;
  final List<ConsolidationRowData> rows;

  const ConsolidationMatrixData({
    required this.reportTypeId,
    required this.title,
    required this.barangay,
    required this.year,
    required this.mainHeaders,
    required this.subHeaders,
    required this.rows,
  });
}

/// Computes multi-month (12-month Jan-Dec) and quarterly (Q1-Q4 Boys/Girls/Total)
/// consolidation matrices matching official DOH/NNC forms (FORMS-WEIGHING-0-23-MOS).
class ConsolidationComputationService {
  final _childRepo = ChildRepository();
  final _measurementRepo = MeasurementRepository();

  Map<String, int> compute(String reportTypeId, String barangay) {
    switch (reportTypeId) {
      case 'consolidation_0_23':
        return _byWeightStatus(_children(barangay, maxAgeExclusive: 24));
      case 'consolidation_24_59':
        return _byWeightStatusWithGender(
          _children(barangay, minAge: 24, maxAgeExclusive: 60),
        );
      case 'uw_suw':
        return _uwSuwOnly(_children(barangay));
      case 'stunted_sst':
        return _byHeightStatus(_children(barangay));
      case 'wasted_sw':
        return _byWastingStatus(_children(barangay));
      default:
        return {};
    }
  }

  ConsolidationMatrixData computeMatrix(
    String reportTypeId,
    String barangay, {
    int? year,
  }) {
    final targetYear = year ?? DateTime.now().year;

    if (reportTypeId == 'consolidation_24_59') {
      return _compute24to59Matrix(barangay, targetYear);
    }
    if (reportTypeId == 'stunted_sst') {
      return _computeStuntedMatrix(barangay, targetYear);
    }
    if (reportTypeId == 'wasted_sw') {
      return _computeWastedMatrix(barangay, targetYear);
    }
    if (reportTypeId == 'uw_suw') {
      return _computeUwMatrix(barangay, targetYear);
    }

    // Default: consolidation_0_23
    return _compute0to23Matrix(barangay, targetYear);
  }

  ConsolidationMatrixData _compute0to23Matrix(String barangay, int year) {
    final children = _childRepo.getByBarangay(barangay);
    final months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    final subHeaders = List.generate(24, (i) => i.isEven ? 'OLD' : 'NEW');

    List<int> rowNormal = List.filled(24, 0);
    List<int> rowUw = List.filled(24, 0);
    List<int> rowSuw = List.filled(24, 0);
    List<int> rowSubTotal = List.filled(24, 0);
    List<int> rowNotWeighed = List.filled(24, 0);
    List<int> rowOverAge = List.filled(24, 0);
    List<int> rowMovedOut = List.filled(24, 0);
    List<int> rowDeceased = List.filled(24, 0);
    List<int> rowGrandTotal = List.filled(24, 0);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;

      for (final child in children) {
        final age = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);
        
        if (!child.isActive) {
          if (child.inactiveReason == 'Transferred') {
            rowMovedOut[newIdx]++;
            rowMovedOut[oldIdx]++;
          } else if (child.inactiveReason == 'Deceased') {
            rowDeceased[newIdx]++;
            rowDeceased[oldIdx]++;
          } else {
            rowOverAge[newIdx]++;
            rowOverAge[oldIdx]++;
          }
          continue;
        }

        if (age < 0) continue; // Not born yet

        if (age >= 24) {
          rowOverAge[newIdx]++;
          rowOverAge[oldIdx]++;
          continue;
        }

        // Active child 0-23 months
        final measurements = _measurementRepo.getForChild(child.id);
        final thisMonthMs = measurements.where((mRec) => mRec.date.year == year && mRec.date.month == m).toList();
        final prevMs = measurements.where((mRec) => mRec.date.year < year || (mRec.date.year == year && mRec.date.month < m)).toList();

        final statusNew = _reportStatusForChildAndMeasurement(
          child,
          thisMonthMs.isNotEmpty ? thisMonthMs.first : null,
        );
        final statusOld = _reportStatusForChildAndMeasurement(
          child,
          prevMs.isNotEmpty ? prevMs.first : null,
        );

        // Fill OLD column
        if (statusOld == 'Underweight') {
          rowUw[oldIdx]++;
        } else if (statusOld == 'Severely Underweight') {
          rowSuw[oldIdx]++;
        } else {
          rowNormal[oldIdx]++;
        }

        // Fill NEW column
        if (thisMonthMs.isEmpty) {
          rowNotWeighed[newIdx]++;
          if (statusNew == 'Underweight') {
            rowUw[newIdx]++;
          } else if (statusNew == 'Severely Underweight') {
            rowSuw[newIdx]++;
          } else {
            rowNormal[newIdx]++;
          }
        } else {
          if (statusNew == 'Underweight') {
            rowUw[newIdx]++;
          } else if (statusNew == 'Severely Underweight') {
            rowSuw[newIdx]++;
          } else {
            rowNormal[newIdx]++;
          }
        }
      }

      rowSubTotal[oldIdx] = rowNormal[oldIdx] + rowUw[oldIdx] + rowSuw[oldIdx];
      rowSubTotal[newIdx] = rowNormal[newIdx] + rowUw[newIdx] + rowSuw[newIdx];

      rowGrandTotal[oldIdx] = rowSubTotal[oldIdx] + rowNotWeighed[oldIdx] + rowOverAge[oldIdx] + rowMovedOut[oldIdx] + rowDeceased[oldIdx];
      rowGrandTotal[newIdx] = rowSubTotal[newIdx] + rowNotWeighed[newIdx] + rowOverAge[newIdx] + rowMovedOut[newIdx] + rowDeceased[newIdx];
    }

    return ConsolidationMatrixData(
      reportTypeId: 'consolidation_0_23',
      title: 'CONSOLIDATION 0 - 23 MONTHS',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(label: 'NO. of NORMAL', values: rowNormal),
        ConsolidationRowData(label: 'NO. of UNDERWEIGHT', values: rowUw),
        ConsolidationRowData(label: 'NO. of SEVERELY UNDERWEIGHT', values: rowSuw),
        ConsolidationRowData(label: 'TOTAL', values: rowSubTotal),
        ConsolidationRowData(label: 'Hindi natimbang:', values: rowNotWeighed),
        ConsolidationRowData(label: 'Sobra sa Edad', values: rowOverAge),
        ConsolidationRowData(label: 'Lumipat ng Tirahan', values: rowMovedOut),
        ConsolidationRowData(label: 'Namatay', values: rowDeceased),
        ConsolidationRowData(label: 'TOTAL', values: rowGrandTotal),
      ],
    );
  }

  String _reportStatusForChildAndMeasurement(Child child, dynamic measurement) {
    if (measurement == null) return 'Normal';

    final inferred = measurement is Measurement
        ? measurement.statusForAgeMonths(child.ageInMonthsAt(measurement.date))
        : measurement['weightForAgeStatus'] ?? 'Normal';

    switch (inferred) {
      case 'SAM':
      case 'Severely Underweight':
        return 'Severely Underweight';
      case 'MAM':
      case 'Underweight':
        return 'Underweight';
      default:
        return 'Normal';
    }
  }

  ConsolidationMatrixData _compute24to59Matrix(String barangay, int year) {
    final children = _childRepo.getByBarangay(barangay);
    final mainHeaders = ['BOYS', 'GIRLS', 'TOTAL'];
    final subHeaders = [
      '1ST. QTR.', '2ND. QTR.', '3RD.QTR.', '4TH.QTR.',
      '1ST. QTR.', '2ND. QTR.', '3RD.QTR.', '4TH.QTR.',
      '1ST. QTR.', '2ND. QTR.', '3RD.QTR.', '4TH.QTR.'
    ];

    List<int> rowNormal = List.filled(12, 0);
    List<int> rowUw = List.filled(12, 0);
    List<int> rowSuw = List.filled(12, 0);
    List<int> rowOw = List.filled(12, 0);
    List<int> rowSubTotal = List.filled(12, 0);
    List<int> rowNotWeighed = List.filled(12, 0);
    List<int> rowOverAge = List.filled(12, 0);
    List<int> rowMovedOut = List.filled(12, 0);
    List<int> rowDeceased = List.filled(12, 0);
    List<int> rowGrandTotal = List.filled(12, 0);

    for (int q = 1; q <= 4; q++) {
      final qEndMonth = q * 3;
      final boysIdx = q - 1;       // 0,1,2,3
      final girlsIdx = q + 3;      // 4,5,6,7
      final totalIdx = q + 7;      // 8,9,10,11

      for (final child in children) {
        final age = (year - child.birthDate.year) * 12 + (qEndMonth - child.birthDate.month);
        final isBoy = child.gender == 'Male';
        final targetIdx = isBoy ? boysIdx : girlsIdx;

        if (!child.isActive) {
          if (child.inactiveReason == 'Transferred') {
            rowMovedOut[targetIdx]++;
            rowMovedOut[totalIdx]++;
          } else if (child.inactiveReason == 'Deceased') {
            rowDeceased[targetIdx]++;
            rowDeceased[totalIdx]++;
          } else {
            rowOverAge[targetIdx]++;
            rowOverAge[totalIdx]++;
          }
          continue;
        }

        if (age < 24) continue;

        if (age >= 60) {
          rowOverAge[targetIdx]++;
          rowOverAge[totalIdx]++;
          continue;
        }

        final status = child.nutritionStatus;
        if (status == 'Underweight') {
          rowUw[targetIdx]++;
          rowUw[totalIdx]++;
        } else if (status == 'Severely Underweight') {
          rowSuw[targetIdx]++;
          rowSuw[totalIdx]++;
        } else if (status == 'Overweight' || child.wastingStatus == 'Overweight') {
          rowOw[targetIdx]++;
          rowOw[totalIdx]++;
        } else {
          rowNormal[targetIdx]++;
          rowNormal[totalIdx]++;
        }
      }

      rowSubTotal[boysIdx] = rowNormal[boysIdx] + rowUw[boysIdx] + rowSuw[boysIdx] + rowOw[boysIdx];
      rowSubTotal[girlsIdx] = rowNormal[girlsIdx] + rowUw[girlsIdx] + rowSuw[girlsIdx] + rowOw[girlsIdx];
      rowSubTotal[totalIdx] = rowSubTotal[boysIdx] + rowSubTotal[girlsIdx];

      rowGrandTotal[boysIdx] = rowSubTotal[boysIdx] + rowNotWeighed[boysIdx] + rowOverAge[boysIdx] + rowMovedOut[boysIdx] + rowDeceased[boysIdx];
      rowGrandTotal[girlsIdx] = rowSubTotal[girlsIdx] + rowNotWeighed[girlsIdx] + rowOverAge[girlsIdx] + rowMovedOut[girlsIdx] + rowDeceased[girlsIdx];
      rowGrandTotal[totalIdx] = rowGrandTotal[boysIdx] + rowGrandTotal[girlsIdx];
    }

    return ConsolidationMatrixData(
      reportTypeId: 'consolidation_24_59',
      title: 'CONSOLIDATION 24 - 59 MONTHS',
      barangay: barangay,
      year: year,
      mainHeaders: mainHeaders,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(label: 'NORMAL', values: rowNormal),
        ConsolidationRowData(label: 'UNDERWEIGHT', values: rowUw),
        ConsolidationRowData(label: 'SEVERELY UNDERWEIGHT', values: rowSuw),
        ConsolidationRowData(label: 'OVERWEIGHT', values: rowOw),
        ConsolidationRowData(label: 'TOTAL', values: rowSubTotal),
        ConsolidationRowData(label: 'Hindi natimbang:', values: rowNotWeighed),
        ConsolidationRowData(label: 'Sobra sa Edad', values: rowOverAge),
        ConsolidationRowData(label: 'Lumipat ng Tirahan', values: rowMovedOut),
        ConsolidationRowData(label: 'Namatay', values: rowDeceased),
        ConsolidationRowData(label: 'TOTAL', values: rowGrandTotal),
      ],
    );
  }

  ConsolidationMatrixData _computeUwMatrix(String barangay, int year) {
    final matrix = _compute0to23Matrix(barangay, year);
    return ConsolidationMatrixData(
      reportTypeId: 'uw_suw',
      title: 'CONSOLIDATION UNDERWEIGHT / SEVERELY UNDERWEIGHT',
      barangay: barangay,
      year: year,
      mainHeaders: matrix.mainHeaders,
      subHeaders: matrix.subHeaders,
      rows: matrix.rows,
    );
  }

  ConsolidationMatrixData _computeStuntedMatrix(String barangay, int year) {
    final children = _childRepo.getByBarangay(barangay);
    final months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    final subHeaders = List.generate(24, (i) => i.isEven ? 'OLD' : 'NEW');

    List<int> rowNormal = List.filled(24, 0);
    List<int> rowStunted = List.filled(24, 0);
    List<int> rowSeverelyStunted = List.filled(24, 0);
    List<int> rowSubTotal = List.filled(24, 0);
    List<int> rowNotWeighed = List.filled(24, 0);
    List<int> rowOverAge = List.filled(24, 0);
    List<int> rowMovedOut = List.filled(24, 0);
    List<int> rowDeceased = List.filled(24, 0);
    List<int> rowGrandTotal = List.filled(24, 0);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;

      for (final child in children) {
        final age = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);
        
        if (!child.isActive) {
          if (child.inactiveReason == 'Transferred') {
            rowMovedOut[newIdx]++;
            rowMovedOut[oldIdx]++;
          } else if (child.inactiveReason == 'Deceased') {
            rowDeceased[newIdx]++;
            rowDeceased[oldIdx]++;
          } else {
            rowOverAge[newIdx]++;
            rowOverAge[oldIdx]++;
          }
          continue;
        }

        if (age < 0 || age >= 60) {
          if (age >= 60) {
            rowOverAge[newIdx]++;
            rowOverAge[oldIdx]++;
          }
          continue;
        }

        final status = child.stuntingStatus;
        if (status == 'Stunted') {
          rowStunted[newIdx]++;
          rowStunted[oldIdx]++;
        } else if (status == 'Severely Stunted') {
          rowSeverelyStunted[newIdx]++;
          rowSeverelyStunted[oldIdx]++;
        } else {
          rowNormal[newIdx]++;
          rowNormal[oldIdx]++;
        }
      }

      rowSubTotal[oldIdx] = rowNormal[oldIdx] + rowStunted[oldIdx] + rowSeverelyStunted[oldIdx];
      rowSubTotal[newIdx] = rowNormal[newIdx] + rowStunted[newIdx] + rowSeverelyStunted[newIdx];

      rowGrandTotal[oldIdx] = rowSubTotal[oldIdx] + rowNotWeighed[oldIdx] + rowOverAge[oldIdx] + rowMovedOut[oldIdx] + rowDeceased[oldIdx];
      rowGrandTotal[newIdx] = rowSubTotal[newIdx] + rowNotWeighed[newIdx] + rowOverAge[newIdx] + rowMovedOut[newIdx] + rowDeceased[newIdx];
    }

    return ConsolidationMatrixData(
      reportTypeId: 'stunted_sst',
      title: 'CONSOLIDATION STUNTED / SEVERELY STUNTED',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(label: 'NO. of NORMAL', values: rowNormal),
        ConsolidationRowData(label: 'NO. of STUNTED', values: rowStunted),
        ConsolidationRowData(label: 'NO. of SEVERELY STUNTED', values: rowSeverelyStunted),
        ConsolidationRowData(label: 'TOTAL', values: rowSubTotal),
        ConsolidationRowData(label: 'Hindi natimbang:', values: rowNotWeighed),
        ConsolidationRowData(label: 'Sobra sa Edad', values: rowOverAge),
        ConsolidationRowData(label: 'Lumipat ng Tirahan', values: rowMovedOut),
        ConsolidationRowData(label: 'Namatay', values: rowDeceased),
        ConsolidationRowData(label: 'TOTAL', values: rowGrandTotal),
      ],
    );
  }

  ConsolidationMatrixData _computeWastedMatrix(String barangay, int year) {
    final children = _childRepo.getByBarangay(barangay);
    final months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    final subHeaders = List.generate(24, (i) => i.isEven ? 'OLD' : 'NEW');

    List<int> rowNormal = List.filled(24, 0);
    List<int> rowWasted = List.filled(24, 0);
    List<int> rowSeverelyWasted = List.filled(24, 0);
    List<int> rowSubTotal = List.filled(24, 0);
    List<int> rowNotWeighed = List.filled(24, 0);
    List<int> rowOverAge = List.filled(24, 0);
    List<int> rowMovedOut = List.filled(24, 0);
    List<int> rowDeceased = List.filled(24, 0);
    List<int> rowGrandTotal = List.filled(24, 0);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;

      for (final child in children) {
        final age = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);
        
        if (!child.isActive) {
          if (child.inactiveReason == 'Transferred') {
            rowMovedOut[newIdx]++;
            rowMovedOut[oldIdx]++;
          } else if (child.inactiveReason == 'Deceased') {
            rowDeceased[newIdx]++;
            rowDeceased[oldIdx]++;
          } else {
            rowOverAge[newIdx]++;
            rowOverAge[oldIdx]++;
          }
          continue;
        }

        if (age < 0 || age >= 60) {
          if (age >= 60) {
            rowOverAge[newIdx]++;
            rowOverAge[oldIdx]++;
          }
          continue;
        }

        final status = child.wastingStatus;
        if (status == 'MAM' || status == 'Wasted') {
          rowWasted[newIdx]++;
          rowWasted[oldIdx]++;
        } else if (status == 'SAM' || status == 'Severely Wasted') {
          rowSeverelyWasted[newIdx]++;
          rowSeverelyWasted[oldIdx]++;
        } else {
          rowNormal[newIdx]++;
          rowNormal[oldIdx]++;
        }
      }

      rowSubTotal[oldIdx] = rowNormal[oldIdx] + rowWasted[oldIdx] + rowSeverelyWasted[oldIdx];
      rowSubTotal[newIdx] = rowNormal[newIdx] + rowWasted[newIdx] + rowSeverelyWasted[newIdx];

      rowGrandTotal[oldIdx] = rowSubTotal[oldIdx] + rowNotWeighed[oldIdx] + rowOverAge[oldIdx] + rowMovedOut[oldIdx] + rowDeceased[oldIdx];
      rowGrandTotal[newIdx] = rowSubTotal[newIdx] + rowNotWeighed[newIdx] + rowOverAge[newIdx] + rowMovedOut[newIdx] + rowDeceased[newIdx];
    }

    return ConsolidationMatrixData(
      reportTypeId: 'wasted_sw',
      title: 'CONSOLIDATION WASTED / SEVERELY WASTED',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(label: 'NO. of NORMAL', values: rowNormal),
        ConsolidationRowData(label: 'NO. of WASTED / MAM', values: rowWasted),
        ConsolidationRowData(label: 'NO. of SEVERELY WASTED / SAM', values: rowSeverelyWasted),
        ConsolidationRowData(label: 'TOTAL', values: rowSubTotal),
        ConsolidationRowData(label: 'Hindi natimbang:', values: rowNotWeighed),
        ConsolidationRowData(label: 'Sobra sa Edad', values: rowOverAge),
        ConsolidationRowData(label: 'Lumipat ng Tirahan', values: rowMovedOut),
        ConsolidationRowData(label: 'Namatay', values: rowDeceased),
        ConsolidationRowData(label: 'TOTAL', values: rowGrandTotal),
      ],
    );
  }

  List<Child> _children(String barangay, {int? minAge, int? maxAgeExclusive}) {
    return _childRepo.getByBarangay(barangay).where((c) {
      if (!c.isActive) return false;
      if (minAge != null && c.ageInMonths < minAge) return false;
      if (maxAgeExclusive != null && c.ageInMonths >= maxAgeExclusive) {
        return false;
      }
      return true;
    }).toList();
  }

  Map<String, int> _byWeightStatus(List<Child> children) => {
    'Normal': children.where((c) => c.nutritionStatus == 'Normal').length,
    'Underweight': children
        .where((c) => c.nutritionStatus == 'Underweight')
        .length,
    'Severely Underweight': children
        .where((c) => c.nutritionStatus == 'Severely Underweight')
        .length,
    'Not weighed': children
        .where((c) => c.nutritionStatus == 'Not weighed')
        .length,
    'Total': children.length,
  };

  Map<String, int> _byWeightStatusWithGender(List<Child> children) {
    final boys = children.where((c) => c.gender == 'Male').toList();
    final girls = children.where((c) => c.gender == 'Female').toList();
    return {
      'Normal (Boys)': boys.where((c) => c.nutritionStatus == 'Normal').length,
      'Normal (Girls)': girls
          .where((c) => c.nutritionStatus == 'Normal')
          .length,
      'Underweight (Boys)': boys
          .where((c) => c.nutritionStatus == 'Underweight')
          .length,
      'Underweight (Girls)': girls
          .where((c) => c.nutritionStatus == 'Underweight')
          .length,
      'Overweight (Boys)': boys
          .where((c) => c.wastingStatus == 'Overweight')
          .length,
      'Overweight (Girls)': girls
          .where((c) => c.wastingStatus == 'Overweight')
          .length,
      'Total Boys': boys.length,
      'Total Girls': girls.length,
      'Total': children.length,
    };
  }

  Map<String, int> _uwSuwOnly(List<Child> children) => {
    'Underweight': children
        .where((c) => c.nutritionStatus == 'Underweight')
        .length,
    'Severely Underweight': children
        .where((c) => c.nutritionStatus == 'Severely Underweight')
        .length,
    'Total flagged': children
        .where(
          (c) =>
              c.nutritionStatus == 'Underweight' ||
              c.nutritionStatus == 'Severely Underweight',
        )
        .length,
  };

  Map<String, int> _byHeightStatus(List<Child> children) => {
    'Normal': children.where((c) => c.stuntingStatus == 'Normal').length,
    'Stunted': children.where((c) => c.stuntingStatus == 'Stunted').length,
    'Severely Stunted': children
        .where((c) => c.stuntingStatus == 'Severely Stunted')
        .length,
    'Tall': children.where((c) => c.stuntingStatus == 'Tall').length,
    'Total': children.length,
  };

  Map<String, int> _byWastingStatus(List<Child> children) => {
    'Normal': children.where((c) => c.wastingStatus == 'Normal').length,
    'Wasted / MAM': children
        .where((c) => c.wastingStatus == 'MAM' || c.wastingStatus == 'Wasted')
        .length,
    'Severely Wasted / SAM': children
        .where((c) => c.wastingStatus == 'SAM' || c.wastingStatus == 'Severely Wasted')
        .length,
    'Overweight': children
        .where((c) => c.wastingStatus == 'Overweight')
        .length,
    'Total': children.length,
  };
}
