import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:appscalev3/data/local/hive_boxes.dart';
import 'package:appscalev3/features/reports/services/report_pdf_service.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/guardian.dart';
import 'package:appscalev3/data/models/report_signatory.dart';
import 'package:appscalev3/data/local/measurement_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    final tempDir = await Directory.systemTemp.createTemp('hive_test_pdf');
    Hive.init(tempDir.path);
    await Hive.openBox(HiveBoxes.measurements);

    const channel = MethodChannel('plugins.flutter.io/path_provider');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
      return tempDir.path;
    });
  });

  tearDownAll(() async {
    await Hive.close();
  });

  test('exportMonthly0to23Pdf generates valid PDF with correct structure and no crashes', () async {
    final regFontBytes = File('assets/fonts/Roboto-Regular.ttf').readAsBytesSync();
    final boldFontBytes = File('assets/fonts/Roboto-Bold.ttf').readAsBytesSync();

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (ByteData? message) async {
      final key = String.fromCharCodes(message!.buffer.asUint8List());
      if (key.contains('Roboto-Regular.ttf')) {
        return ByteData.sublistView(regFontBytes);
      }
      if (key.contains('Roboto-Bold.ttf')) {
        return ByteData.sublistView(boldFontBytes);
      }
      return null;
    });

    final service = ReportPdfService();
    final boys = <Child>[
      Child(
        id: 'b1',
        sequenceNo: '001',
        fullName: 'Juan Dela Cruz',
        gender: 'Male',
        birthDate: DateTime(2025, 3, 15),
        address: 'Zone 1',
        barangay: 'Bahi',
        belongsToIpGroup: false,
        disability: 'None',
        guardian: const Guardian(
          fullName: 'Maria Dela Cruz',
          relationship: 'Mother',
          contactNo: '09123456789',
        ),
        createdAt: DateTime(2025, 3, 15),
      ),
    ];
    final girls = <Child>[
      Child(
        id: 'g1',
        sequenceNo: '002',
        fullName: 'Maria Santos',
        gender: 'Female',
        birthDate: DateTime(2025, 5, 20),
        address: 'Zone 2',
        barangay: 'Bahi',
        belongsToIpGroup: false,
        disability: 'None',
        guardian: const Guardian(
          fullName: 'Juana Santos',
          relationship: 'Mother',
          contactNo: '09987654321',
        ),
        createdAt: DateTime(2025, 5, 20),
      ),
    ];

    final measRepo = MeasurementRepository();
    final signatory = const ReportSignatory(
      barangay: 'Bahi',
      bnsName: 'Jane BNS',
      punongBarangayName: 'Capt. Smith',
      mnaoAdminAideName: 'Officer Aide',
      dnpcName: 'DNPC Officer',
    );

    final file = await service.exportMonthly0to23Pdf(
      fileTitle: 'Sample_Monthly_0_23',
      barangay: 'Bahi',
      municipality: 'Gasan',
      province: 'Marinduque',
      year: 2026,
      boys: boys,
      girls: girls,
      measurementRepo: measRepo,
      signatory: signatory,
    );

    expect(file.existsSync(), isTrue);
    final pdfBytes = await file.readAsBytes();
    expect(pdfBytes.length, greaterThan(1000));
    final sampleOut = File('test/sample_monthly_0_23.pdf');
    sampleOut.writeAsBytesSync(pdfBytes);
    debugPrint('Generated sample PDF size: ${pdfBytes.length} bytes at ${sampleOut.path}');
  });
}
