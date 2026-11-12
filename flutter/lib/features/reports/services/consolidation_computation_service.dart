import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/growth_standards/growth_classifier.dart';

/// Detailed breakdown item for a child contributing to a consolidation count.
/// Allows BNS/supervisors to tap any cell number in the report and see the exact
/// children that form that total.
class ChildDrilldownItem {
  final String childId;
  final String fullName;
  final String gender;
  final DateTime birthDate;
  final int ageMonths;
  final double? weightKg;
  final double? heightCm;
  final String status;
  final DateTime? dateWeighed;
  final String details;

  const ChildDrilldownItem({
    required this.childId,
    required this.fullName,
    required this.gender,
    required this.birthDate,
    required this.ageMonths,
    this.weightKg,
    this.heightCm,
    required this.status,
    this.dateWeighed,
    this.details = '',
  });
}

class ConsolidationRowData {
  final String label;
  final List<int> values;
  final List<List<ChildDrilldownItem>> cellChildren;

  const ConsolidationRowData({
    required this.label,
    required this.values,
    this.cellChildren = const [],
  });
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
///
/// DEFINITION OF "OLD" vs "NEW" (Batay sa Official DOH/NNC OPT Plus Standards):
/// - OLD (Dati / Naunang Katayuan):
///   Kinakatawan ang nutritional status ng bata bago pumasok ang kasalukuyang buwan.
///   Batay sa pinakahuling balidong measurement bago ang ika-1 ng buwan (monthStart).
///   Kung ang bata ay hindi pa natitimbang bago ang buwang ito, napupunta sa 'Hindi natimbang'.
///   Kung bagong panganak sa buwang ito, hindi kasama sa OLD.
/// - NEW (Bago / Kasalukuyang Pagtimbang):
///   Kinakatawan ang aktuwal na pagtimbang sa bata sa LOOB ng buwang ito (monthStart hanggang monthEnd).
///   Kung may measurement sa buwang ito at edad <= 23 months, kinaklasipika ito bilang
///   Normal, Underweight, o Severely Underweight batay sa WHO/DOH Growth Standards.
///   Kung walang pagtimbang sa buwang ito, napupunta sa 'Hindi natimbang'.
///   Kung nag-24 na buwan na sa buwang ito, napupunta sa 'Sobra sa Edad'.
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

    final kidsNormal = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsUw = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsSuw = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsNotWeighed = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsOverAge = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsMovedOut = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsDeceased = List.generate(24, (_) => <ChildDrilldownItem>[]);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;
      final monthStart = DateTime(year, m, 1);
      final monthEnd = DateTime(year, m + 1, 0, 23, 59, 59);

      for (final child in children) {
        // 1. Child not yet born in month m
        if (child.birthDate.isAfter(monthEnd)) continue;

        // 2. Child inactive (transferred/deceased/graduated)
        if (!child.isActive) {
          final inactDate = child.inactiveDate;
          if (inactDate != null && !inactDate.isAfter(monthEnd)) {
            final wasAlreadyInactivePriorToMonth = inactDate.isBefore(monthStart);
            final item = ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: child.ageInMonthsAt(inactDate),
              status: child.inactiveReason ?? 'Inactive',
              details: 'Status changed on ${inactDate.toIso8601String().split('T').first}',
            );

            if (child.inactiveReason == 'Transferred') {
              kidsMovedOut[newIdx].add(item);
              if (wasAlreadyInactivePriorToMonth) kidsMovedOut[oldIdx].add(item);
            } else if (child.inactiveReason == 'Deceased') {
              kidsDeceased[newIdx].add(item);
              if (wasAlreadyInactivePriorToMonth) kidsDeceased[oldIdx].add(item);
            }
            continue;
          }
        }

