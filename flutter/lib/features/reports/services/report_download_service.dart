import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

class ReportDownloadResult {
  final String fileName;
  final String filePath;
  final String mimeType;

  const ReportDownloadResult({
    required this.fileName,
    required this.filePath,
    required this.mimeType,
  });

  @override
  String toString() => fileName;
}

/// Service responsible for saving generated reports directly into the device's
/// public Downloads folder without opening any external sheet or chooser.
class ReportDownloadService {
  static const MethodChannel _channel = MethodChannel('com.example.appscale/downloads');

  /// Saves [sourceFile] into the public Downloads directory.
  /// Returns a [ReportDownloadResult] containing final saved file name, file path, and mime type.
  /// Throws [Exception] with user-friendly message on failure.
  static Future<ReportDownloadResult> downloadReport({
    required File sourceFile,
    required String targetFileName,
    String mimeType = 'application/pdf',
  }) async {
    if (!sourceFile.existsSync() || sourceFile.lengthSync() <= 0) {
      throw Exception('Generated file is empty or missing');
    }

    if (Platform.isAndroid) {
      try {
        final result = await _channel.invokeMethod<String>('saveToPublicDownloads', {
          'sourcePath': sourceFile.path,
          'targetName': targetFileName,
          'mimeType': mimeType,
        });

        if (result == null || result.isEmpty) {
          throw Exception('Failed to save file to Downloads');
        }

        final publicFile = File('/storage/emulated/0/Download/$result');
        final finalPath = publicFile.existsSync() ? publicFile.path : sourceFile.path;

        return ReportDownloadResult(
          fileName: result,
          filePath: finalPath,
          mimeType: mimeType,
        );
      } on PlatformException catch (e) {
        if (e.code == 'PERMISSION_DENIED') {
          throw Exception('Storage permission was denied. Please allow storage access to save reports.');
        }
        throw Exception('Failed to save report to Downloads: ${e.message ?? e.code}');
      }
    } else if (Platform.isIOS) {
      final docsDir = await getApplicationDocumentsDirectory();
      final dotIdx = targetFileName.lastIndexOf('.');
      final base = dotIdx > 0 ? targetFileName.substring(0, dotIdx) : targetFileName;
      final ext = dotIdx > 0 ? targetFileName.substring(dotIdx) : '';

      var candidate = File('${docsDir.path}/$targetFileName');
      var counter = 1;
      while (candidate.existsSync()) {
        candidate = File('${docsDir.path}/${base}_$counter$ext');
        counter++;
      }

      await sourceFile.copy(candidate.path);

      if (!candidate.existsSync() || candidate.lengthSync() <= 0) {
        throw Exception('Failed to verify saved file in Documents folder');
      }

      return ReportDownloadResult(
        fileName: candidate.uri.pathSegments.last,
        filePath: candidate.path,
        mimeType: mimeType,
      );
    } else {
      final downloadsDir = await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
      final dotIdx = targetFileName.lastIndexOf('.');
      final base = dotIdx > 0 ? targetFileName.substring(0, dotIdx) : targetFileName;
      final ext = dotIdx > 0 ? targetFileName.substring(dotIdx) : '';

      var candidate = File('${downloadsDir.path}/$targetFileName');
      var counter = 1;
      while (candidate.existsSync()) {
        candidate = File('${downloadsDir.path}/${base}_$counter$ext');
        counter++;
      }

      await sourceFile.copy(candidate.path);

      if (!candidate.existsSync() || candidate.lengthSync() <= 0) {
        throw Exception('Failed to write file to Downloads');
      }

      return ReportDownloadResult(
        fileName: candidate.uri.pathSegments.last,
        filePath: candidate.path,
        mimeType: mimeType,
      );
    }
  }
}
