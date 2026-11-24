import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart' show ScaffoldMessengerState, SnackBar, SnackBarBehavior, RoundedRectangleBorder, BorderRadius, Colors, TextButton, InkWell, Padding, EdgeInsets, Icon, Icons, Text, Row, Expanded, SizedBox, TextStyle, FontWeight, MaterialTapTargetSize, Size, TextOverflow;
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/program_schedule.dart';
import '../../../../data/models/report_signatory.dart';
import '../../../reports/services/report_download_service.dart';
import '../../../reports/services/report_notification_service.dart';

class CalendarSchedulePdfService {
  static const List<String> _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  Future<pw.ThemeData> _loadDocTheme() async {
    try {
      final fontData = await rootBundle.load('assets/fonts/Roboto-Regular.ttf');
      final robotoRegular = pw.Font.ttf(fontData);
      final fontBoldData = await rootBundle.load('assets/fonts/Roboto-Bold.ttf');
      final robotoBold = pw.Font.ttf(fontBoldData);
      return pw.ThemeData.withFont(
        base: robotoRegular,
        bold: robotoBold,
      );
    } catch (_) {
      return pw.ThemeData.base();
    }
  }

  static String _markerFor(String programType) {
    switch (programType.toLowerCase()) {
      case 'feeding':
        return 'F';
      case 'vitamin a':
      case 'vitamin_a':
        return 'Vit A';
      case 'deworming':
        return 'Dew';
      case 'opt plus':
      case 'opt_plus':
        return 'OPT';
      default:
        return 'Act';
    }
  }

  static PdfColor _colorFor(String programType) {
    switch (programType.toLowerCase()) {
      case 'feeding':
        return PdfColor.fromInt(0xFF2E7D32); // Dark Green
      case 'vitamin a':
      case 'vitamin_a':
        return PdfColor.fromInt(0xFFE65100); // Amber / Orange
      case 'deworming':
        return PdfColor.fromInt(0xFFC2185B); // Crimson / Red
      case 'opt plus':
      case 'opt_plus':
        return PdfColor.fromInt(0xFF1565C0); // Cobalt Blue
      default:
        return PdfColor.fromInt(0xFF455A64); // Slate Grey
    }
  }

  static PdfColor _bgColorFor(String programType) {
    switch (programType.toLowerCase()) {
      case 'feeding':
        return PdfColor.fromInt(0xFFE8F5E9);
      case 'vitamin a':
      case 'vitamin_a':
        return PdfColor.fromInt(0xFFFFF3E0);
      case 'deworming':
        return PdfColor.fromInt(0xFFFCE4EC);
      case 'opt plus':
      case 'opt_plus':
        return PdfColor.fromInt(0xFFE3F2FD);
      default:
        return PdfColor.fromInt(0xFFECEFF1);
    }
  }

