import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../../data/models/report_signatory.dart';
import '../../../shared/utils/barangay_assets.dart';
import 'consolidation_computation_service.dart';

/// Builds the consolidation report as a real PDF.
/// Supports both single-period summary and official multi-month / quarterly
/// matrix tables matching DOH/NNC form standards.
class ReportPdfService {
  Future<void> exportAndShare({
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
        margin: const pw.EdgeInsets.all(28),
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

    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '$fileTitle.pdf',
    );
  }

  Future<void> exportMatrixAndShare({
    required String fileTitle,
    required ConsolidationMatrixData matrix,
    required ReportSignatory? signatory,
  }) async {
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(20),
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

    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '$fileTitle.pdf',
    );
  }

  Future<void> exportTableAndShare({
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
        margin: const pw.EdgeInsets.all(24),
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
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8),
              cellStyle: const pw.TextStyle(fontSize: 7.5),
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

    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '$fileTitle.pdf',
    );
  }

  /// Exports Lactating Mothers Masterlist as a simple portrait A4 numbered list,
  /// matching the official MASTERLIST OF LACTATING MOTHER form.
  Future<void> exportLactatingMasterlistPdf({
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
                constraints: const pw.BoxConstraints(maxWidth: 200),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Prepared by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 16),
                    pw.Container(height: 0.5, width: 170, color: PdfColors.black),
                    pw.SizedBox(height: 3),
                    pw.Text(
                      bns.isNotEmpty ? bns.toUpperCase() : '',
                      style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                    ),
                    pw.Text(bnsPosition, style: const pw.TextStyle(fontSize: 9)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
              // Noted by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 200),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Noted by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 16),
                    pw.Container(height: 0.5, width: 170, color: PdfColors.black),
                    pw.SizedBox(height: 3),
                    pw.Text(
                      pb.isNotEmpty ? pb.toUpperCase() : '',
                      style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                    ),
                    pw.Text(pbPosition, style: const pw.TextStyle(fontSize: 9)),
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

    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '$fileTitle.pdf',
    );
  }

  /// Exports Children Masterlist as a simple portrait A4 numbered list,
  /// matching the official masterlist form format.
  Future<void> exportChildrenMasterlistPdf({
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
                constraints: const pw.BoxConstraints(maxWidth: 200),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Prepared by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 16),
                    pw.Container(height: 0.5, width: 170, color: PdfColors.black),
                    pw.SizedBox(height: 3),
                    pw.Text(
                      bns.isNotEmpty ? bns.toUpperCase() : '',
                      style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                    ),
                    pw.Text(bnsPosition, style: const pw.TextStyle(fontSize: 9)),
                    pw.SizedBox(height: 2),
                    pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
              // Noted by
              pw.ConstrainedBox(
                constraints: const pw.BoxConstraints(maxWidth: 200),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('Noted by:', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 16),
                    pw.Container(height: 0.5, width: 170, color: PdfColors.black),
                    pw.SizedBox(height: 3),
                    pw.Text(
                      pb.isNotEmpty ? pb.toUpperCase() : '',
                      style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                    ),
                    pw.Text(pbPosition, style: const pw.TextStyle(fontSize: 9)),
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

    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: '$fileTitle.pdf',
    );
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
          pw.Text(title, style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 14),
          pw.Container(
            height: 0.5,
            width: 130,
            color: PdfColors.black,
          ),
          pw.SizedBox(height: 2),
          pw.Text(
            name.isNotEmpty ? name.toUpperCase() : '',
            style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 1),
          pw.Text(role, style: const pw.TextStyle(fontSize: 6.5)),
          pw.SizedBox(height: 1),
          pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 6.5, color: PdfColors.grey700)),
        ],
      ),
    );
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
      constraints: const pw.BoxConstraints(maxWidth: 220),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 10),
          pw.Container(
            width: 200,
            decoration: const pw.BoxDecoration(
              border: pw.Border(top: pw.BorderSide(width: 0.5)),
            ),
            padding: const pw.EdgeInsets.only(top: 2),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  name.isNotEmpty ? name.toUpperCase() : '',
                  style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 1),
                pw.Text(label, style: const pw.TextStyle(fontSize: 8)),
                pw.SizedBox(height: 1),
                pw.Text('Date: ____________________', style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
