import 'dart:io';
import 'package:excel/excel.dart' as xls;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/report_signatory.dart';
import 'consolidation_computation_service.dart';
import 'excel_table_data.dart';

/// Builds real .xlsx files on-device, entirely offline.
/// Exact matching layouts for DOH/NNC "0-23 mos." and "24-59 MOS." templates.
class ReportExcelService {
  static String normalizeCellValue(Object? value) {
    if (value == null) return '';
    if (value is String) return value;
    if (value is num || value is bool) return value.toString();
    return value.toString();
  }

  static String _fmtDateOnly(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static String _mapWeightStatusCode(String status) {
    final s = status.toLowerCase();
    if (s.contains('severely underweight') || s == 'suw') return 'SUW';
    if (s.contains('underweight') || s == 'uw') return 'UW';
    if (s.contains('overweight') || s.contains('obese') || s == 'ow') return 'OW';
    if (s.contains('normal') || s == 'n') return 'N';
    return '';
  }

  /// Exports Monthly Record of Weight and Weight Status (0-23 Months) to Excel (Sheet "0-23 mos.")
  Future<void> exportMonthly0to23Excel({
    required String fileTitle,
    required String barangay,
    required String municipality,
    required String province,
    required int year,
    required List<dynamic> boys,
    required List<dynamic> girls,
    required MeasurementRepository measurementRepo,
    required ReportSignatory? signatory,
  }) async {
    final workbook = xls.Excel.createExcel();
    final sheet = workbook['0-23 mos.'];
    workbook.delete('Sheet1');

    int curRow = 0;

    void setCell(int col, int row, String val, {bool bold = false, bool center = false}) {
      final cell = sheet.cell(xls.CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row));
      cell.value = xls.TextCellValue(val);
      if (bold || center) {
        cell.cellStyle = xls.CellStyle(
          bold: bold,
          horizontalAlign: center ? xls.HorizontalAlign.Center : xls.HorizontalAlign.Left,
          verticalAlign: xls.VerticalAlign.Center,
        );
      }
    }

    // Set Column Widths
    sheet.setColumnWidth(0, 26.0); // NAME OF CHILD
    sheet.setColumnWidth(1, 8.0);  // YR
    sheet.setColumnWidth(2, 6.0);  // MO
    sheet.setColumnWidth(3, 6.0);  // DAY
    for (int i = 4; i < 22; i++) {
      sheet.setColumnWidth(i, 11.0);
    }

    // Header Block
    setCell(0, curRow, 'MONTHLY RECORD OF WEIGHT AND WEIGHT STATUS', bold: true, center: true);
    sheet.merge(
      xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow),
      xls.CellIndex.indexByColumnRow(columnIndex: 21, rowIndex: curRow),
    );
    curRow++;

