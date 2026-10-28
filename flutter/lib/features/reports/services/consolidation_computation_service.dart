import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/growth_standards/growth_classifier.dart';
import '../../masterlist/utils/child_status_meta.dart';

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
      final monthStart = DateTime(year, m, 1);
      final monthEnd = DateTime(year, m + 1, 0, 23, 59, 59);

      // Per-month counters (reset each iteration so columns are independent)
      int mNormalOld = 0, mUwOld = 0, mSuwOld = 0;
      int mNormalNew = 0, mUwNew = 0, mSuwNew = 0;
      int mNotWeighedOld = 0, mNotWeighedNew = 0;
      int mOverAgeOld = 0, mOverAgeNew = 0;
      int mMovedOutOld = 0, mMovedOutNew = 0;
      int mDeceasedOld = 0, mDeceasedNew = 0;

      for (final child in children) {
        // 1. Child not yet born in month m
        if (child.birthDate.isAfter(monthEnd)) continue;

        // 2. Child inactive (transferred/deceased/graduated) — count in correct row
        if (!child.isActive) {
          final inactDate = child.inactiveDate;
          if (inactDate != null && !inactDate.isAfter(monthEnd)) {
            final wasAlreadyInactivePriorToMonth = inactDate.isBefore(monthStart);
            if (child.inactiveReason == 'Transferred') {
              mMovedOutNew++;
              if (wasAlreadyInactivePriorToMonth) mMovedOutOld++;
            } else if (child.inactiveReason == 'Deceased') {
              mDeceasedNew++;
              if (wasAlreadyInactivePriorToMonth) mDeceasedOld++;
            } else {
              // Graduated / aged-out handled below
            }
            continue;
          }
        }

        // 3. Sobra sa Edad: age at END of month >= 24 months
        //    (DOH counts child as 0-23 if they are still under 24 at any point
        //     in the month; we use monthEnd for the boundary.)
        final ageAtMonthEnd = child.ageInMonthsAt(monthEnd);
        if (ageAtMonthEnd >= 24) {
          // Only mark Sobra sa Edad if child was >= 24 for the whole month
          final ageAtMonthStart = child.ageInMonthsAt(monthStart);
          if (ageAtMonthStart >= 24) {
            mOverAgeNew++;
            mOverAgeOld++;
          } else {
            // Turned 24 mid-month: still participates in NEW, aged-out in OLD
            mOverAgeOld++;
            // Falls through to NEW classification below
          }
          if (ageAtMonthStart >= 24) continue;
        }

        // 4. Valid measurements sorted newest-first
        final validMs = _measurementRepo
            .getForChild(child.id)
            .where((r) => r.isPlausible)
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

        final wasBornBeforeMonthStart = child.birthDate.isBefore(monthStart);

        // --- OLD column: latest valid measurement BEFORE monthStart ---
        if (wasBornBeforeMonthStart) {
          final prevMs = validMs.where((r) => r.date.isBefore(monthStart)).toList();
          if (prevMs.isNotEmpty) {
            final pRec = prevMs.first; // sorted desc → first = latest
            final pAge = child.ageInMonthsAt(pRec.date);
            if (pAge <= 23) {
              final pStatus = GrowthClassifier.classifyWeightForAge(
                weightKg: pRec.weightKg,
                ageMonths: pAge,
                gender: child.gender,
              );
              if (pStatus == 'Severely Underweight') {
                mSuwOld++;
              } else if (pStatus == 'Underweight') {
                mUwOld++;
              } else {
                mNormalOld++;
              }
            } else {
              mOverAgeOld++;
            }
          } else {
            mNotWeighedOld++;
          }
        }

        // --- NEW column: latest valid measurement ON or BEFORE end of month M,
        //     but only classified as "weighed" if the measurement is IN month M.
        //     A child weighed in a prior month but not this month is Hindi natimbang. ---
        final latestOnOrBeforeEnd = validMs.where((r) => !r.date.isAfter(monthEnd)).toList();
        if (latestOnOrBeforeEnd.isNotEmpty) {
          final mRec = latestOnOrBeforeEnd.first;
          final isWeighedThisMonth = mRec.date.year == year && mRec.date.month == m;
          if (isWeighedThisMonth) {
            final ageAtMeas = child.ageInMonthsAt(mRec.date);
            if (ageAtMeas <= 23) {
              final wfa = GrowthClassifier.classifyWeightForAge(
                weightKg: mRec.weightKg,
                ageMonths: ageAtMeas,
                gender: child.gender,
              );
              if (wfa == 'Severely Underweight') {
                mSuwNew++;
              } else if (wfa == 'Underweight') {
                mUwNew++;
              } else {
                mNormalNew++;
              }
            } else {
              mOverAgeNew++;
            }
          } else {
            // Has an older measurement but none this month → Hindi natimbang
            mNotWeighedNew++;
          }
        } else {
          // Never weighed at all up to this month
          mNotWeighedNew++;
        }
      }

      // Write per-month results into the flat 24-element arrays
      rowNormal[oldIdx] = mNormalOld;
      rowNormal[newIdx] = mNormalNew;
      rowUw[oldIdx] = mUwOld;
      rowUw[newIdx] = mUwNew;
      rowSuw[oldIdx] = mSuwOld;
      rowSuw[newIdx] = mSuwNew;
      rowNotWeighed[oldIdx] = mNotWeighedOld;
      rowNotWeighed[newIdx] = mNotWeighedNew;
      rowOverAge[oldIdx] = mOverAgeOld;
      rowOverAge[newIdx] = mOverAgeNew;
      rowMovedOut[oldIdx] = mMovedOutOld;
      rowMovedOut[newIdx] = mMovedOutNew;
      rowDeceased[oldIdx] = mDeceasedOld;
      rowDeceased[newIdx] = mDeceasedNew;

      rowSubTotal[oldIdx] = mNormalOld + mUwOld + mSuwOld;
      rowSubTotal[newIdx] = mNormalNew + mUwNew + mSuwNew;
      rowGrandTotal[oldIdx] = rowSubTotal[oldIdx] + mNotWeighedOld + mOverAgeOld + mMovedOutOld + mDeceasedOld;
      rowGrandTotal[newIdx] = rowSubTotal[newIdx] + mNotWeighedNew + mOverAgeNew + mMovedOutNew + mDeceasedNew;
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

        final status = ChildStatusMeta.formatStatus(child.nutritionStatus);
        if (status == 'Underweight') {
          rowUw[targetIdx]++;
          rowUw[totalIdx]++;
        } else if (status == 'Severely Underweight') {
          rowSuw[targetIdx]++;
          rowSuw[totalIdx]++;
        } else if (status == 'Overweight') {
          rowOw[targetIdx]++;
          rowOw[totalIdx]++;
        } else if (status == 'Not weighed') {
          rowNotWeighed[targetIdx]++;
          rowNotWeighed[totalIdx]++;
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

        final status = ChildStatusMeta.formatStatus(child.stuntingStatus);
        if (status == 'Stunted') {
          rowStunted[newIdx]++;
          rowStunted[oldIdx]++;
        } else if (status == 'Severely Stunted') {
          rowSeverelyStunted[newIdx]++;
          rowSeverelyStunted[oldIdx]++;
        } else if (status == 'Not weighed') {
          rowNotWeighed[newIdx]++;
          rowNotWeighed[oldIdx]++;
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

        final status = ChildStatusMeta.formatStatus(child.wastingStatus);
        if (status == 'MAM' || status == 'Wasted') {
          rowWasted[newIdx]++;
          rowWasted[oldIdx]++;
        } else if (status == 'SAM' || status == 'Severely Wasted') {
          rowSeverelyWasted[newIdx]++;
          rowSeverelyWasted[oldIdx]++;
        } else if (status == 'Not weighed') {
          rowNotWeighed[newIdx]++;
          rowNotWeighed[oldIdx]++;
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
    'Normal': children
        .where((c) => ChildStatusMeta.formatStatus(c.nutritionStatus) == 'Normal')
        .length,
    'Underweight': children
        .where((c) => ChildStatusMeta.formatStatus(c.nutritionStatus) == 'Underweight')
        .length,
    'Severely Underweight': children
        .where((c) => ChildStatusMeta.formatStatus(c.nutritionStatus) == 'Severely Underweight')
        .length,
    'Overweight': children
        .where((c) => ChildStatusMeta.formatStatus(c.nutritionStatus) == 'Overweight')
        .length,
    'Not weighed': children
        .where((c) => ChildStatusMeta.formatStatus(c.nutritionStatus) == 'Not weighed')
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
