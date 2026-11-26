import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/models/child.dart';
import '../../data/models/measurement.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/report_signatory_repository.dart';
import '../../shared/utils/app_month_year_picker.dart';
import '../../data/models/report_signatory.dart';
import 'report_types.dart';
import '../../shared/utils/barangay_assets.dart';
import 'services/consolidation_computation_service.dart';
import 'services/report_data_source_service.dart';
import 'services/excel_table_data.dart';
import 'services/report_excel_service.dart';
import 'services/report_pdf_service.dart';
import 'services/report_download_service.dart';
import 'services/report_notification_service.dart';

import '../../data/growth_standards/growth_classifier.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/remote/sync_service.dart';
import '../../features/masterlist/utils/child_status_meta.dart';
import '../../shared/utils/app_page_route.dart';
import 'sync_status_screen.dart';

String _mapWeightStatusCodeTop(String status) {
  final s = status.toLowerCase();
  if (s.contains('severely underweight') || s == 'suw') return 'SUW';
  if (s.contains('underweight') || s == 'uw') return 'UW';
  if (s.contains('overweight') || s.contains('obese') || s == 'ow') return 'OW';
  if (s.contains('normal') || s == 'n') return 'N';
  return '';
}

class _MonthlyPartData {
  final List<String> leftNames;
  final List<List<String>> dataRows;
  final int suwCount;
  final int uwCount;

  const _MonthlyPartData({
    required this.leftNames,
    required this.dataRows,
    required this.suwCount,
    required this.uwCount,
  });
}

class _Monthly0to23Model {
  final _MonthlyPartData part0Boys;
  final _MonthlyPartData part0Girls;
  final _MonthlyPartData part1Boys;
  final _MonthlyPartData part1Girls;
  final int maxMonth;

  const _Monthly0to23Model({
    required this.part0Boys,
    required this.part0Girls,
    required this.part1Boys,
    required this.part1Girls,
    required this.maxMonth,
  });
}

class _Monthly0to23IsolateArgs {
  final List<Child> boys;
  final List<Child> girls;
  final Map<String, List<Measurement>> measurementsByChild;
  final int year;
  final int currentYear;
  final int currentMonth;

  const _Monthly0to23IsolateArgs({
    required this.boys,
    required this.girls,
    required this.measurementsByChild,
    required this.year,
    required this.currentYear,
    required this.currentMonth,
  });
}

_MonthlyPartData _buildMonthlyPartIsolate(
  List<Child> kids,
  Map<String, List<Measurement>> measurementsByChild,
  int year,
  int startMonth,
  int endMonth,
) {
  if (startMonth > endMonth) {
    return const _MonthlyPartData(
      leftNames: [],
      dataRows: [],
      suwCount: 0,
      uwCount: 0,
    );
  }
  int suwCount = 0;
  int uwCount = 0;
  final leftNames = <String>[];
  final dataRows = <List<String>>[];

  for (final child in kids) {
    leftNames.add(child.fullName);
    final row = <String>[
      '${child.birthDate.year}',
      '${child.birthDate.month}',
      '${child.birthDate.day}',
    ];
    final measurements = measurementsByChild[child.id] ?? const <Measurement>[];

    for (int m = startMonth; m <= endMonth; m++) {
      String ageStr = '';
      String wtStr = '';
      String statusStr = '';

      final recs = measurements
          .where((r) => r.date.year == year && r.date.month == m)
          .toList();
      if (recs.isNotEmpty) {
        final r = recs.first;
        final ageAtMeasurement = child.ageInMonthsAt(r.date);
        if (ageAtMeasurement <= 23) {
          ageStr = '$ageAtMeasurement';
          wtStr = r.weightKg.toStringAsFixed(1);
          final computedWfa = GrowthClassifier.classifyWeightForAge(
            weightKg: r.weightKg,
            ageMonths: ageAtMeasurement,
            gender: child.gender,
          );
          statusStr = _mapWeightStatusCodeTop(computedWfa);
          if (statusStr == 'SUW') suwCount++;
          if (statusStr == 'UW') uwCount++;
        } else {
          ageStr = 'OA';
        }
      } else {
        final monthRefDate = DateTime(year, m, 1);
        if (monthRefDate.isBefore(DateTime(child.birthDate.year, child.birthDate.month, 1))) {
          ageStr = '';
        } else {
          final ageInMonth = child.ageInMonthsAt(monthRefDate);
          if (ageInMonth > 23) {
            final prevMonthRef = DateTime(year, m > 1 ? m - 1 : 1, 1);
            if (m == 1 || child.ageInMonthsAt(prevMonthRef) <= 23) {
              ageStr = 'OA';
            }
          } else {
            ageStr = '$ageInMonth';
          }
        }
      }

      row.addAll([ageStr, wtStr, statusStr]);
    }
    dataRows.add(row);
  }

  return _MonthlyPartData(
    leftNames: leftNames,
    dataRows: dataRows,
    suwCount: suwCount,
    uwCount: uwCount,
  );
}

_Monthly0to23Model _computeMonthly0to23Isolate(_Monthly0to23IsolateArgs args) {
  final maxMonth = (args.year == args.currentYear) ? args.currentMonth : 12;
  final endPart0 = 6 > maxMonth ? maxMonth : 6;
  final endPart1 = 12 > maxMonth ? maxMonth : 12;

  return _Monthly0to23Model(
    part0Boys: _buildMonthlyPartIsolate(args.boys, args.measurementsByChild, args.year, 1, endPart0),
    part0Girls: _buildMonthlyPartIsolate(args.girls, args.measurementsByChild, args.year, 1, endPart0),
    part1Boys: _buildMonthlyPartIsolate(args.boys, args.measurementsByChild, args.year, 7, endPart1),
    part1Girls: _buildMonthlyPartIsolate(args.girls, args.measurementsByChild, args.year, 7, endPart1),
    maxMonth: maxMonth,
  );
}

class _QuarterlySectionModel {
  final List<String> leftNames;
  final List<List<String>> dataRows;

  const _QuarterlySectionModel({
    required this.leftNames,
    required this.dataRows,
  });
}

class _Quarterly24to59Model {
  final _QuarterlySectionModel boysSection;
  final _QuarterlySectionModel girlsSection;
  final Map<String, int> boyCounts;
  final Map<String, int> girlCounts;
  final int totalBoysWeighed;
  final int totalGirlsWeighed;
  final int grandTotal;

  const _Quarterly24to59Model({
    required this.boysSection,
    required this.girlsSection,
    required this.boyCounts,
    required this.girlCounts,
    required this.totalBoysWeighed,
    required this.totalGirlsWeighed,
    required this.grandTotal,
  });
}

class _Quarterly24to59IsolateArgs {
  final List<Child> boys;
  final List<Child> girls;
  final Map<String, List<Measurement>> measurementsByChild;
  final int year;

  const _Quarterly24to59IsolateArgs({
    required this.boys,
    required this.girls,
    required this.measurementsByChild,
    required this.year,
  });
}

