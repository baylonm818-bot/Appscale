import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/features/reports/services/report_excel_service.dart';

void main() {
  group('ReportExcelService', () {
    test('normalizes non-string cell values before export', () {
      expect(ReportExcelService.normalizeCellValue(null), isEmpty);
      expect(ReportExcelService.normalizeCellValue(42), '42');
      expect(ReportExcelService.normalizeCellValue(true), 'true');
      expect(ReportExcelService.normalizeCellValue(12.5), '12.5');
    });
  });
}
