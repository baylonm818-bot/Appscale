import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/report_signatory_repository.dart';
import '../../shared/utils/app_pickers.dart';
import '../../data/models/report_signatory.dart';
import 'report_types.dart';
import 'services/consolidation_computation_service.dart';
import 'services/excel_table_data.dart';
import 'services/report_excel_service.dart';
import 'services/report_pdf_service.dart';

class ReportPreviewScreen extends StatefulWidget {
  final ReportTypeInfo reportType;
  const ReportPreviewScreen({super.key, required this.reportType});

  @override
  State<ReportPreviewScreen> createState() => _ReportPreviewScreenState();
}

class _ReportPreviewScreenState extends State<ReportPreviewScreen> {
  final _settings = SettingsRepository();
  DateTime _period = DateTime.now();
  bool _isExporting = false;
  int _monthlyPartIndex = 0; // 0 = JAN–JUN, 1 = JUL–DEC

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  String get _currentMunicipality =>
      _settings.authUser?['municipality']?.toString() ?? 'GASAN';

  String get _currentProvince =>
      _settings.authUser?['province']?.toString() ?? 'MARINDUQUE';

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

  Future<void> _exportConsolidationPdf() async {
    setState(() => _isExporting = true);
    final matrix = ConsolidationComputationService().computeMatrix(
      widget.reportType.id,
      _currentBarangay,
      year: _period.year,
    );
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    await ReportPdfService().exportMatrixAndShare(
      fileTitle: '${widget.reportType.id}_${_period.year}_$_currentBarangay',
      matrix: matrix,
      signatory: signatory,
    );

    if (mounted) setState(() => _isExporting = false);
  }

  Future<void> _exportConsolidationExcel() async {
    setState(() => _isExporting = true);
    final matrix = ConsolidationComputationService().computeMatrix(
      widget.reportType.id,
      _currentBarangay,
      year: _period.year,
    );
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    await ReportExcelService().exportConsolidationMatrixAndShare(
      fileTitle: '${widget.reportType.id}_${_period.year}_$_currentBarangay',
      matrix: matrix,
      signatory: signatory,
    );

    if (mounted) setState(() => _isExporting = false);
  }

