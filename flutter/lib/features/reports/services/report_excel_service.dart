import 'dart:io';
import 'package:excel/excel.dart' as xls;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../data/models/report_signatory.dart';
import 'consolidation_computation_service.dart';
import 'excel_table_data.dart';

/// Builds real .xlsx files on-device, entirely offline.
/// Supports both data export spreadsheets and official 12-Month / Quarterly
/// consolidation form layouts with complete 4-signatory blocks.
class ReportExcelService {
  static String normalizeCellValue(Object? value) {
    if (value == null) return '';
    if (value is String) return value;
    if (value is num || value is bool) return value.toString();
    return value.toString();
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

    // Official Form Header Block
    sheet.appendRow([xls.TextCellValue('PROVINCE: MARINDUQUE'), xls.TextCellValue(''), xls.TextCellValue('CITY/MUNICIPALITY: GASAN'), xls.TextCellValue(''), xls.TextCellValue('BARANGAY: ${barangay.toUpperCase()}')]);
    sheet.appendRow([xls.TextCellValue(title.toUpperCase())]);
    sheet.appendRow([xls.TextCellValue('YEAR: $year')]);
    sheet.appendRow([]);

    // Table Headers
    sheet.appendRow(
      data.headers.map((h) => xls.TextCellValue(normalizeCellValue(h).replaceAll('\n', ' '))).toList(),
    );

    // Data Rows
    for (final row in data.rows) {
      sheet.appendRow(
        row.map((v) => xls.TextCellValue(normalizeCellValue(v))).toList(),
      );
    }

    // Summary counts for 0-23 Months Monthly Weight Record
    if (reportTypeId == 'monthly_weight_record') {
      sheet.appendRow([]);
      sheet.appendRow([xls.TextCellValue('NO. OF SEVERELY UNDERWEIGHT: $suwCount')]);
      sheet.appendRow([xls.TextCellValue('NO. OF UNDERWEIGHT: $uwCount')]);
    }

    // Signatory Block
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

    // Title Block
    sheet.appendRow([xls.TextCellValue('CONSOLIDATION')]);
    final titleRow2 = matrix.reportTypeId == 'consolidation_0_23'
        ? '0 - 23 months'
        : matrix.title;
    sheet.appendRow([xls.TextCellValue(titleRow2)]);
    sheet.appendRow([]);
    sheet.appendRow([xls.TextCellValue('BARANGAY: ${matrix.barangay.toUpperCase()}')]);

    // Main Header row
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

    // Sub Header row
    final subHeaderRow = <xls.CellValue>[xls.TextCellValue('')];
    for (final sh in matrix.subHeaders) {
      subHeaderRow.add(xls.TextCellValue(sh));
    }
    sheet.appendRow(subHeaderRow);

    // Metric Rows
    for (final r in matrix.rows) {
      final rowCells = <xls.CellValue>[xls.TextCellValue(r.label)];
      for (final val in r.values) {
        rowCells.add(xls.IntCellValue(val));
      }
      sheet.appendRow(rowCells);
    }

    // Signatory Block
    sheet.appendRow([]);
    sheet.appendRow([]);
    final sig1 = (signatory?.bnsName.isNotEmpty ?? false) ? signatory!.bnsName : 'LORNA D. TAPAR/ DAISY J. MALINAO';
    final sig2 = (signatory?.punongBarangayName.isNotEmpty ?? false) ? signatory!.punongBarangayName : 'FELIX S. NAMBIO JR.';
    final sig3 = (signatory?.mnaoAdminAideName.isNotEmpty ?? false) ? signatory!.mnaoAdminAideName : 'MA. THERESA F. LAUDIT';
    final sig4 = (signatory?.dnpcName.isNotEmpty ?? false) ? signatory!.dnpcName : 'MAUREEN F. LEYCO';

    if (matrix.reportTypeId == 'consolidation_24_59') {
      sheet.appendRow([
        xls.TextCellValue('SUBMITTED BY:'), xls.TextCellValue(''),
        xls.TextCellValue('NOTED BY:'), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('APPROVED BY:')
      ]);
      sheet.appendRow([]);
      sheet.appendRow([
        xls.TextCellValue(sig1), xls.TextCellValue(''),
        xls.TextCellValue(sig2), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue(sig3), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue(sig4)
      ]);
      sheet.appendRow([
        xls.TextCellValue('BNS'), xls.TextCellValue(''),
        xls.TextCellValue('PUNONG BARANGAY'), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('ADMIN AIDE IV- MNAO OIC'), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('DNPC')
      ]);
    } else {
      sheet.appendRow([
        xls.TextCellValue('SUBMITTED BY:'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('NOTED BY:'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('APPROVED BY:')
      ]);
      sheet.appendRow([]);
      sheet.appendRow([
        xls.TextCellValue(sig1), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue(sig2), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue(sig3), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue(sig4)
      ]);
      sheet.appendRow([
        xls.TextCellValue('BNS'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('PUNONG BARANGAY'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('ADMIN AIDE IV- MNAO OIC'), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''), xls.TextCellValue(''),
        xls.TextCellValue('DNPC')
      ]);
    }

    final bytes = workbook.encode();
    if (bytes == null) return;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileTitle.xlsx');
    await file.writeAsBytes(bytes);

    await Share.shareXFiles([XFile(file.path)], text: fileTitle);
  }
}
