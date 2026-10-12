import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/models/child.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/report_signatory_repository.dart';
import '../../shared/utils/app_pickers.dart';
import '../../data/models/report_signatory.dart';
import 'report_types.dart';
import '../../shared/utils/barangay_assets.dart';
import 'services/consolidation_computation_service.dart';
import 'services/excel_table_data.dart';
import 'services/report_excel_service.dart';
import 'services/report_pdf_service.dart';
import 'services/report_download_service.dart';

import '../../data/growth_standards/growth_classifier.dart';
import '../../data/local/app_data_bus.dart';
import '../../shared/utils/app_page_route.dart';
import 'sync_status_screen.dart';
import 'report_signatories_screen.dart';

class ReportPreviewScreen extends StatefulWidget {
  final ReportTypeInfo reportType;
  const ReportPreviewScreen({super.key, required this.reportType});

  @override
  State<ReportPreviewScreen> createState() => _ReportPreviewScreenState();
}

class _ReportPreviewScreenState extends State<ReportPreviewScreen> {
  final _settings = SettingsRepository();
  final _childRepo = ChildRepository();
  final _measurementRepo = MeasurementRepository();
  final _motherRepo = MotherRepository();
  DateTime _period = DateTime.now();
  bool _isExporting = false;
  int _monthlyPartIndex = 0; // 0 = JAN–JUN, 1 = JUL–DEC

  int get _pendingRecordsCount =>
      _childRepo.pendingCount +
      _measurementRepo.pendingCount +
      _motherRepo.pendingCount;

