import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/guardian.dart';
import 'package:appscalev3/data/models/measurement.dart';
import 'package:appscalev3/features/reports/reports_home_screen.dart';
import 'package:appscalev3/features/reports/report_preview_screen.dart';
import 'package:appscalev3/features/reports/report_types.dart';
import 'package:appscalev3/features/reports/sync_status_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  Future<void> openAllBoxes() async {
    final boxNames = [
      HiveBoxes.settings,
      HiveBoxes.activityLog,
      HiveBoxes.mothers,
      HiveBoxes.children,
      HiveBoxes.measurements,
      HiveBoxes.motherVisits,
      HiveBoxes.referrals,
      HiveBoxes.feedingEnrollment,
      HiveBoxes.feedingSchedule,
      HiveBoxes.mealPlans,
      HiveBoxes.feedingAttendance,
      HiveBoxes.feedingFeedback,
      HiveBoxes.feedingSessions,
      HiveBoxes.notifications,
      HiveBoxes.programSchedule,
      HiveBoxes.vitaminA,
      HiveBoxes.deworming,
      HiveBoxes.reportSignatories,
      HiveBoxes.reportSnapshots,
      HiveBoxes.puroks,
    ];
    for (final name in boxNames) {
      if (!Hive.isBoxOpen(name)) {
        await Hive.openBox(name);
      }
    }
  }

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('reports_test_');
    Hive.init(tempDir.path);
    await openAllBoxes();

    final settingsBox = Hive.box(HiveBoxes.settings);
    await settingsBox.put('authUser', {
      'user_id': 1,
      'barangay': 'Tiguion',
      'municipality': 'Gasan',
      'province': 'Marinduque',
      'role': 'bns',
      'first_name': 'Test',
      'last_name': 'BNS',
    });

    final childBox = Hive.box(HiveBoxes.children);
    final measBox = Hive.box(HiveBoxes.measurements);

    // Seed 26 children spanning both 0-23 months and 24-59 months directly into Hive
    // so no background network sync timers are started during widget teardown.
    for (int i = 1; i <= 26; i++) {
      final isOlder = i > 14;
      final birthDate = isOlder
          ? DateTime(2023, (i % 12) + 1, 10)
          : DateTime(2025, (i % 12) + 1, 15);
      final wfa = i % 3 == 0
          ? 'Severely Underweight'
          : (i % 3 == 1 ? 'Underweight' : 'Normal');
      final hfa = i % 4 == 0 ? 'Severely Stunted' : (i % 4 == 1 ? 'Stunted' : 'Normal');
      final wfl = i % 5 == 0 ? 'SAM' : (i % 5 == 1 ? 'MAM' : 'Normal');

      final child = Child(
        id: 'child_$i',
        sequenceNo: '$i',
        fullName: 'Child $i Test',
        birthDate: birthDate,
        gender: i % 2 == 0 ? 'Male' : 'Female',
        address: 'Purok ${(i % 4) + 1}',
        barangay: 'Tiguion',
        belongsToIpGroup: false,
        disability: '',
        guardian: Guardian(
          fullName: 'Guardian $i',
          relationship: 'Mother',
          contactNo: '09123456789',
        ),
        createdAt: DateTime(2025, 1, 1),
        lastWeighedAt: DateTime(2026, 2, 10),
        nutritionStatus: wfa,
        stuntingStatus: hfa,
        wastingStatus: wfl,
      );
      final childMap = child.toMap()..['_syncStatus'] = 'synced';
      await childBox.put(child.id, childMap);

      final m = Measurement(
        date: DateTime(2026, 2, 10),
        weightKg: 7.5 + (i % 6),
        heightCm: isOlder ? 92.0 + (i % 8) : 68.0 + (i % 8),
        bilateralPittingEdema: false,
        weightForAgeStatus: wfa,
        heightForAgeStatus: hfa,
        weightForLengthStatus: wfl,
      );
      final mMap = m.toMap()..['_syncStatus'] = 'synced';
      await measBox.put(child.id, [mMap]);
    }
  });

  tearDown(() async {
    await Hive.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<void> selectDropdownOption(
    WidgetTester tester,
    String currentLabelOrValue,
    String targetOption,
  ) async {
    await tester.ensureVisible(find.text(currentLabelOrValue).first);
    await tester.tap(find.text(currentLabelOrValue).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(targetOption).last);
    await tester.pumpAndSettle();
  }

  Future<void> settlePreviewAndRoutes(WidgetTester tester) async {
    await tester.pump();
    for (int i = 0; i < 200; i++) {
      await tester.pump(const Duration(milliseconds: 50));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 25)));
      await tester.pump(const Duration(milliseconds: 16));
      if (find.byType(CircularProgressIndicator).evaluate().isEmpty) {
        break;
      }
    }
    expect(find.byType(CircularProgressIndicator), findsNothing,
        reason: 'Preview loading spinner did not settle cleanly');
    await tester.pumpAndSettle();
  }

  Future<void> openReportAndReturn(
    WidgetTester tester, {
    bool toggleMonthlyTabs = false,
  }) async {
    final btn = find.text('Generate & Preview Report');
    await tester.ensureVisible(btn);
    await tester.tap(btn);
    await settlePreviewAndRoutes(tester);

    expect(find.byType(ReportPreviewScreen), findsOneWidget);
    expect(find.byType(ErrorWidget), findsNothing);

    if (toggleMonthlyTabs) {
      if (find.text('JUL – DEC (Part 2)').evaluate().isNotEmpty) {
        await tester.tap(find.text('JUL – DEC (Part 2)'));
        await tester.pumpAndSettle();
        expect(find.byType(ErrorWidget), findsNothing);
      }
      if (find.text('JAN – JUN (Part 1)').evaluate().isNotEmpty) {
        await tester.tap(find.text('JAN – JUN (Part 1)'));
        await tester.pumpAndSettle();
        expect(find.byType(ErrorWidget), findsNothing);
      }
    }

    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pumpAndSettle();

    expect(find.byType(ReportsHomeScreen), findsOneWidget);
    expect(find.byType(ErrorWidget), findsNothing);
    expect(find.byType(SnackBar), findsNothing);
  }

  testWidgets('Repeat all report previews & category switches 5x with zero white screens or exceptions', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final errors = <FlutterErrorDetails>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      errors.add(details);
    };

    try {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ReportsHomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Reports & Analytics'), findsOneWidget);

      String currentCategory = 'Consolidation reports';
      String currentReport = ReportTypes.consolidation0to23.title;

      final sequence = <(String, String, bool)>[
        ('Masterlists', ReportTypes.childrenMasterlist.title, false),
        ('Individual records', ReportTypes.monthlyWeightRecord.title, true),
        ('Individual records', ReportTypes.quarterlyWeighing.title, false),
        ('Consolidation reports', ReportTypes.consolidation0to23.title, false),
        ('Consolidation reports', ReportTypes.consolidation24to59.title, false),
        ('Consolidation reports', ReportTypes.underweightSuw.title, false),
        ('Consolidation reports', ReportTypes.stuntedSst.title, false),
        ('Consolidation reports', ReportTypes.wastedSw.title, false),
      ];

      // Repeat the full matrix 5 times (open -> back -> change category/form)
      for (int round = 0; round < 5; round++) {
        for (final (targetCategory, targetReport, isMonthly) in sequence) {
          if (currentCategory != targetCategory) {
            await selectDropdownOption(tester, currentCategory, targetCategory);
            currentCategory = targetCategory;
            // After changing category, form must automatically reset to first item in that category
            currentReport = (targetCategory == 'Consolidation reports'
                    ? ReportTypes.consolidationTypes
                    : (targetCategory == 'Individual records'
                        ? ReportTypes.recordTypes
                        : ReportTypes.masterlistTypes))
                .first
                .title;
            expect(find.text(currentReport), findsOneWidget);
          }

          if (currentReport != targetReport) {
            await selectDropdownOption(tester, currentReport, targetReport);
            currentReport = targetReport;
          }

          await openReportAndReturn(tester, toggleMonthlyTabs: isMonthly);
        }
      }
    } finally {
      FlutterError.onError = originalOnError;
    }

    expect(
      errors,
      isEmpty,
      reason: errors.map((e) => e.exceptionAsString()).join('\n---\n'),
    );
  });

  testWidgets('SyncStatusScreen snackbar is cleared when navigating back to ReportsHomeScreen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final errors = <FlutterErrorDetails>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) => errors.add(details);

    try {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ReportsHomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.cloud_sync));
      await tester.pumpAndSettle();
      expect(find.byType(SyncStatusScreen), findsOneWidget);

      // Post a snackbar on SyncStatusScreen (simulating a Retry / Sync alert)
      final syncCtx = tester.element(find.byType(SyncStatusScreen));
      ScaffoldMessenger.of(syncCtx).showSnackBar(
        const SnackBar(content: Text('Retry failed: simulated error')),
      );
      await tester.pump();
      expect(find.text('Retry failed: simulated error'), findsOneWidget);

      // Pop back to ReportsHomeScreen
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      expect(find.byType(ReportsHomeScreen), findsOneWidget);
      expect(find.text('Retry failed: simulated error'), findsNothing);
      expect(find.byType(SnackBar), findsNothing);
    } finally {
      FlutterError.onError = originalOnError;
    }

    expect(errors, isEmpty);
  });

  testWidgets('ReportPreviewScreen shows friendly retry error UI instead of white screen on missing box error', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    // Simulate a corrupt/closed box condition (real dart:io op must run outside FakeAsync)
    await tester.runAsync(() => Hive.box(HiveBoxes.children).close());

    final errors = <FlutterErrorDetails>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) => errors.add(details);

    try {
      await tester.pumpWidget(
        const MaterialApp(
          home: ReportPreviewScreen(
            reportType: ReportTypes.childrenMasterlist,
          ),
        ),
      );
      await settlePreviewAndRoutes(tester);

      expect(find.text('Could not load report. Tap to retry'), findsOneWidget);
      expect(find.text('Tap to retry'), findsOneWidget);
      expect(find.byType(ErrorWidget), findsNothing);

      // Re-open box and tap retry -> recovers cleanly!
      await tester.runAsync(() => Hive.openBox(HiveBoxes.children));
      await tester.tap(find.text('Tap to retry'));
      await settlePreviewAndRoutes(tester);

      expect(find.text('Could not load report. Tap to retry'), findsNothing);
      expect(find.byType(ErrorWidget), findsNothing);
    } finally {
      FlutterError.onError = originalOnError;
    }

    expect(errors, isEmpty);
  });
}