  /// Generates the PDF document bytes fully offline using bundled Roboto fonts and local data.
  Future<Uint8List> generatePdfBytes({
    required String barangay,
    required int year,
    required int month,
    required String programFilter,
    required String layout, // 'Calendar + list', 'List only', 'Calendar only'
    required List<ProgramSchedule> schedules,
    String? bnsName,
    String? purok,
    ReportSignatory? signatory,
    DateTime? startDate,
    DateTime? endDate,
    bool isWholeYear = false,
  }) async {
    final theme = await _loadDocTheme();
    final doc = pw.Document(theme: theme);

    final showCalendar = layout != 'List only';
    final showList = layout != 'Calendar only';

    final monthName = (month >= 1 && month <= 12) ? _monthNames[month - 1] : 'Month $month';
    final isCustomRange = startDate != null && endDate != null &&
        (startDate.month != endDate.month || startDate.year != endDate.year);

    final headerTitle = isWholeYear
        ? 'Calendar of Activities - Year $year'
        : (isCustomRange
            ? 'Calendar of Activities - ${startDate.day} ${_monthNames[startDate.month - 1].substring(0, 3)} ${startDate.year} to ${endDate.day} ${_monthNames[endDate.month - 1].substring(0, 3)} ${endDate.year}'
            : 'Calendar of Activities - $monthName $year');

    final purokPart = (purok != null && purok.trim().isNotEmpty) ? ' - Purok ${purok.trim()}' : '';
    final locationSubtitle = 'Barangay $barangay$purokPart';
    final filterSubtitle = 'Program Filter: $programFilter';

    final preparedByName = (bnsName != null && bnsName.trim().isNotEmpty)
        ? bnsName.trim()
        : (signatory?.preparedByName ?? 'Barangay Nutrition Scholar');
    final preparedByPosition = signatory?.preparedByPosition ?? 'Barangay Nutrition Scholar (BNS)';

    final notedByName = signatory?.notedByName ??
        signatory?.punongBarangayName ??
        signatory?.approvedByName ??
        'Not set';
    final notedByPosition = signatory?.notedByPosition ?? 'Punong Barangay';

    // Calendar grid calculations
    final firstDayOfMonth = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final leadingEmptyDays = firstDayOfMonth.weekday % 7; // 0=Sun, 1=Mon...6=Sat
    final totalCells = leadingEmptyDays + daysInMonth;
    final totalWeeks = (totalCells + 6) ~/ 7;

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.symmetric(
          horizontal: 14 * PdfPageFormat.mm,
          vertical: 11 * PdfPageFormat.mm,
        ),
        header: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      headerTitle,
                      style: pw.TextStyle(
                        fontSize: 15,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColor.fromInt(0xFF1B5E20),
                      ),
                    ),
                    pw.SizedBox(height: 2),
                    pw.Text(
                      '$locationSubtitle    |    $filterSubtitle',
                      style: pw.TextStyle(
                        fontSize: 9.5,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.grey800,
                      ),
                    ),
                  ],
                ),
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromInt(0xFFF1F8E9),
                    borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                    border: pw.Border.all(color: PdfColor.fromInt(0xFFAED581), width: 0.6),
                  ),
                  child: pw.Text(
                    'AppScale BNS Offline Report',
                    style: pw.TextStyle(
                      fontSize: 8,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromInt(0xFF2E7D32),
                    ),
                  ),
                ),
              ],
            ),
            pw.SizedBox(height: 4),
            pw.Container(height: 1.2, color: PdfColor.fromInt(0xFF1B5E20)),
            pw.SizedBox(height: 6),
          ],
        ),
        footer: (context) => pw.Container(
          margin: const pw.EdgeInsets.only(top: 8),
          padding: const pw.EdgeInsets.only(top: 4),
          decoration: const pw.BoxDecoration(
            border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 0.5)),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Generated from BNS Mobile Database ($barangay)',
                style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey600),
              ),
              pw.Text(
                'Page ${context.pageNumber} of ${context.pagesCount}',
                style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey600),
              ),
            ],
          ),
        ),
        build: (context) {
          final content = <pw.Widget>[];

          // ── Program Legend ────────────────────────────────────────────────
          content.add(
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              margin: const pw.EdgeInsets.only(bottom: 8),
              decoration: pw.BoxDecoration(
                color: PdfColors.grey100,
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'PROGRAM MARKERS & LEGEND:',
                    style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.grey800),
                  ),
                  _buildLegendItem('[F] Feeding', _colorFor('Feeding'), _bgColorFor('Feeding')),
                  _buildLegendItem('[Vit A] Vitamin A', _colorFor('Vitamin A'), _bgColorFor('Vitamin A')),
                  _buildLegendItem('[Dew] Deworming', _colorFor('Deworming'), _bgColorFor('Deworming')),
                  _buildLegendItem('[OPT] OPT Plus', _colorFor('OPT Plus'), _bgColorFor('OPT Plus')),
                ],
              ),
            ),
          );

          // ── Calendar Grid ─────────────────────────────────────────────────
          if (showCalendar) {
            if (isWholeYear) {
              content.add(
                pw.Container(
                  margin: const pw.EdgeInsets.only(bottom: 10),
                  child: pw.Table(
                    children: [
                      for (int r = 0; r < 3; r++)
                        pw.TableRow(
                          children: [
                            for (int c = 0; c < 4; c++)
                              _buildMiniMonth(year, r * 4 + c + 1, schedules),
                          ],
                        ),
                    ],
                  ),
                ),
              );
            } else {
              content.add(
                pw.Container(
                  margin: const pw.EdgeInsets.only(bottom: 12),
                  child: pw.Table(
                    border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
                    columnWidths: const {
                      0: pw.FlexColumnWidth(1),
                      1: pw.FlexColumnWidth(1),
                      2: pw.FlexColumnWidth(1),
                      3: pw.FlexColumnWidth(1),
                      4: pw.FlexColumnWidth(1),
                      5: pw.FlexColumnWidth(1),
                      6: pw.FlexColumnWidth(1),
                    },
                    children: [
                      // Day headers: Sun - Sat
                      pw.TableRow(
                        decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                        children: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) {
                          final isSun = d == 'SUN';
                          return pw.Container(
                            padding: const pw.EdgeInsets.symmetric(vertical: 4),
                            alignment: pw.Alignment.center,
                            child: pw.Text(
                              d,
                              style: pw.TextStyle(
                                fontSize: 8,
                                fontWeight: pw.FontWeight.bold,
                                color: isSun ? PdfColors.red800 : PdfColors.grey800,
                              ),
                            ),
                          );
                        }).toList(),
                      ),

                      // Week rows
                      for (int w = 0; w < totalWeeks; w++)
                        pw.TableRow(
                          children: List.generate(7, (col) {
                            final cellIndex = w * 7 + col;
                            if (cellIndex < leadingEmptyDays || cellIndex >= totalCells) {
                              return pw.Container(
                                color: PdfColors.grey50,
                                constraints: const pw.BoxConstraints(minHeight: 46),
                              );
                            }

                            final dayNum = cellIndex - leadingEmptyDays + 1;
                            final daySchedules = schedules.where((s) =>
                                s.date.year == year &&
                                s.date.month == month &&
                                s.date.day == dayNum).toList();

                            return pw.Container(
                              padding: const pw.EdgeInsets.all(2.5),
                              constraints: const pw.BoxConstraints(minHeight: 46),
                              child: pw.Column(
                                crossAxisAlignment: pw.CrossAxisAlignment.start,
                                children: [
                                  pw.Row(
                                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                                    children: [
                                      if (daySchedules.isNotEmpty)
                                        pw.Container(
                                          padding: const pw.EdgeInsets.symmetric(horizontal: 2.5, vertical: 0.5),
                                          decoration: pw.BoxDecoration(
                                            color: PdfColor.fromInt(0xFF1B5E20),
                                            borderRadius: const pw.BorderRadius.all(pw.Radius.circular(2)),
                                          ),
                                          child: pw.Text(
                                            '${daySchedules.length} act',
                                            style: const pw.TextStyle(fontSize: 5, color: PdfColors.white),
                                          ),
                                        )
                                      else
                                        pw.SizedBox(),
                                      pw.Text(
                                        '$dayNum',
                                        style: pw.TextStyle(
                                          fontSize: 7.5,
                                          fontWeight: pw.FontWeight.bold,
                                          color: col == 0 ? PdfColors.red800 : PdfColors.grey900,
                                        ),
                                      ),
                                    ],
                                  ),
                                  pw.SizedBox(height: 2),
                                  ...daySchedules.take(3).map((s) => _buildDayScheduleCellBadge(s)),
                                  if (daySchedules.length > 3)
                                    pw.Padding(
                                      padding: const pw.EdgeInsets.only(top: 1),
                                      child: pw.Text(
                                        '+${daySchedules.length - 3} more',
                                        style: const pw.TextStyle(fontSize: 5, color: PdfColors.grey700),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }),
                        ),
                    ],
                  ),
                ),
              );
            }
          }

          // ── Activities Table ──────────────────────────────────────────────
          if (showList) {
            content.add(
              pw.Container(
                margin: const pw.EdgeInsets.only(top: 6, bottom: 4),
                child: pw.Row(
                  children: [
                    pw.Container(
                      width: 3.5,
                      height: 12,
                      color: PdfColor.fromInt(0xFF1B5E20),
                      margin: const pw.EdgeInsets.only(right: 6),
                    ),
                    pw.Text(
                      'SCHEDULED ACTIVITIES & VENUES',
                      style: pw.TextStyle(
                        fontSize: 10,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColor.fromInt(0xFF1B5E20),
                      ),
                    ),
                    pw.SizedBox(width: 8),
                    pw.Text(
                      '(${schedules.length} scheduled ${schedules.length == 1 ? "activity" : "activities"})',
                      style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700),
                    ),
                  ],
                ),
              ),
            );

            if (schedules.isEmpty) {
              content.add(
                pw.Container(
                  padding: const pw.EdgeInsets.all(12),
                  alignment: pw.Alignment.center,
                  decoration: pw.BoxDecoration(
                    color: PdfColors.grey100,
                    borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                    border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
                  ),
                  child: pw.Text(
                    'No scheduled activities found for this period.',
                    style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
                  ),
                ),
              );
            } else {
              content.add(
                pw.TableHelper.fromTextArray(
                  border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
                  headerStyle: pw.TextStyle(
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColors.white,
                  ),
                  headerDecoration: const pw.BoxDecoration(
                    color: PdfColor.fromInt(0xFF1B5E20),
                  ),
                  headers: [
                    '#',
                    'Date',
                    'Time',
                    'Program / Activity',
                    'Venue',
                    'Target Beneficiaries',
                    'Notes / Reminders',
                  ],
                  columnWidths: const {
                    0: pw.FixedColumnWidth(20),
                    1: pw.FixedColumnWidth(65),
                    2: pw.FixedColumnWidth(85),
                    3: pw.FlexColumnWidth(1.4),
                    4: pw.FlexColumnWidth(1.2),
                    5: pw.FlexColumnWidth(1.0),
                    6: pw.FlexColumnWidth(1.1),
                  },
                  cellStyle: const pw.TextStyle(fontSize: 7.5),
                  cellPadding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 4),
                  data: List.generate(schedules.length, (i) {
                    final s = schedules[i];
                    final marker = _markerFor(s.programType);
                    final dateStr =
                        '${_monthNames[s.date.month - 1].substring(0, 3)} ${s.date.day}, ${s.date.year}';
                    final timeStr = (s.startTime.isNotEmpty && s.endTime.isNotEmpty)
                        ? '${s.startTime} - ${s.endTime}'
                        : (s.startTime.isNotEmpty ? s.startTime : 'Time TBA');

                    return [
                      '${i + 1}',
                      dateStr,
                      timeStr,
                      '[$marker] ${s.title}',
                      s.location.isNotEmpty ? s.location : 'Venue TBA',
                      s.readableTargetGroup,
                      s.notes.isNotEmpty ? s.notes : '—',
                    ];
                  }),
                ),
              );
            }
          }

          // ── Signatory Footer ──────────────────────────────────────────────
          // Note requirement: "The name must sit above the line and must not overlap it."
          content.add(
            pw.Padding(
              padding: const pw.EdgeInsets.only(top: 22, bottom: 6),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'Prepared by:',
                        style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey800),
                      ),
                      pw.SizedBox(height: 22), // Space for pen signature
                      pw.Text(
                        preparedByName,
                        style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: PdfColors.black),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Container(width: 200, height: 0.8, color: PdfColors.black),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        preparedByPosition,
                        style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700),
                      ),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'Noted by:',
                        style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey800),
                      ),
                      pw.SizedBox(height: 22), // Space for pen signature
                      pw.Text(
                        notedByName,
                        style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: PdfColors.black),
                      ),
                      pw.SizedBox(height: 2),
                      pw.Container(width: 200, height: 0.8, color: PdfColors.black),
                      pw.SizedBox(height: 2),
                      pw.Text(
                        notedByPosition,
                        style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );

          return content;
        },
      ),
    );

    return doc.save();
  }

  static pw.Widget _buildLegendItem(String label, PdfColor color, PdfColor bg) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: pw.BoxDecoration(
        color: bg,
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(3)),
        border: pw.Border.all(color: color, width: 0.5),
      ),
      child: pw.Row(
        mainAxisSize: pw.MainAxisSize.min,
        children: [
          pw.Container(
            width: 6,
            height: 6,
            decoration: pw.BoxDecoration(
              color: color,
              shape: pw.BoxShape.circle,
            ),
          ),
          pw.SizedBox(width: 4),
          pw.Text(
            label,
            style: pw.TextStyle(
              fontSize: 7,
              fontWeight: pw.FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildMiniMonth(int yr, int m, List<ProgramSchedule> allSchedules) {
    final firstDay = DateTime(yr, m, 1);
    final daysInM = DateTime(yr, m + 1, 0).day;
    final leading = firstDay.weekday % 7;
    final totalC = leading + daysInM;
    final weeks = (totalC + 6) ~/ 7;

    return pw.Container(
      margin: const pw.EdgeInsets.all(2),
      padding: const pw.EdgeInsets.all(3.5),
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(3)),
        border: pw.Border.all(color: PdfColors.grey300, width: 0.5),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            alignment: pw.Alignment.center,
            padding: const pw.EdgeInsets.only(bottom: 2),
            child: pw.Text(
              _monthNames[m - 1].toUpperCase(),
              style: pw.TextStyle(
                fontSize: 6.5,
                fontWeight: pw.FontWeight.bold,
                color: PdfColor.fromInt(0xFF1B5E20),
              ),
            ),
          ),
          pw.Table(
            children: [
              pw.TableRow(
                children: ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => pw.Container(
                  alignment: pw.Alignment.center,
                  padding: const pw.EdgeInsets.only(bottom: 1),
                  child: pw.Text(
                    d,
                    style: pw.TextStyle(
                      fontSize: 4.8,
                      fontWeight: pw.FontWeight.bold,
                      color: d == 'S' ? PdfColors.red800 : PdfColors.grey700,
                    ),
                  ),
                )).toList(),
              ),
              for (int w = 0; w < weeks; w++)
                pw.TableRow(
                  children: List.generate(7, (col) {
                    final idx = w * 7 + col;
                    if (idx < leading || idx >= totalC) {
                      return pw.SizedBox();
                    }
                    final dayN = idx - leading + 1;
                    final dayScheds = allSchedules.where((s) =>
                        s.date.year == yr && s.date.month == m && s.date.day == dayN).toList();
                    final hasSched = dayScheds.isNotEmpty;

                    return pw.Container(
                      alignment: pw.Alignment.center,
                      padding: const pw.EdgeInsets.symmetric(vertical: 0.5),
                      child: hasSched
                          ? pw.Container(
                              padding: const pw.EdgeInsets.symmetric(horizontal: 1.5, vertical: 0.4),
                              decoration: const pw.BoxDecoration(
                                color: PdfColors.green800,
                                borderRadius: pw.BorderRadius.all(pw.Radius.circular(1.5)),
                              ),
                              child: pw.Text(
                                '$dayN',
                                style: pw.TextStyle(
                                  fontSize: 4.5,
                                  color: PdfColors.white,
                                  fontWeight: pw.FontWeight.bold,
                                ),
                              ),
                            )
                          : pw.Text(
                              '$dayN',
                              style: pw.TextStyle(
                                fontSize: 4.8,
                                color: col == 0 ? PdfColors.red700 : PdfColors.grey800,
                              ),
                            ),
                    );
                  }),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildDayScheduleCellBadge(ProgramSchedule s) {
    final marker = _markerFor(s.programType);
    final color = _colorFor(s.programType);
    final bg = _bgColorFor(s.programType);

    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 1.5),
      padding: const pw.EdgeInsets.symmetric(horizontal: 2.5, vertical: 1),
      decoration: pw.BoxDecoration(
        color: bg,
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(2)),
        border: pw.Border.all(color: color, width: 0.4),
      ),
      child: pw.Row(
        children: [
          pw.Text(
            '[$marker]',
            style: pw.TextStyle(
              fontSize: 5.5,
              fontWeight: pw.FontWeight.bold,
              color: color,
            ),
          ),
          pw.SizedBox(width: 2),
          pw.Expanded(
            child: pw.Text(
              s.title,
              maxLines: 1,
              overflow: pw.TextOverflow.clip,
              style: const pw.TextStyle(
                fontSize: 5.5,
                color: PdfColors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Saves the PDF into public Downloads folder using MediaStore on Android 10+
  /// and shows the system notification and floating snackbar with OPEN action.
  Future<ReportDownloadResult> saveAsPdf({
    ScaffoldMessengerState? messenger,
    required String barangay,
    required int year,
    required int month,
    required String programFilter,
    required String layout,
    required List<ProgramSchedule> schedules,
    String? bnsName,
    String? purok,
    ReportSignatory? signatory,
    bool isWholeYear = false,
  }) async {
    final pdfBytes = await generatePdfBytes(
      barangay: barangay,
      year: year,
      month: month,
      programFilter: programFilter,
      layout: layout,
      schedules: schedules,
      bnsName: bnsName,
      purok: purok,
      signatory: signatory,
      isWholeYear: isWholeYear,
    );

    final sanitizedBarangay = barangay.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
    final monthStr = month.toString().padLeft(2, '0');
    final targetFileName = isWholeYear
        ? 'calendar_schedule_${year}_whole_year_$sanitizedBarangay.pdf'
        : 'calendar_schedule_${year}_${monthStr}_$sanitizedBarangay.pdf';

    // Write to temporary local file
    final tempDir = await getTemporaryDirectory();
    final tempFile = File('${tempDir.path}/$targetFileName');
    await tempFile.writeAsBytes(pdfBytes, flush: true);

    // Save into public Downloads folder via MediaStore / native channel
    final downloadResult = await ReportDownloadService.downloadReport(
      sourceFile: tempFile,
      targetFileName: targetFileName,
      mimeType: 'application/pdf',
    );

    // Show tappable system notification with payload and "Open" action
    ReportNotificationService.showDownloadNotification(
      fileName: downloadResult.fileName,
      filePath: downloadResult.filePath,
      mimeType: downloadResult.mimeType,
    );

    // Show floating in-app snackbar
    if (messenger != null) {
      showScheduleDownloadSnackbar(messenger, downloadResult);
    }

    return downloadResult;
  }

  /// Displays the floating snackbar with OPEN, close (X), and 5-second auto-dismiss
  static void showScheduleDownloadSnackbar(ScaffoldMessengerState messenger, ReportDownloadResult result) {
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 95),
        backgroundColor: AppColors.primaryGreen,
        duration: const Duration(seconds: 5),
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
                messenger.hideCurrentSnackBar();
                ReportNotificationService.openFile(
                  result.filePath,
                  mimeType: result.mimeType,
                  fileName: result.fileName,
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
                messenger.hideCurrentSnackBar();
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

  /// Opens the native Android print dialog
  Future<void> printSchedule({
    required String barangay,
    required int year,
    required int month,
    required String programFilter,
    required String layout,
    required List<ProgramSchedule> schedules,
    String? bnsName,
    String? purok,
    ReportSignatory? signatory,
    bool isWholeYear = false,
  }) async {
    final pdfBytes = await generatePdfBytes(
      barangay: barangay,
      year: year,
      month: month,
      programFilter: programFilter,
      layout: layout,
      schedules: schedules,
      bnsName: bnsName,
      purok: purok,
      signatory: signatory,
      isWholeYear: isWholeYear,
    );

    final sanitizedBarangay = barangay.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
    final monthStr = month.toString().padLeft(2, '0');
    final docName = isWholeYear
        ? 'calendar_schedule_${year}_whole_year_$sanitizedBarangay'
        : 'calendar_schedule_${year}_${monthStr}_$sanitizedBarangay';

    await Printing.layoutPdf(
      onLayout: (format) async => pdfBytes,
      name: docName,
    );
  }

  /// Opens the system share sheet
  Future<void> shareSchedule({
    required String barangay,
    required int year,
    required int month,
    required String programFilter,
    required String layout,
    required List<ProgramSchedule> schedules,
    String? bnsName,
    String? purok,
    ReportSignatory? signatory,
    bool isWholeYear = false,
  }) async {
    final pdfBytes = await generatePdfBytes(
      barangay: barangay,
      year: year,
      month: month,
      programFilter: programFilter,
      layout: layout,
      schedules: schedules,
      bnsName: bnsName,
      purok: purok,
      signatory: signatory,
      isWholeYear: isWholeYear,
    );

    final sanitizedBarangay = barangay.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
    final monthStr = month.toString().padLeft(2, '0');
    final fileName = isWholeYear
        ? 'calendar_schedule_${year}_whole_year_$sanitizedBarangay.pdf'
        : 'calendar_schedule_${year}_${monthStr}_$sanitizedBarangay.pdf';

    await Printing.sharePdf(
      bytes: pdfBytes,
      filename: fileName,
    );
  }
}
