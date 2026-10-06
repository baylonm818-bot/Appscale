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

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

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
      int no = 1;
      final rows = children.map((c) => [
        '${no++}',
        c.fullName,
        c.gender,
        _fmtDate(c.birthDate),
        '${c.ageInMonths}',
        c.guardian.fullName.isNotEmpty ? c.guardian.fullName : '—',
        c.address.isNotEmpty ? c.address : 'Purok 1',
        c.nutritionStatus,
      ]).toList();

      await ReportPdfService().exportChildrenMasterlistPdf(
        fileTitle: 'children_masterlist_${_period.year}_$_currentBarangay',
        barangay: _currentBarangay,
        year: _period.year,
        rows: rows,
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
    final data = _buildExcelData(widget.reportType.id);
    await ReportExcelService().exportAndShare(
      fileTitle: '${widget.reportType.id}_$_currentBarangay',
      data: data,
      metadataLine:
          '${widget.reportType.title} · Barangay: $_currentBarangay · Generated: ${DateTime.now().toString().split(' ').first}',
    );
    if (mounted) setState(() => _isExporting = false);
  }

  ExcelTableData _buildExcelData(String reportTypeId) {
    final childRepo = ChildRepository();
    final measurementRepo = MeasurementRepository();

    if (reportTypeId == 'monthly_weight_record') {
      final children = childRepo
          .getByBarangay(_currentBarangay)
          .where((c) => c.isActive && c.ageInMonths < 24)
          .toList();

      final monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                          'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      // Build header: NAME | AGE | DOB | then each month x3 (WT, HT, STATUS)
      final headers = <String>[
        'NAME OF CHILD', 'AGE\n(MO)', 'DATE OF\nBIRTH',
        ...monthNames.expand((m) => ['$m\nWT(kg)', '$m\nHT(cm)', '$m\nSTATUS']),
      ];

      List<List<String>> buildSection(List<dynamic> kids) {
        final rows = <List<String>>[];
        for (final c in kids) {
          final measurements = measurementRepo.getForChild(c.id);
          final row = <String>[
            c.fullName,
            '${c.ageInMonths}',
            _fmtDate(c.birthDate),
          ];
          for (int mo = 1; mo <= 12; mo++) {
            final rec = measurements.where(
              (m) => m.date.month == mo && m.date.year == _period.year,
            ).toList();
            if (rec.isNotEmpty) {
              row.add(rec.first.weightKg.toStringAsFixed(1));
              row.add(rec.first.heightCm.toStringAsFixed(1));
              row.add(rec.first.bmiStatus);
            } else {
              row.addAll(['', '', '']);
            }
          }
          rows.add(row);
        }
        return rows;
      }

      final boys = children.where((c) => c.gender == 'Male').toList();
      final girls = children.where((c) => c.gender == 'Female').toList();

      final allRows = <List<String>>[
        // MALE section header
        List.filled(headers.length, 'MALE'),
        ...buildSection(boys),
        // FEMALE section header
        List.filled(headers.length, 'FEMALE'),
        ...buildSection(girls),
      ];

      return ExcelTableData(headers: headers, rows: allRows);
    }


    if (reportTypeId == 'quarterly_weighing') {
      final children = childRepo
          .getByBarangay(_currentBarangay)
          .where((c) => c.isActive && c.ageInMonths >= 24 && c.ageInMonths < 60)
          .toList();

      // Quarter month ranges: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
      final qMonths = [
        [1, 2, 3],   // Q1
        [4, 5, 6],   // Q2
        [7, 8, 9],   // Q3
        [10, 11, 12] // Q4
      ];

      final headers = <String>[
        'NAME OF CHILD',
        'NAME OF FATHER',
        'DATE OF BIRTH\n(Day)',
        'DATE OF BIRTH\n(Month)',
        'DATE OF BIRTH\n(Year)',
        // 4 quarters × 4 columns each
        '1ST QTR\nDATE',   '1ST QTR\nAGE(MO)', '1ST QTR\nWT(KG)', '1ST QTR\nSTATUS',
        '2ND QTR\nDATE',   '2ND QTR\nAGE(MO)', '2ND QTR\nWT(KG)', '2ND QTR\nSTATUS',
        '3RD QTR\nDATE',   '3RD QTR\nAGE(MO)', '3RD QTR\nWT(KG)', '3RD QTR\nSTATUS',
        '4TH QTR\nDATE',   '4TH QTR\nAGE(MO)', '4TH QTR\nWT(KG)', '4TH QTR\nSTATUS',
        'REMARKS',
      ];

      List<List<String>> buildSection(List<dynamic> kids) {
        return kids.map((c) {
          final measurements = measurementRepo.getForChild(c.id);
          final row = <String>[
            c.fullName,
            c.guardian.fullName,
            '${c.birthDate.day}',
            '${c.birthDate.month}',
            '${c.birthDate.year}',
          ];
          for (final months in qMonths) {
            final qRec = measurements.where((m) => months.contains(m.date.month)).toList();
            if (qRec.isNotEmpty) {
              final rec = qRec.first;
              final ageAtWeighing = (rec.date.year - c.birthDate.year) * 12
                  + (rec.date.month - c.birthDate.month);
              row.add(_fmtDate(rec.date));
              row.add('$ageAtWeighing');
              row.add(rec.weightKg.toStringAsFixed(1));
              row.add(rec.weightForAgeStatus);
            } else {
              row.addAll(['', '', '', '']);
            }
          }
          row.add(''); // REMARKS — blank, to be filled manually
          return row;
        }).toList();
      }

      final boys = children.where((c) => c.gender == 'Male').toList();
      final girls = children.where((c) => c.gender == 'Female').toList();

      final allRows = <List<String>>[
        List.filled(headers.length, 'BOYS'),
        ...buildSection(boys),
        List.filled(headers.length, 'GIRLS'),
        ...buildSection(girls),
      ];

      return ExcelTableData(headers: headers, rows: allRows);
    }

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
          _fmtDate(c.birthDate),
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
          'Seq No',
          'Name',
          'Sex',
          'DOB',
          'Age (mo)',
          'IP Group',
          'Disability',
          'Weight (kg)',
          'Height (cm)',
          'MUAC (cm)',
          'Edema',
          'Weight Status',
          'Height Status',
          'Wasting Status',
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
              '${no++}',
              c.fullName,
              c.gender,
              _fmtDate(c.birthDate),
              '${c.ageInMonths}',
              c.address.isNotEmpty ? c.address : 'Purok 1',
              c.guardian.fullName,
              c.guardian.contactNo,
              c.nutritionStatus,
              c.isActive ? 'Active' : 'Inactive',
            ],
          )
          .toList();
      return ExcelTableData(
        headers: [
          'NO.',
          'NAME OF CHILD',
          'SEX',
          'BIRTHDAY',
          'AGE (MO)',
          'ADDRESS',
          'GUARDIAN NAME',
          'GUARDIAN CONTACT',
          'NUTRITIONAL STATUS',
          'STATUS',
        ],
        rows: rows,
      );
    }

    // lactating_mothers_masterlist
    final mothers = MotherRepository()
        .getAll()
        .where((m) => m.barangay == _currentBarangay && m.isActive)
        .toList();
    int no = 1;
    final rows = mothers
        .map(
          (m) => [
            '${no++}',
            m.fullName,
            '${m.age}',
            m.address.isNotEmpty ? m.address : 'Purok 1',
            m.contactNo,
            m.breastfeedingPractice.isNotEmpty ? m.breastfeedingPractice : 'Lactating',
          ],
        )
        .toList();
    return ExcelTableData(
      headers: [
        'NO.',
        'NAME OF LACTATING MOTHER',
        'AGE',
        'ADDRESS',
        'CONTACT',
        'STATUS',
      ],
      rows: rows,
    );
  }

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

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
                                style: AppTextStyles.label.copyWith(
                                  fontSize: 13,
                                ),
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
                      if (widget.reportType.id == 'monthly_weight_record') ...[
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
                  decoration: BoxDecoration(color: AppColors.background),
                  children: mainHeaderCells,
                ),
                TableRow(
                  decoration: BoxDecoration(color: AppColors.background),
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
    final data = _buildExcelData(widget.reportType.id);
    final previewRows = data.rows.take(10).toList();

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
                  'Record Preview (${data.rows.length} Total)',
                  style: AppTextStyles.label.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Barangay $_currentBarangay',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkGreen,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              border: TableBorder.all(
                color: AppColors.border.withValues(alpha: 0.6),
                width: 0.5,
              ),
              children: [
                // Table Header
                TableRow(
                  decoration: const BoxDecoration(
                    color: AppColors.darkGreen,
                  ),
                  children: data.headers
                      .map(
                        (h) => Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          child: Text(
                            h.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                // Table Data Rows
                ...previewRows.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final row = entry.value;
                  final isEven = idx % 2 == 0;
                  return TableRow(
                    decoration: BoxDecoration(
                      color: isEven
                          ? Colors.white
                          : AppColors.background.withValues(alpha: 0.5),
                    ),
                    children: row
                        .map(
                          (val) => Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 7,
                            ),
                            child: Text(
                              val.toString(),
                              style: AppTextStyles.body.copyWith(
                                fontSize: 11,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
                }),
              ],
            ),
          ),
          if (data.rows.length > 10)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                '+ ${data.rows.length - 10} more records in the exported file',
                style: AppTextStyles.caption.copyWith(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: AppColors.textMuted,
                ),
              ),
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
