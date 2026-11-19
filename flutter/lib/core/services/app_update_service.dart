import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../constants/api_constants.dart';
import '../theme/app_colors.dart';

class AppUpdateInfo {
  final bool hasUpdate;
  final String currentVersion;
  final String latestVersion;
  final int currentVersionCode;
  final int latestVersionCode;
  final bool hasApk;
  final String downloadUrl;
  final int fileSizeBytes;
  final String releaseNotes;
  final DateTime? updatedAt;

  const AppUpdateInfo({
    required this.hasUpdate,
    required this.currentVersion,
    required this.latestVersion,
    required this.currentVersionCode,
    required this.latestVersionCode,
    required this.hasApk,
    required this.downloadUrl,
    required this.fileSizeBytes,
    required this.releaseNotes,
    this.updatedAt,
  });

  String get fileSizeFormatted {
    if (fileSizeBytes <= 0) return '';
    final mb = fileSizeBytes / (1024 * 1024);
    return '${mb.toStringAsFixed(1)} MB';
  }
}

class AppUpdateService {
  AppUpdateService._();

  /// Current running version of the mobile app
  static const String currentVersion = '3.2.0';
  static const int currentVersionCode = 32;

  /// Checks the backend server for a newer APK version
  static Future<AppUpdateInfo?> checkForUpdate() async {
    try {
      final uri = Uri.parse('${ApiConstants.apiBaseUrl}/app-version');
      final res = await http.get(uri).timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final latestVersion = (data['latestVersion'] ?? currentVersion).toString();
      final latestVersionCode = int.tryParse(data['versionCode']?.toString() ?? '') ?? currentVersionCode;
      final hasApk = data['hasApk'] == true;
      final rawDownload = data['downloadUrl']?.toString() ?? '/api/download-apk';
      final fullDownloadUrl = rawDownload.startsWith('http')
          ? rawDownload
          : '${ApiConstants.serverOrigin}$rawDownload';
      final fileSizeBytes = int.tryParse(data['fileSizeBytes']?.toString() ?? '') ?? 0;
      final releaseNotes = (data['releaseNotes'] ?? 'Bug fixes and performance improvements.').toString();

      final hasUpdate = hasApk && (latestVersionCode > currentVersionCode);

      return AppUpdateInfo(
        hasUpdate: hasUpdate,
        currentVersion: currentVersion,
        latestVersion: latestVersion,
        currentVersionCode: currentVersionCode,
        latestVersionCode: latestVersionCode,
        hasApk: hasApk,
        downloadUrl: fullDownloadUrl,
        fileSizeBytes: fileSizeBytes,
        releaseNotes: releaseNotes,
      );
    } catch (e) {
      debugPrint('[AppUpdateService] Check update error: $e');
      return null;
    }
  }

  /// Downloads the APK and launches the Android Package Installer
  static Future<void> downloadAndInstall({
    required String downloadUrl,
    required Function(double progress, int received, int total) onProgress,
  }) async {
    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse(downloadUrl));
      final response = await client.send(request);

      if (response.statusCode != 200) {
        throw Exception('Download failed with status: ${response.statusCode}');
      }

      final totalBytes = response.contentLength ?? 0;
      int receivedBytes = 0;

      final tempDir = await getTemporaryDirectory();
      final apkFile = File('${tempDir.path}/appscale_update.apk');

      if (await apkFile.exists()) {
        await apkFile.delete();
      }

      final sink = apkFile.openWrite();

      await for (final chunk in response.stream) {
        sink.add(chunk);
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          final progress = (receivedBytes / totalBytes).clamp(0.0, 1.0);
          onProgress(progress, receivedBytes, totalBytes);
        } else {
          onProgress(0.5, receivedBytes, 0);
        }
      }

      await sink.flush();
      await sink.close();

      onProgress(1.0, receivedBytes, totalBytes);

      // Open APK with native package installer
      final result = await OpenFilex.open(
        apkFile.path,
        type: 'application/vnd.android.package-archive',
      );

      if (result.type != ResultType.done) {
        throw Exception('Could not open installer: ${result.message}');
      }
    } finally {
      client.close();
    }
  }

  /// Shows the update dialog with download progress
  static Future<void> showUpdateDialog(
    BuildContext context,
    AppUpdateInfo info, {
    bool isManualCheck = false,
  }) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => _UpdateDialog(info: info),
    );
  }
}

class _UpdateDialog extends StatefulWidget {
  final AppUpdateInfo info;

  const _UpdateDialog({required this.info});

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _isDownloading = false;
  double _progress = 0.0;
  String _statusText = '';
  String? _errorMessage;

  Future<void> _startDownload() async {
    setState(() {
      _isDownloading = true;
      _errorMessage = null;
      _statusText = 'Inihahanda ang pag-download...';
    });

    try {
      await AppUpdateService.downloadAndInstall(
        downloadUrl: widget.info.downloadUrl,
        onProgress: (progress, received, total) {
          if (!mounted) return;
          setState(() {
            _progress = progress;
            if (total > 0) {
              final receivedMb = (received / (1024 * 1024)).toStringAsFixed(1);
              final totalMb = (total / (1024 * 1024)).toStringAsFixed(1);
              _statusText = 'Idina-download: $receivedMb MB / $totalMb MB (${(progress * 100).toInt()}%)';
            } else {
              _statusText = 'Idina-download ang update...';
            }
          });
        },
      );

      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _errorMessage = 'Hindi matapos ang pag-download. Pakisubukang muli mamaya.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    color: AppColors.primaryGreen,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Bagong Update ng AppScale!',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'v${widget.info.latestVersion} ${widget.info.fileSizeFormatted.isNotEmpty ? "(${widget.info.fileSizeFormatted})" : ""}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryGreen,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Ano ang bago sa bersyong ito:',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 6),
            Container(
              constraints: const BoxConstraints(maxHeight: 130),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: SingleChildScrollView(
                child: Text(
                  widget.info.releaseNotes,
                  style: const TextStyle(fontSize: 12, height: 1.45, color: AppColors.textPrimary),
                ),
              ),
            ),
            if (_isDownloading) ...[
              const SizedBox(height: 16),
              LinearProgressIndicator(
                value: _progress > 0 ? _progress : null,
                backgroundColor: AppColors.border,
                valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primaryGreen),
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  _statusText,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 10),
              Text(
                _errorMessage!,
                style: const TextStyle(fontSize: 12, color: AppColors.statRed),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (!_isDownloading)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Mamaya Na', style: TextStyle(color: AppColors.textMuted)),
                  ),
                const SizedBox(width: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                  onPressed: _isDownloading ? null : _startDownload,
                  child: _isDownloading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('I-update Ngayon'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