  Future<void> _exportPdf() async {
    setState(() => _isExporting = true);
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    if (widget.reportType.id == 'lactating_mothers_masterlist') {
      final motherRepo = MotherRepository();
      final mothers = motherRepo
          .getAll()
          .where((m) => m.barangay == _currentBarangay && m.isActive)
          .toList();
      final names = mothers.map((m) => m.fullName).toList();
      await ReportPdfService().exportLactatingMasterlistPdf(
        fileTitle: 'lactating_masterlist_${_period.year}_$_currentBarangay',
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

      await ReportPdfService().exportChildrenMasterlistPdf(
        fileTitle: 'children_masterlist_${_period.year}_$_currentBarangay',
        barangay: _currentBarangay,
        year: _period.year,
        names: names,
        signatory: signatory,
      );
    } else {
      final data = _buildExcelData(widget.reportType.id);
      await ReportPdfService().exportTableAndShare(
        fileTitle: '${widget.reportType.id}_$_currentBarangay',
        title: widget.reportType.title,
        barangay: _currentBarangay,
        headers: data.headers,
        rows: data.rows,
        signatory: signatory,
      );
    }
    if (mounted) setState(() => _isExporting = false);
  }

  Future<void> _exportExcel() async {
    setState(() => _isExporting = true);
    final signatory = ReportSignatoryRepository().get(_currentBarangay);
    final childRepo = ChildRepository();
    final measurementRepo = MeasurementRepository();

    if (widget.reportType.id == 'monthly_weight_record') {
      final children = childRepo
          .getByBarangay(_currentBarangay)
          .where((c) => c.isActive)
          .toList();

      final boys = children.where((c) => c.gender == 'Male').toList()
        ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

      final girls = children.where((c) => c.gender == 'Female').toList()
        ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

      await ReportExcelService().exportMonthly0to23Excel(
        fileTitle: 'Monthly_0-23_${_period.year}',
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

      await ReportExcelService().exportQuarterlyRecord24to59Excel(
        fileTitle: 'Quarterly_24-59_${_period.year}',
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
      await ReportExcelService().exportIndividualRecordAndShare(
        reportTypeId: widget.reportType.id,
        fileTitle: '${widget.reportType.id}_${_period.year}_$_currentBarangay',
        title: widget.reportType.title,
        barangay: _currentBarangay,
        year: _period.year,
        data: data,
        signatory: signatory,
      );
    }
    if (mounted) setState(() => _isExporting = false);
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
      final children = childRepo.getByBarangay(_currentBarangay);
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

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
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
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isConsolidation) ...[
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
                                'Year: ${_period.year}',
                                style: AppTextStyles.label.copyWith(fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _buildConsolidationPreview(),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: _exportButton(
                              'Export PDF',
                              _exportConsolidationPdf,
                              Icons.picture_as_pdf_outlined,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _exportButton(
                              'Export Excel',
                              _exportConsolidationExcel,
                              Icons.grid_on_outlined,
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      if (widget.reportType.id == 'monthly_weight_record' ||
                          widget.reportType.id == 'quarterly_weighing') ...[
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
                            'Data as of today. Exports as a spreadsheet.',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      _buildRecordPreview(),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          if (widget.reportType.formats.contains(ExportFormat.pdf)) ...[
                            Expanded(
                              child: _exportButton(
                                'Export PDF',
                                _exportPdf,
                                Icons.picture_as_pdf_outlined,
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                          Expanded(
                            child: _exportButton(
                              'Export Excel',
                              _exportExcel,
                              Icons.grid_on_outlined,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConsolidationPreview() {
    final matrix = ConsolidationComputationService().computeMatrix(
      widget.reportType.id,
      _currentBarangay,
      year: _period.year,
    );

    final signatory = ReportSignatoryRepository().get(_currentBarangay);
    final sig1 = (signatory?.bnsName.isNotEmpty ?? false)
        ? signatory!.bnsName
        : 'LORNA D. TAPAR/ DAISY J. MALINAO';
    final sig2 = (signatory?.punongBarangayName.isNotEmpty ?? false)
        ? signatory!.punongBarangayName
        : 'FELIX S. NAMBIO JR.';
    final sig3 = (signatory?.mnaoAdminAideName.isNotEmpty ?? false)
        ? signatory!.mnaoAdminAideName
        : 'MA. THERESA F. LAUDIT';
    final sig4 = (signatory?.dnpcName.isNotEmpty ?? false)
        ? signatory!.dnpcName
        : 'MAUREEN F. LEYCO';

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            color: AppColors.textMuted,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          name,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            decoration: TextDecoration.underline,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          position,
          style: const TextStyle(
            fontSize: 9,
            color: AppColors.textMuted,
          ),
        ),
      ],
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
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    final children = childRepo.getByBarangay(_currentBarangay).where((c) => c.isActive).toList();
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
          final totalMonths = (_period.year - child.birthDate.year) * 12 + (m - child.birthDate.month);
          String ageStr = '';
          String wtStr = '';
          String statusStr = '';

          if (totalMonths < 0) {
            ageStr = '';
          } else if (totalMonths > 23) {
            final prevMonths = (_period.year - child.birthDate.year) * 12 + (m - 1 - child.birthDate.month);
            if (prevMonths <= 23) {
              ageStr = 'OA';
            }
          } else {
            ageStr = '$totalMonths';
            final recs = measurements.where((r) => r.date.year == _period.year && r.date.month == m).toList();
            if (recs.isNotEmpty) {
              final r = recs.first;
              wtStr = r.weightKg.toStringAsFixed(1);
              statusStr = _mapWeightStatusCode(r.weightForAgeStatus);
              if (statusStr == 'SUW') suwCount++;
              if (statusStr == 'UW') uwCount++;
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

      final bnsName = signatory?.bnsName.isNotEmpty == true ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';

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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('NO. OF SEVERELY UNDERWEIGHT: $suwCount', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.statRed)),
                    const SizedBox(height: 2),
                    Text('NO. OF UNDERWEIGHT: $uwCount', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.statAmber)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('DATE ACCOMPLISHED: ${_fmtDateOnly(DateTime.now())}', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                    const SizedBox(height: 2),
                    Text('ACCOMPLISHED BY: $bnsName', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
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
                  label: const Text('JAN – JUN (Part 1)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
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
                  label: const Text('JUL – DEC (Part 2)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
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

          // Tables for Boys & Girls
          buildGenderTable('BOYS', boys),
          const SizedBox(height: 16),
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
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    final children = childRepo.getByBarangay(_currentBarangay).where((c) => c.isActive).toList();
    final boys = children.where((c) => c.gender == 'Male').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));
    final girls = children.where((c) => c.gender == 'Female').toList()
      ..sort((a, b) => a.birthDate.compareTo(b.birthDate));

    final bnsName = signatory?.bnsName.isNotEmpty == true ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';

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
            final ageAtWeighing = (rec.date.year - child.birthDate.year) * 12 + (rec.date.month - child.birthDate.month);
            dates.add('${rec.date.month}/${rec.date.day}/${rec.date.year}');
            ages.add(ageAtWeighing > 59 ? 'OA' : '$ageAtWeighing');
            wts.add(rec.weightKg.toStringAsFixed(1));
            statuses.add(_mapWeightStatusCode(rec.weightForAgeStatus));
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
          buildQuarterlySection('BOYS', boys),
          const SizedBox(height: 20),
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
    final sig1 = (signatory?.bnsName.isNotEmpty ?? false) ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';
    final sig2 = (signatory?.punongBarangayName.isNotEmpty ?? false) ? signatory!.punongBarangayName : 'FELIX S. NAMBIO JR.';
    final sig3 = (signatory?.mnaoAdminAideName.isNotEmpty ?? false) ? signatory!.mnaoAdminAideName : 'MA. THERESA F. LAUDIT';
    final sig4 = (signatory?.dnpcName.isNotEmpty ?? false) ? signatory!.dnpcName : 'MAUREEN F. LEYCO';

    return SingleChildScrollView(
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
    );
  }

  Widget _buildGenericRecordPreview() {
    final data = _buildExcelData(widget.reportType.id);
    final signatory = ReportSignatoryRepository().get(_currentBarangay);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
