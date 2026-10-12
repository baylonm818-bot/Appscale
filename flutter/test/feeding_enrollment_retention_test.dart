import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:appscalev3/data/local/feeding_enrollment_repository.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_feeding_test_');
    Hive.init(tempDir.path);
    await Hive.openBox(HiveBoxes.feedingEnrollment);
    await Hive.openBox(HiveBoxes.children);
  });

  tearDown(() async {
    await Hive.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('Feeding Enrollment Retention & Zero Data Loss Tests', () {
    test('Enroll marks child as enrolled and stores history without deleting', () async {
      final repo = FeedingEnrollmentRepository();
      const childId = 'child_test_101';

      expect(repo.isEnrolled(childId), isFalse);
      expect(repo.wasEverEnrolled(childId), isFalse);

      final box = Hive.box(HiveBoxes.feedingEnrollment);
      // Simulate enrolling
      final now = DateTime.now().toIso8601String();
      await box.put(childId, {
        'status': 'enrolled',
        'enrolled_at': now,
        'unenrolled_at': null,
        'unenroll_reason': null,
        'history': [
          {'action': 'enrolled', 'date': now, 'reason': 'Initial enrollment'}
        ],
      });

      expect(repo.isEnrolled(childId), isTrue);
      expect(repo.wasEverEnrolled(childId), isTrue);
      expect(repo.enrolledAt(childId), isNotNull);
      expect(repo.unenrolledAt(childId), isNull);
    });

    test('Unenroll changes status to unenrolled, records reason, and PRESERVES data', () async {
      final repo = FeedingEnrollmentRepository();
      const childId = 'child_test_102';

      final box = Hive.box(HiveBoxes.feedingEnrollment);
      final enrolledTime = DateTime.now().subtract(const Duration(days: 30)).toIso8601String();
      final unenrollTime = DateTime.now().toIso8601String();

      // Put initial enrolled record
      await box.put(childId, {
        'status': 'enrolled',
        'enrolled_at': enrolledTime,
        'unenrolled_at': null,
        'unenroll_reason': null,
        'history': [
          {'action': 'enrolled', 'date': enrolledTime, 'reason': 'Initial enrollment'}
        ],
      });

      expect(repo.isEnrolled(childId), isTrue);

      // Now unenroll
      await box.put(childId, {
        'status': 'unenrolled',
        'enrolled_at': enrolledTime,
        'unenrolled_at': unenrollTime,
        'unenroll_reason': 'Transferred Residence / Barangay',
        'history': [
          {'action': 'enrolled', 'date': enrolledTime, 'reason': 'Initial enrollment'},
          {'action': 'unenrolled', 'date': unenrollTime, 'reason': 'Transferred Residence / Barangay'}
        ],
      });

      // Assertions
      expect(repo.isEnrolled(childId), isFalse, reason: 'Child must no longer be active');
      expect(repo.wasEverEnrolled(childId), isTrue, reason: 'Child MUST remain marked as ever enrolled');
      expect(repo.unenrollReason(childId), 'Transferred Residence / Barangay');
      expect(repo.enrolledAt(childId), isNotNull, reason: 'Enrolled date must NOT be wiped');
      expect(repo.unenrolledAt(childId), isNotNull, reason: 'Unenrolled date must be recorded');

      final history = repo.getHistory(childId);
      expect(history.length, 2);
      expect(history.first['action'], 'enrolled');
      expect(history.last['action'], 'unenrolled');
    });

    test('Legacy string date format in Hive is safely read as enrolled', () async {
      final repo = FeedingEnrollmentRepository();
      const childId = 'child_legacy_001';
      final box = Hive.box(HiveBoxes.feedingEnrollment);

      // Legacy string format:
      await box.put(childId, '2026-09-01T08:00:00.000');

      expect(repo.isEnrolled(childId), isTrue);
      expect(repo.wasEverEnrolled(childId), isTrue);
      expect(repo.enrolledAt(childId), isNotNull);
      expect(repo.getHistory(childId).length, 1);
    });
  });
}