    setCell(0, curRow, 'INFANTS 0-23 MONTHS', bold: true, center: true);
    sheet.merge(
      xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow),
      xls.CellIndex.indexByColumnRow(columnIndex: 21, rowIndex: curRow),
    );
    curRow++;

    setCell(
      0,
      curRow,
      'PROVINCE: ${province.toUpperCase()} | CITY/MUNICIPALITY: ${municipality.toUpperCase()} | BARANGAY: ${barangay.toUpperCase()}',
      bold: true,
      center: true,
    );
    sheet.merge(
      xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow),
      xls.CellIndex.indexByColumnRow(columnIndex: 21, rowIndex: curRow),
    );
    curRow += 2;

    final monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];

    void buildPartTable(int startMonth, int endMonth) {
      // Row 1: Group Headers
      setCell(0, curRow, 'NAME OF CHILD', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow + 1),
      );

      setCell(1, curRow, 'DATE OF BIRTH', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: curRow),
      );

      int col = 4;
      for (int m = startMonth; m <= endMonth; m++) {
        setCell(col, curRow, '${monthNames[m - 1]}, $year', bold: true, center: true);
        sheet.merge(
          xls.CellIndex.indexByColumnRow(columnIndex: col, rowIndex: curRow),
          xls.CellIndex.indexByColumnRow(columnIndex: col + 2, rowIndex: curRow),
        );
        col += 3;
      }
      curRow++;

      // Row 2: Sub-headers (BOYS header)
      setCell(0, curRow, 'BOYS', bold: true);
      setCell(1, curRow, 'YEAR', bold: true, center: true);
      setCell(2, curRow, 'MO.', bold: true, center: true);
      setCell(3, curRow, 'DAY', bold: true, center: true);

      col = 4;
      for (int m = startMonth; m <= endMonth; m++) {
        setCell(col, curRow, 'AGE (MO)', bold: true, center: true);
        setCell(col + 1, curRow, 'WEIGHT (KGS)', bold: true, center: true);
        setCell(col + 2, curRow, 'WEIGHT STATUS', bold: true, center: true);
        col += 3;
      }
      curRow++;

      // Boys Data Rows
      int boysSuw = 0;
      int boysUw = 0;

      for (final child in boys) {
        setCell(0, curRow, child.fullName);
        setCell(1, curRow, '${child.birthDate.year}', center: true);
        setCell(2, curRow, '${child.birthDate.month}', center: true);
        setCell(3, curRow, '${child.birthDate.day}', center: true);

        final measurements = measurementRepo.getForChild(child.id);

        col = 4;
        for (int m = startMonth; m <= endMonth; m++) {
          final totalMonths = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);
          String ageStr = '';
          String wtStr = '';
          String statusStr = '';

          if (totalMonths < 0) {
            ageStr = '';
          } else if (totalMonths > 23) {
            final prevMonths = (year - child.birthDate.year) * 12 + (m - 1 - child.birthDate.month);
            if (prevMonths <= 23) {
              ageStr = 'OA';
            }
          } else {
            ageStr = '$totalMonths';
            final recs = measurements.where((rec) => rec.date.year == year && rec.date.month == m).toList();
            if (recs.isNotEmpty) {
              final r = recs.first;
              wtStr = r.weightKg.toStringAsFixed(1);
              statusStr = _mapWeightStatusCode(r.weightForAgeStatus);
              if (statusStr == 'SUW') boysSuw++;
              if (statusStr == 'UW') boysUw++;
            }
          }

          setCell(col, curRow, ageStr, center: true);
          setCell(col + 1, curRow, wtStr, center: true);
          setCell(col + 2, curRow, statusStr, center: true);
          col += 3;
        }
        curRow++;
      }

      // Boys Footer
      setCell(0, curRow, 'NO. OF SEVERELY UNDERWEIGHT: $boysSuw', bold: true);
      setCell(6, curRow, 'DATE ACCOMPLISHED: ${_fmtDateOnly(DateTime.now())}', bold: true);
      curRow++;
      setCell(0, curRow, 'NO. OF UNDERWEIGHT: $boysUw', bold: true);
      final bnsName = signatory?.bnsName.isNotEmpty == true ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';
      setCell(6, curRow, 'ACCOMPLISHED BY: $bnsName', bold: true);
      curRow += 2;

      // GIRLS Header
      setCell(0, curRow, 'GIRLS', bold: true);
      setCell(1, curRow, 'YEAR', bold: true, center: true);
      setCell(2, curRow, 'MO.', bold: true, center: true);
      setCell(3, curRow, 'DAY', bold: true, center: true);

      col = 4;
      for (int m = startMonth; m <= endMonth; m++) {
        setCell(col, curRow, 'AGE (MO)', bold: true, center: true);
        setCell(col + 1, curRow, 'WEIGHT (KGS)', bold: true, center: true);
        setCell(col + 2, curRow, 'WEIGHT STATUS', bold: true, center: true);
        col += 3;
      }
      curRow++;

      // Girls Data Rows
      int girlsSuw = 0;
      int girlsUw = 0;

      for (final child in girls) {
        setCell(0, curRow, child.fullName);
        setCell(1, curRow, '${child.birthDate.year}', center: true);
        setCell(2, curRow, '${child.birthDate.month}', center: true);
        setCell(3, curRow, '${child.birthDate.day}', center: true);

        final measurements = measurementRepo.getForChild(child.id);

        col = 4;
        for (int m = startMonth; m <= endMonth; m++) {
          final totalMonths = (year - child.birthDate.year) * 12 + (m - child.birthDate.month);
          String ageStr = '';
          String wtStr = '';
          String statusStr = '';

          if (totalMonths < 0) {
            ageStr = '';
          } else if (totalMonths > 23) {
            final prevMonths = (year - child.birthDate.year) * 12 + (m - 1 - child.birthDate.month);
            if (prevMonths <= 23) {
              ageStr = 'OA';
            }
          } else {
            ageStr = '$totalMonths';
            final recs = measurements.where((rec) => rec.date.year == year && rec.date.month == m).toList();
            if (recs.isNotEmpty) {
              final r = recs.first;
              wtStr = r.weightKg.toStringAsFixed(1);
              statusStr = _mapWeightStatusCode(r.weightForAgeStatus);
              if (statusStr == 'SUW') girlsSuw++;
              if (statusStr == 'UW') girlsUw++;
            }
          }

          setCell(col, curRow, ageStr, center: true);
          setCell(col + 1, curRow, wtStr, center: true);
          setCell(col + 2, curRow, statusStr, center: true);
          col += 3;
        }
        curRow++;
      }

      // Girls Footer
      setCell(0, curRow, 'NO. OF SEVERELY UNDERWEIGHT: $girlsSuw', bold: true);
      setCell(6, curRow, 'DATE ACCOMPLISHED: ${_fmtDateOnly(DateTime.now())}', bold: true);
      curRow++;
      setCell(0, curRow, 'NO. OF UNDERWEIGHT: $girlsUw', bold: true);
      setCell(6, curRow, 'ACCOMPLISHED BY: $bnsName', bold: true);
      curRow += 2;
    }

    // Part 1: JAN – JUN
    buildPartTable(1, 6);
    curRow += 1;

    // Part 2: JUL – DEC
    buildPartTable(7, 12);

    // Signatory block
    _appendSignatoryBlock(sheet, curRow, signatory);

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }

  /// Exports Quarterly Full Weighing Record (24-59 Months) to Excel (Sheet "24-59 MOS.")
  Future<void> exportQuarterlyRecord24to59Excel({
    required String fileTitle,
    required String barangay,
    required String municipality,
    required String province,
    required int year,
    required List<dynamic> boys,
    required List<dynamic> girls,
    required MeasurementRepository measurementRepo,
    required ReportSignatory? signatory,
  }) async {
    final workbook = xls.Excel.createExcel();
    final sheet = workbook['24-59 MOS.'];
    workbook.delete('Sheet1');

    int curRow = 0;

    void setCell(int col, int row, String val, {bool bold = false, bool center = false}) {
      final cell = sheet.cell(xls.CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row));
      cell.value = xls.TextCellValue(val);
      if (bold || center) {
        cell.cellStyle = xls.CellStyle(
          bold: bold,
          horizontalAlign: center ? xls.HorizontalAlign.Center : xls.HorizontalAlign.Left,
          verticalAlign: xls.VerticalAlign.Center,
        );
      }
    }

    // Set Column Widths
    sheet.setColumnWidth(0, 24.0); // NAME OF CHILD / BOYS
    sheet.setColumnWidth(1, 24.0); // NAME OF FATHER/MOTHER
    sheet.setColumnWidth(2, 14.0); // DATE OF BIRTH
    for (int i = 3; i < 19; i++) {
      sheet.setColumnWidth(i, 11.0);
    }
    sheet.setColumnWidth(19, 16.0); // REMARKS

    final bnsName = signatory?.bnsName.isNotEmpty == true ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';

    void buildGenderTable(String sectionLabel, List<dynamic> kids) {
      // Header Block (Left & Right)
      setCell(0, curRow, 'BNS FORM NO: 1-A', bold: true);
      curRow++;
      setCell(0, curRow, 'Food and Nutrition Program', bold: true);
      curRow++;
      setCell(0, curRow, 'Revised Boac MNC', bold: true);
      curRow++;
      setCell(0, curRow, 'Date: January 2004', bold: true);
      curRow++;
      setCell(0, curRow, 'QUARTERLY FULL WEIGHING RECORD', bold: true);
      setCell(10, curRow, 'Inclusive date of Weighing: 1ST | 2ND | 3RD | 4TH', bold: true);
      curRow++;
      setCell(0, curRow, '24-59 MOS.', bold: true);
      setCell(10, curRow, 'Total no. of Families Surveyed:', bold: true);
      curRow++;
      setCell(0, curRow, '1. NAME OF BNS: $bnsName', bold: true);
      setCell(10, curRow, 'Total no. of Families with PS:', bold: true);
      curRow++;
      setCell(0, curRow, '2. BARANGAY: ${barangay.toUpperCase()}', bold: true);
      setCell(10, curRow, 'Total no. of Families with/out PS:', bold: true);
      curRow++;
      setCell(0, curRow, '3. MUNICIPALITY: ${municipality.toUpperCase()}', bold: true);
      setCell(10, curRow, 'Total no. of Children Weighed: ${kids.length}', bold: true);
      curRow++;
      setCell(0, curRow, '4. PROVINCE: ${province.toUpperCase()}', bold: true);
      curRow += 2;

      // Table Header Row 1
      setCell(0, curRow, 'NAME OF CHILD / $sectionLabel', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: curRow + 1),
      );

      setCell(1, curRow, 'NAME OF FATHER/MOTHER', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 1, rowIndex: curRow + 1),
      );

      setCell(2, curRow, 'DATE OF BIRTH', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 2, rowIndex: curRow + 1),
      );

      setCell(3, curRow, 'DATE OF WEIGHING', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 3, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 6, rowIndex: curRow),
      );

      setCell(7, curRow, 'AGE IN MOS.', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 7, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 10, rowIndex: curRow),
      );

      setCell(11, curRow, 'WEIGHT IN KLS.', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 11, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 14, rowIndex: curRow),
      );

      setCell(15, curRow, 'NUTRITIONAL STATUS', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 15, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 18, rowIndex: curRow),
      );

      setCell(19, curRow, 'REMARKS', bold: true, center: true);
      sheet.merge(
        xls.CellIndex.indexByColumnRow(columnIndex: 19, rowIndex: curRow),
        xls.CellIndex.indexByColumnRow(columnIndex: 19, rowIndex: curRow + 1),
      );
      curRow++;

      // Table Header Row 2
      final qLabels = ['1ST', '2ND', '3RD', '4TH'];
      for (int i = 0; i < 4; i++) {
        setCell(3 + i, curRow, qLabels[i], bold: true, center: true);
        setCell(7 + i, curRow, qLabels[i], bold: true, center: true);
        setCell(11 + i, curRow, qLabels[i], bold: true, center: true);
        setCell(15 + i, curRow, qLabels[i], bold: true, center: true);
      }
      curRow++;

      // Data Rows
      final qMonths = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12]
      ];

      for (final child in kids) {
        setCell(0, curRow, child.fullName);
        setCell(1, curRow, child.guardian.fullName);
        setCell(2, curRow, '${child.birthDate.month}/${child.birthDate.day}/${child.birthDate.year}', center: true);

        final measurements = measurementRepo.getForChild(child.id);

        for (int q = 0; q < 4; q++) {
          final months = qMonths[q];
          final targetMonth = (q + 1) * 3;
          final qRecs = measurements.where((m) => m.date.year == year && months.contains(m.date.month)).toList();

          String dateStr = '';
          String ageStr = '';
          String wtStr = '';
          String statusStr = '';

          final totalMonths = (year - child.birthDate.year) * 12 + (targetMonth - child.birthDate.month);

          if (qRecs.isNotEmpty) {
            final rec = qRecs.first;
            final ageAtWeighing = Child.monthsBetween(child.birthDate, rec.date);
            dateStr = '${rec.date.month}/${rec.date.day}/${rec.date.year}';
            if (ageAtWeighing > 59) {
              ageStr = 'OA';
            } else {
              ageStr = '$ageAtWeighing';
            }
            wtStr = rec.weightKg.toStringAsFixed(1);
            statusStr = _mapWeightStatusCode(rec.weightForAgeStatus);
          } else {
            if (totalMonths > 59) {
              final prevTargetMonth = q > 0 ? q * 3 : 1;
              final prevMonths = (year - child.birthDate.year) * 12 + (prevTargetMonth - child.birthDate.month);
              if (prevMonths <= 59) {
                ageStr = 'OA';
              }
            } else if (totalMonths >= 24) {
              ageStr = '$totalMonths';
            }
          }

          setCell(3 + q, curRow, dateStr, center: true);
          setCell(7 + q, curRow, ageStr, center: true);
          setCell(11 + q, curRow, wtStr, center: true);
          setCell(15 + q, curRow, statusStr, center: true);
        }

        setCell(19, curRow, ''); // REMARKS
        curRow++;
      }

      curRow += 2;
    }

    buildGenderTable('BOYS', boys);
    buildGenderTable('GIRLS', girls);

    _appendSignatoryBlock(sheet, curRow, signatory);

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }

  void _appendSignatoryBlock(xls.Sheet sheet, int startRow, ReportSignatory? signatory) {
    final sig1 = signatory?.bnsName.isNotEmpty == true ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';
    final sig2 = signatory?.punongBarangayName.isNotEmpty == true ? signatory!.punongBarangayName : 'FELIX S. NAMBIO JR.';
    final sig3 = signatory?.mnaoAdminAideName.isNotEmpty == true ? signatory!.mnaoAdminAideName : 'MA. THERESA F. LAUDIT';
    final sig4 = signatory?.dnpcName.isNotEmpty == true ? signatory!.dnpcName : 'MAUREEN F. LEYCO';

    int r = startRow + 1;

    void setC(int col, int row, String val, {bool bold = false}) {
      final cell = sheet.cell(xls.CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row));
      cell.value = xls.TextCellValue(val);
      if (bold) {
        cell.cellStyle = xls.CellStyle(bold: true);
      }
    }

    setC(0, r, 'SUBMITTED / ACCOMPLISHED BY:', bold: true);
    setC(4, r, 'NOTED BY:', bold: true);
    setC(8, r, 'APPROVED BY:', bold: true);
    r += 2;

    setC(0, r, sig1, bold: true);
    setC(4, r, sig2, bold: true);
    setC(8, r, sig3, bold: true);
    setC(12, r, sig4, bold: true);
    r++;

    setC(0, r, 'BARANGAY NUTRITION SCHOLAR (BNS)');
    setC(4, r, 'PUNONG BARANGAY');
    setC(8, r, 'ADMIN AIDE IV- MNAO OIC');
    setC(12, r, 'DNPC');
  }

  Future<void> exportAndShare({
    required String fileTitle,
    required ExcelTableData data,
    required String metadataLine,
  }) async {
    final workbook = xls.Excel.createExcel();
    final sheet = workbook['Report'];
    workbook.delete('Sheet1');

    sheet.appendRow([xls.TextCellValue(normalizeCellValue(metadataLine))]);
    sheet.appendRow(
      data.headers.map((h) => xls.TextCellValue(normalizeCellValue(h).replaceAll('\n', ' '))).toList(),
    );
    for (final row in data.rows) {
      sheet.appendRow(
        row
            .map((v) => xls.TextCellValue(normalizeCellValue(v)))
            .toList(),
      );
    }

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }

  Future<void> exportIndividualRecordAndShare({
    required String reportTypeId,
    required String fileTitle,
    required String title,
    required String barangay,
    required int year,
    required ExcelTableData data,
    required ReportSignatory? signatory,
    int suwCount = 0,
    int uwCount = 0,
  }) async {
    final workbook = xls.Excel.createExcel();
    String sheetName = '0-23 MOS.';
    if (reportTypeId == 'quarterly_weighing') {
      sheetName = '24-59 MOS.';
    } else if (reportTypeId == 'opt_plus') {
      sheetName = 'OPT PLUS';
    } else if (reportTypeId.contains('masterlist')) {
      sheetName = 'MASTERLIST';
    }

    final sheet = workbook[sheetName];
    workbook.delete('Sheet1');

    sheet.appendRow([xls.TextCellValue('PROVINCE: MARINDUQUE'), xls.TextCellValue(''), xls.TextCellValue('CITY/MUNICIPALITY: GASAN'), xls.TextCellValue(''), xls.TextCellValue('BARANGAY: ${barangay.toUpperCase()}')]);
    sheet.appendRow([xls.TextCellValue(title.toUpperCase())]);
    sheet.appendRow([xls.TextCellValue('YEAR: $year')]);
    sheet.appendRow([]);

    sheet.appendRow(
      data.headers.map((h) => xls.TextCellValue(normalizeCellValue(h).replaceAll('\n', ' '))).toList(),
    );

    for (final row in data.rows) {
      sheet.appendRow(
        row.map((v) => xls.TextCellValue(normalizeCellValue(v))).toList(),
      );
    }

    if (reportTypeId == 'monthly_weight_record') {
      sheet.appendRow([]);
      sheet.appendRow([xls.TextCellValue('NO. OF SEVERELY UNDERWEIGHT: $suwCount')]);
      sheet.appendRow([xls.TextCellValue('NO. OF UNDERWEIGHT: $uwCount')]);
    }

    sheet.appendRow([]);
    sheet.appendRow([]);
    final sig1 = (signatory?.bnsName.isNotEmpty ?? false) ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';
    final sig2 = (signatory?.punongBarangayName.isNotEmpty ?? false) ? signatory!.punongBarangayName : 'FELIX S. NAMBIO JR.';
    final sig3 = (signatory?.mnaoAdminAideName.isNotEmpty ?? false) ? signatory!.mnaoAdminAideName : 'MA. THERESA F. LAUDIT';
    final sig4 = (signatory?.dnpcName.isNotEmpty ?? false) ? signatory!.dnpcName : 'MAUREEN F. LEYCO';

    sheet.appendRow([
      xls.TextCellValue('SUBMITTED / ACCOMPLISHED BY:'), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue('NOTED BY:'), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue('APPROVED BY:')
    ]);
    sheet.appendRow([]);
    sheet.appendRow([
      xls.TextCellValue(sig1), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue(sig2), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue(sig3), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue(sig4)
    ]);
    sheet.appendRow([
      xls.TextCellValue('BARANGAY NUTRITION SCHOLAR (BNS)'), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue('PUNONG BARANGAY'), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue('ADMIN AIDE IV- MNAO OIC'), xls.TextCellValue(''), xls.TextCellValue(''),
      xls.TextCellValue('DNPC')
    ]);

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }

  Future<void> exportConsolidationMatrixAndShare({
    required String fileTitle,
    required ConsolidationMatrixData matrix,
    required ReportSignatory? signatory,
  }) async {
    final workbook = xls.Excel.createExcel();
    String sheetName = 'CONSOLIDATION 0-23';
    if (matrix.reportTypeId == 'consolidation_24_59') {
      sheetName = 'CONSOLIDATION 24-59 MOS.';
    } else if (matrix.reportTypeId == 'stunted_sst') {
      sheetName = 'CONSOLIDATION STUNTED';
    } else if (matrix.reportTypeId == 'wasted_sw') {
      sheetName = 'CONSOLIDATION WASTED';
    } else if (matrix.reportTypeId == 'uw_suw') {
      sheetName = 'CONSOLIDATION UNDERWEIGHT';
    }
    final sheet = workbook[sheetName];
    workbook.delete('Sheet1');

    sheet.appendRow([xls.TextCellValue('CONSOLIDATION')]);
    final titleRow2 = matrix.reportTypeId == 'consolidation_0_23'
        ? '0 - 23 months'
        : matrix.title;
    sheet.appendRow([xls.TextCellValue(titleRow2)]);
    sheet.appendRow([]);
    sheet.appendRow([xls.TextCellValue('BARANGAY: ${matrix.barangay.toUpperCase()}')]);

    final mainHeaderRow = <xls.CellValue>[xls.TextCellValue('NUTRITIONAL STATUS')];
    if (matrix.reportTypeId == 'consolidation_24_59') {
      mainHeaderRow.addAll([
        xls.TextCellValue('BOYS'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('GIRLS'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('TOTAL'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
      ]);
    } else {
      for (final m in matrix.mainHeaders) {
        mainHeaderRow.add(xls.TextCellValue(m));
        mainHeaderRow.add(xls.TextCellValue(''));
      }
    }
    sheet.appendRow(mainHeaderRow);

    final subHeaderRow = <xls.CellValue>[xls.TextCellValue('')];
    for (final sh in matrix.subHeaders) {
      subHeaderRow.add(xls.TextCellValue(sh));
    }
    sheet.appendRow(subHeaderRow);

    for (final r in matrix.rows) {
      final rowCells = <xls.CellValue>[xls.TextCellValue(r.label)];
      for (final val in r.values) {
        rowCells.add(xls.IntCellValue(val));
      }
      sheet.appendRow(rowCells);
    }

    _appendSignatoryBlock(sheet, matrix.rows.length + 5, signatory);

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }
}
