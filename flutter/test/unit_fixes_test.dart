import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:appscalev3/data/growth_standards/growth_classifier.dart';
import 'package:appscalev3/data/models/referral.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/guardian.dart';
import 'package:appscalev3/data/models/app_notification.dart';
import 'package:appscalev3/data/models/vitamin_a_record.dart';
import 'package:appscalev3/data/models/deworming_record.dart';
import 'package:appscalev3/data/models/program_schedule.dart';
import 'package:appscalev3/data/local/vitamin_a_repository.dart';
import 'package:appscalev3/data/local/deworming_repository.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';
import 'package:appscalev3/data/growth_standards/measurement_validator.dart';
import 'package:appscalev3/features/reports/services/consolidation_computation_service.dart';
import 'package:appscalev3/shared/utils/app_user_identity.dart';
import 'package:appscalev3/data/models/measurement.dart';

void main() {
  group('Item 4: GrowthClassifier Tests', () {
    test('Classifies Overweight when weightKg > posTwoSD', () {
      final status = GrowthClassifier.classifyWeightForAge(
        ageMonths: 24,
        gender: 'Boy',
        weightKg: 16.5,
      );
      expect(status, equals('Overweight'));
    });

    test(
      'Classifies Normal when weightKg is between negTwoSD and posTwoSD',
      () {
        final status = GrowthClassifier.classifyWeightForAge(
          ageMonths: 24,
          gender: 'Boy',
          weightKg: 12.0,
        );
        expect(status, equals('Normal'));
      },
    );

    test(
      'Classifies Underweight when weightKg < negTwoSD and >= negThreeSD',
      () {
        final status = GrowthClassifier.classifyWeightForAge(
          ageMonths: 24,
          gender: 'Boy',
          weightKg: 9.2,
        );
        expect(status, equals('Underweight'));
      },
    );

    test('Classifies Severely Underweight when weightKg < negThreeSD', () {
      final status = GrowthClassifier.classifyWeightForAge(
        ageMonths: 24,
        gender: 'Boy',
        weightKg: 8.0,
      );
      expect(status, equals('Severely Underweight'));
    });
  });

  group('Referral Model Tests', () {
    test('Referral copyWith correctly updates status and notes', () {
      final ref = Referral(
        id: 'ref-1',
        beneficiaryType: 'child',
        beneficiaryId: 'c1',
        beneficiaryName: 'Test Baby',
        barangay: 'San Antonio',
        reason: 'Severe Acute Malnutrition (SAM)',
        facility: 'RHU Main',
        notes: '',
        status: 'Pending',
        createdAt: DateTime(2026, 3, 1),
      );

      final updated = ref.copyWith(
        status: 'In Progress',
        notes: 'Referred to RHU nutritionist for RUTF therapy.',
      );

      expect(updated.status, equals('In Progress'));
      expect(
        updated.notes,
        equals('Referred to RHU nutritionist for RUTF therapy.'),
      );
      expect(updated.id, equals('ref-1'));
      expect(updated.facility, equals('RHU Main'));
    });
  });

  group('Child Model Integrity Tests', () {
    test(
      'Child copyWith preserves wastingStatus and other fields when updated',
      () {
        final child = Child(
          id: 'c-test',
          sequenceNo: '001',
          fullName: 'Baby Smith',
          birthDate: DateTime(2025, 1, 1),
          gender: 'Girl',
          address: 'Purok 1',
          barangay: 'San Antonio',
          belongsToIpGroup: false,
          disability: 'None',
          guardian: const Guardian(
            fullName: 'Mary Smith',
            relationship: 'Mother',
            contactNo: '09999999999',
          ),
          createdAt: DateTime(2025, 1, 1),
          nutritionStatus: 'Normal',
          wastingStatus: 'MAM',
          stuntingStatus: 'Normal',
        );

        final updated = child.copyWith(nutritionStatus: 'Underweight');
        expect(updated.wastingStatus, equals('MAM'));
        expect(updated.nutritionStatus, equals('Underweight'));
        expect(updated.fullName, equals('Baby Smith'));
        expect(updated.guardian.fullName, equals('Mary Smith'));
      },
    );

    test('Child age calculation accounts for day-of-month instead of month-only rounding', () {
      final now = DateTime(2025, 3, 15);
      final child = Child(
        id: 'c-age-test',
        sequenceNo: '002',
        fullName: 'Baby With Day Boundary',
        birthDate: DateTime(2024, 3, 31),
        gender: 'Boy',
        address: 'Purok 2',
        barangay: 'San Antonio',
        belongsToIpGroup: false,
        disability: 'None',
        guardian: const Guardian(
          fullName: 'Parent Name',
          relationship: 'Mother',
          contactNo: '09123456789',
        ),
        createdAt: DateTime(2024, 3, 31),
      );

      expect(Child.monthsBetween(child.birthDate, now), equals(11));
      expect(child.ageInMonthsAt(now), equals(11));
    });
  });

  group('Referral & Notification Web Architecture Tests', () {
    test('AppNotification model serialization and deserialization', () {
      final notif = AppNotification(
        id: 'notif-123',
        title: 'Referral Resolved by RHU',
        message:
            'RHU completed referral for Baby Juan. Outcome: RUTF supply provided.',
        type: 'referral_completed',
        referralId: 'ref-001',
        timestamp: DateTime(2026, 3, 18, 14, 0),
        isRead: false,
      );

      final map = notif.toMap();
      final restored = AppNotification.fromMap(map);

      expect(restored.id, equals('notif-123'));
      expect(restored.title, equals('Referral Resolved by RHU'));
      expect(restored.type, equals('referral_completed'));
      expect(restored.referralId, equals('ref-001'));
      expect(restored.isRead, isFalse);

      final markedRead = restored.copyWith(isRead: true);
      expect(markedRead.isRead, isTrue);
    });
  });

  group('Measurement classification tests', () {
    test('Infants use weight-for-length status instead of BMI for wasting classification', () {
      final infant = Measurement(
        date: DateTime(2026, 3, 1),
        weightKg: 7.2,
        heightCm: 66.0,
        muacCm: 11.5,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Underweight',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'SAM',
        customBmi: 16.5,
        customBmiStatus: 'Normal',
      );

      expect(infant.statusForAgeMonths(11), equals('SAM'));
      expect(infant.statusForAgeMonths(30), equals('Normal'));
      expect(infant.effectiveWastingStatus, equals('SAM'));
    });
  });

  group('Report consolidation logic', () {
    test('0-23 month consolidation uses the measurement-date weight-for-length status for infants', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (MethodCall methodCall) async {
          if (methodCall.method == 'getApplicationDocumentsDirectory') {
            return '/tmp';
          }
          return null;
        },
      );
      await Hive.initFlutter();
      await Hive.openBox(HiveBoxes.children);
      await Hive.openBox(HiveBoxes.measurements);

      final childBox = Hive.box(HiveBoxes.children);
      final measurementBox = Hive.box(HiveBoxes.measurements);
      await childBox.clear();
      await measurementBox.clear();

      final child = Child(
        id: 'child-0-23-report',
        sequenceNo: '001',
        fullName: 'Infant Report Test',
        birthDate: DateTime(2025, 1, 10),
        gender: 'Boy',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: 'None',
        guardian: const Guardian(
          fullName: 'Parent Name',
          relationship: 'Mother',
          contactNo: '09999999999',
        ),
        createdAt: DateTime(2025, 1, 10),
        nutritionStatus: 'Normal',
        stuntingStatus: 'Normal',
        wastingStatus: 'Normal',
      );

      await childBox.put(child.id, child.toMap()..['_syncStatus'] = 'synced');

      final measurement = Measurement(
        date: DateTime(2026, 1, 15),
        weightKg: 7.6,
        heightCm: 66.0,
        muacCm: 11.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Normal',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'SAM',
        customBmi: 17.4,
        customBmiStatus: 'Normal',
      );

      await measurementBox.put(child.id, [measurement.toMap()..['_syncStatus'] = 'synced']);

      final matrix = ConsolidationComputationService().computeMatrix(
        'consolidation_0_23',
        'Tiguion',
        year: 2026,
      );

      expect(matrix.rows[2].values[1], greaterThan(0));
      expect(matrix.rows[2].values[1], equals(1));
    });
  });

  group('Vitamin A Program DOH Guidelines Tests', () {
    test('DOH Vitamin A dosage recommendation by age', () {
      expect(
        VitaminARepository.determineRecommendedDosage(4),
        equals('Not Eligible (<6 mos)'),
      );
      expect(
        VitaminARepository.determineRecommendedDosage(6),
        equals('100,000 IU (Blue)'),
      );
      expect(
        VitaminARepository.determineRecommendedDosage(11),
        equals('100,000 IU (Blue)'),
      );
      expect(
        VitaminARepository.determineRecommendedDosage(12),
        equals('200,000 IU (Red)'),
      );
      expect(
        VitaminARepository.determineRecommendedDosage(59),
        equals('200,000 IU (Red)'),
      );
      expect(
        VitaminARepository.determineRecommendedDosage(60),
        equals('Exceeds Target Age (>59 mos)'),
      );
    });

    test('VitaminARecord serialization and deserialization', () {
      final now = DateTime(2026, 3, 18);
      final record = VitaminARecord(
        id: 'vit-101',
        childId: 'c-1',
        childName: 'Baby Juan',
        barangay: 'Tiguion',
        ageInMonths: 9,
        dateGiven: now,
        dosage: '100,000 IU (Blue)',
        doseType: 'Routine (6-11 mos)',
        administeredBy: 'Nutrition Staff',
        remarks: 'No reaction',
        nextDueDate: now.add(const Duration(days: 180)),
        createdAt: now,
      );

      final map = record.toMap();
      final restored = VitaminARecord.fromMap(map);

      expect(restored.id, equals('vit-101'));
      expect(restored.childName, equals('Baby Juan'));
      expect(restored.dosage, equals('100,000 IU (Blue)'));
      expect(restored.administeredBy, equals('Nutrition Staff'));
      expect(restored.nextDueDate, isNotNull);
    });
  });

  group('User identity normalization', () {
    test('resolves the logged-in user name without default placeholders', () {
      final user = {
        'full_name': 'Maria Santos',
        'first_name': 'Maria',
        'last_name': 'Santos',
      };

      expect(AppUserIdentity.resolveDisplayName(user), equals('Maria Santos'));
      expect(AppUserIdentity.resolveBarangay(user), equals('Tiguion'));
    });

    test('sanitizes mobile numbers to digits only', () {
      expect(AppUserIdentity.sanitizeMobileNumber('+63 912-345-6789'), equals('639123456789'));
      expect(AppUserIdentity.sanitizeMobileNumber('09ABC12345X'), equals('0912345'));
      expect(AppUserIdentity.sanitizeMobileNumber('   '), isEmpty);
      expect(AppUserIdentity.isValidPhilippineContactNumber(''), isTrue);
      expect(AppUserIdentity.isValidPhilippineContactNumber('+63 912-345-6789'), isTrue);
    });
  });

  group('Deworming Program DOH Guidelines Tests', () {
    test('DOH Deworming eligibility by age', () {
      expect(
        DewormingRepository.isEligible(6),
        isFalse,
      ); // under 12 mos contraindicated
      expect(DewormingRepository.isEligible(11), isFalse);
      expect(DewormingRepository.isEligible(12), isTrue); // 12-59 mos target
      expect(DewormingRepository.isEligible(36), isTrue);
      expect(DewormingRepository.isEligible(59), isTrue);
      expect(DewormingRepository.isEligible(60), isFalse);
    });

    test('DewormingRecord serialization and deserialization', () {
      final now = DateTime(2026, 3, 18);
      final record = DewormingRecord(
        id: 'dew-101',
        childId: 'c-2',
        childName: 'Baby Pedro',
        barangay: 'Tiguion',
        ageInMonths: 24,
        dateGiven: now,
        drugName: 'Albendazole 400mg',
        round: '1st Round (Jan - Jun)',
        adverseEvents: 'None',
        administeredBy: 'Nutrition Staff',
        remarks: 'Taken with water',
        nextDueDate: now.add(const Duration(days: 180)),
        createdAt: now,
      );

      final map = record.toMap();
      final restored = DewormingRecord.fromMap(map);

      expect(restored.id, equals('dew-101'));
      expect(restored.childName, equals('Baby Pedro'));
      expect(restored.drugName, equals('Albendazole 400mg'));
      expect(restored.round, equals('1st Round (Jan - Jun)'));
      expect(restored.adverseEvents, equals('None'));
    });
  });

  group('ProgramSchedule Model Tests', () {
    test('ProgramSchedule serialization and deserialization', () {
      final now = DateTime(2026, 3, 25);
      final sched = ProgramSchedule(
        id: 'sch-101',
        title: 'Community Deworming Day',
        programType: 'Deworming',
        date: now,
        startTime: '08:00 AM',
        endTime: '12:00 PM',
        location: 'Barangay Health Center',
        targetGroup: 'Children 12-59 mos',
        notes: 'Bring child immunization card',
        barangay: 'Tiguion',
        createdBy: 'RHU Web Admin',
        createdAt: DateTime(2026, 3, 18),
      );

      final map = sched.toMap();
      final restored = ProgramSchedule.fromMap(map);

      expect(restored.id, equals('sch-101'));
      expect(restored.title, equals('Community Deworming Day'));
      expect(restored.programType, equals('Deworming'));
      expect(restored.createdBy, equals('RHU Web Admin'));
    });
  });

  group('Priority 1: Age Calculation & Edge Cases', () {
    test('Born 2026-07-31 evaluated on 2026-10-08 is exactly 2 completed months', () {
      final birth = DateTime(2026, 7, 31);
      final asOf = DateTime(2026, 10, 8);
      expect(Child.monthsBetween(birth, asOf), equals(2));
    });

    test('Born 2026-09-30 evaluated on 2026-10-08 is 0 completed months (1 wk 1 day)', () {
      final birth = DateTime(2026, 9, 30);
      final asOf = DateTime(2026, 10, 8);
      expect(Child.monthsBetween(birth, asOf), equals(0));
      expect(Child.ageDisplayAt(birth, asOf: asOf), equals('1 wk 1 day'));
    });

    test('Month-end leap year calculation (Jan 31 to Feb 29 leap year)', () {
      final birth = DateTime(2024, 1, 31);
      final feb28 = DateTime(2024, 2, 28);
      final feb29 = DateTime(2024, 2, 29);
      expect(Child.monthsBetween(birth, feb28), equals(0));
      expect(Child.monthsBetween(birth, feb29), equals(1));
    });

    test('Month-end non-leap year calculation (Jan 31 to Feb 28 non-leap year)', () {
      final birth = DateTime(2023, 1, 31);
      final feb27 = DateTime(2023, 2, 27);
      final feb28 = DateTime(2023, 2, 28);
      expect(Child.monthsBetween(birth, feb27), equals(0));
      expect(Child.monthsBetween(birth, feb28), equals(1));
    });

    test('Infant age formatting shows weeks and days for under 1 month', () {
      final now = DateTime(2026, 10, 10);
      expect(Child.ageDisplayAt(DateTime(2026, 10, 8), asOf: now), equals('2 days'));
      expect(Child.ageDisplayAt(DateTime(2026, 9, 26), asOf: now), equals('2 wks'));
      expect(Child.ageDisplayAt(DateTime(2026, 9, 10), asOf: now), equals('1 mo.'));
      expect(Child.ageDisplayAt(DateTime(2026, 7, 10), asOf: now), equals('3 mos'));
    });
  });

  group('Priority 1: Measurement Validator & Plausibility', () {
    test('Comma decimal parsing works properly', () {
      expect(MeasurementValidator.parseDecimal('12,5'), equals(12.5));
      expect(MeasurementValidator.parseDecimal('85,25'), equals(85.25));
      expect(MeasurementValidator.parseDecimal('12.5'), equals(12.5));
      expect(MeasurementValidator.parseDecimal(''), isNull);
    });

    test('Rejects implausible 25 kg weight for a 1-month-old', () {
      final err = MeasurementValidator.validateWeight(25.0, 1);
      expect(err, isNotNull);
      expect(err, contains('outside plausible range'));
    });

    test('Accepts normal 4.5 kg weight for a 1-month-old', () {
      final err = MeasurementValidator.validateWeight(4.5, 1);
      expect(err, isNull);
    });

    test('Rejects 35 cm height for a 3-month-old', () {
      final err = MeasurementValidator.validateHeight(35.0, 3);
      expect(err, isNotNull);
      expect(err, contains('outside plausible range'));
    });

    test('Rejects decreasing height compared to previous entry', () {
      final err = MeasurementValidator.validateHeight(
        58.0,
        4,
        previousHeightCm: 60.0,
      );
      expect(err, isNotNull);
      expect(err, contains('cannot decrease'));
    });

    test('Accepts valid increasing height', () {
      final err = MeasurementValidator.validateHeight(
        62.0,
        4,
        previousHeightCm: 60.0,
      );
      expect(err, isNull);
    });

    test('MUAC applicability and plausibility by age', () {
      expect(MeasurementValidator.isMuacApplicable(3), isFalse);
      expect(MeasurementValidator.isMuacApplicable(6), isTrue);
      expect(MeasurementValidator.validateMuac(14.0, 3), isNull);
      final err = MeasurementValidator.validateMuac(4.0, 12);
      expect(err, isNotNull);
      expect(err, contains('outside plausible range'));
    });
  });

  group('Priority 4: Address formatting', () {
    test('Raw number is formatted as Purok X', () {
      final child = Child(
        id: 'c-addr',
        sequenceNo: '001',
        fullName: 'Test Child',
        birthDate: DateTime(2025, 1, 1),
        gender: 'Boy',
        address: '4',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: ''),
        createdAt: DateTime(2025, 1, 1),
      );
      expect(child.formattedAddress, equals('Purok 4'));
    });
  });
}