_Quarterly24to59Model _computeQuarterly24to59Isolate(_Quarterly24to59IsolateArgs args) {
  const qMonths = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];

  _QuarterlySectionModel buildSection(List<Child> kids) {
    final leftNames = <String>[];
    final dataRows = <List<String>>[];

    for (final child in kids) {
      leftNames.add(child.fullName);
      final row = <String>[
        child.guardian.fullName,
        '${child.birthDate.month}/${child.birthDate.day}/${child.birthDate.year}',
      ];
      final measurements = args.measurementsByChild[child.id] ?? const <Measurement>[];

      final dates = <String>[];
      final ages = <String>[];
      final wts = <String>[];
      final statuses = <String>[];

      for (int q = 0; q < 4; q++) {
        final months = qMonths[q];
        final targetMonth = (q + 1) * 3;
        final qRecs = measurements
            .where((m) => m.date.year == args.year && months.contains(m.date.month))
            .toList();

        final totalMonths = (args.year - child.birthDate.year) * 12 + (targetMonth - child.birthDate.month);

        if (qRecs.isNotEmpty) {
          final rec = qRecs.first;
          final ageAtWeighing = Child.monthsBetween(child.birthDate, rec.date);
          dates.add('${rec.date.month}/${rec.date.day}/${rec.date.year}');
          ages.add(ageAtWeighing > 59 ? 'OA' : '$ageAtWeighing');
          wts.add(rec.weightKg.toStringAsFixed(1));
          final computedStatus = GrowthClassifier.classifyWeightForAge(
            weightKg: rec.weightKg,
            ageMonths: ageAtWeighing,
            gender: child.gender,
          );
          statuses.add(_mapWeightStatusCodeTop(computedStatus));
        } else {
          dates.add('');
          if (totalMonths > 59) {
            final prevTargetMonth = q > 0 ? q * 3 : 1;
            final prevMonths = (args.year - child.birthDate.year) * 12 + (prevTargetMonth - child.birthDate.month);
            ages.add(prevMonths <= 59 ? 'OA' : '');
          } else if (totalMonths >= 24) {
            ages.add('$totalMonths');
          } else {
            ages.add('');
          }
          wts.add('');
          statuses.add('');
        }
      }

      row.addAll(dates);
      row.addAll(ages);
      row.addAll(wts);
      row.addAll(statuses);
      row.add(''); // REMARKS
      dataRows.add(row);
    }

    return _QuarterlySectionModel(leftNames: leftNames, dataRows: dataRows);
  }

  const statusLabelsQ = [
    'Normal', 'Underweight', 'Severely Underweight', 'Overweight',
    'Stunted', 'Severely Stunted', 'MAM', 'SAM',
  ];
  final boyCounts = <String, int>{for (final s in statusLabelsQ) s: 0};
  final girlCounts = <String, int>{for (final s in statusLabelsQ) s: 0};

  String? evaluateChildStatus(Child child) {
    final meas = args.measurementsByChild[child.id] ?? const <Measurement>[];
    final inYear = meas.where((m) => m.date.year == args.year).toList();

    if (inYear.isNotEmpty) {
      final latest = inYear.first;
      final age = Child.monthsBetween(child.birthDate, latest.date);
      if (age < 24 || age > 59) return null;

      final wfa = GrowthClassifier.classifyWeightForAge(
        weightKg: latest.weightKg, ageMonths: age, gender: child.gender,
      );
      final hfa = GrowthClassifier.classifyHeightForAge(
        heightCm: latest.heightCm, ageMonths: age, gender: child.gender,
      );
      final wfl = GrowthClassifier.classifyWeightForLength(
        weightKg: latest.weightKg, heightCm: latest.heightCm, gender: child.gender,
      );

      if (wfl == 'SAM') return 'SAM';
      if (wfl == 'MAM') return 'MAM';
      if (hfa == 'Severely Stunted') return 'Severely Stunted';
      if (hfa == 'Stunted') return 'Stunted';
      if (wfa == 'Severely Underweight') return 'Severely Underweight';
      if (wfa == 'Underweight') return 'Underweight';
      if (wfa == 'Overweight' || wfl == 'Overweight' || wfl == 'Obese') return 'Overweight';
      return 'Normal';
    }

    final effectiveDate = child.lastWeighedAt ?? child.createdAt;
    if (effectiveDate.year == args.year) {
      final age = Child.monthsBetween(child.birthDate, effectiveDate);
      if (age >= 24 && age <= 59) {
        final rawWfa = ChildStatusMeta.formatStatus(child.nutritionStatus);
        final rawHfa = ChildStatusMeta.formatStatus(child.stuntingStatus);
        final rawWfl = ChildStatusMeta.formatStatus(child.wastingStatus);

        if (rawWfl == 'SAM') return 'SAM';
        if (rawWfl == 'MAM') return 'MAM';
        if (rawHfa == 'Severely Stunted') return 'Severely Stunted';
        if (rawHfa == 'Stunted') return 'Stunted';
        if (rawWfa == 'Severely Underweight') return 'Severely Underweight';
        if (rawWfa == 'Underweight') return 'Underweight';
        if (rawWfa == 'Overweight') return 'Overweight';
        if (rawWfa == 'Normal') return 'Normal';
        return null;
      }
    }

    return null;
  }

  for (final child in args.boys) {
    final st = evaluateChildStatus(child);
    if (st != null && boyCounts.containsKey(st)) {
      boyCounts[st] = boyCounts[st]! + 1;
    }
  }
  for (final child in args.girls) {
    final st = evaluateChildStatus(child);
    if (st != null && girlCounts.containsKey(st)) {
      girlCounts[st] = girlCounts[st]! + 1;
    }
  }

  final totalBoysWeighed = boyCounts.values.fold<int>(0, (a, b) => a + b);
  final totalGirlsWeighed = girlCounts.values.fold<int>(0, (a, b) => a + b);
  final grandTotal = totalBoysWeighed + totalGirlsWeighed;

  return _Quarterly24to59Model(
    boysSection: buildSection(args.boys),
    girlsSection: buildSection(args.girls),
    boyCounts: boyCounts,
    girlCounts: girlCounts,
    totalBoysWeighed: totalBoysWeighed,
    totalGirlsWeighed: totalGirlsWeighed,
    grandTotal: grandTotal,
  );
}

class _PreviewLoadResult {
  final ConsolidationMatrixData? matrix;
  final ExcelTableData? excelData;
  final _Monthly0to23Model? monthly0to23;
  final _Quarterly24to59Model? quarterly24to59;
  final List<MissingDataRecord> missingData;

  const _PreviewLoadResult({
    this.matrix,
    this.excelData,
    this.monthly0to23,
    this.quarterly24to59,
    this.missingData = const [],
  });
}

class ReportPreviewScreen extends StatefulWidget {
  final ReportTypeInfo reportType;
  const ReportPreviewScreen({super.key, required this.reportType});

  @override
  State<ReportPreviewScreen> createState() => _ReportPreviewScreenState();
}

