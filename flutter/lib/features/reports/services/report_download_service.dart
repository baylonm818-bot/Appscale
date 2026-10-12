import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

/// Service responsible for saving generated reports directly into the device's
/// public Downloads folder without opening any external sheet or chooser.
///
/// Platforms:
/// - Android 10+ (API 29+): Saves via MediaStore.Downloads (no permissions needed)
/// - Android 9 and below: Requests WRITE_EXTERNAL_STORAGE permission, saves to /Download
/// - iOS: Saves to app Documents folder with UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace
///   so it appears directly in the Files app.
class ReportDownloadService {
  static const MethodChannel _channel = MethodChannel('com.example.appscale/downloads');

  /// Saves [sourceFile] into the public Downloads directory.
  /// Returns the final saved file name on success.
  /// Throws [Exception] with user-friendly message on failure.
  static Future<String> downloadReport({
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
        return result;
      } on PlatformException catch (e) {
        if (e.code == 'PERMISSION_DENIED') {
          throw Exception('Storage permission was denied. Please allow storage access to save reports.');
        }
        throw Exception('Failed to save report to Downloads: ${e.message ?? e.code}');
      }
    } else if (Platform.isIOS) {
      // On iOS: save to application documents directory with deduplication.
      // UIFileSharingEnabled and LSSupportsOpeningDocumentsInPlace make it visible in the Files app.
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

      return candidate.uri.pathSegments.last;
    } else {
      // Desktop / Other: Fallback to getDownloadsDirectory
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

      return candidate.uri.pathSegments.last;
    }
  }
}
