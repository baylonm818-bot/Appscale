import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:appscalev3/data/local/child_repository.dart';
import 'package:appscalev3/data/local/measurement_repository.dart';
import 'package:appscalev3/data/local/mother_repository.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/guardian.dart';
import 'package:appscalev3/data/models/measurement.dart';
import 'package:appscalev3/data/models/mother.dart';
import 'package:appscalev3/features/reports/services/consolidation_computation_service.dart';
import 'package:appscalev3/features/reports/services/report_data_source_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_report_test_');
    Hive.init(tempDir.path);
    await Hive.openBox(HiveBoxes.children);
    await Hive.openBox(HiveBoxes.measurements);
    await Hive.openBox(HiveBoxes.mothers);
    await Hive.openBox(HiveBoxes.settings);
    await Hive.openBox(HiveBoxes.reportSignatories);
  });

  tearDown(() async {
    await Hive.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('Reports & Consolidation Source of Truth Verification Tests', () {
    test('Consolidation 0-23 Matrix matches known encoded BNS data exactly', () async {
      const brgy = 'TestBarangay';
      final childRepo = ChildRepository();
      final measRepo = MeasurementRepository();

      // 1. Normal Child (weighed in Jan 2026, 9.2 kg at ~7 months -> Normal)
      final childNormal = Child(
        id: 'c_normal',
        sequenceNo: '1',
        fullName: 'Baby Normal',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Male',
        address: 'Purok 2',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother One', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2025, 6, 15),
      );
      await childRepo.add(childNormal);
      await measRepo.addMeasurement(
        'c_normal',
        Measurement(
          date: DateTime(2026, 1, 15),
          weightKg: 9.2,
          heightCm: 70.0,
          bilateralPittingEdema: false,
          weightForAgeStatus: 'Normal',
          heightForAgeStatus: 'Normal',
          weightForLengthStatus: 'Normal',
        ),
      );

      // 2. Underweight Child (weighed in Jan 2026, 6.0 kg at ~7 months -> Underweight)
      final childUw = Child(
        id: 'c_uw',
        sequenceNo: '2',
        fullName: 'Baby Underweight',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Male',
        address: 'Purok 3',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Two', relationship: 'Mother', contactNo: '09123456788'),
        createdAt: DateTime(2025, 6, 15),
      );
      await childRepo.add(childUw);
      await measRepo.addMeasurement(
        'c_uw',
        Measurement(
          date: DateTime(2026, 1, 15),
          weightKg: 6.0,
          heightCm: 68.0,
          bilateralPittingEdema: false,
          weightForAgeStatus: 'Underweight',
          heightForAgeStatus: 'Normal',
          weightForLengthStatus: 'Normal',
        ),
      );

      // 3. Severely Underweight Child (weighed in Jan 2026, 5.0 kg at ~7 months -> Severely Underweight)
      final childSuw = Child(
        id: 'c_suw',
        sequenceNo: '3',
        fullName: 'Baby Severelyuw',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Female',
        address: 'Purok 1',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Three', relationship: 'Mother', contactNo: '09123456787'),
        createdAt: DateTime(2025, 6, 15),
      );
      await childRepo.add(childSuw);
      await measRepo.addMeasurement(
        'c_suw',
        Measurement(
          date: DateTime(2026, 1, 15),
          weightKg: 5.0,
          heightCm: 65.0,
          bilateralPittingEdema: false,
          weightForAgeStatus: 'Severely Underweight',
          heightForAgeStatus: 'Normal',
          weightForLengthStatus: 'Normal',
        ),
      );

      // 4. Not Weighed Child (active 0-23 mos child, but NO measurement in Jan 2026)
      final childNotWeighed = Child(
        id: 'c_notweighed',
        sequenceNo: '4',
        fullName: 'Baby Notweighed',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Male',
        address: 'Purok 4',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Four', relationship: 'Mother', contactNo: '09123456786'),
        createdAt: DateTime(2025, 6, 15),
      );
      await childRepo.add(childNotWeighed);

      // 5. Over Age Child (born 2023-11-01 -> 26 months old in Jan 2026 -> Sobra sa Edad)
      final childOverAge = Child(
        id: 'c_overage',
        sequenceNo: '5',
        fullName: 'Child OverAge',
        birthDate: DateTime(2023, 11, 1),
        gender: 'Female',
        address: 'Purok 5',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Five', relationship: 'Mother', contactNo: '09123456785'),
        createdAt: DateTime(2023, 11, 1),
      );
      await childRepo.add(childOverAge);

      // 6. Transferred Child (Inactive reason: Transferred)
      final childMoved = Child(
        id: 'c_moved',
        sequenceNo: '6',
        fullName: 'Child Transferred',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Male',
        address: 'Purok 6',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Six', relationship: 'Mother', contactNo: '09123456784'),
        createdAt: DateTime(2025, 6, 15),
        isActive: false,
        inactiveReason: 'Transferred',
        inactiveDate: DateTime(2026, 1, 10),
      );
      await childRepo.add(childMoved);

      // 7. Deceased Child (Inactive reason: Deceased)
      final childDeceased = Child(
        id: 'c_deceased',
        sequenceNo: '7',
        fullName: 'Child Deceased',
        birthDate: DateTime(2025, 6, 15),
        gender: 'Female',
        address: 'Purok 7',
        barangay: brgy,
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother Seven', relationship: 'Mother', contactNo: '09123456783'),
        createdAt: DateTime(2025, 6, 15),
        isActive: false,
        inactiveReason: 'Deceased',
        inactiveDate: DateTime(2026, 1, 10),
      );
      await childRepo.add(childDeceased);

      // Run Consolidation Matrix computation
      final matrix = ConsolidationComputationService().computeMatrix(
        'consolidation_0_23',
        brgy,
        year: 2026,
      );

      // January NEW is at colIdx 1 (oldIdx = 0, newIdx = 1)
      const janNewIdx = 1;

      final rowNormal = matrix.rows.firstWhere((r) => r.label == 'NO. of NORMAL');
      final rowUw = matrix.rows.firstWhere((r) => r.label == 'NO. of UNDERWEIGHT');
      final rowSuw = matrix.rows.firstWhere((r) => r.label == 'NO. of SEVERELY UNDERWEIGHT');
      final rowSubTotal = matrix.rows.firstWhere((r) => r.label == 'TOTAL');
      final rowNotWeighed = matrix.rows.firstWhere((r) => r.label == 'Hindi natimbang:');
      final rowOverAge = matrix.rows.firstWhere((r) => r.label == 'Sobra sa Edad');
      final rowMovedOut = matrix.rows.firstWhere((r) => r.label == 'Lumipat ng Tirahan');
      final rowDeceased = matrix.rows.firstWhere((r) => r.label == 'Namatay');
      final rowGrandTotal = matrix.rows.firstWhere((r) => r.label == 'KABUUAN');

      // Assert exact counts in January NEW
      expect(rowNormal.values[janNewIdx], equals(1), reason: 'Normal should be 1');
      expect(rowUw.values[janNewIdx], equals(1), reason: 'Underweight should be 1');
      expect(rowSuw.values[janNewIdx], equals(1), reason: 'Severely Underweight should be 1');

      // Assert Subtotal is strictly the sum of weighed rows above it
      final expectedSubTotal = rowNormal.values[janNewIdx] + rowUw.values[janNewIdx] + rowSuw.values[janNewIdx];
      expect(rowSubTotal.values[janNewIdx], equals(expectedSubTotal));
      expect(rowSubTotal.values[janNewIdx], equals(3));

      expect(rowNotWeighed.values[janNewIdx], equals(1), reason: 'Hindi natimbang should be 1');
      expect(rowOverAge.values[janNewIdx], equals(1), reason: 'Sobra sa Edad should be 1');
      expect(rowMovedOut.values[janNewIdx], equals(1), reason: 'Lumipat should be 1');
      expect(rowDeceased.values[janNewIdx], equals(1), reason: 'Namatay should be 1');

      // Assert Grand Total (KABUUAN) is strictly the sum of all categories
      final expectedGrandTotal = expectedSubTotal +
          rowNotWeighed.values[janNewIdx] +
          rowOverAge.values[janNewIdx] +
          rowMovedOut.values[janNewIdx] +
          rowDeceased.values[janNewIdx];
      expect(rowGrandTotal.values[janNewIdx], equals(expectedGrandTotal));
      expect(rowGrandTotal.values[janNewIdx], equals(7));

      // Assert drilldown tracking: each cell has the exact list of children
      expect(rowNormal.cellChildren[janNewIdx].length, equals(1));
      expect(rowNormal.cellChildren[janNewIdx].first.fullName, equals('Baby Normal'));

      expect(rowUw.cellChildren[janNewIdx].length, equals(1));
      expect(rowUw.cellChildren[janNewIdx].first.fullName, equals('Baby Underweight'));

      expect(rowSuw.cellChildren[janNewIdx].length, equals(1));
      expect(rowSuw.cellChildren[janNewIdx].first.fullName, equals(childSuw.fullName));

      expect(rowNotWeighed.cellChildren[janNewIdx].length, equals(1));
      expect(rowNotWeighed.cellChildren[janNewIdx].first.fullName, equals(childNotWeighed.fullName));
    });

    test('ReportDataSourceService builds Masterlists directly from encoded BNS records', () async {
      const brgy = 'TestBrgyLactating';
      final motherRepo = MotherRepository();

      final mother = Mother(
        id: 'm1',
        fullName: 'Maria Dela Cruz',
        birthDate: DateTime(1996, 5, 20),
        contactNo: '09181234567',
        address: 'Purok 4',
        barangay: brgy,
        breastfeedingPractice: 'Exclusive Breastfeeding',
        belongsToIpGroup: false,
        disability: 'None',
        createdAt: DateTime.now(),
      );
      await motherRepo.add(mother);

      final ds = ReportDataSourceService();
      final table = ds.buildLactatingMothersData(brgy, 2026);

      expect(table.rows.length, equals(1));
      final row = table.rows.first;
      expect(row[1], equals('Maria Dela Cruz'));
      // In 2026, mother born in 1996 is 30
      expect(row[2], equals('30'));
      expect(row[3], equals('Purok 4'));
      expect(row[4], equals('09181234567'));
      expect(row[5], equals('Exclusive Breastfeeding'));
    });

    test('ReportDataSourceService identifies missing data correctly', () async {
      const brgy = 'TestBrgyMissing';
      final motherRepo = MotherRepository();

      // Mother missing birthdate and contact
      final incompleteMother = Mother(
        id: 'm_incomplete',
        fullName: 'Juana Santos',
        birthDate: null,
        contactNo: '',
        address: '',
        barangay: brgy,
        breastfeedingPractice: '',
        belongsToIpGroup: false,
        disability: '',
        createdAt: DateTime.now(),
      );
      await motherRepo.add(incompleteMother);

      final ds = ReportDataSourceService();
      final issues = ds.checkMissingData('lactating_mothers_masterlist', brgy, 2026);

      expect(issues.any((i) => i.issue == 'No birthdate recorded'), isTrue);
      expect(issues.any((i) => i.issue == 'Missing purok/address'), isTrue);
      expect(issues.any((i) => i.issue == 'Missing contact number'), isTrue);
    });
  });
}