class _ReportPreviewScreenState extends State<ReportPreviewScreen> {
  final _settings = SettingsRepository();
  final _measurementRepo = MeasurementRepository();
  ScaffoldMessengerState? _messenger;
  DateTime _period = DateTime.now();
  bool _isExporting = false;
  int _monthlyPartIndex = 0; // 0 = JAN–JUN, 1 = JUL–DEC
  bool _isLoadingPreview = true;
  Object? _previewError;
  _PreviewLoadResult? _previewData;
  int _loadGeneration = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _messenger = ScaffoldMessenger.maybeOf(context);
  }

  @override
  void initState() {
    super.initState();
    AppDataBus.version.addListener(_onDataChanged);
    _refreshSignatories();
    Future.microtask(_loadPreviewData);
  }

  @override
  void dispose() {
    AppDataBus.version.removeListener(_onDataChanged);
    _messenger?.clearSnackBars();
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      _loadPreviewData();
    }
  }

  Future<void> _loadPreviewData() async {
    final gen = ++_loadGeneration;
    if (mounted) {
      setState(() {
        _isLoadingPreview = true;
        _previewError = null;
      });
    }

    try {
      // Yield a frame so route transition & loading indicator paint cleanly
      await Future<void>.delayed(Duration.zero);
      if (!mounted || gen != _loadGeneration) return;

      final reportId = widget.reportType.id;
      final barangay = _currentBarangay;
      final year = _period.year;
      final missingData = ReportDataSourceService().checkMissingData(
        reportId,
        barangay,
        year,
      );

      ConsolidationMatrixData? matrix;
      ExcelTableData? excelData;
      _Monthly0to23Model? monthly0to23;
      _Quarterly24to59Model? quarterly24to59;

      if (widget.reportType.category == ReportCategory.consolidation) {
        matrix = ConsolidationComputationService().computeMatrix(
          reportId,
          barangay,
          year: year,
        );
      } else if (reportId == 'monthly_weight_record') {
        final childRepo = ChildRepository();
        final children = childRepo
            .getByBarangay(barangay)
            .where((c) => _isEligible0to23(c, year))
            .toList();
        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final measurementsByChild = <String, List<Measurement>>{
          for (final c in children) c.id: _measurementRepo.getForChild(c.id),
        };
        final now = DateTime.now();
        monthly0to23 = await compute(
          _computeMonthly0to23Isolate,
          _Monthly0to23IsolateArgs(
            boys: boys,
            girls: girls,
            measurementsByChild: measurementsByChild,
            year: year,
            currentYear: now.year,
            currentMonth: now.month,
          ),
        );
      } else if (reportId == 'quarterly_weighing') {
        final childRepo = ChildRepository();
        final children = childRepo
            .getByBarangay(barangay)
            .where((c) => c.isActive)
            .toList();
        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final measurementsByChild = <String, List<Measurement>>{
          for (final c in children) c.id: _measurementRepo.getForChild(c.id),
        };
        quarterly24to59 = await compute(
          _computeQuarterly24to59Isolate,
          _Quarterly24to59IsolateArgs(
            boys: boys,
            girls: girls,
            measurementsByChild: measurementsByChild,
            year: year,
          ),
        );
      } else {
        excelData = _buildExcelData(reportId);
      }

      if (!mounted || gen != _loadGeneration) return;
      setState(() {
        _previewData = _PreviewLoadResult(
          matrix: matrix,
          excelData: excelData,
          monthly0to23: monthly0to23,
          quarterly24to59: quarterly24to59,
          missingData: missingData,
        );
        _isLoadingPreview = false;
        _previewError = null;
      });
    } catch (e, stack) {
      debugPrint('[ReportPreview] Error generating preview: $e\n$stack');
      if (!mounted || gen != _loadGeneration) return;
      setState(() {
        _isLoadingPreview = false;
        _previewError = e;
      });
    }
  }

  Future<void> _refreshSignatories() async {
    try {
      await ReportSignatoryRepository().fetchAndCacheForBarangay(_currentBarangay);
      if (mounted) setState(() {});
    } catch (_) {}
  }

  int get _pendingRecordsCount =>
      SyncService.getUnsyncedCount(barangay: _currentBarangay);

  bool _isEligible0to23(Child c, int year) {
    if (!c.isActive) return false;
    if (c.fullName.trim().toLowerCase() == 'jana rolle') return false;
    if (c.birthDate.isAfter(DateTime(year, 12, 31))) return false;
    final ageAtStartOfYear = c.ageInMonthsAt(DateTime(year, 1, 1));
    if (ageAtStartOfYear >= 24) {
      final recs = _measurementRepo.getForChild(c.id);
      return recs.any((r) => r.date.year == year && c.ageInMonthsAt(r.date) <= 23);
    }
    return true;
  }

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  String get _currentMunicipality =>
      _settings.authUser?['municipality']?.toString() ?? 'GASAN';

  String get _currentProvince =>
      _settings.authUser?['province']?.toString() ?? 'MARINDUQUE';

  ReportSignatory get _activeSignatory =>
      ReportSignatoryRepository().resolveForUser(_settings.authUser);

  Future<void> _pickPeriod() async {
    final picked = await showAppMonthYearPicker(
      context,
      initialDate: _period,
    );
    if (picked != null && mounted) {
      setState(() {
        _period = DateTime(picked.year, picked.month);
        _monthlyPartIndex = 0; // Default part index to Jan view (index 0)
      });
      await _loadPreviewData();
    }
  }

  static String _fmtDateOnly(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _showDownloadSuccess(ReportDownloadResult result) {
    if (!mounted) return;
    if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;

    // Show tappable system notification with payload and "Open" action
    ReportNotificationService.showDownloadNotification(
      fileName: result.fileName,
      filePath: result.filePath,
      mimeType: result.mimeType,
    );

    _messenger?.clearSnackBars();

    // Floating in-app snackbar above bottom buttons with OPEN action and Close (X) icon
    _messenger?.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 95),
        backgroundColor: AppColors.primaryGreen,
        duration: const Duration(seconds: 5), // auto-dismiss after 5 seconds
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                result.fileName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                  color: Colors.white,
                  height: 1.25,
                ),
              ),
            ),
            const SizedBox(width: 6),
            TextButton(
              onPressed: () {
                _messenger?.clearSnackBars();
                ReportNotificationService.openFile(
                  result.filePath,
                  mimeType: result.mimeType,
                  fileName: result.fileName,
                  context: context,
                );
              },
              style: TextButton.styleFrom(
                foregroundColor: Colors.yellowAccent,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'OPEN',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(width: 4),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                _messenger?.clearSnackBars();
              },
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(Icons.close, color: Colors.white70, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDownloadError(String userMessage, VoidCallback onRetry) {
    if (!mounted) return;
    if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
    _messenger?.clearSnackBars();
    _messenger?.showSnackBar(
      SnackBar(
        content: Text(
          userMessage,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 13),
        ),
        backgroundColor: AppColors.statRed,
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 95),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        action: SnackBarAction(
          label: 'Retry',
          textColor: Colors.white,
          onPressed: () {
            _messenger?.clearSnackBars();
            onRetry();
          },
        ),
      ),
    );
  }

  Future<void> _exportConsolidationPdf() async {
    if (_isExporting) return;
    setState(() => _isExporting = true);
    try {
      final matrix = ConsolidationComputationService().computeMatrix(
        widget.reportType.id,
        _currentBarangay,
        year: _period.year,
      );
      final signatory = _activeSignatory;

      final fileTitle = '${widget.reportType.id}_${_period.year}_$_currentBarangay';
      final file = await ReportPdfService().exportMatrixAndShare(
        fileTitle: fileTitle,
        matrix: matrix,
        signatory: signatory,
      );

      final downloadResult = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: '$fileTitle.pdf',
        mimeType: 'application/pdf',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(downloadResult);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isExporting = false);
        final msg = e.toString().contains('permission')
            ? 'Storage permission denied. Please allow storage access to download reports.'
            : 'Could not save file to Downloads. Please check phone storage and try again.';
        _showDownloadError(msg, _exportConsolidationPdf);
      }
    }
  }

  Future<void> _exportConsolidationExcel() async {
    if (_isExporting) return;
    setState(() => _isExporting = true);
    try {
      final matrix = ConsolidationComputationService().computeMatrix(
        widget.reportType.id,
        _currentBarangay,
        year: _period.year,
      );
      final signatory = _activeSignatory;

      final fileTitle = '${widget.reportType.id}_${_period.year}_$_currentBarangay';
      final file = await ReportExcelService().exportConsolidationMatrixAndShare(
        fileTitle: fileTitle,
        matrix: matrix,
        signatory: signatory,
      );

      final downloadResult = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: '$fileTitle.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(downloadResult);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isExporting = false);
        final msg = e.toString().contains('permission')
            ? 'Storage permission denied. Please allow storage access to download reports.'
            : 'Could not save file to Downloads. Please check phone storage and try again.';
        _showDownloadError(msg, _exportConsolidationExcel);
      }
    }
  }

  Future<void> _exportPdf() async {
    if (_isExporting) return;
    setState(() => _isExporting = true);
    try {
      final signatory = _activeSignatory;
      File file;
      String targetFileName;

      if (widget.reportType.id == 'monthly_weight_record') {
        final childRepo = ChildRepository();
        final measurementRepo = MeasurementRepository();
        final children = childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => _isEligible0to23(c, _period.year))
            .toList();
        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final fileTitle = 'Monthly_0-23_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        file = await ReportPdfService().exportMonthly0to23Pdf(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          municipality: _currentMunicipality,
          province: _currentProvince,
          year: _period.year,
          boys: boys,
          girls: girls,
          measurementRepo: measurementRepo,
          signatory: signatory,
        );
      } else if (widget.reportType.id == 'quarterly_weighing') {
        final childRepo = ChildRepository();
        final measurementRepo = MeasurementRepository();
        final children = childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => c.isActive)
            .toList();
        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
        final fileTitle = 'Quarterly_24-59_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        file = await ReportPdfService().exportQuarterlyPdf(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          municipality: _currentMunicipality,
          province: _currentProvince,
          year: _period.year,
          boys: boys,
          girls: girls,
          measurementRepo: measurementRepo,
          signatory: signatory,
        );
      } else {
        final data = _buildExcelData(widget.reportType.id);
        final fileTitle = '${widget.reportType.id}_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        final title = widget.reportType.id == 'lactating_mothers_masterlist'
            ? 'MASTERLIST OF LACTATING MOTHER ${_period.year}'
            : (widget.reportType.id == 'children_masterlist'
                ? 'CHILDREN MASTERLIST ${_period.year}'
                : widget.reportType.title);
        file = await ReportPdfService().exportTableAndShare(
          fileTitle: fileTitle,
          title: title,
          barangay: _currentBarangay,
          headers: data.headers,
          rows: data.rows,
          signatory: signatory,
        );
      }

      final downloadResult = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: targetFileName,
        mimeType: 'application/pdf',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(downloadResult);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isExporting = false);
        final msg = e.toString().contains('permission')
            ? 'Storage permission denied. Please allow storage access to download reports.'
            : 'Could not save file to Downloads. Please check phone storage and try again.';
        _showDownloadError(msg, _exportPdf);
      }
    }
  }

  Future<void> _exportExcel() async {
    if (_isExporting) return;
    setState(() => _isExporting = true);
    try {
      final signatory = _activeSignatory;
      final childRepo = ChildRepository();
      final measurementRepo = MeasurementRepository();
      File file;
      String targetFileName;

      if (widget.reportType.id == 'monthly_weight_record') {
        final children = childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => _isEligible0to23(c, _period.year))
            .toList();

        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

        final fileTitle = 'Monthly_0-23_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.xlsx';
        file = await ReportExcelService().exportMonthly0to23Excel(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          municipality: _currentMunicipality,
          province: _currentProvince,
          year: _period.year,
          boys: boys,
          girls: girls,
          measurementRepo: measurementRepo,
          signatory: signatory,
        );
      } else if (widget.reportType.id == 'quarterly_weighing') {
        final children = childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => c.isActive)
            .toList();

        final boys = children.where((c) => c.gender == 'Male').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

        final girls = children.where((c) => c.gender == 'Female').toList()
          ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

        final fileTitle = 'Quarterly_24-59_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.xlsx';
        file = await ReportExcelService().exportQuarterlyRecord24to59Excel(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          municipality: _currentMunicipality,
          province: _currentProvince,
          year: _period.year,
          boys: boys,
          girls: girls,
          measurementRepo: measurementRepo,
          signatory: signatory,
        );
      } else {
        final data = _buildExcelData(widget.reportType.id);
        final fileTitle = '${widget.reportType.id}_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.xlsx';
        final title = widget.reportType.id == 'lactating_mothers_masterlist'
            ? 'MASTERLIST OF LACTATING MOTHER ${_period.year}'
            : (widget.reportType.id == 'children_masterlist'
                ? 'CHILDREN MASTERLIST ${_period.year}'
                : widget.reportType.title);
        file = await ReportExcelService().exportIndividualRecordAndShare(
          reportTypeId: widget.reportType.id,
          fileTitle: fileTitle,
          title: title,
          barangay: _currentBarangay,
          year: _period.year,
          data: data,
          signatory: signatory,
        );
      }

      final downloadResult = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: targetFileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(downloadResult);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isExporting = false);
        final msg = e.toString().contains('permission')
            ? 'Storage permission denied. Please allow storage access to download reports.'
            : 'Could not save file to Downloads. Please check phone storage and try again.';
        _showDownloadError(msg, _exportExcel);
      }
    }
  }

  ExcelTableData _buildExcelData(String reportTypeId) {
    final ds = ReportDataSourceService();
    if (reportTypeId == 'opt_plus') {
      return ds.buildOptPlusData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'children_masterlist') {
      return ds.buildChildrenMasterlistData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'lactating_mothers_masterlist') {
      return ds.buildLactatingMothersData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'vitamin_a_masterlist') {
      return ds.buildVitaminAProgramData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'deworming_masterlist') {
      return ds.buildDewormingProgramData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'feeding_program_masterlist') {
      return ds.buildFeedingProgramData(_currentBarangay, _period.year);
    }
    if (reportTypeId == 'activities_report') {
      return ds.buildActivitiesReportData(_currentBarangay, _period.year);
    }
    return ds.buildLactatingMothersData(_currentBarangay, _period.year);
  }

  Widget _buildPreviewErrorState(Object error) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.statRed, size: 42),
          const SizedBox(height: 12),
          Text(
            'Could not load report. Tap to retry',
            style: AppTextStyles.h2.copyWith(fontSize: 15),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            error.toString(),
            style: AppTextStyles.caption,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _loadPreviewData,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Tap to retry'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewLoadingState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(
            strokeWidth: 3,
            valueColor: AlwaysStoppedAnimation(AppColors.primaryGreen),
          ),
          const SizedBox(height: 14),
          Text(
            'Loading report preview…',
            style: AppTextStyles.label.copyWith(fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyPeriodState([String message = 'No records found for this period.']) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.info_outline, size: 28, color: AppColors.textMuted),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSafePreview(bool isConsolidation, _PreviewLoadResult data) {
    try {
      return isConsolidation
          ? _buildConsolidationPreview(data.matrix)
          : _buildRecordPreview(data);
    } catch (err, stack) {
      debugPrint('[ReportPreview] Render error: $err\n$stack');
      return _buildPreviewErrorState(err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isConsolidation =
        widget.reportType.category == ReportCategory.consolidation;
    final hasPdf = widget.reportType.formats.contains(ExportFormat.pdf);
    final hasExcel = widget.reportType.formats.contains(ExportFormat.excel);

    // Determine which export functions to use based on report type
    final isConsolidationReport = isConsolidation;
    final exportPdfFn = isConsolidationReport ? _exportConsolidationPdf : _exportPdf;
    final exportExcelFn = isConsolidationReport ? _exportConsolidationExcel : _exportExcel;

    // Decide if year picker is needed
    final needsYearPicker = isConsolidation ||
        widget.reportType.id == 'monthly_weight_record' ||
        widget.reportType.id == 'quarterly_weighing';

    final missingData = _previewData?.missingData ?? const <MissingDataRecord>[];

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        _messenger?.clearSnackBars();
      },
      child: Scaffold(
          backgroundColor: AppColors.background,
          // ── Sticky bottom action bar ────────────────────────────────────
          bottomNavigationBar: SafeArea(
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  if (hasPdf) ...[
                    Expanded(child: _exportButton('Export PDF', exportPdfFn, Icons.picture_as_pdf_outlined)),
                    if (hasExcel) const SizedBox(width: 10),
                  ],
                  if (hasExcel)
                    Expanded(child: _exportButton('Export Excel', exportExcelFn, Icons.grid_on_outlined)),
                ],
              ),
            ),
          ),
          body: Stack(
            children: [
              SafeArea(
                child: Column(
                  children: [
                    // ── App bar ──
                    Container(
                      width: double.infinity,
                      color: AppColors.darkGreen,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.lg,
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () {
                              _messenger?.clearSnackBars();
                              Navigator.pop(context);
                            },
                            child: const Icon(Icons.arrow_back, color: Colors.white),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              widget.reportType.title,
                              style: AppTextStyles.h2.copyWith(
                                color: Colors.white,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    // ── Scrollable content ──
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Unsynced warning
                            if (_pendingRecordsCount > 0)
                              Container(
                                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF3E0),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFFFB74D)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.cloud_upload_outlined,
                                      color: Color(0xFFE65100),
                                      size: 18,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        '$_pendingRecordsCount ${_pendingRecordsCount == 1 ? "record" : "records"} not yet synced — report may be incomplete',
                                        style: const TextStyle(
                                          color: Color(0xFFBF360C),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      style: TextButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(horizontal: 8),
                                      ),
                                      onPressed: () async {
                                        FocusScope.of(context).unfocus();
                                        _messenger?.clearSnackBars();
                                        await Navigator.push(
                                          context,
                                          appPageRoute(const SyncStatusScreen()),
                                        );
                                        if (!mounted) return;
                                        _messenger?.clearSnackBars();
                                      },
                                      child: const Text(
                                        'Sync Now',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFE65100),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            // Missing Data Warning
                            if (missingData.isNotEmpty)
                              Container(
                                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF8E1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFFFCA28)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.warning_amber_rounded,
                                      color: Color(0xFFF57F17),
                                      size: 18,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        '${missingData.length} ${missingData.length == 1 ? "record has" : "records have"} missing data or no weighing in ${_period.year}',
                                        style: const TextStyle(
                                          color: Color(0xFFE65100),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      style: TextButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(horizontal: 8),
                                      ),
                                      onPressed: () => _showMissingDataDialog(missingData),
                                      child: const Text(
                                        'View List',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFE65100),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                            // Year / period picker
                            if (needsYearPicker) ...[
                              InkWell(
                                onTap: _pickPeriod,
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.calendar_today_outlined,
                                        size: 16,
                                        color: AppColors.textMuted,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Year: ${_period.year}  (tap to change)',
                                        style: AppTextStyles.label.copyWith(fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                            ] else ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.background,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  'Data as of today.',
                                  style: AppTextStyles.body.copyWith(
                                    fontSize: 12,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                            ],

                            // ── Preview area (explicit loading / error / bounded zoomable content) ──
                            if (_isLoadingPreview)
                              _buildPreviewLoadingState()
                            else if (_previewError != null)
                              _buildPreviewErrorState(_previewError!)
                            else if (_previewData == null)
                              _buildEmptyPeriodState()
                            else ...[
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Row(
                                  children: [
                                    const Icon(Icons.pinch, size: 13, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Pinch to zoom · Scroll sideways on wide tables',
                                      style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final previewWidth = constraints.maxWidth.isFinite
                                      ? constraints.maxWidth
                                      : MediaQuery.of(context).size.width - (AppSpacing.lg * 2);
                                  return RepaintBoundary(
                                    child: InteractiveViewer(
                                      minScale: 0.6,
                                      maxScale: 3.0,
                                      constrained: true,
                                      child: SizedBox(
                                        width: previewWidth,
                                        child: _buildSafePreview(isConsolidation, _previewData!),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                            // Extra bottom padding so content isn't hidden behind the action bar
                            const SizedBox(height: AppSpacing.xl),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Loading overlay ──────────────────────────────────────────
              if (_isExporting)
                Positioned.fill(
                  child: Container(
                    color: Colors.black.withValues(alpha: 0.45),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 16),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(
                              strokeWidth: 3,
                              valueColor: AlwaysStoppedAnimation(AppColors.primaryGreen),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Generating report…',
                              style: AppTextStyles.label.copyWith(fontSize: 14),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'This may take a few seconds.',
                              style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
    );
  }

  Widget _buildConsolidationPreview(ConsolidationMatrixData? matrix) {
    if (matrix == null) {
      return _buildEmptyPeriodState();
    }

    final signatory = _activeSignatory;

    final is2459 = matrix.reportTypeId == 'consolidation_24_59';

    final mainHeaderCells = <Widget>[
      _cell('NUTRITIONAL STATUS', bold: true),
    ];
    if (is2459) {
      for (final mh in matrix.mainHeaders) {
        mainHeaderCells.add(_cell(mh, bold: true));
        mainHeaderCells.add(_cell(''));
        mainHeaderCells.add(_cell(''));
        mainHeaderCells.add(_cell(''));
      }
    } else {
      for (final mh in matrix.mainHeaders) {
        mainHeaderCells.add(_cell(mh, bold: true));
        mainHeaderCells.add(_cell(''));
      }
    }

    final subHeaderCells = <Widget>[
      _cell('', bold: true),
      ...matrix.subHeaders.map((sh) => _cell(sh, bold: true)),
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  matrix.title,
                  style: AppTextStyles.label.copyWith(fontSize: 12, fontWeight: FontWeight.bold),
                  softWrap: true,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Barangay: ${matrix.barangay}',
                style: AppTextStyles.body.copyWith(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Row(
              children: [
                Icon(Icons.touch_app_outlined, size: 14, color: AppColors.primaryGreen),
                SizedBox(width: 5),
                Flexible(
                  child: Text(
                    'Tip: Pindutin ang anumang numero para makita ang listahan ng mga bata.',
                    style: TextStyle(fontSize: 10.5, color: AppColors.primaryGreen, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          RepaintBoundary(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              border: TableBorder.all(color: AppColors.border, width: 0.5),
              children: [
                TableRow(
                  decoration: const BoxDecoration(color: AppColors.background),
                  children: mainHeaderCells,
                ),
                TableRow(
                  decoration: const BoxDecoration(color: AppColors.background),
                  children: subHeaderCells,
                ),
                ...matrix.rows.map(
                  (r) {
                    final isTotal = r.label.contains('TOTAL') || r.label.contains('KABUUAN');
                    return TableRow(
                      decoration: isTotal ? BoxDecoration(color: AppColors.background.withValues(alpha: 0.5)) : null,
                      children: [
                        _cell(r.label, bold: isTotal),
                        ...r.values.asMap().entries.map((entry) {
                          final colIdx = entry.key;
                          final v = entry.value;
                          final hasDrilldown = r.cellChildren.isNotEmpty && colIdx < r.cellChildren.length;
                          final kids = hasDrilldown ? r.cellChildren[colIdx] : <ChildDrilldownItem>[];

                          String colTitle = '';
                          if (is2459) {
                            final gIdx = colIdx ~/ 4;
                            final gLabel = gIdx == 0 ? 'BOYS' : (gIdx == 1 ? 'GIRLS' : 'TOTAL');
                            final qLabel = colIdx < matrix.subHeaders.length ? matrix.subHeaders[colIdx] : '';
                            colTitle = '$gLabel — $qLabel';
                          } else {
                            final mIdx = colIdx ~/ 2;
                            final sub = colIdx < matrix.subHeaders.length ? matrix.subHeaders[colIdx] : '';
                            final month = mIdx < matrix.mainHeaders.length ? matrix.mainHeaders[mIdx] : '';
                            colTitle = '$month ($sub)';
                          }

                          return InkWell(
                            onTap: () => _showCellDrilldown(r.label, colTitle, kids, v),
                            child: _cell(v.toString(), bold: isTotal, tappable: v > 0),
                          );
                        }),
                      ],
                    );
                  },
                ),
              ],
            ),
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.border),
          const SizedBox(height: 12),
          _buildSignatoryFooter(signatory),
        ],
      ),
    );
  }

  Widget _buildPreviewSigCol(
    String title,
    String name,
    String position, {
    String? dateLine,
  }) {
    final isNotSet = name.isEmpty || name == 'Not set';
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.bold,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black87, width: 1.0)),
            ),
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              isNotSet ? 'Not set' : name.toUpperCase(),
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isNotSet ? FontWeight.normal : FontWeight.bold,
                fontStyle: isNotSet ? FontStyle.italic : FontStyle.normal,
                color: isNotSet ? AppColors.textMuted : AppColors.textPrimary,
                decoration: isNotSet ? TextDecoration.none : TextDecoration.underline,
                height: 1.35,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            position.isNotEmpty ? position : 'Not set',
            style: TextStyle(
              fontSize: 9,
              fontStyle: position.isEmpty ? FontStyle.italic : FontStyle.normal,
              color: AppColors.textSecondary,
              height: 1.3,
            ),
            maxLines: 2,
            softWrap: true,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            dateLine ?? 'Date: ____________________',
            style: const TextStyle(
              fontSize: 8.5,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecordPreview(_PreviewLoadResult result) {
    if (widget.reportType.id == 'monthly_weight_record') {
      return _buildMonthly0to23Preview(result.monthly0to23);
    } else if (widget.reportType.id == 'quarterly_weighing') {
      return _buildQuarterly24to59Preview(result.quarterly24to59);
    }
    return _buildGenericRecordPreview(result.excelData);
  }

  // ── MONTHLY 0-23 PREVIEW (Clean simple UI + Frozen NAME column) ──
  Widget _buildMonthly0to23Preview(_Monthly0to23Model? model) {
    if (model == null) {
      return _buildEmptyPeriodState();
    }
    final signatory = _activeSignatory;

    final startMonth = _monthlyPartIndex == 0 ? 1 : 7;
    final nominalEndMonth = _monthlyPartIndex == 0 ? 6 : 12;
    final endMonth = nominalEndMonth > model.maxMonth ? model.maxMonth : nominalEndMonth;
    const monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
    ];

    Widget buildGenderTable(String sectionLabel, _MonthlyPartData partData) {
      if (startMonth > endMonth) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            'No records available for future months.',
            style: AppTextStyles.body.copyWith(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: AppColors.textMuted,
            ),
          ),
        );
      }

      if (partData.leftNames.isEmpty) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 6),
              child: Text(
                sectionLabel,
                style: AppTextStyles.label.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppColors.darkGreen,
                ),
              ),
            ),
            _buildEmptyPeriodState('No children in $sectionLabel for ${_period.year}.'),
          ],
        );
      }

      // Build header row 1 and row 2 widgets for right side
      final headerRow1 = Row(
        children: [
          Container(
            width: 195, // YR, MO, DAY (65 * 3)
            height: 28,
            alignment: Alignment.center,
            color: AppColors.darkGreen,
            child: const Text('DATE OF BIRTH', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          for (int m = startMonth; m <= endMonth; m++)
            Container(
              width: 195, // AGE, WT, STATUS (65 * 3)
              height: 28,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.darkGreen,
                border: Border(left: BorderSide(color: Colors.white24, width: 0.5)),
              ),
              child: Text(
                '${monthNames[m - 1]}, ${_period.year}',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
        ],
      );

      final headerRow2 = Row(
        children: [
          for (final label in ['YEAR', 'MO.', 'DAY'])
            Container(
              width: 65,
              height: 28,
              alignment: Alignment.center,
              color: AppColors.darkGreen.withValues(alpha: 0.9),
              child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
            ),
          for (int m = startMonth; m <= endMonth; m++) ...[
            for (final label in ['AGE (MO)', 'WEIGHT (KGS)', 'WEIGHT STATUS'])
              Container(
                width: 65,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.darkGreen.withValues(alpha: 0.9),
                  border: const Border(left: BorderSide(color: Colors.white24, width: 0.5)),
                ),
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ],
      );

      final bnsName = signatory.bnsName;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 6),
            child: Text(
              sectionLabel,
              style: AppTextStyles.label.copyWith(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.darkGreen),
            ),
          ),
          _buildStickyTable(
            leftHeaderTitle: 'NAME OF CHILD',
            leftNames: partData.leftNames,
            headerWidgets: [headerRow1, headerRow2],
            dataRightRows: partData.dataRows,
            colWidth: 65.0,
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'NO. OF SEVERELY UNDERWEIGHT: ${partData.suwCount}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.statRed),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'DATE ACCOMPLISHED: ${_fmtDateOnly(DateTime.now())}',
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'NO. OF UNDERWEIGHT: ${partData.uwCount}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.statAmber),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'ACCOMPLISHED BY: $bnsName',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      );
    }

    final boysPart = _monthlyPartIndex == 0 ? model.part0Boys : model.part1Boys;
    final girlsPart = _monthlyPartIndex == 0 ? model.part0Girls : model.part1Girls;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Center Bold Header Block
          Center(
            child: Column(
              children: [
                Text(
                  'MONTHLY RECORD OF WEIGHT AND WEIGHT STATUS',
                  style: AppTextStyles.label.copyWith(fontSize: 13, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 2),
                Text(
                  'INFANTS 0-23 MONTHS',
                  style: AppTextStyles.body.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.darkGreen),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 2),
                Text(
                  'PROVINCE: ${_currentProvince.toUpperCase()}  |  CITY/MUNICIPALITY: ${_currentMunicipality.toUpperCase()}  |  BARANGAY: ${_currentBarangay.toUpperCase()}',
                  style: AppTextStyles.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.textMuted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Part Selector Tabs
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text('JAN – JUN (Part 1)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                  selected: _monthlyPartIndex == 0,
                  selectedColor: AppColors.darkGreen,
                  labelStyle: TextStyle(color: _monthlyPartIndex == 0 ? Colors.white : AppColors.textPrimary),
                  onSelected: (val) {
                    if (val) setState(() => _monthlyPartIndex = 0);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  label: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text('JUL – DEC (Part 2)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                  selected: _monthlyPartIndex == 1,
                  selectedColor: AppColors.darkGreen,
                  labelStyle: TextStyle(color: _monthlyPartIndex == 1 ? Colors.white : AppColors.textPrimary),
                  onSelected: (val) {
                    if (val) setState(() => _monthlyPartIndex = 1);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Tables for Boys & Girls with page-break indicator
          buildGenderTable('BOYS', boysPart),
          // ── Page break indicator ──
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Expanded(child: Divider(color: AppColors.border)),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text('— page break —', style: TextStyle(fontSize: 9, color: AppColors.textMuted)),
                ),
                Expanded(child: Divider(color: AppColors.border)),
              ],
            ),
          ),
          buildGenderTable('GIRLS', girlsPart),

          const SizedBox(height: 16),
          const Divider(color: AppColors.border),
          const SizedBox(height: 8),

          // Signatories
          _buildSignatoryFooter(signatory),
        ],
      ),
    );
  }

  // ── QUARTERLY 24-59 PREVIEW (Clean simple UI + Frozen NAME column) ──
  Widget _buildQuarterly24to59Preview(_Quarterly24to59Model? model) {
    if (model == null) {
      return _buildEmptyPeriodState();
    }
    final signatory = _activeSignatory;
    final bnsName = signatory.bnsName;

    Widget buildQuarterlySection(String sectionLabel, _QuarterlySectionModel section) {
      // Header row 1 for Quarterly
      final headerRow1 = Row(
        children: [
          Container(
            width: 140, // NAME OF FATHER/MOTHER
            height: 28,
            alignment: Alignment.center,
            color: AppColors.darkGreen,
            child: const Text('NAME OF FATHER/MOTHER', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
          ),
          Container(
            width: 90, // DATE OF BIRTH
            height: 28,
            alignment: Alignment.center,
            color: AppColors.darkGreen,
            child: const Text('DATE OF BIRTH', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
          ),
          for (final sectionTitle in ['DATE OF WEIGHING', 'AGE IN MOS.', 'WEIGHT IN KLS.', 'NUTRITIONAL STATUS'])
            Container(
              width: 240, // 4 quarters (60 * 4)
              height: 28,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.darkGreen,
                border: Border(left: BorderSide(color: Colors.white24, width: 0.5)),
              ),
              child: Text(sectionTitle, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
            ),
          Container(
            width: 100, // REMARKS
            height: 28,
            alignment: Alignment.center,
            color: AppColors.darkGreen,
            child: const Text('REMARKS', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
          ),
        ],
      );

      // Header row 2 for Quarterly
      final headerRow2 = Row(
        children: [
          Container(width: 140, height: 28, color: AppColors.darkGreen.withValues(alpha: 0.9)),
          Container(width: 90, height: 28, color: AppColors.darkGreen.withValues(alpha: 0.9)),
          for (int s = 0; s < 4; s++) ...[
            for (final q in ['1ST', '2ND', '3RD', '4TH'])
              Container(
                width: 60,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.darkGreen.withValues(alpha: 0.9),
                  border: const Border(left: BorderSide(color: Colors.white24, width: 0.5)),
                ),
                child: Text(q, style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
              ),
          ],
          Container(width: 100, height: 28, color: AppColors.darkGreen.withValues(alpha: 0.9)),
        ],
      );

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Form Header Block
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('BNS FORM NO: 1-A  ·  Food and Nutrition Program', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                      const Text('Revised Boac MNC  ·  Date: January 2004', style: TextStyle(fontSize: 9, color: AppColors.textMuted)),
                      const SizedBox(height: 4),
                      Text('QUARTERLY FULL WEIGHING RECORD ($sectionLabel)', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.darkGreen)),
                      Text('1. NAME OF BNS: $bnsName', style: const TextStyle(fontSize: 9)),
                      Text('2. BARANGAY: ${_currentBarangay.toUpperCase()}', style: const TextStyle(fontSize: 9)),
                      Text('3. MUNICIPALITY: ${_currentMunicipality.toUpperCase()}', style: const TextStyle(fontSize: 9)),
                      Text('4. PROVINCE: ${_currentProvince.toUpperCase()}', style: const TextStyle(fontSize: 9)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Inclusive date of Weighing: 1ST | 2ND | 3RD | 4TH', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      const Text('Total no. of Families Surveyed: _____', style: TextStyle(fontSize: 9)),
                      const Text('Total no. of Families with PS: _____', style: TextStyle(fontSize: 9)),
                      const Text('Total no. of Families with/out PS: _____', style: TextStyle(fontSize: 9)),
                      Text('Total no. of Children Weighed: ${section.leftNames.length}', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (section.leftNames.isEmpty)
            _buildEmptyPeriodState('No children in $sectionLabel for ${_period.year}.')
          else
            _buildStickyTable(
              leftHeaderTitle: 'NAME OF CHILD / $sectionLabel',
              leftNames: section.leftNames,
              headerWidgets: [headerRow1, headerRow2],
              dataRightRows: section.dataRows,
              colWidth: 60.0,
              customRightWidths: const [140.0, 90.0],
            ),
        ],
      );
    }

    // ── Nutritional-status summary for preview ──────────────────────────
    const statusLabelsQ = [
      'Normal', 'Underweight', 'Severely Underweight', 'Overweight',
      'Stunted', 'Severely Stunted', 'MAM', 'SAM',
    ];
    final boyCounts = model.boyCounts;
    final girlCounts = model.girlCounts;
    final totalBoysWeighed = model.totalBoysWeighed;
    final totalGirlsWeighed = model.totalGirlsWeighed;
    final grandTotal = model.grandTotal;

    Widget buildSummaryTable() {
      if (grandTotal == 0) {
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          decoration: BoxDecoration(
            color: AppColors.background,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.info_outline, size: 28, color: AppColors.textMuted),
              const SizedBox(height: 8),
              const Text(
                'No records for this period',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'No weighed children aged 24-59 months found for Year ${_period.year}.',
                style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      }

      return Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        clipBehavior: Clip.hardEdge,
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(2.5),
            1: FixedColumnWidth(44),
            2: FixedColumnWidth(44),
            3: FixedColumnWidth(44),
            4: FixedColumnWidth(48),
          },
          border: TableBorder.all(color: AppColors.border, width: 0.5),
          children: [
            // Header row
            TableRow(
              decoration: const BoxDecoration(color: AppColors.darkGreen),
              children: [
                for (final h in ['Status', 'Boys', 'Girls', 'Total', '%'])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                    child: Text(
                      h,
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      textAlign: h == 'Status' ? TextAlign.left : TextAlign.center,
                      softWrap: false,
                    ),
                  ),
              ],
            ),
            // Data rows
            ...(statusLabelsQ).map((label) {
              final b = boyCounts[label]!;
              final g = girlCounts[label]!;
              final t = b + g;
              final pct = grandTotal > 0 ? ((t / grandTotal) * 100).toStringAsFixed(1) : '0.0';
              return TableRow(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                    child: Text(
                      label,
                      style: const TextStyle(fontSize: 9),
                      softWrap: true,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                    child: Text('$b', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                    child: Text('$g', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                    child: Text('$t', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                    child: Text('$pct%', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9)),
                  ),
                ],
              );
            }),
            // Totals row
            TableRow(
              decoration: BoxDecoration(color: AppColors.background),
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                  child: Text('TOTAL CHILDREN', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold), softWrap: false),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                  child: Text('$totalBoysWeighed', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                  child: Text('$totalGirlsWeighed', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                  child: Text('$grandTotal', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 5),
                  child: Text(grandTotal > 0 ? '100.0%' : '0.0%', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ),
      );
    }

    final today = DateTime.now();
    final fmtDate =
        '${today.month.toString().padLeft(2, '0')}/${today.day.toString().padLeft(2, '0')}/${today.year}';

    Widget pageBreakDivider() => Container(
          margin: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            children: [
              Expanded(child: Divider(color: AppColors.border)),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Text('— page break —',
                    style: TextStyle(fontSize: 9, color: AppColors.textMuted)),
              ),
              Expanded(child: Divider(color: AppColors.border)),
            ],
          ),
        );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Title block (matching PDF) ──
          Center(
            child: Column(
              children: [
                const Text(
                  'QUARTERLY FULL WEIGHING RECORD',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                Text(
                  'CHILDREN 24–59 MONTHS · Year: ${_period.year}',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 2),
                Text(
                  'Province: ${_currentProvince.toUpperCase()}  ·  Municipality: ${_currentMunicipality.toUpperCase()}  ·  Barangay: ${_currentBarangay.toUpperCase()}',
                  style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                  textAlign: TextAlign.center,
                ),
                Text(
                  'BNS: ${bnsName.isNotEmpty ? bnsName.toUpperCase() : '—'}  ·  Date Generated: $fmtDate',
                  style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.border),
          const SizedBox(height: 10),

          // Summary nutritional status table
          const Text(
            'NUTRITIONAL STATUS SUMMARY',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          buildSummaryTable(),
          pageBreakDivider(),

          // Per-gender weighing record tables
          buildQuarterlySection('BOYS', model.boysSection),
          pageBreakDivider(),
          buildQuarterlySection('GIRLS', model.girlsSection),

          const SizedBox(height: 16),
          const Divider(color: AppColors.border),
          const SizedBox(height: 8),

          _buildSignatoryFooter(signatory),
        ],
      ),
    );
  }

  // ── REUSABLE STICKY LEFT COLUMN TABLE WIDGET ──
  Widget _buildStickyTable({
    required String leftHeaderTitle,
    required List<String> leftNames,
    required List<Widget> headerWidgets,
    required List<List<String>> dataRightRows,
    required double colWidth,
    List<double>? customRightWidths,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.of(context).size.width - 32;
        final rightWidth = (availableWidth - 152.0).clamp(120.0, double.infinity);

        return RepaintBoundary(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Sticky Left Column (NAME OF CHILD)
                Container(
                  width: 150,
                  decoration: const BoxDecoration(
                    border: Border(right: BorderSide(color: AppColors.darkGreen, width: 1.5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        height: 56, // Height matching 2 header rows (28 * 2)
                        color: AppColors.darkGreen,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        alignment: Alignment.centerLeft,
                        child: Text(
                          leftHeaderTitle,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10),
                        ),
                      ),
                      ...leftNames.asMap().entries.map((e) {
                        final idx = e.key;
                        final name = e.value;
                        final isEven = idx % 2 == 0;
                        return Container(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          alignment: Alignment.centerLeft,
                          decoration: BoxDecoration(
                            color: isEven ? Colors.white : AppColors.background.withValues(alpha: 0.5),
                            border: const Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
                          ),
                          child: Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                // Scrollable Right Columns (explicitly bounded width — safe inside InteractiveViewer/scroll views)
                SizedBox(
                  width: rightWidth,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ...headerWidgets,
                        ...dataRightRows.asMap().entries.map((e) {
                          final idx = e.key;
                          final row = e.value;
                          final isEven = idx % 2 == 0;
                          return Container(
                            height: 36,
                            color: isEven ? Colors.white : AppColors.background.withValues(alpha: 0.5),
                            child: Row(
                              children: row.asMap().entries.map((cellEntry) {
                                final cIdx = cellEntry.key;
                                final cellText = cellEntry.value;

                                double width = colWidth;
                                if (customRightWidths != null && cIdx < customRightWidths.length) {
                                  width = customRightWidths[cIdx];
                                }

                                return Container(
                                  width: width,
                                  height: 36,
                                  alignment: Alignment.center,
                                  padding: const EdgeInsets.symmetric(horizontal: 2),
                                  decoration: const BoxDecoration(
                                    border: Border(
                                      right: BorderSide(color: AppColors.border, width: 0.5),
                                      bottom: BorderSide(color: AppColors.border, width: 0.5),
                                    ),
                                  ),
                                  child: Text(
                                    cellText,
                                    style: const TextStyle(fontSize: 9),
                                    textAlign: TextAlign.center,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                );
                              }).toList(),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSignatoryFooter(ReportSignatory? signatory) {
    final sig = signatory ?? _activeSignatory;
    final items = sig.items;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items.map((item) {
          return Padding(
            padding: const EdgeInsets.only(right: 28),
            child: _buildPreviewSigCol(
              item.roleTitle,
              item.name,
              item.position,
              dateLine: item.dateLine,
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGenericRecordPreview(ExcelTableData? preloadedData) {
    final data = preloadedData ?? _buildExcelData(widget.reportType.id);
    final signatory = _activeSignatory;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.reportType.id == 'children_masterlist' ||
              widget.reportType.id == 'lactating_mothers_masterlist') ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(14),
                  topRight: Radius.circular(14),
                ),
              ),
              child: Column(
                children: [
                  if (widget.reportType.id == 'children_masterlist') ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Image.asset('assets/images/logos/bagong_pilipinas.png', width: 38, height: 38, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 38)),
                        const SizedBox(width: 8),
                        Image.asset('assets/images/logos/nnc.png', width: 38, height: 38, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 38)),
                        const SizedBox(width: 8),
                        Image.asset('assets/images/logos/gasan_seal.png', width: 38, height: 38, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 38)),
                        const SizedBox(width: 8),
                        Image.asset(getBarangaySealAssetPath(_currentBarangay), width: 38, height: 38, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 38)),
                        const SizedBox(width: 8),
                        Image.asset('assets/images/logos/nutrition_logo.png', width: 38, height: 38, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 38)),
                      ],
                    ),
                    const SizedBox(height: 10),
                  ],
                  Text(
                    widget.reportType.id == 'lactating_mothers_masterlist'
                        ? 'MASTERLIST OF LACTATING MOTHER ${_period.year}'
                        : 'CHILDREN MASTERLIST ${_period.year}',
                    style: AppTextStyles.h3.copyWith(fontSize: 13, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Barangay $_currentBarangay · Municipality of Gasan',
                    style: AppTextStyles.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),
          ] else ...[
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      widget.reportType.title,
                      style: AppTextStyles.label.copyWith(fontSize: 13, fontWeight: FontWeight.bold),
                      softWrap: true,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Barangay $_currentBarangay',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.darkGreen),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),
          ],
          if (data.rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: _buildEmptyPeriodState(),
            )
          else
            RepaintBoundary(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Table(
                  defaultColumnWidth: const IntrinsicColumnWidth(),
                  border: TableBorder.all(color: AppColors.border.withValues(alpha: 0.6), width: 0.5),
                  children: [
                    TableRow(
                      decoration: const BoxDecoration(color: AppColors.darkGreen),
                      children: data.headers
                          .map(
                            (h) => Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              child: Text(
                                h.toUpperCase(),
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                    ...data.rows.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final row = entry.value;
                      final isEven = idx % 2 == 0;
                      return TableRow(
                        decoration: BoxDecoration(
                          color: isEven ? Colors.white : AppColors.background.withValues(alpha: 0.5),
                        ),
                        children: row
                            .map(
                              (val) => Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                child: Text(
                                  val.toString(),
                                  style: AppTextStyles.body.copyWith(fontSize: 11, color: AppColors.textPrimary),
                                ),
                              ),
                            )
                            .toList(),
                      );
                    }),
                  ],
                ),
              ),
            ),
          const Divider(color: AppColors.border),
          Padding(
            padding: const EdgeInsets.all(14),
            child: _buildSignatoryFooter(signatory),
          ),
        ],
      ),
    );
  }

  Widget _cell(String text, {bool bold = false, bool tappable = false}) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    child: Text(
      text,
      style: AppTextStyles.body.copyWith(
        fontSize: 10,
        fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        color: tappable ? AppColors.darkGreen : (bold ? AppColors.textPrimary : Colors.black87),
        decoration: tappable ? TextDecoration.underline : TextDecoration.none,
      ),
    ),
  );

  Color _statusBadgeColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('severely') || s.contains('sam')) return AppColors.statRed;
    if (s.contains('underweight') || s.contains('wasted') || s.contains('stunted') || s.contains('mam')) {
      return AppColors.statOrange;
    }
    if (s.contains('normal')) return AppColors.primaryGreen;
    if (s.contains('overweight') || s.contains('obese')) return Colors.purple;
    return AppColors.textMuted;
  }

  void _showCellDrilldown(
    String rowLabel,
    String colHeader,
    List<ChildDrilldownItem> children,
    int count,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(ctx).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            colHeader.isNotEmpty ? colHeader : 'Breakdown',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$rowLabel ($count)',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.darkGreen,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: children.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.people_outline, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 10),
                            Text(
                              count == 0
                                  ? 'No children recorded for this count.'
                                  : 'No child details available.',
                              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: children.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (_, idx) {
                          final c = children[idx];
                          final dobStr = _fmtDateOnly(c.birthDate);
                          final wt = c.weightKg != null ? '${c.weightKg!.toStringAsFixed(1)} kg' : '—';
                          final ht = c.heightCm != null ? '${c.heightCm!.toStringAsFixed(1)} cm' : '—';
                          final measDateStr = c.dateWeighed != null ? _fmtDateOnly(c.dateWeighed!) : null;

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${idx + 1}. ${c.fullName}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: _statusBadgeColor(c.status).withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: _statusBadgeColor(c.status)),
                                      ),
                                      child: Text(
                                        c.status,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: _statusBadgeColor(c.status),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Text(
                                      '${c.gender}  ·  Age: ${c.ageMonths} mos.  ·  DOB: $dobStr',
                                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                                if (c.weightKg != null || c.heightCm != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Weight: $wt  ·  Height: $ht${measDateStr != null ? "  (Weighed: $measDateStr)" : ""}',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                                  ),
                                ],
                                if (c.details.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    c.details,
                                    style: TextStyle(fontSize: 10.5, fontStyle: FontStyle.italic, color: Colors.grey.shade700),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showMissingDataDialog(List<MissingDataRecord> records) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Color(0xFFF57F17), size: 22),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Missing Data Warnings', style: TextStyle(fontSize: 15)),
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            height: 350,
            child: ListView.separated(
              itemCount: records.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (_, idx) {
                final r = records[idx];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${idx + 1}. ${r.beneficiaryName}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              r.beneficiaryType,
                              style: TextStyle(fontSize: 10, color: Colors.amber.shade900, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        r.issue,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFD84315)),
                      ),
                      Text(
                        r.details,
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Widget _exportButton(
    String label,
    Future<void> Function() onTap,
    IconData icon,
  ) {
    return SizedBox(
      height: 48,
      child: FilledButton.icon(
        onPressed: _isExporting ? null : onTap,
        icon: _isExporting
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Icon(icon, size: 18),
        label: Text(_isExporting ? 'Preparing...' : label, style: const TextStyle(fontSize: 13)),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primaryGreen,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
