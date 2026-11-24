import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/data/models/program_schedule.dart';
import 'package:appscalev3/data/models/report_signatory.dart';
import 'package:appscalev3/features/program/schedule/services/calendar_schedule_pdf_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Calendar Schedule PDF Generation Tests', () {
    final pdfService = CalendarSchedulePdfService();

    final testSchedules = [
      ProgramSchedule(
        id: 'sched-1',
        title: 'Supplementary Feeding Session Day 1',
        programType: 'Feeding',
        date: DateTime(2026, 11, 4),
        startTime: '08:30 AM',
        endTime: '11:30 AM',
        location: 'Barangay Covered Court',
        targetGroup: 'Children 6-59 months',
        notes: 'Bring feeding utensils',
        barangay: 'Antipolo',
        createdBy: 'BNS Mobile',
        createdAt: DateTime(2026, 11, 1),
      ),
      ProgramSchedule(
        id: 'sched-2',
        title: 'Vitamin A Capsule Distribution',
        programType: 'Vitamin A',
        date: DateTime(2026, 11, 10),
        startTime: '09:00 AM',
        endTime: '12:00 PM',
        location: 'Barangay Health Center',
        targetGroup: 'Children 6-59 mos',
        notes: 'Bring immunization card',
        barangay: 'Antipolo',
        createdBy: 'BNS Mobile',
        createdAt: DateTime(2026, 11, 1),
      ),
      ProgramSchedule(
        id: 'sched-3',
        title: 'Mass Deworming Activity Round 2',
        programType: 'Deworming',
        date: DateTime(2026, 11, 18),
        startTime: '08:00 AM',
        endTime: '11:00 AM',
        location: 'Day Care Center',
        targetGroup: 'Children 12-59 mos',
        notes: 'Ensure child had breakfast',
        barangay: 'Antipolo',
        createdBy: 'BNS Mobile',
        createdAt: DateTime(2026, 11, 1),
      ),
      ProgramSchedule(
        id: 'sched-4',
        title: 'OPT Plus Community Weighing',
        programType: 'OPT Plus',
        date: DateTime(2026, 11, 25),
        startTime: '07:30 AM',
        endTime: '11:30 AM',
        location: 'Purok 1 Hall',
        targetGroup: 'All children 0-59 mos',
        notes: 'Height and weight measurement',
        barangay: 'Antipolo',
        createdBy: 'BNS Mobile',
        createdAt: DateTime(2026, 11, 1),
      ),
    ];

    const testSignatory = ReportSignatory(
      barangay: 'Antipolo',
      bnsName: 'Maria Santos',
      punongBarangayName: 'Hon. Juan Dela Cruz',
      bnsPosition: 'Barangay Nutrition Scholar (BNS)',
      punongBarangayPosition: 'Punong Barangay',
    );

    test('Generates valid PDF bytes with Calendar + list layout for all programs', () async {
      final bytes = await pdfService.generatePdfBytes(
        barangay: 'Antipolo',
        year: 2026,
        month: 11,
        programFilter: 'All',
        layout: 'Calendar + list',
        schedules: testSchedules,
        bnsName: 'Maria Santos',
        purok: '1',
        signatory: testSignatory,
      );

      expect(bytes, isNotNull);
      expect(bytes.isNotEmpty, isTrue);
      // PDF standard magic bytes: %PDF-
      expect(String.fromCharCodes(bytes.take(5)), equals('%PDF-'));
    });

    test('Generates valid PDF with single program filter (Feeding only)', () async {
      final feedingOnly = testSchedules.where((s) => s.programType == 'Feeding').toList();
      final bytes = await pdfService.generatePdfBytes(
        barangay: 'Antipolo',
        year: 2026,
        month: 11,
        programFilter: 'Feeding',
        layout: 'Calendar + list',
        schedules: feedingOnly,
        bnsName: 'Maria Santos',
        signatory: testSignatory,
      );

      expect(bytes, isNotNull);
      expect(bytes.length, greaterThan(1000));
    });

    test('Generates valid PDF for Calendar only and List only layouts', () async {
      final calBytes = await pdfService.generatePdfBytes(
        barangay: 'Antipolo',
        year: 2026,
        month: 11,
        programFilter: 'All',
        layout: 'Calendar only',
        schedules: testSchedules,
        signatory: testSignatory,
      );
      expect(calBytes.isNotEmpty, isTrue);

      final listBytes = await pdfService.generatePdfBytes(
        barangay: 'Antipolo',
        year: 2026,
        month: 11,
        programFilter: 'All',
        layout: 'List only',
        schedules: testSchedules,
        signatory: testSignatory,
      );
      expect(listBytes.isNotEmpty, isTrue);
    });

    test('Generates multi-page PDF when month has many schedules', () async {
      final manySchedules = <ProgramSchedule>[];
      for (int i = 1; i <= 28; i++) {
        manySchedules.add(
          ProgramSchedule(
            id: 'many-sched-$i',
            title: 'Daily Feeding and Nutrition Check Day $i',
            programType: i % 2 == 0 ? 'Feeding' : 'Vitamin A',
            date: DateTime(2026, 11, (i % 28) + 1),
            startTime: '08:30 AM',
            endTime: '11:00 AM',
            location: 'Purok ${(i % 5) + 1} Center',
            targetGroup: 'Target group $i',
            notes: 'Notes for day $i',
            barangay: 'Antipolo',
            createdBy: 'BNS Mobile',
            createdAt: DateTime(2026, 11, 1),
          ),
        );
      }

      final bytes = await pdfService.generatePdfBytes(
        barangay: 'Antipolo',
        year: 2026,
        month: 11,
        programFilter: 'All',
        layout: 'Calendar + list',
        schedules: manySchedules,
        bnsName: 'Maria Santos',
        signatory: testSignatory,
      );

      expect(bytes.isNotEmpty, isTrue);
      // Ensure file is substantial enough for multiple pages
      expect(bytes.length, greaterThan(5000));
    });

    test('ReportSignatory resolves notedByName and preparedByName correctly', () {
      expect(testSignatory.preparedByName, equals('Maria Santos'));
      expect(testSignatory.preparedByPosition, equals('Barangay Nutrition Scholar (BNS)'));
      expect(testSignatory.notedByName, equals('Hon. Juan Dela Cruz'));
      expect(testSignatory.notedByPosition, equals('Punong Barangay'));
    });
  });
}
