import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/guardian.dart';
import 'package:appscalev3/data/models/mother.dart';
import 'package:appscalev3/data/models/measurement.dart';
import 'package:appscalev3/data/models/referral.dart';
import 'package:appscalev3/data/local/measurement_repository.dart';
import 'package:appscalev3/data/local/referral_repository.dart';
import 'package:appscalev3/features/dashboard/data/dashboard_repository.dart';

void main() {
  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    const channel = MethodChannel('plugins.flutter.io/path_provider');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
      return '.';
    });
    await Hive.initFlutter();
    await Hive.openBox(HiveBoxes.settings);
    await Hive.openBox(HiveBoxes.children);
    await Hive.openBox(HiveBoxes.mothers);
    await Hive.openBox(HiveBoxes.measurements);
    await Hive.openBox(HiveBoxes.referrals);
    await Hive.box(HiveBoxes.settings).clear();
    await Hive.box(HiveBoxes.children).clear();
    await Hive.box(HiveBoxes.mothers).clear();
    await Hive.box(HiveBoxes.measurements).clear();
    await Hive.box(HiveBoxes.referrals).clear();
  });

  group('Dashboard Count & Source of Truth Tests', () {
    test('SAM cases and Severe (any indicator) counts agree with shared evaluation', () async {
      final measBox = Hive.box(HiveBoxes.measurements);
      final measRepo = MeasurementRepository();
      final dashboardRepo = DashboardRepository();

      // Child 1: SAM wasting
      final c1 = Child(
        id: 'c1',
        sequenceNo: 'c1',
        fullName: 'Child One',
        birthDate: DateTime.now().subtract(const Duration(days: 300)),
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );
      final m1 = Measurement(
        date: DateTime.now().subtract(const Duration(days: 5)),
        weightKg: 7.0,
        heightCm: 75.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Normal',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'SAM',
      );
      await measBox.put('c1', [m1.toMap()]);

      // Child 2: Severely Stunted (not SAM)
      final c2 = Child(
        id: 'c2',
        sequenceNo: 'c2',
        fullName: 'Child Two',
        birthDate: DateTime.now().subtract(const Duration(days: 400)),
        gender: 'Female',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );
      final m2 = Measurement(
        date: DateTime.now().subtract(const Duration(days: 10)),
        weightKg: 10.0,
        heightCm: 70.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Normal',
        heightForAgeStatus: 'Severely Stunted',
        weightForLengthStatus: 'Normal',
      );
      await measBox.put('c2', [m2.toMap()]);

      // Child 3: Severely Underweight (not SAM, not Stunted)
      final c3 = Child(
        id: 'c3',
        sequenceNo: 'c3',
        fullName: 'Child Three',
        birthDate: DateTime.now().subtract(const Duration(days: 500)),
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );
      final m3 = Measurement(
        date: DateTime.now().subtract(const Duration(days: 15)),
        weightKg: 7.5,
        heightCm: 85.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Severely Underweight',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'Normal',
      );
      await measBox.put('c3', [m3.toMap()]);

      // Child 4: At risk (MAM wasting)
      final c4 = Child(
        id: 'c4',
        sequenceNo: 'c4',
        fullName: 'Child Four',
        birthDate: DateTime.now().subtract(const Duration(days: 350)),
        gender: 'Female',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );
      final m4 = Measurement(
        date: DateTime.now().subtract(const Duration(days: 20)),
        weightKg: 8.5,
        heightCm: 80.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Normal',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'MAM',
      );
      await measBox.put('c4', [m4.toMap()]);

      // Child 5: Normal
      final c5 = Child(
        id: 'c5',
        sequenceNo: 'c5',
        fullName: 'Child Five',
        birthDate: DateTime.now().subtract(const Duration(days: 350)),
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );
      final m5 = Measurement(
        date: DateTime.now().subtract(const Duration(days: 20)),
        weightKg: 10.0,
        heightCm: 80.0,
        bilateralPittingEdema: false,
        weightForAgeStatus: 'Normal',
        heightForAgeStatus: 'Normal',
        weightForLengthStatus: 'Normal',
      );
      await measBox.put('c5', [m5.toMap()]);

      // Child 6: Not weighed (no measurement)
      final c6 = Child(
        id: 'c6',
        sequenceNo: 'c6',
        fullName: 'Child Six',
        birthDate: DateTime.now().subtract(const Duration(days: 100)),
        gender: 'Female',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Guardian', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime.now(),
      );

      final children = [c1, c2, c3, c4, c5, c6];
      final counts = dashboardRepo.computeNutritionCounts(children, measRepo);

      // Verify counts
      expect(counts.totalChildren, equals(6));
      expect(counts.samCases, equals(1)); // Child 1 only
      expect(counts.severeCount, equals(3)); // Child 1 (SAM), Child 2 (Sev. Stunted), Child 3 (Sev. Underweight)
      expect(counts.atRiskCount, equals(1)); // Child 4
      expect(counts.normalCount, equals(1)); // Child 5
      expect(counts.notWeighedCount, equals(1)); // Child 6 (unweighed)

      // Invariant checks
      expect(counts.samCases <= counts.severeCount, isTrue);
      expect(counts.severeCount <= counts.totalChildren, isTrue);
      final sumAll = counts.severeCount +
          counts.atRiskCount +
          counts.obeseCount +
          counts.overweightCount +
          counts.normalCount +
          counts.notWeighedCount;
      expect(sumAll, equals(counts.totalChildren));

      // Subtitle verification: samCases and severeCount must agree in format
      final subtitle = counts.samCases > 0
          ? '${counts.samCases} acute wasting · ${counts.severeCount} severe'
          : '${counts.severeCount} severe (no acute SAM)';
      expect(subtitle, equals('1 acute wasting · 3 severe'));
    });

    test('Lactating Mothers new this month only counts real registration date', () {
      final now = DateTime.now();

      // Mother registered this month
      final m1 = Mother.fromMap({
        'id': 'm1',
        'full_name': 'New Mother',
        'barangay': 'Tiguion',
        'contact_number': '09111111111',
        'purok': 'Purok 1',
        'created_at': DateTime(now.year, now.month, 5).toIso8601String(),
        'status': 'active',
      });
      expect(m1.createdAt.year, equals(now.year));
      expect(m1.createdAt.month, equals(now.month));

      // Mother registered 3 months ago (e.g. from previous year/month)
      final pastDate = DateTime(now.year, now.month > 3 ? now.month - 3 : 1, 15);
      final m2 = Mother.fromMap({
        'id': 'm2',
        'full_name': 'Old Mother',
        'barangay': 'Tiguion',
        'contact_number': '09222222222',
        'purok': 'Purok 1',
        'date_registered': pastDate.toIso8601String(),
        'status': 'active',
      });

      final activeMothers = [m1, m2];
      final newThisMonth = activeMothers
          .where((m) => m.createdAt.year == now.year && m.createdAt.month == now.month)
          .length;

      expect(newThisMonth, equals(1)); // Only m1, NOT all 2
    });
  });

  group('Referral Display Tests', () {
    test('Unreferred child shows refer button', () {
      final refStatus = ReferralRepository().getReferralHeaderStatus(
        beneficiaryId: 'unreferred_child',
      );
      expect(refStatus.showReferButton, isTrue);
      expect(refStatus.referral, isNull);
    });

    test('Referred child hides refer button and retains referral record in database', () async {
      final refBox = Hive.box(HiveBoxes.referrals);
      final ref = Referral(
        id: 'ref-1',
        beneficiaryType: 'child',
        beneficiaryId: 'child_with_ref',
        beneficiaryName: 'Referred Child',
        barangay: 'Tiguion',
        reason: 'Severely Wasted (SAM)',
        facility: 'RHU Gasan',
        notes: 'Clinical referral notes',
        status: 'Pending',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
        referredBy: 'Juana Dela Cruz (BNS)',
      );
      await refBox.put(ref.id, ref.toMap());

      final refStatus = ReferralRepository().getReferralHeaderStatus(
        beneficiaryId: 'child_with_ref',
      );

      // Must hide refer button
      expect(refStatus.showReferButton, isFalse);

      // Record in database is intact and contains referredAt and referredBy
      final savedRefs = ReferralRepository().getForBeneficiary('child_with_ref');
      expect(savedRefs.length, equals(1));
      expect(savedRefs.first.referredBy, equals('Juana Dela Cruz (BNS)'));
      expect(savedRefs.first.referredAt, isNotNull);
      expect(savedRefs.first.reason, equals('Severely Wasted (SAM)'));
    });
  });

  group('Scope 3: Age Calculation & Inactivation Tests', () {
    test('Under 1 month formatted as days', () {
      final ref = DateTime(2026, 3, 15);
      final c = Child(
        id: 'infant',
        sequenceNo: 'infant',
        fullName: 'Newborn Baby',
        birthDate: DateTime(2026, 3, 10), // 5 days old
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2026, 3, 10),
      );
      expect(c.formatAge(includeDays: true, referenceDate: ref), equals('5 days'));
      expect(c.formatAge(includeDays: false, referenceDate: ref), equals('0 months'));
    });

    test('Months and days optional format (e.g. 3 months and 4 days)', () {
      final ref = DateTime(2026, 6, 14);
      final c = Child(
        id: 'child_3m4d',
        sequenceNo: 'child_3m4d',
        fullName: 'Baby Girl',
        birthDate: DateTime(2026, 3, 10), // exactly 3 completed months and 4 days
        gender: 'Female',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2026, 3, 10),
      );
      expect(c.formatAge(includeDays: true, referenceDate: ref), equals('3 months and 4 days'));
      expect(c.formatAge(includeDays: false, referenceDate: ref), equals('3 months'));
    });

    test('Future birth date safely returns 0 days without negative values', () {
      final ref = DateTime(2026, 3, 15);
      final c = Child(
        id: 'future',
        sequenceNo: 'future',
        fullName: 'Future Child',
        birthDate: DateTime(2026, 3, 20),
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2026, 3, 15),
      );
      expect(c.formatAge(includeDays: true, referenceDate: ref), equals('0 days'));
      expect(c.formatAge(includeDays: false, referenceDate: ref), equals('0 months'));
    });

    test('Child at 59 months threshold has ageInMonths == 59', () {
      final ref = DateTime(2026, 3, 1);
      final c = Child(
        id: 'child_59m',
        sequenceNo: 'child_59m',
        fullName: 'Graduating Child',
        birthDate: DateTime(2021, 4, 1), // exactly 59 months
        gender: 'Male',
        address: 'Purok 1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2021, 4, 1),
      );
      expect(c.ageInMonthsAt(ref), equals(59));
      expect(c.formatAge(includeDays: false, referenceDate: ref), equals('59 months'));
    });
  });

  group('Scope 4: Address (Barangay + Purok) Tests', () {
    test('addressWithBarangay combines barangay and normalized purok', () {
      final c = Child(
        id: 'c_addr',
        sequenceNo: 'c_addr',
        fullName: 'Addr Child',
        birthDate: DateTime(2025, 1, 1),
        gender: 'Male',
        address: '1',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: const Guardian(fullName: 'Mother', relationship: 'Mother', contactNo: '09123456789'),
        createdAt: DateTime(2025, 1, 1),
      );
      expect(c.formattedAddress, equals('Purok 1'));
      expect(c.addressWithBarangay, equals('Tiguion, Purok 1'));
    });
  });
}