  bool _isEligible0to23(Child c, int year) {
    if (!c.isActive) return false;
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
    final picked = await showAppDatePicker(
      context: context,
      initialDate: _period,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _period = DateTime(picked.year, picked.month));
    }
  }

  static String _mapWeightStatusCode(String status) {
    final s = status.toLowerCase();
    if (s.contains('severely underweight') || s == 'suw') return 'SUW';
    if (s.contains('underweight') || s == 'uw') return 'UW';
    if (s.contains('overweight') || s.contains('obese') || s == 'ow') return 'OW';
    if (s.contains('normal') || s == 'n') return 'N';
    return '';
  }

  static String _fmtDateOnly(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _showDownloadSuccess(String savedFileName) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Downloaded to Downloads: $savedFileName',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.primaryGreen,
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showDownloadError(String userMessage, VoidCallback onRetry) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          userMessage,
          style: const TextStyle(fontSize: 13),
        ),
        backgroundColor: AppColors.statRed,
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Retry',
          textColor: Colors.white,
          onPressed: onRetry,
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

      final savedFileName = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: '$fileTitle.pdf',
        mimeType: 'application/pdf',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(savedFileName);
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

      final savedFileName = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: '$fileTitle.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(savedFileName);
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

      if (widget.reportType.id == 'lactating_mothers_masterlist') {
        final motherRepo = MotherRepository();
        final mothers = motherRepo
            .getAll()
            .where((m) => m.barangay == _currentBarangay && m.isActive)
            .toList();
        final names = mothers.map((m) => m.fullName).toList();
        final fileTitle = 'lactating_masterlist_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        file = await ReportPdfService().exportLactatingMasterlistPdf(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          year: _period.year,
          names: names,
          signatory: signatory,
        );
      } else if (widget.reportType.id == 'children_masterlist') {
        final childRepo = ChildRepository();
        final children = childRepo
            .getByBarangay(_currentBarangay)
            .where((c) => c.isActive)
            .toList();
        final names = children.map((c) => c.fullName).toList();
        final fileTitle = 'children_masterlist_${_period.year}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        file = await ReportPdfService().exportChildrenMasterlistPdf(
          fileTitle: fileTitle,
          barangay: _currentBarangay,
          year: _period.year,
          names: names,
          signatory: signatory,
        );
      } else if (widget.reportType.id == 'monthly_weight_record') {
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
        final fileTitle = '${widget.reportType.id}_$_currentBarangay';
        targetFileName = '$fileTitle.pdf';
        file = await ReportPdfService().exportTableAndShare(
          fileTitle: fileTitle,
          title: widget.reportType.title,
          barangay: _currentBarangay,
          headers: data.headers,
          rows: data.rows,
          signatory: signatory,
        );
      }

      final savedFileName = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: targetFileName,
        mimeType: 'application/pdf',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(savedFileName);
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
        file = await ReportExcelService().exportIndividualRecordAndShare(
          reportTypeId: widget.reportType.id,
          fileTitle: fileTitle,
          title: widget.reportType.title,
          barangay: _currentBarangay,
          year: _period.year,
          data: data,
          signatory: signatory,
        );
      }

      final savedFileName = await ReportDownloadService.downloadReport(
        sourceFile: file,
        targetFileName: targetFileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (mounted) {
        setState(() => _isExporting = false);
        _showDownloadSuccess(savedFileName);
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
    final childRepo = ChildRepository();
    final measurementRepo = MeasurementRepository();

    if (reportTypeId == 'opt_plus') {
      final children = childRepo
          .getByBarangay(_currentBarangay)
          .where((c) => c.isActive)
          .toList();
      final rows = children.map((c) {
        final m = measurementRepo.getForChild(c.id);
        final latest = m.isNotEmpty ? m.first : null;
        return [
          c.sequenceNo,
          c.fullName,
          c.gender,
          _fmtDateOnly(c.birthDate),
          '${c.ageInMonths}',
          c.belongsToIpGroup ? 'Yes' : 'No',
          c.disability,
          latest?.weightKg.toString() ?? '—',
          latest?.heightCm.toString() ?? '—',
          latest?.muacCm?.toString() ?? '—',
          (latest?.bilateralPittingEdema ?? false) ? 'Yes' : 'No',
          c.nutritionStatus,
          c.stuntingStatus,
          c.wastingStatus,
        ];
      }).toList();
      return ExcelTableData(
        headers: [
          'Seq No', 'Name', 'Sex', 'DOB', 'Age (mo)', 'IP Group', 'Disability',
          'Weight (kg)', 'Height (cm)', 'MUAC (cm)', 'Edema', 'Weight Status',
          'Height Status', 'Wasting Status',
        ],
        rows: rows,
      );
    }

    if (reportTypeId == 'children_masterlist') {
      final children = childRepo
          .getByBarangay(_currentBarangay)
          .where((c) => c.isActive)
          .toList();
      int no = 1;
      final rows = children
          .map(
            (c) => [
              '${no++}', c.fullName, c.gender, _fmtDateOnly(c.birthDate),
              '${c.ageInMonths}', c.address.isNotEmpty ? c.address : 'Purok 1',
              c.guardian.fullName, c.guardian.contactNo, c.nutritionStatus,
              c.isActive ? 'Active' : 'Inactive',
            ],
          )
          .toList();
      return ExcelTableData(
        headers: [
          'NO.', 'NAME OF CHILD', 'SEX', 'BIRTHDAY', 'AGE (MO)', 'ADDRESS',
          'GUARDIAN NAME', 'GUARDIAN CONTACT', 'NUTRITIONAL STATUS', 'STATUS',
        ],
        rows: rows,
      );
    }

    final mothers = MotherRepository()
        .getAll()
        .where((m) => m.barangay == _currentBarangay && m.isActive)
        .toList();
    int no = 1;
    final rows = mothers
        .map(
          (m) => [
            '${no++}', m.fullName, '${m.age}', m.address.isNotEmpty ? m.address : 'Purok 1',
            m.contactNo, m.breastfeedingPractice.isNotEmpty ? m.breastfeedingPractice : 'Lactating',
          ],
        )
        .toList();
    return ExcelTableData(
      headers: [
        'NO.', 'NAME OF LACTATING MOTHER', 'AGE', 'ADDRESS', 'CONTACT', 'STATUS',
      ],
      rows: rows,
    );
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

    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, _, _) {
        return Scaffold(
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
                            onTap: () => Navigator.pop(context),
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
                          InkWell(
                            onTap: () async {
                              await Navigator.push(
                                context,
                                appPageRoute(const ReportSignatoriesScreen()),
                              );
                              setState(() {});
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  Icon(Icons.draw_outlined, color: Colors.white, size: 15),
                                  SizedBox(width: 4),
                                  Text(
                                    'Signatories',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
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
                                      onPressed: () => Navigator.push(
                                        context,
                                        appPageRoute(const SyncStatusScreen()),
                                      ),
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

                            // ── Preview area (with pinch-to-zoom) ──
                            // Hint text for zoom
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
                            InteractiveViewer(
                              minScale: 0.6,
                              maxScale: 3.0,
                              constrained: true,
                              child: isConsolidation
                                  ? _buildConsolidationPreview()
                                  : _buildRecordPreview(),
                            ),
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
        );
      },
    );
  }

  Widget _buildConsolidationPreview() {
    final matrix = ConsolidationComputationService().computeMatrix(
      widget.reportType.id,
      _currentBarangay,
      year: _period.year,
    );

    final signatory = _activeSignatory;
    final sig1 = signatory.bnsName;
    final sig2 = signatory.punongBarangayName;
    final sig3 = signatory.mnaoAdminAideName;
    final sig4 = signatory.dnpcName;

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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                matrix.title,
                style: AppTextStyles.label.copyWith(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              Text(
                'Barangay: ${matrix.barangay}',
                style: AppTextStyles.body.copyWith(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
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
                    final isTotal = r.label.contains('TOTAL');
                    return TableRow(
                      decoration: isTotal ? BoxDecoration(color: AppColors.background.withValues(alpha: 0.5)) : null,
                      children: [
                        _cell(r.label, bold: isTotal),
                        ...r.values.map((v) => _cell(v.toString(), bold: isTotal)),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.border),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPreviewSigCol('SUBMITTED BY:', sig1, 'BNS'),
                const SizedBox(width: 24),
                _buildPreviewSigCol('NOTED BY:', sig2, 'PUNONG BARANGAY'),
                const SizedBox(width: 24),
                _buildPreviewSigCol('APPROVED BY:', sig3, 'ADMIN AIDE IV- MNAO OIC'),
                const SizedBox(width: 24),
                _buildPreviewSigCol('APPROVED BY:', sig4, 'DNPC'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewSigCol(String title, String name, String position) {
    return SizedBox(
      width: 155,
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
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black87, width: 1.0)),
            ),
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              name.isNotEmpty ? name.toUpperCase() : '',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                decoration: TextDecoration.underline,
                height: 1.35,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            position,
            style: const TextStyle(
              fontSize: 9,
              color: AppColors.textSecondary,
              height: 1.3,
            ),
            maxLines: 2,
            softWrap: true,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          const Text(
            'Date: ____________________',
            style: TextStyle(
              fontSize: 8.5,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecordPreview() {
    if (widget.reportType.id == 'monthly_weight_record') {
      return _buildMonthly0to23Preview();
    } else if (widget.reportType.id == 'quarterly_weighing') {
      return _buildQuarterly24to59Preview();
    }
    return _buildGenericRecordPreview();
  }

  // ── MONTHLY 0-23 PREVIEW (Clean simple UI + Frozen NAME column) ──
  Widget _buildMonthly0to23Preview() {
    final childRepo = ChildRepository();
    final measurementRepo = MeasurementRepository();
    final signatory = _activeSignatory;

    final children = childRepo
        .getByBarangay(_currentBarangay)
        .where((c) => _isEligible0to23(c, _period.year))
        .toList();
    final boys = children.where((c) => c.gender == 'Male').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
    final girls = children.where((c) => c.gender == 'Female').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

    final startMonth = _monthlyPartIndex == 0 ? 1 : 7;
    final endMonth = _monthlyPartIndex == 0 ? 6 : 12;
    final monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];

    Widget buildGenderTable(String sectionLabel, List<dynamic> kids) {
      int suwCount = 0;
      int uwCount = 0;

      final dataRows = <List<String>>[];
      for (final child in kids) {
        final row = <String>[
          '${child.birthDate.year}',
          '${child.birthDate.month}',
          '${child.birthDate.day}',
        ];
        final measurements = measurementRepo.getForChild(child.id);

        for (int m = startMonth; m <= endMonth; m++) {
          String ageStr = '';
          String wtStr = '';
          String statusStr = '';

          final recs = measurements
              .where((r) => r.date.year == _period.year && r.date.month == m)
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
              statusStr = _mapWeightStatusCode(computedWfa);
              if (statusStr == 'SUW') suwCount++;
              if (statusStr == 'UW') uwCount++;
            } else {
              ageStr = 'OA';
            }
          } else {
            final monthRefDate = DateTime(_period.year, m, 1);
            if (monthRefDate.isBefore(DateTime(child.birthDate.year, child.birthDate.month, 1))) {
              ageStr = '';
            } else {
              final ageInMonth = child.ageInMonthsAt(monthRefDate);
              if (ageInMonth > 23) {
                final prevMonthRef = DateTime(_period.year, m > 1 ? m - 1 : 1, 1);
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
            leftNames: kids.map((k) => k.fullName.toString()).toList(),
            headerWidgets: [headerRow1, headerRow2],
            dataRightRows: dataRows,
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
                        'NO. OF SEVERELY UNDERWEIGHT: $suwCount',
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
                        'NO. OF UNDERWEIGHT: $uwCount',
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
          // ── Logo header (matching PDF) ──
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/images/logos/bagong_pilipinas.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/nnc.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/gasan_seal.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset(getBarangaySealAssetPath(_currentBarangay), width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/nutrition_logo.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
            ],
          ),
          const SizedBox(height: 10),

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
          buildGenderTable('BOYS', boys),
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
          buildGenderTable('GIRLS', girls),

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
  Widget _buildQuarterly24to59Preview() {
    final childRepo = ChildRepository();
    final measurementRepo = MeasurementRepository();
    final signatory = _activeSignatory;

    final children = childRepo.getByBarangay(_currentBarangay).where((c) => c.isActive).toList();
    final boys = children.where((c) => c.gender == 'Male').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
    final girls = children.where((c) => c.gender == 'Female').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

    final bnsName = signatory.bnsName;

    final qMonths = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12]
    ];

    Widget buildQuarterlySection(String sectionLabel, List<dynamic> kids) {
      final dataRows = <List<String>>[];

      for (final child in kids) {
        final row = <String>[
          child.guardian.fullName.toString(),
          '${child.birthDate.month}/${child.birthDate.day}/${child.birthDate.year}',
        ];

        final measurements = measurementRepo.getForChild(child.id);

        final dates = <String>[];
        final ages = <String>[];
        final wts = <String>[];
        final statuses = <String>[];

        for (int q = 0; q < 4; q++) {
          final months = qMonths[q];
          final targetMonth = (q + 1) * 3;
          final qRecs = measurements.where((m) => m.date.year == _period.year && months.contains(m.date.month)).toList();

          final totalMonths = (_period.year - child.birthDate.year) * 12 + (targetMonth - child.birthDate.month);

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
            statuses.add(_mapWeightStatusCode(computedStatus));
          } else {
            dates.add('');
            if (totalMonths > 59) {
              final prevTargetMonth = q > 0 ? q * 3 : 1;
              final prevMonths = (_period.year - child.birthDate.year) * 12 + (prevTargetMonth - child.birthDate.month);
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
                      Text('Total no. of Children Weighed: ${kids.length}', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          _buildStickyTable(
            leftHeaderTitle: 'NAME OF CHILD / $sectionLabel',
            leftNames: kids.map((k) => k.fullName.toString()).toList(),
            headerWidgets: [headerRow1, headerRow2],
            dataRightRows: dataRows,
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
    final boyCounts = <String, int>{for (final s in statusLabelsQ) s: 0};
    final girlCounts = <String, int>{for (final s in statusLabelsQ) s: 0};

    void countChildPreview(Child child, Map<String, int> counts) {
      final meas = measurementRepo.getForChild(child.id);
      final inYear = meas.where((m) => m.date.year == _period.year).toList();
      if (inYear.isEmpty) return;
      final latest = inYear.first;
      final age = Child.monthsBetween(child.birthDate, latest.date);
      final wfa = GrowthClassifier.classifyWeightForAge(
        weightKg: latest.weightKg, ageMonths: age, gender: child.gender,
      );
      final hfa = GrowthClassifier.classifyHeightForAge(
        heightCm: latest.heightCm, ageMonths: age, gender: child.gender,
      );
      final wfl = GrowthClassifier.classifyWeightForLength(
        weightKg: latest.weightKg, heightCm: latest.heightCm, gender: child.gender,
      );
      if (wfl == 'SAM') { counts['SAM'] = counts['SAM']! + 1; }
      else if (wfl == 'MAM') { counts['MAM'] = counts['MAM']! + 1; }
      else if (hfa == 'Severely Stunted') { counts['Severely Stunted'] = counts['Severely Stunted']! + 1; }
      else if (hfa == 'Stunted') { counts['Stunted'] = counts['Stunted']! + 1; }
      else if (wfa == 'Severely Underweight') { counts['Severely Underweight'] = counts['Severely Underweight']! + 1; }
      else if (wfa == 'Underweight') { counts['Underweight'] = counts['Underweight']! + 1; }
      else if (wfa == 'Overweight' || wfl == 'Overweight' || wfl == 'Obese') { counts['Overweight'] = counts['Overweight']! + 1; }
      else { counts['Normal'] = counts['Normal']! + 1; }
    }

    for (final child in boys) { countChildPreview(child, boyCounts); }
    for (final child in girls) { countChildPreview(child, girlCounts); }

    final grandTotal = boys.length + girls.length;

    Widget buildSummaryTable() {
      return Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        clipBehavior: Clip.hardEdge,
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(3),
            1: FixedColumnWidth(60),
            2: FixedColumnWidth(60),
            3: FixedColumnWidth(60),
            4: FixedColumnWidth(80),
          },
          border: TableBorder.all(color: AppColors.border, width: 0.5),
          children: [
            // Header row
            TableRow(
              decoration: const BoxDecoration(color: AppColors.darkGreen),
              children: [
                for (final h in ['Nutritional Status', 'Boys', 'Girls', 'Total', 'Percentage (%)'])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                    child: Text(h, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                        textAlign: h == 'Nutritional Status' ? TextAlign.left : TextAlign.center),
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
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text(label, style: const TextStyle(fontSize: 9))),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text('$b', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9))),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text('$g', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9))),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text('$t', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text('$pct%', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9))),
                ],
              );
            }),
            // Totals row
            TableRow(
              decoration: BoxDecoration(color: AppColors.background),
              children: [
                const Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text('TOTAL', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text('${boys.length}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text('${girls.length}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text('$grandTotal', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(grandTotal > 0 ? '100.0%' : '0.0%', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold))),
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
          // ── Logo header (matching PDF) ──
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset('assets/images/logos/bagong_pilipinas.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/nnc.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/gasan_seal.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset(getBarangaySealAssetPath(_currentBarangay), width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
              const SizedBox(width: 6),
              Image.asset('assets/images/logos/nutrition_logo.png', width: 32, height: 32,
                  fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 32)),
            ],
          ),
          const SizedBox(height: 10),
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
          buildQuarterlySection('BOYS', boys),
          pageBreakDivider(),
          buildQuarterlySection('GIRLS', girls),

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
    return Container(
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
                    color: isEven ? Colors.white : AppColors.background.withValues(alpha: 0.5),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    alignment: Alignment.centerLeft,
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
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
          // Scrollable Right Columns
          Expanded(
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
    );
  }

  Widget _buildSignatoryFooter(ReportSignatory? signatory) {
    final sig1 = signatory?.bnsName ?? '';
    final sig2 = signatory?.punongBarangayName ?? '';
    final sig3 = signatory?.mnaoAdminAideName ?? '';
    final sig4 = signatory?.dnpcName ?? '';

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPreviewSigCol('SUBMITTED BY:', sig1, 'BNS'),
          const SizedBox(width: 48),
          _buildPreviewSigCol('NOTED BY:', sig2, 'PUNONG BARANGAY'),
          const SizedBox(width: 48),
          _buildPreviewSigCol('APPROVED BY:', sig3, 'ADMIN AIDE IV- MNAO OIC'),
          const SizedBox(width: 48),
          _buildPreviewSigCol('APPROVED BY:', sig4, 'DNPC'),
        ],
      ),
    );
  }

  Widget _buildGenericRecordPreview() {
    final data = _buildExcelData(widget.reportType.id);
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
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.reportType.title,
                    style: AppTextStyles.label.copyWith(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Barangay $_currentBarangay',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.darkGreen),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),
          ],
          SingleChildScrollView(
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
          const Divider(color: AppColors.border),
          Padding(
            padding: const EdgeInsets.all(14),
            child: _buildSignatoryFooter(signatory),
          ),
        ],
      ),
    );
  }

  Widget _cell(String text, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    child: Text(
      text,
      style: AppTextStyles.body.copyWith(
        fontSize: 10,
        fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
      ),
    ),
  );

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
