import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/report_signatory.dart';
import '../../../data/growth_standards/growth_classifier.dart';
import '../../../shared/utils/barangay_assets.dart';
import 'consolidation_computation_service.dart';

/// Builds the consolidation report as a real PDF.
/// Supports both single-period summary and official multi-month / quarterly
/// matrix tables matching DOH/NNC form standards.
class ReportPdfService {
  Future<File> _savePdfToDocuments({
    required String fileTitle,
    required Uint8List bytes,
  }) async {
    final docsDir = await getApplicationDocumentsDirectory();
    final reportsDir = Directory('${docsDir.path}/reports');
    if (!reportsDir.existsSync()) {
      reportsDir.createSync(recursive: true);
    }
    final cleanTitle = fileTitle.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    final file = File('${reportsDir.path}/$cleanTitle.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  Future<File> exportAndShare({
    required String fileTitle,
    required String title,
    required String barangay,
    required String period,
    required Map<String, int> newCounts,
    required Map<String, int>? oldCounts,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(20 * PdfPageFormat.mm),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(
                'CONSOLIDATION',
                style: pw.TextStyle(
                  fontSize: 14,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
            ),
            pw.Center(
              child: pw.Text(title, style: const pw.TextStyle(fontSize: 11)),
            ),
            pw.SizedBox(height: 6),
            pw.Text(
              'Barangay: $barangay',
              style: const pw.TextStyle(fontSize: 10),
            ),
            pw.Text('Period: $period', style: const pw.TextStyle(fontSize: 10)),
            pw.SizedBox(height: 16),
            _buildTable(newCounts, oldCounts),
            pw.SizedBox(height: 28),
            if (signatory != null) _buildSignatureBlock(signatory),
          ],
        ),
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  Future<File> exportMatrixAndShare({
    required String fileTitle,
    required ConsolidationMatrixData matrix,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.symmetric(horizontal: 16 * PdfPageFormat.mm, vertical: 20 * PdfPageFormat.mm),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(
                'CONSOLIDATION',
                style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
              ),
            ),
            pw.Center(
              child: pw.Text(matrix.title, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 4),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('BARANGAY: ${matrix.barangay.toUpperCase()}', style: const pw.TextStyle(fontSize: 9)),
                pw.Text('YEAR: ${matrix.year}', style: const pw.TextStyle(fontSize: 9)),
              ],
            ),
            pw.SizedBox(height: 10),
            _buildMatrixTable(matrix),
            pw.SizedBox(height: 20),
            _buildFourSignatoryBlock(signatory),
          ],
        ),
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  Future<File> exportTableAndShare({
    required String fileTitle,
    required String title,
    required String barangay,
    required List<String> headers,
    required List<List<String>> rows,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();
    final bns = (signatory?.bnsName.isNotEmpty ?? false) ? signatory!.bnsName : '';
    final pb = (signatory?.punongBarangayName.isNotEmpty ?? false) ? signatory!.punongBarangayName : '';
    final bnsPos = (signatory?.bnsPosition.isNotEmpty ?? false) ? signatory!.bnsPosition : 'BARANGAY NUTRITION SCHOLAR';
    final pbPos = (signatory?.punongBarangayPosition.isNotEmpty ?? false) ? signatory!.punongBarangayPosition : 'PUNONG BARANGAY';

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.symmetric(horizontal: 18 * PdfPageFormat.mm, vertical: 20 * PdfPageFormat.mm),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(
                title.toUpperCase(),
                style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
              ),
            ),
            pw.SizedBox(height: 4),
            pw.Text('BARANGAY: ${barangay.toUpperCase()}', style: const pw.TextStyle(fontSize: 9)),
            pw.SizedBox(height: 10),
            pw.TableHelper.fromTextArray(
              headers: headers,
              data: rows,
              headerCount: 1,
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, lineSpacing: 1.35),
              cellStyle: const pw.TextStyle(fontSize: 7.5, lineSpacing: 1.35),
              headerPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
              cellAlignment: pw.Alignment.centerLeft,
              border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
            ),
            pw.SizedBox(height: 20),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                _sigCol('PREPARED BY:', bns, bnsPos),
                _sigCol('NOTED BY:', pb, pbPos),
              ],
            ),
          ],
        ),
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  /// Exports Lactating Mothers Masterlist as a simple portrait A4 numbered list,
  /// matching the official MASTERLIST OF LACTATING MOTHER form.
  Future<File> exportLactatingMasterlistPdf({
    required String fileTitle,
    required String barangay,
    required int year,
    required List<String> names,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();
    final bns = (signatory?.bnsName.isNotEmpty ?? false)
        ? signatory!.bnsName
        : '';
    final pb = (signatory?.punongBarangayName.isNotEmpty ?? false)
        ? signatory!.punongBarangayName
        : '';
    final pbPosition = (signatory?.punongBarangayPosition.isNotEmpty ?? false)
        ? signatory!.punongBarangayPosition
        : 'Punong Barangay';
    final bnsPosition = (signatory?.bnsPosition.isNotEmpty ?? false)
        ? signatory!.bnsPosition
        : 'Barangay Nutrition Scholar';

    final bagongPilipinas = await _loadAssetImage('assets/images/logos/bagong_pilipinas.png');
    final nnc = await _loadAssetImage('assets/images/logos/nnc.png');
    final gasanSeal = await _loadAssetImage('assets/images/logos/gasan_seal.png');
    final barangaySeal = await _loadBarangayImage(barangay, signatory);
    final nutritionLogo = await _loadAssetImage('assets/images/logos/nutrition_logo.png');

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 48, vertical: 40),
        build: (context) => [
          // Header border top
          pw.Container(
            decoration: const pw.BoxDecoration(
              border: pw.Border(top: pw.BorderSide(width: 2)),
            ),
            child: pw.SizedBox(height: 4),
          ),
          pw.SizedBox(height: 8),

          // 5 official logos row: Bagong Pilipinas, NNC, Gasan, Barangay seal, Nutrition logo
          _buildHeaderLogos(
            barangay: barangay,
            bagongPilipinas: bagongPilipinas,
            nnc: nnc,
            gasanSeal: gasanSeal,
            barangaySeal: barangaySeal,
            nutritionLogo: nutritionLogo,
          ),
          pw.SizedBox(height: 16),

          // Title
          pw.Center(
            child: pw.Text(
              'MASTERLIST OF LACTATING MOTHER $year',
              style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
          ),
          pw.SizedBox(height: 16),

          // Numbered list of names (centered, 2 columns if many)
          ...names.asMap().entries.map((e) => pw.Center(
            child: pw.Text(
              '${e.key + 1}. ${e.value}',
              style: const pw.TextStyle(fontSize: 11),
              textAlign: pw.TextAlign.center,
            ),
          )),

          pw.SizedBox(height: 32),

          // Signatory block
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Prepared by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 210),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Prepared by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 24),
                    pw.Container(
                      width: 175,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(bottom: 2),
                      child: pw.Text(
                        bns.isNotEmpty ? bns.toUpperCase() : '',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          decoration: pw.TextDecoration.underline,
                          lineSpacing: 1.35,
                        ),
                        textAlign: pw.TextAlign.center,
                        maxLines: 1,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                    pw.Text(bnsPosition, style: const pw.TextStyle(fontSize: 9, lineSpacing: 1.3)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
              // Noted by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 210),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Noted by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 24),
                    pw.Container(
                      width: 175,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(bottom: 2),
                      child: pw.Text(
                        pb.isNotEmpty ? pb.toUpperCase() : '',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          decoration: pw.TextDecoration.underline,
                          lineSpacing: 1.35,
                        ),
                        textAlign: pw.TextAlign.center,
                        maxLines: 1,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                    pw.Text(pbPosition, style: const pw.TextStyle(fontSize: 9, lineSpacing: 1.3)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  /// Exports Children Masterlist as a simple portrait A4 numbered list,
  /// matching the official masterlist form format.
  Future<File> exportChildrenMasterlistPdf({
    required String fileTitle,
    required String barangay,
    required int year,
    required List<String> names,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();
    final bns = (signatory?.bnsName.isNotEmpty ?? false)
        ? signatory!.bnsName
        : '';
    final pb = (signatory?.punongBarangayName.isNotEmpty ?? false)
        ? signatory!.punongBarangayName
        : '';
    final pbPosition = (signatory?.punongBarangayPosition.isNotEmpty ?? false)
        ? signatory!.punongBarangayPosition
        : 'Punong Barangay';
    final bnsPosition = (signatory?.bnsPosition.isNotEmpty ?? false)
        ? signatory!.bnsPosition
        : 'Barangay Nutrition Scholar';

    final bagongPilipinas = await _loadAssetImage('assets/images/logos/bagong_pilipinas.png');
    final nnc = await _loadAssetImage('assets/images/logos/nnc.png');
    final gasanSeal = await _loadAssetImage('assets/images/logos/gasan_seal.png');
    final barangaySeal = await _loadBarangayImage(barangay, signatory);
    final nutritionLogo = await _loadAssetImage('assets/images/logos/nutrition_logo.png');

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 48, vertical: 40),
        build: (context) => [
          // Header border top
          pw.Container(
            decoration: const pw.BoxDecoration(
              border: pw.Border(top: pw.BorderSide(width: 2)),
            ),
            child: pw.SizedBox(height: 4),
          ),
          pw.SizedBox(height: 8),

          // 5 official logos row: Bagong Pilipinas, NNC, Gasan, Barangay seal, Nutrition logo
          _buildHeaderLogos(
            barangay: barangay,
            bagongPilipinas: bagongPilipinas,
            nnc: nnc,
            gasanSeal: gasanSeal,
            barangaySeal: barangaySeal,
            nutritionLogo: nutritionLogo,
          ),
          pw.SizedBox(height: 16),

          // Title
          pw.Center(
            child: pw.Text(
              'CHILDREN MASTERLIST $year',
              style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
          ),
          pw.SizedBox(height: 16),

          // Numbered list of names (centered)
          ...names.asMap().entries.map((e) => pw.Center(
            child: pw.Text(
              '${e.key + 1}. ${e.value}',
              style: const pw.TextStyle(fontSize: 11),
              textAlign: pw.TextAlign.center,
            ),
          )),

          pw.SizedBox(height: 32),

          // Signatory block
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Prepared by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 210),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Prepared by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 24),
                    pw.Container(
                      width: 175,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(bottom: 2),
                      child: pw.Text(
                        bns.isNotEmpty ? bns.toUpperCase() : '',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          decoration: pw.TextDecoration.underline,
                          lineSpacing: 1.35,
                        ),
                        textAlign: pw.TextAlign.center,
                        maxLines: 1,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                    pw.Text(bnsPosition, style: const pw.TextStyle(fontSize: 9, lineSpacing: 1.3)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
              // Noted by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 210),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Noted by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 24),
                    pw.Container(
                      width: 175,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(bottom: 2),
                      child: pw.Text(
                        pb.isNotEmpty ? pb.toUpperCase() : '',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          decoration: pw.TextDecoration.underline,
                          lineSpacing: 1.35,
                        ),
                        textAlign: pw.TextAlign.center,
                        maxLines: 1,
                      ),
                    ),
                    pw.SizedBox(height: 3),
                    pw.Text(pbPosition, style: const pw.TextStyle(fontSize: 9, lineSpacing: 1.3)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  Future<pw.MemoryImage?> _loadAssetImage(String assetPath) async {
    try {
      final byteData = await rootBundle.load(assetPath);
      return pw.MemoryImage(byteData.buffer.asUint8List());
    } catch (_) {
      return null;
    }
  }

  Future<pw.MemoryImage?> _loadBarangayImage(String barangay, ReportSignatory? signatory) async {
    final customPath = signatory?.barangayLogoPath ?? '';
    if (customPath.isNotEmpty) {
      try {
        final file = File(customPath);
        if (file.existsSync()) {
          final bytes = await file.readAsBytes();
          return pw.MemoryImage(bytes);
        }
      } catch (_) {}
    }
    final assetPath = getBarangaySealAssetPath(barangay);
    return _loadAssetImage(assetPath);
  }

  pw.Widget _buildHeaderLogos({
    required String barangay,
    required pw.MemoryImage? bagongPilipinas,
    required pw.MemoryImage? nnc,
    required pw.MemoryImage? gasanSeal,
    required pw.MemoryImage? barangaySeal,
    required pw.MemoryImage? nutritionLogo,
  }) {
    return pw.Center(
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          _renderLogo(bagongPilipinas, 'BAGONG\nPILIPINAS', PdfColors.red800),
          pw.SizedBox(width: 8),
          _renderLogo(nnc, 'NNC', PdfColors.green800),
          pw.SizedBox(width: 8),
          _renderLogo(gasanSeal, 'GASAN', PdfColors.blue800),
          pw.SizedBox(width: 8),
          _renderLogo(barangaySeal, 'BARANGAY\n${barangay.toUpperCase()}', PdfColors.teal800),
          pw.SizedBox(width: 8),
          _renderLogo(nutritionLogo, 'BNS', PdfColors.green700),
        ],
      ),
    );
  }

  pw.Widget _renderLogo(pw.MemoryImage? image, String fallbackLabel, PdfColor fallbackColor) {
    if (image != null) {
      return pw.Container(
        width: 46,
        height: 46,
        decoration: const pw.BoxDecoration(
          shape: pw.BoxShape.circle,
          color: PdfColors.white,
        ),
        child: pw.Image(image, fit: pw.BoxFit.contain, width: 46, height: 46),
      );
    }
    return _logoPlaceholder(fallbackLabel, fallbackColor);
  }

  pw.Widget _logoPlaceholder(String label, [PdfColor color = PdfColors.grey600]) {
    return pw.Container(
      width: 46,
      height: 46,
      decoration: pw.BoxDecoration(
        shape: pw.BoxShape.circle,
        color: color,
        border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
      ),
      alignment: pw.Alignment.center,
      child: pw.Text(
        label,
        style: pw.TextStyle(fontSize: 5, color: PdfColors.white, fontWeight: pw.FontWeight.bold),
        textAlign: pw.TextAlign.center,
      ),
    );
  }



  pw.Widget _buildMatrixTable(ConsolidationMatrixData matrix) {
    final is2459 = matrix.reportTypeId == 'consolidation_24_59';

    final headerRows = <pw.TableRow>[];

    final mainHeaderCells = <pw.Widget>[
      pw.Padding(
        padding: const pw.EdgeInsets.all(3),
        child: pw.Text('NUTRITIONAL STATUS', style: pw.TextStyle(fontSize: 6.5, fontWeight: pw.FontWeight.bold)),
      ),
    ];

    if (is2459) {
      for (final mh in matrix.mainHeaders) {
        mainHeaderCells.add(
          pw.Padding(
            padding: const pw.EdgeInsets.all(3),
            child: pw.Text(mh, textAlign: pw.TextAlign.center, style: pw.TextStyle(fontSize: 6.5, fontWeight: pw.FontWeight.bold)),
          ),
        );
        mainHeaderCells.add(pw.SizedBox());
        mainHeaderCells.add(pw.SizedBox());
        mainHeaderCells.add(pw.SizedBox());
      }
    } else {
      for (final mh in matrix.mainHeaders) {
        mainHeaderCells.add(
          pw.Padding(
            padding: const pw.EdgeInsets.all(3),
            child: pw.Text(mh, textAlign: pw.TextAlign.center, style: pw.TextStyle(fontSize: 6, fontWeight: pw.FontWeight.bold)),
          ),
        );
        mainHeaderCells.add(pw.SizedBox());
      }
    }

    headerRows.add(
      pw.TableRow(
        decoration: const pw.BoxDecoration(color: PdfColors.grey200),
        children: mainHeaderCells,
      ),
    );

    final subHeaderCells = <pw.Widget>[
      pw.Padding(
        padding: const pw.EdgeInsets.all(3),
        child: pw.Text('', style: pw.TextStyle(fontSize: 6.5, fontWeight: pw.FontWeight.bold)),
      ),
      ...matrix.subHeaders.map(
        (h) => pw.Padding(
          padding: const pw.EdgeInsets.all(2),
          child: pw.Text(h, textAlign: pw.TextAlign.center, style: pw.TextStyle(fontSize: 5.5, fontWeight: pw.FontWeight.bold)),
        ),
      ),
    ];

    headerRows.add(
      pw.TableRow(
        decoration: const pw.BoxDecoration(color: PdfColors.grey200),
        children: subHeaderCells,
      ),
    );

    final dataRows = matrix.rows.map((r) {
      final isBoldRow = r.label.contains('TOTAL');
      return pw.TableRow(
        decoration: isBoldRow ? const pw.BoxDecoration(color: PdfColors.grey100) : null,
        children: [
          pw.Padding(
            padding: const pw.EdgeInsets.all(3),
            child: pw.Text(
              r.label,
              style: pw.TextStyle(fontSize: 6.5, fontWeight: isBoldRow ? pw.FontWeight.bold : pw.FontWeight.normal),
            ),
          ),
          ...r.values.map(
            (v) => pw.Padding(
              padding: const pw.EdgeInsets.all(2),
              child: pw.Text(
                v.toString(),
                textAlign: pw.TextAlign.center,
                style: pw.TextStyle(fontSize: 6.5, fontWeight: isBoldRow ? pw.FontWeight.bold : pw.FontWeight.normal),
              ),
            ),
          ),
        ],
      );
    }).toList();

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
      children: [...headerRows, ...dataRows],
    );
  }

  pw.Widget _buildFourSignatoryBlock(ReportSignatory? s) {
    final bns = (s?.bnsName.isNotEmpty ?? false) ? s!.bnsName : '';
    final pb = (s?.punongBarangayName.isNotEmpty ?? false) ? s!.punongBarangayName : '';
    final mnao = (s?.mnaoAdminAideName.isNotEmpty ?? false) ? s!.mnaoAdminAideName : '';
    final dnpc = (s?.dnpcName.isNotEmpty ?? false) ? s!.dnpcName : '';

    final bnsPos = (s?.bnsPosition.isNotEmpty ?? false) ? s!.bnsPosition : 'BNS';
    final pbPos = (s?.punongBarangayPosition.isNotEmpty ?? false) ? s!.punongBarangayPosition : 'PUNONG BARANGAY';
    final mnaoPos = (s?.mnaoAdminAidePosition.isNotEmpty ?? false) ? s!.mnaoAdminAidePosition : 'ADMIN AIDE IV- MNAO OIC';
    final dnpcPos = (s?.dnpcPosition.isNotEmpty ?? false) ? s!.dnpcPosition : 'DNPC';

    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _sigCol('SUBMITTED BY:', bns, bnsPos),
        _sigCol('NOTED BY:', pb, pbPos),
        _sigCol('APPROVED BY:', mnao, mnaoPos),
        _sigCol('APPROVED BY:', dnpc, dnpcPos),
      ],
    );
  }

  pw.Widget _sigCol(String title, String name, String role) {
    return pw.ConstrainedBox(
      constraints: const pw.BoxConstraints(maxWidth: 160),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(title, style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 20),
          pw.Container(
            width: 135,
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
            ),
            padding: const pw.EdgeInsets.only(bottom: 2),
            child: pw.Text(
              name.isNotEmpty ? name.toUpperCase() : '',
              style: pw.TextStyle(
                fontSize: 8,
                fontWeight: pw.FontWeight.bold,
                decoration: pw.TextDecoration.underline,
                lineSpacing: 1.3,
              ),
              textAlign: pw.TextAlign.center,
              maxLines: 1,
            ),
          ),
          pw.SizedBox(height: 3),
          pw.Text(role, style: const pw.TextStyle(fontSize: 6.5, lineSpacing: 1.3)),
          pw.SizedBox(height: 2),
          pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 6.5, color: PdfColors.grey700)),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUARTERLY FULL WEIGHING RECORD (24–59 months) PDF
  // ─────────────────────────────────────────────────────────────────────────

  /// Exports the Quarterly Full Weighing Record as a PDF.
  /// Includes:
  ///   1. Official logo header
  ///   2. Summary nutritional-status table (each child counted once using
  ///      their latest measurement within the selected quarter)
  ///   3. Per-gender quarterly weighing record tables (matching form BNS 1-A)
  ///   4. Signature block (BNS auto-filled; others blank if not typed)
  Future<File> exportQuarterlyPdf({
    required String fileTitle,
    required String barangay,
    required String municipality,
    required String province,
    required int year,
    required List<Child> boys,
    required List<Child> girls,
    required MeasurementRepository measurementRepo,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();

    final bagongPilipinas = await _loadAssetImage('assets/images/logos/bagong_pilipinas.png');
    final nnc = await _loadAssetImage('assets/images/logos/nnc.png');
    final gasanSeal = await _loadAssetImage('assets/images/logos/gasan_seal.png');
    final barangaySeal = await _loadBarangayImage(barangay, signatory);
    final nutritionLogo = await _loadAssetImage('assets/images/logos/nutrition_logo.png');

    final bnsName = (signatory?.bnsName.isNotEmpty ?? false) ? signatory!.bnsName : '';
    final today = DateTime.now();
    final fmtDate = '${today.month.toString().padLeft(2, '0')}/'
        '${today.day.toString().padLeft(2, '0')}/${today.year}';

    // ── Compute summary table data ───────────────────────────────────────

    // Status labels and order
    const statusLabels = [
      'Normal',
      'Underweight',
      'Severely Underweight',
      'Overweight',
      'Stunted',
      'Severely Stunted',
      'MAM',
      'SAM',
    ];

    // For each quarter, count each child once with their latest measurement
    // For the summary table we count across the full year (all 4 quarters).
    final boyCounts = <String, int>{for (final s in statusLabels) s: 0};
    final girlCounts = <String, int>{for (final s in statusLabels) s: 0};

    void countChild(Child child, Map<String, int> counts) {
      final measurements = measurementRepo.getForChild(child.id);
      // Find latest measurement within the selected year
      final inYear = measurements.where((m) => m.date.year == year).toList();
      if (inYear.isEmpty) return;
      // getForChild returns most-recent-first
      final latest = inYear.first;
      final age = Child.monthsBetween(child.birthDate, latest.date);

      final wfa = GrowthClassifier.classifyWeightForAge(
        weightKg: latest.weightKg,
        ageMonths: age,
        gender: child.gender,
      );
      final hfa = GrowthClassifier.classifyHeightForAge(
        heightCm: latest.heightCm,
        ageMonths: age,
        gender: child.gender,
      );
      final wfl = GrowthClassifier.classifyWeightForLength(
        weightKg: latest.weightKg,
        heightCm: latest.heightCm,
        gender: child.gender,
      );

      // Record worst status per dimension
      if (wfl == 'SAM') {
        counts['SAM'] = counts['SAM']! + 1;
      } else if (wfl == 'MAM') {
        counts['MAM'] = counts['MAM']! + 1;
      } else if (hfa == 'Severely Stunted') {
        counts['Severely Stunted'] = counts['Severely Stunted']! + 1;
      } else if (hfa == 'Stunted') {
        counts['Stunted'] = counts['Stunted']! + 1;
      } else if (wfa == 'Severely Underweight') {
        counts['Severely Underweight'] = counts['Severely Underweight']! + 1;
      } else if (wfa == 'Underweight') {
        counts['Underweight'] = counts['Underweight']! + 1;
      } else if (wfa == 'Overweight' || wfl == 'Overweight' || wfl == 'Obese') {
        counts['Overweight'] = counts['Overweight']! + 1;
      } else {
        counts['Normal'] = counts['Normal']! + 1;
      }
    }

    for (final child in boys) { countChild(child, boyCounts); }
    for (final child in girls) { countChild(child, girlCounts); }

    final totalBoys = boys.length;
    final totalGirls = girls.length;
    final grandTotal = totalBoys + totalGirls;

    // ── Build summary table rows ─────────────────────────────────────────
    List<List<String>> summaryRows() {
      final rows = <List<String>>[];
      int runningTotal = 0;
      for (final label in statusLabels) {
        final b = boyCounts[label]!;
        final g = girlCounts[label]!;
        final t = b + g;
        runningTotal += t;
        final pct = grandTotal > 0
            ? '${((t / grandTotal) * 100).toStringAsFixed(1)}%'
            : '0.0%';
        rows.add([label, '$b', '$g', '$t', pct]);
      }
      final pct = grandTotal > 0
          ? '${((runningTotal / grandTotal) * 100).toStringAsFixed(1)}%'
          : '0.0%';
      rows.add(['TOTAL', '$totalBoys', '$totalGirls', '$grandTotal', pct]);
      return rows;
    }

    // ── Helpers for the per-gender weighing tables ───────────────────────
    const qMonths = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];

    String mapWtStatus(String raw) {
      final s = raw.toLowerCase();
      if (s.contains('severely') && s.contains('underweight')) return 'SUW';
      if (s.contains('underweight')) return 'UW';
      if (s.contains('overweight') || s.contains('obese')) return 'OW';
      if (s.contains('normal')) return 'N';
      return '';
    }

    pw.Widget buildWeighingTable(String genderLabel, List<Child> kids) {
      // Headers
      const qtrs = ['1ST', '2ND', '3RD', '4TH'];
      final headerData = [
        ['NAME OF CHILD / $genderLabel', 'DATE OF BIRTH',
          ...List.generate(4, (i) => 'DATE\nWT${i + 1}'),
          ...List.generate(4, (i) => 'AGE\n${qtrs[i]}'),
          ...List.generate(4, (i) => 'WT\n${qtrs[i]}'),
          ...List.generate(4, (i) => 'STATUS\n${qtrs[i]}'),
          'REMARKS',
        ],
      ];

      final dataRows = kids.map((child) {
        final meas = measurementRepo.getForChild(child.id);
        final dates = <String>[];
        final ages = <String>[];
        final weights = <String>[];
        final statuses = <String>[];

        for (int q = 0; q < 4; q++) {
          final qRecs = meas
              .where((m) => m.date.year == year && qMonths[q].contains(m.date.month))
              .toList();
          if (qRecs.isNotEmpty) {
            final rec = qRecs.first;
            final ageAtW = Child.monthsBetween(child.birthDate, rec.date);
            dates.add('${rec.date.month}/${rec.date.day}/${rec.date.year}');
            ages.add(ageAtW > 59 ? 'OA' : '$ageAtW');
            weights.add(rec.weightKg.toStringAsFixed(1));
            statuses.add(mapWtStatus(
              GrowthClassifier.classifyWeightForAge(
                weightKg: rec.weightKg,
                ageMonths: ageAtW,
                gender: child.gender,
              ),
            ));
          } else {
            final targetMonth = (q + 1) * 3;
            final est = (year - child.birthDate.year) * 12 +
                (targetMonth - child.birthDate.month);
            dates.add('');
            ages.add(est > 59 ? 'OA' : (est >= 24 ? '$est' : ''));
            weights.add('');
            statuses.add('');
          }
        }

        return [
          child.fullName,
          '${child.birthDate.month}/${child.birthDate.day}/${child.birthDate.year}',
          ...dates,
          ...ages,
          ...weights,
          ...statuses,
          '',
        ];
      }).toList();

      const colWidths = <int, pw.TableColumnWidth>{
        0: pw.FlexColumnWidth(2.5),
        1: pw.FixedColumnWidth(54),
        2: pw.FixedColumnWidth(42), 3: pw.FixedColumnWidth(42),
        4: pw.FixedColumnWidth(42), 5: pw.FixedColumnWidth(42),
        6: pw.FixedColumnWidth(30), 7: pw.FixedColumnWidth(30),
        8: pw.FixedColumnWidth(30), 9: pw.FixedColumnWidth(30),
        10: pw.FixedColumnWidth(36), 11: pw.FixedColumnWidth(36),
        12: pw.FixedColumnWidth(36), 13: pw.FixedColumnWidth(36),
        14: pw.FixedColumnWidth(36), 15: pw.FixedColumnWidth(36),
        16: pw.FixedColumnWidth(36), 17: pw.FixedColumnWidth(36),
        18: pw.FixedColumnWidth(46),
      };

      return pw.TableHelper.fromTextArray(
        headers: headerData[0],
        data: dataRows,
        headerStyle: pw.TextStyle(fontSize: 6.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        headerDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF1B5E20)),
        cellStyle: const pw.TextStyle(fontSize: 7),
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 3),
        border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.4),
        columnWidths: colWidths,
        cellAlignment: pw.Alignment.center,
        headerCount: 1,
      );
    }

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.symmetric(horizontal: 16 * PdfPageFormat.mm, vertical: 14 * PdfPageFormat.mm),
        build: (context) => [
          // ── Logos ──
          _buildHeaderLogos(
            barangay: barangay,
            bagongPilipinas: bagongPilipinas,
            nnc: nnc,
            gasanSeal: gasanSeal,
            barangaySeal: barangaySeal,
            nutritionLogo: nutritionLogo,
          ),
          pw.SizedBox(height: 10),

          // ── Title block ──
          pw.Center(
            child: pw.Column(
              children: [
                pw.Text(
                  'QUARTERLY FULL WEIGHING RECORD',
                  style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold),
                ),
                pw.Text(
                  'CHILDREN 24–59 MONTHS · Year: $year',
                  style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  'Province: ${province.toUpperCase()}  ·  Municipality: ${municipality.toUpperCase()}  ·  Barangay: ${barangay.toUpperCase()}',
                  style: const pw.TextStyle(fontSize: 8),
                ),
                pw.Text(
                  'BNS: $bnsName  ·  Date Generated: $fmtDate',
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 12),

          // ── Summary nutritional status table ──
          pw.Text(
            'NUTRITIONAL STATUS SUMMARY',
            style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 4),
          pw.TableHelper.fromTextArray(
            headers: ['Nutritional Status', 'Boys', 'Girls', 'Total', 'Percentage (%)'],
            data: summaryRows(),
            headerStyle: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
            headerDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF1B5E20)),
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
            columnWidths: {
              0: const pw.FlexColumnWidth(3),
              1: const pw.FixedColumnWidth(48),
              2: const pw.FixedColumnWidth(48),
              3: const pw.FixedColumnWidth(48),
              4: const pw.FixedColumnWidth(72),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.center,
              2: pw.Alignment.center,
              3: pw.Alignment.center,
              4: pw.Alignment.center,
            },
            headerCount: 1,
          ),
          pw.SizedBox(height: 16),

          // ── BOYS weighing table ──
          pw.Text('BOYS (Total: $totalBoys)',
              style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          if (boys.isEmpty)
            pw.Text('No boys recorded.', style: const pw.TextStyle(fontSize: 8))
          else
            buildWeighingTable('BOYS', boys),
          pw.SizedBox(height: 12),

          // ── GIRLS weighing table ──
          pw.Text('GIRLS (Total: $totalGirls)',
              style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          if (girls.isEmpty)
            pw.Text('No girls recorded.', style: const pw.TextStyle(fontSize: 8))
          else
            buildWeighingTable('GIRLS', girls),
          pw.SizedBox(height: 24),

          // ── Signature block ──
          pw.Divider(color: PdfColors.grey400),
          pw.SizedBox(height: 8),
          _buildFourSignatoryBlock(signatory),
        ],
      ),
    );

    final bytes = await doc.save();
    return _savePdfToDocuments(fileTitle: fileTitle, bytes: bytes);
  }

  pw.Widget _buildTable(
    Map<String, int> newCounts,
    Map<String, int>? oldCounts,
  ) {
    final headers = ['', 'Old', 'New'];
    final rows = newCounts.entries
        .map(
          (e) => [
            e.key,
            (oldCounts?[e.key]?.toString() ?? '—'),
            e.value.toString(),
          ],
        )
        .toList();
    return pw.TableHelper.fromTextArray(
      headers: headers,
      data: rows,
      headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
      cellStyle: const pw.TextStyle(fontSize: 10),
      cellAlignment: pw.Alignment.centerLeft,
      columnWidths: {
        0: const pw.FlexColumnWidth(3),
        1: const pw.FlexColumnWidth(1),
        2: const pw.FlexColumnWidth(1),
      },
    );
  }

  pw.Widget _buildSignatureBlock(ReportSignatory s) {
    final bnsPos = s.bnsPosition.isNotEmpty ? s.bnsPosition : 'Submitted by, BNS';
    final pbPos = s.punongBarangayPosition.isNotEmpty ? s.punongBarangayPosition : 'Noted by, Punong Barangay';
    final mnaoPos = s.mnaoAdminAidePosition.isNotEmpty ? s.mnaoAdminAidePosition : 'Approved by, Admin Aide, MNAO';
    final dnpcPos = s.dnpcPosition.isNotEmpty ? s.dnpcPosition : 'Approved by, DNPC';

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        _sigLine(s.bnsName, bnsPos),
        pw.SizedBox(height: 12),
        _sigLine(s.punongBarangayName, pbPos),
        pw.SizedBox(height: 12),
        _sigLine(s.mnaoAdminAideName, mnaoPos),
        pw.SizedBox(height: 12),
        _sigLine(s.dnpcName, dnpcPos),
      ],
    );
  }

  pw.Widget _sigLine(String name, String label) {
    return pw.ConstrainedBox(
      constraints: const pw.BoxConstraints(maxWidth: 240),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 20),
          pw.Container(
            width: 210,
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
            ),
            padding: const pw.EdgeInsets.only(bottom: 2),
            child: pw.Text(
              name.isNotEmpty ? name.toUpperCase() : '',
              style: pw.TextStyle(
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
                decoration: pw.TextDecoration.underline,
                lineSpacing: 1.35,
              ),
              textAlign: pw.TextAlign.center,
              maxLines: 1,
            ),
          ),
          pw.SizedBox(height: 3),
          pw.Text(label, style: const pw.TextStyle(fontSize: 8, lineSpacing: 1.3)),
          pw.SizedBox(height: 2),
          pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700)),
        ],
      ),
    );
  }
}