        // 3. Sobra sa Edad: age at END of month >= 24 months
        final ageAtMonthEnd = child.ageInMonthsAt(monthEnd);
        final ageAtMonthStart = child.ageInMonthsAt(monthStart);
        if (ageAtMonthEnd >= 24) {
          final overAgeItem = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMonthEnd,
            status: 'Sobra sa Edad',
            details: 'Age is $ageAtMonthEnd months (>= 24 mos)',
          );

          if (ageAtMonthStart >= 24) {
            kidsOverAge[oldIdx].add(overAgeItem);
            kidsOverAge[newIdx].add(overAgeItem);
            continue;
          } else {
            // Turned 24 mid-month
            kidsOverAge[oldIdx].add(overAgeItem);
          }
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
            final pRec = prevMs.first;
            final pAge = child.ageInMonthsAt(pRec.date);
            if (pAge <= 23) {
              final pStatus = GrowthClassifier.classifyWeightForAge(
                weightKg: pRec.weightKg,
                ageMonths: pAge,
                gender: child.gender,
              );
              final item = ChildDrilldownItem(
                childId: child.id,
                fullName: child.fullName,
                gender: child.gender,
                birthDate: child.birthDate,
                ageMonths: pAge,
                weightKg: pRec.weightKg,
                heightCm: pRec.heightCm,
                status: pStatus,
                dateWeighed: pRec.date,
                details: 'Weighed ${pRec.weightKg}kg on ${pRec.date.toIso8601String().split('T').first}',
              );
              if (pStatus == 'Severely Underweight') {
                kidsSuw[oldIdx].add(item);
              } else if (pStatus == 'Underweight') {
                kidsUw[oldIdx].add(item);
              } else {
                kidsNormal[oldIdx].add(item);
              }
            } else {
              kidsOverAge[oldIdx].add(ChildDrilldownItem(
                childId: child.id,
                fullName: child.fullName,
                gender: child.gender,
                birthDate: child.birthDate,
                ageMonths: pAge,
                status: 'Sobra sa Edad',
              ));
            }
          } else {
            kidsNotWeighed[oldIdx].add(ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: ageAtMonthStart,
              status: 'Hindi natimbang',
              details: 'No measurement prior to ${months[m - 1]} 1',
            ));
          }
        }

        // --- NEW column: latest valid measurement IN month M ---
        final inMonthMs = validMs.where((r) => r.date.year == year && r.date.month == m).toList();
        if (inMonthMs.isNotEmpty) {
          final mRec = inMonthMs.first;
          final ageAtMeas = child.ageInMonthsAt(mRec.date);
          if (ageAtMeas <= 23) {
            final wfa = GrowthClassifier.classifyWeightForAge(
              weightKg: mRec.weightKg,
              ageMonths: ageAtMeas,
              gender: child.gender,
            );
            final item = ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: ageAtMeas,
              weightKg: mRec.weightKg,
              heightCm: mRec.heightCm,
              status: wfa,
              dateWeighed: mRec.date,
              details: 'Weighed ${mRec.weightKg}kg on ${mRec.date.toIso8601String().split('T').first}',
            );
            if (wfa == 'Severely Underweight') {
              kidsSuw[newIdx].add(item);
            } else if (wfa == 'Underweight') {
              kidsUw[newIdx].add(item);
            } else {
              kidsNormal[newIdx].add(item);
            }
          } else {
            kidsOverAge[newIdx].add(ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: ageAtMeas,
              status: 'Sobra sa Edad',
            ));
          }
        } else {
          kidsNotWeighed[newIdx].add(ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMonthEnd,
            status: 'Hindi natimbang',
            details: 'No weighing record during ${months[m - 1]} $year',
          ));
        }
      }
    }

    final kidsSubTotal = List.generate(
      24,
      (i) => [...kidsNormal[i], ...kidsUw[i], ...kidsSuw[i]],
    );
    final kidsGrandTotal = List.generate(
      24,
      (i) => [
        ...kidsSubTotal[i],
        ...kidsNotWeighed[i],
        ...kidsOverAge[i],
        ...kidsMovedOut[i],
        ...kidsDeceased[i],
      ],
    );

    return ConsolidationMatrixData(
      reportTypeId: 'consolidation_0_23',
      title: 'CONSOLIDATION 0 - 23 MONTHS',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(
          label: 'NO. of NORMAL',
          values: kidsNormal.map((l) => l.length).toList(),
          cellChildren: kidsNormal,
        ),
        ConsolidationRowData(
          label: 'NO. of UNDERWEIGHT',
          values: kidsUw.map((l) => l.length).toList(),
          cellChildren: kidsUw,
        ),
        ConsolidationRowData(
          label: 'NO. of SEVERELY UNDERWEIGHT',
          values: kidsSuw.map((l) => l.length).toList(),
          cellChildren: kidsSuw,
        ),
        ConsolidationRowData(
          label: 'TOTAL',
          values: kidsSubTotal.map((l) => l.length).toList(),
          cellChildren: kidsSubTotal,
        ),
        ConsolidationRowData(
          label: 'Hindi natimbang:',
          values: kidsNotWeighed.map((l) => l.length).toList(),
          cellChildren: kidsNotWeighed,
        ),
        ConsolidationRowData(
          label: 'Sobra sa Edad',
          values: kidsOverAge.map((l) => l.length).toList(),
          cellChildren: kidsOverAge,
        ),
        ConsolidationRowData(
          label: 'Lumipat ng Tirahan',
          values: kidsMovedOut.map((l) => l.length).toList(),
          cellChildren: kidsMovedOut,
        ),
        ConsolidationRowData(
          label: 'Namatay',
          values: kidsDeceased.map((l) => l.length).toList(),
          cellChildren: kidsDeceased,
        ),
        ConsolidationRowData(
          label: 'KABUUAN',
          values: kidsGrandTotal.map((l) => l.length).toList(),
          cellChildren: kidsGrandTotal,
        ),
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

    final kidsNormal = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsUw = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsSuw = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsOw = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsNotWeighed = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsOverAge = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsMovedOut = List.generate(12, (_) => <ChildDrilldownItem>[]);
    final kidsDeceased = List.generate(12, (_) => <ChildDrilldownItem>[]);

    for (int q = 1; q <= 4; q++) {
      final qStartMonth = (q - 1) * 3 + 1;
      final qEndMonth = q * 3;
      final boysIdx = q - 1;       // 0,1,2,3
      final girlsIdx = q + 3;      // 4,5,6,7
      final totalIdx = q + 7;      // 8,9,10,11

      for (final child in children) {
        final age = (year - child.birthDate.year) * 12 + (qEndMonth - child.birthDate.month);
        final isBoy = child.gender == 'Male';
        final targetIdx = isBoy ? boysIdx : girlsIdx;

        if (!child.isActive) {
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: child.inactiveReason ?? 'Inactive',
          );
          if (child.inactiveReason == 'Transferred') {
            kidsMovedOut[targetIdx].add(item);
            kidsMovedOut[totalIdx].add(item);
          } else if (child.inactiveReason == 'Deceased') {
            kidsDeceased[targetIdx].add(item);
            kidsDeceased[totalIdx].add(item);
          } else {
            kidsOverAge[targetIdx].add(item);
            kidsOverAge[totalIdx].add(item);
          }
          continue;
        }

        if (age < 24) continue;

        if (age >= 60) {
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Sobra sa Edad',
          );
          kidsOverAge[targetIdx].add(item);
          kidsOverAge[totalIdx].add(item);
          continue;
        }

        // Dynamically evaluate quarterly measurements from repository
        final qMeas = _measurementRepo
            .getForChild(child.id)
            .where((m) =>
                m.isPlausible &&
                m.date.year == year &&
                m.date.month >= qStartMonth &&
                m.date.month <= qEndMonth)
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

        if (qMeas.isNotEmpty) {
          final rec = qMeas.first;
          final ageAtMeas = child.ageInMonthsAt(rec.date);
          final wfa = GrowthClassifier.classifyWeightForAge(
            weightKg: rec.weightKg,
            ageMonths: ageAtMeas,
            gender: child.gender,
          );
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMeas,
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            status: wfa,
            dateWeighed: rec.date,
          );

          if (wfa == 'Severely Underweight') {
            kidsSuw[targetIdx].add(item);
            kidsSuw[totalIdx].add(item);
          } else if (wfa == 'Underweight') {
            kidsUw[targetIdx].add(item);
            kidsUw[totalIdx].add(item);
          } else if (wfa == 'Overweight' || wfa == 'Obese') {
            kidsOw[targetIdx].add(item);
            kidsOw[totalIdx].add(item);
          } else {
            kidsNormal[targetIdx].add(item);
            kidsNormal[totalIdx].add(item);
          }
        } else {
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Hindi natimbang',
            details: 'No weighing record in Q$q $year',
          );
          kidsNotWeighed[targetIdx].add(item);
          kidsNotWeighed[totalIdx].add(item);
        }
      }
    }

    final kidsSubTotal = List.generate(
      12,
      (i) => [...kidsNormal[i], ...kidsUw[i], ...kidsSuw[i], ...kidsOw[i]],
    );
    final kidsGrandTotal = List.generate(
      12,
      (i) => [
        ...kidsSubTotal[i],
        ...kidsNotWeighed[i],
        ...kidsOverAge[i],
        ...kidsMovedOut[i],
        ...kidsDeceased[i],
      ],
    );

    return ConsolidationMatrixData(
      reportTypeId: 'consolidation_24_59',
      title: 'CONSOLIDATION 24 - 59 MONTHS',
      barangay: barangay,
      year: year,
      mainHeaders: mainHeaders,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(
          label: 'NORMAL',
          values: kidsNormal.map((l) => l.length).toList(),
          cellChildren: kidsNormal,
        ),
        ConsolidationRowData(
          label: 'UNDERWEIGHT',
          values: kidsUw.map((l) => l.length).toList(),
          cellChildren: kidsUw,
        ),
        ConsolidationRowData(
          label: 'SEVERELY UNDERWEIGHT',
          values: kidsSuw.map((l) => l.length).toList(),
          cellChildren: kidsSuw,
        ),
        ConsolidationRowData(
          label: 'OVERWEIGHT',
          values: kidsOw.map((l) => l.length).toList(),
          cellChildren: kidsOw,
        ),
        ConsolidationRowData(
          label: 'TOTAL',
          values: kidsSubTotal.map((l) => l.length).toList(),
          cellChildren: kidsSubTotal,
        ),
        ConsolidationRowData(
          label: 'Hindi natimbang:',
          values: kidsNotWeighed.map((l) => l.length).toList(),
          cellChildren: kidsNotWeighed,
        ),
        ConsolidationRowData(
          label: 'Sobra sa Edad',
          values: kidsOverAge.map((l) => l.length).toList(),
          cellChildren: kidsOverAge,
        ),
        ConsolidationRowData(
          label: 'Lumipat ng Tirahan',
          values: kidsMovedOut.map((l) => l.length).toList(),
          cellChildren: kidsMovedOut,
        ),
        ConsolidationRowData(
          label: 'Namatay',
          values: kidsDeceased.map((l) => l.length).toList(),
          cellChildren: kidsDeceased,
        ),
        ConsolidationRowData(
          label: 'KABUUAN',
          values: kidsGrandTotal.map((l) => l.length).toList(),
          cellChildren: kidsGrandTotal,
        ),
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

    final kidsNormal = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsStunted = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsSeverelyStunted = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsNotWeighed = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsOverAge = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsMovedOut = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsDeceased = List.generate(24, (_) => <ChildDrilldownItem>[]);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;
      final monthStart = DateTime(year, m, 1);
      final monthEnd = DateTime(year, m + 1, 0, 23, 59, 59);

      for (final child in children) {
        if (child.birthDate.isAfter(monthEnd)) continue;
        final age = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);

        if (!child.isActive) {
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: child.inactiveReason ?? 'Inactive',
          );
          if (child.inactiveReason == 'Transferred') {
            kidsMovedOut[newIdx].add(item);
            kidsMovedOut[oldIdx].add(item);
          } else if (child.inactiveReason == 'Deceased') {
            kidsDeceased[newIdx].add(item);
            kidsDeceased[oldIdx].add(item);
          } else {
            kidsOverAge[newIdx].add(item);
            kidsOverAge[oldIdx].add(item);
          }
          continue;
        }

        if (age < 0 || age >= 60) {
          if (age >= 60) {
            final item = ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: age,
              status: 'Sobra sa Edad',
            );
            kidsOverAge[newIdx].add(item);
            kidsOverAge[oldIdx].add(item);
          }
          continue;
        }

        final validMs = _measurementRepo
            .getForChild(child.id)
            .where((r) => r.isPlausible)
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

        // OLD
        final prevMs = validMs.where((r) => r.date.isBefore(monthStart)).toList();
        if (prevMs.isNotEmpty) {
          final rec = prevMs.first;
          final ageAtMeas = child.ageInMonthsAt(rec.date);
          final hfa = GrowthClassifier.classifyHeightForAge(
            heightCm: rec.heightCm,
            ageMonths: ageAtMeas,
            gender: child.gender,
          );
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMeas,
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            status: hfa,
            dateWeighed: rec.date,
          );
          if (hfa == 'Severely Stunted') {
            kidsSeverelyStunted[oldIdx].add(item);
          } else if (hfa == 'Stunted') {
            kidsStunted[oldIdx].add(item);
          } else {
            kidsNormal[oldIdx].add(item);
          }
        } else {
          kidsNotWeighed[oldIdx].add(ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Hindi natimbang',
          ));
        }

        // NEW
        final inMonthMs = validMs.where((r) => r.date.year == year && r.date.month == m).toList();
        if (inMonthMs.isNotEmpty) {
          final rec = inMonthMs.first;
          final ageAtMeas = child.ageInMonthsAt(rec.date);
          final hfa = GrowthClassifier.classifyHeightForAge(
            heightCm: rec.heightCm,
            ageMonths: ageAtMeas,
            gender: child.gender,
          );
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMeas,
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            status: hfa,
            dateWeighed: rec.date,
          );
          if (hfa == 'Severely Stunted') {
            kidsSeverelyStunted[newIdx].add(item);
          } else if (hfa == 'Stunted') {
            kidsStunted[newIdx].add(item);
          } else {
            kidsNormal[newIdx].add(item);
          }
        } else {
          kidsNotWeighed[newIdx].add(ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Hindi natimbang',
          ));
        }
      }
    }

    final kidsSubTotal = List.generate(
      24,
      (i) => [...kidsNormal[i], ...kidsStunted[i], ...kidsSeverelyStunted[i]],
    );
    final kidsGrandTotal = List.generate(
      24,
      (i) => [
        ...kidsSubTotal[i],
        ...kidsNotWeighed[i],
        ...kidsOverAge[i],
        ...kidsMovedOut[i],
        ...kidsDeceased[i],
      ],
    );

    return ConsolidationMatrixData(
      reportTypeId: 'stunted_sst',
      title: 'CONSOLIDATION STUNTED / SEVERELY STUNTED',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(
          label: 'NO. of NORMAL',
          values: kidsNormal.map((l) => l.length).toList(),
          cellChildren: kidsNormal,
        ),
        ConsolidationRowData(
          label: 'NO. of STUNTED',
          values: kidsStunted.map((l) => l.length).toList(),
          cellChildren: kidsStunted,
        ),
        ConsolidationRowData(
          label: 'NO. of SEVERELY STUNTED',
          values: kidsSeverelyStunted.map((l) => l.length).toList(),
          cellChildren: kidsSeverelyStunted,
        ),
        ConsolidationRowData(
          label: 'TOTAL',
          values: kidsSubTotal.map((l) => l.length).toList(),
          cellChildren: kidsSubTotal,
        ),
        ConsolidationRowData(
          label: 'Hindi natimbang:',
          values: kidsNotWeighed.map((l) => l.length).toList(),
          cellChildren: kidsNotWeighed,
        ),
        ConsolidationRowData(
          label: 'Sobra sa Edad',
          values: kidsOverAge.map((l) => l.length).toList(),
          cellChildren: kidsOverAge,
        ),
        ConsolidationRowData(
          label: 'Lumipat ng Tirahan',
          values: kidsMovedOut.map((l) => l.length).toList(),
          cellChildren: kidsMovedOut,
        ),
        ConsolidationRowData(
          label: 'Namatay',
          values: kidsDeceased.map((l) => l.length).toList(),
          cellChildren: kidsDeceased,
        ),
        ConsolidationRowData(
          label: 'KABUUAN',
          values: kidsGrandTotal.map((l) => l.length).toList(),
          cellChildren: kidsGrandTotal,
        ),
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

    final kidsNormal = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsWasted = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsSeverelyWasted = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsNotWeighed = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsOverAge = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsMovedOut = List.generate(24, (_) => <ChildDrilldownItem>[]);
    final kidsDeceased = List.generate(24, (_) => <ChildDrilldownItem>[]);

    for (int m = 1; m <= 12; m++) {
      final oldIdx = (m - 1) * 2;
      final newIdx = oldIdx + 1;
      final monthStart = DateTime(year, m, 1);
      final monthEnd = DateTime(year, m + 1, 0, 23, 59, 59);

      for (final child in children) {
        if (child.birthDate.isAfter(monthEnd)) continue;
        final age = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);

        if (!child.isActive) {
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: child.inactiveReason ?? 'Inactive',
          );
          if (child.inactiveReason == 'Transferred') {
            kidsMovedOut[newIdx].add(item);
            kidsMovedOut[oldIdx].add(item);
          } else if (child.inactiveReason == 'Deceased') {
            kidsDeceased[newIdx].add(item);
            kidsDeceased[oldIdx].add(item);
          } else {
            kidsOverAge[newIdx].add(item);
            kidsOverAge[oldIdx].add(item);
          }
          continue;
        }

        if (age < 0 || age >= 60) {
          if (age >= 60) {
            final item = ChildDrilldownItem(
              childId: child.id,
              fullName: child.fullName,
              gender: child.gender,
              birthDate: child.birthDate,
              ageMonths: age,
              status: 'Sobra sa Edad',
            );
            kidsOverAge[newIdx].add(item);
            kidsOverAge[oldIdx].add(item);
          }
          continue;
        }

        final validMs = _measurementRepo
            .getForChild(child.id)
            .where((r) => r.isPlausible)
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

        // OLD
        final prevMs = validMs.where((r) => r.date.isBefore(monthStart)).toList();
        if (prevMs.isNotEmpty) {
          final rec = prevMs.first;
          final ageAtMeas = child.ageInMonthsAt(rec.date);
          final wfl = GrowthClassifier.classifyWeightForLength(
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            gender: child.gender,
          );
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMeas,
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            status: wfl,
            dateWeighed: rec.date,
          );
          if (wfl == 'SAM' || wfl == 'Severely Wasted') {
            kidsSeverelyWasted[oldIdx].add(item);
          } else if (wfl == 'MAM' || wfl == 'Wasted') {
            kidsWasted[oldIdx].add(item);
          } else {
            kidsNormal[oldIdx].add(item);
          }
        } else {
          kidsNotWeighed[oldIdx].add(ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Hindi natimbang',
          ));
        }

        // NEW
        final inMonthMs = validMs.where((r) => r.date.year == year && r.date.month == m).toList();
        if (inMonthMs.isNotEmpty) {
          final rec = inMonthMs.first;
          final ageAtMeas = child.ageInMonthsAt(rec.date);
          final wfl = GrowthClassifier.classifyWeightForLength(
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            gender: child.gender,
          );
          final item = ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: ageAtMeas,
            weightKg: rec.weightKg,
            heightCm: rec.heightCm,
            status: wfl,
            dateWeighed: rec.date,
          );
          if (wfl == 'SAM' || wfl == 'Severely Wasted') {
            kidsSeverelyWasted[newIdx].add(item);
          } else if (wfl == 'MAM' || wfl == 'Wasted') {
            kidsWasted[newIdx].add(item);
          } else {
            kidsNormal[newIdx].add(item);
          }
        } else {
          kidsNotWeighed[newIdx].add(ChildDrilldownItem(
            childId: child.id,
            fullName: child.fullName,
            gender: child.gender,
            birthDate: child.birthDate,
            ageMonths: age,
            status: 'Hindi natimbang',
          ));
        }
      }
    }

    final kidsSubTotal = List.generate(
      24,
      (i) => [...kidsNormal[i], ...kidsWasted[i], ...kidsSeverelyWasted[i]],
    );
    final kidsGrandTotal = List.generate(
      24,
      (i) => [
        ...kidsSubTotal[i],
        ...kidsNotWeighed[i],
        ...kidsOverAge[i],
        ...kidsMovedOut[i],
        ...kidsDeceased[i],
      ],
    );

    return ConsolidationMatrixData(
      reportTypeId: 'wasted_sw',
      title: 'CONSOLIDATION WASTED / SEVERELY WASTED',
      barangay: barangay,
      year: year,
      mainHeaders: months,
      subHeaders: subHeaders,
      rows: [
        ConsolidationRowData(
          label: 'NO. of NORMAL',
          values: kidsNormal.map((l) => l.length).toList(),
          cellChildren: kidsNormal,
        ),
        ConsolidationRowData(
          label: 'NO. of WASTED / MAM',
          values: kidsWasted.map((l) => l.length).toList(),
          cellChildren: kidsWasted,
        ),
        ConsolidationRowData(
          label: 'NO. of SEVERELY WASTED / SAM',
          values: kidsSeverelyWasted.map((l) => l.length).toList(),
          cellChildren: kidsSeverelyWasted,
        ),
        ConsolidationRowData(
          label: 'TOTAL',
          values: kidsSubTotal.map((l) => l.length).toList(),
          cellChildren: kidsSubTotal,
        ),
        ConsolidationRowData(
          label: 'Hindi natimbang:',
          values: kidsNotWeighed.map((l) => l.length).toList(),
          cellChildren: kidsNotWeighed,
        ),
        ConsolidationRowData(
          label: 'Sobra sa Edad',
          values: kidsOverAge.map((l) => l.length).toList(),
          cellChildren: kidsOverAge,
        ),
        ConsolidationRowData(
          label: 'Lumipat ng Tirahan',
          values: kidsMovedOut.map((l) => l.length).toList(),
          cellChildren: kidsMovedOut,
        ),
        ConsolidationRowData(
          label: 'Namatay',
          values: kidsDeceased.map((l) => l.length).toList(),
          cellChildren: kidsDeceased,
        ),
        ConsolidationRowData(
          label: 'KABUUAN',
          values: kidsGrandTotal.map((l) => l.length).toList(),
          cellChildren: kidsGrandTotal,
        ),
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
        .where((c) => c.nutritionStatus == 'Normal')
        .length,
    'Underweight': children
        .where((c) => c.nutritionStatus == 'Underweight')
        .length,
    'Severely Underweight': children
        .where((c) => c.nutritionStatus == 'Severely Underweight')
        .length,
    'Overweight': children
        .where((c) => c.nutritionStatus == 'Overweight')
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
