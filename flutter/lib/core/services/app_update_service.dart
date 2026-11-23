import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../app_strings.dart';
import '../constants/api_constants.dart';
import '../theme/app_colors.dart';

enum AppUpdateStatus {
  noInternet,
  serverUnreachable,
  alreadyLatest,
  updateAvailable,
}

class AppUpdateCheckResult {
  final AppUpdateStatus status;
  final AppUpdateInfo? info;
  final String? errorMessage;
  final int? statusCode;

  const AppUpdateCheckResult({
    required this.status,
    this.info,
    this.errorMessage,
    this.statusCode,
  });
}

/// Represents a semantic version with major, minor, patch and optional build number.
class AppVersion implements Comparable<AppVersion> {
  final int major;
  final int minor;
  final int patch;
  final int build;

  const AppVersion({
    required this.major,
    required this.minor,
    required this.patch,
    this.build = 0,
  });

  static AppVersion? tryParse(String? raw) {
    if (raw == null) return null;
    var cleaned = raw.trim();
    if (cleaned.isEmpty) return null;
    if (cleaned.startsWith('v') || cleaned.startsWith('V')) {
      cleaned = cleaned.substring(1).trim();
    }
    int buildNum = 0;
    if (cleaned.contains('+')) {
      final parts = cleaned.split('+');
      cleaned = parts[0];
      if (parts.length > 1) {
        buildNum = int.tryParse(parts[1].trim()) ?? 0;
      }
    }
    if (cleaned.contains('-')) {
      cleaned = cleaned.split('-')[0];
    }
    final segments = cleaned.split('.');
    final major = segments.isNotEmpty ? (int.tryParse(segments[0].trim()) ?? 0) : 0;
    final minor = segments.length > 1 ? (int.tryParse(segments[1].trim()) ?? 0) : 0;
    final patch = segments.length > 2 ? (int.tryParse(segments[2].trim()) ?? 0) : 0;
    return AppVersion(major: major, minor: minor, patch: patch, build: buildNum);
  }

  @override
  int compareTo(AppVersion other) {
    if (major != other.major) return major.compareTo(other.major);
    if (minor != other.minor) return minor.compareTo(other.minor);
    if (patch != other.patch) return patch.compareTo(other.patch);
    if (build != other.build) return build.compareTo(other.build);
    return 0;
  }

  bool isHigherThan(AppVersion other) => compareTo(other) > 0;
  bool isLowerThan(AppVersion other) => compareTo(other) < 0;
  bool isEqualTo(AppVersion other) => compareTo(other) == 0;
}

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
  final List<String> notesEn;
  final List<String> notesTl;
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
    this.notesEn = const [],
    this.notesTl = const [],
    this.updatedAt,
  });

  /// Returns the release notes matching the active language without mixing EN and TL.
  String get localizedReleaseNotes {
    final list = L.isTagalog
        ? (notesTl.isNotEmpty ? notesTl : notesEn)
        : (notesEn.isNotEmpty ? notesEn : notesTl);
    if (list.isNotEmpty) {
      return list.map((item) => '• $item').join('\n');
    }
    return releaseNotes;
  }

  String get fileSizeFormatted {
    if (fileSizeBytes <= 0) return '';
    final mb = fileSizeBytes / (1024 * 1024);
    return '${mb.toStringAsFixed(1)} MB';
  }
}

class AppUpdateService {
  AppUpdateService._();

  /// Current running version of the mobile app
  static const String currentVersion = '3.3.5';
  static const int currentVersionCode = 38;

  /// Compares two versions numerically (major.minor.patch).
  /// Returns >0 if v1 > v2, <0 if v1 < v2, and 0 if v1 == v2.
  static int compareVersions(String v1, String v2) {
    final parsed1 = AppVersion.tryParse(v1) ?? const AppVersion(major: 0, minor: 0, patch: 0);
    final parsed2 = AppVersion.tryParse(v2) ?? const AppVersion(major: 0, minor: 0, patch: 0);
    return parsed1.compareTo(parsed2);
  }

  /// Returns true ONLY when [serverVersion] is strictly HIGHER than [installedVersion].
  static bool isServerVersionHigher(String serverVersion, String installedVersion) {
    return compareVersions(serverVersion, installedVersion) > 0;
  }

  /// Checks the backend server for a newer APK version with detailed network/version status.
  static Future<AppUpdateCheckResult> checkForUpdateWithDetails() async {
    // 1. Check network connectivity first
    try {
      final connectivity = await Connectivity().checkConnectivity();
      if (!connectivity.any((r) => r != ConnectivityResult.none)) {
        debugPrint('[AppUpdateService] No internet connection detected.');
        return const AppUpdateCheckResult(status: AppUpdateStatus.noInternet);
      }
    } catch (e) {
      debugPrint('[AppUpdateService] Connectivity check exception: $e');
    }

    // 2. Query endpoint from single source of truth (ApiConstants.apiBaseUrl)
    final uri = Uri.parse('${ApiConstants.apiBaseUrl}/app-version');
    try {
      final res = await http.get(uri).timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) {
        debugPrint('[AppUpdateService] Server returned error status code: ${res.statusCode}, body: ${res.body}');
        return AppUpdateCheckResult(
          status: AppUpdateStatus.serverUnreachable,
          statusCode: res.statusCode,
          errorMessage: 'HTTP ${res.statusCode}',
        );
      }

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
      final notesEnRaw = data['notes_en'];
      final notesTlRaw = data['notes_tl'];
      final notesEn = notesEnRaw is List
          ? notesEnRaw.map((e) => e.toString()).toList()
          : <String>[];
      final notesTl = notesTlRaw is List
          ? notesTlRaw.map((e) => e.toString()).toList()
          : <String>[];

      // ONLY offer update when server version is strictly HIGHER than installed version.
      // Compare semantically by major.minor.patch (e.g. 3.3.10 > 3.3.1).
      final isHigher = isServerVersionHigher(latestVersion, currentVersion);
      final hasUpdate = hasApk && isHigher;

      final info = AppUpdateInfo(
        hasUpdate: hasUpdate,
        currentVersion: currentVersion,
        latestVersion: latestVersion,
        currentVersionCode: currentVersionCode,
        latestVersionCode: latestVersionCode,
        hasApk: hasApk,
        downloadUrl: fullDownloadUrl,
        fileSizeBytes: fileSizeBytes,
        releaseNotes: releaseNotes,
        notesEn: notesEn,
        notesTl: notesTl,
      );

      if (hasUpdate) {
        debugPrint('[AppUpdateService] Update available: v$latestVersion (Installed: v$currentVersion)');
        return AppUpdateCheckResult(status: AppUpdateStatus.updateAvailable, info: info);
      } else {
        debugPrint('[AppUpdateService] Already on latest version: v$currentVersion (Server: v$latestVersion)');
        return AppUpdateCheckResult(status: AppUpdateStatus.alreadyLatest, info: info);
      }
    } catch (e) {
      debugPrint('[AppUpdateService] Server unreachable exception: $e');
      return AppUpdateCheckResult(
        status: AppUpdateStatus.serverUnreachable,
        errorMessage: e.toString(),
      );
    }
  }

  /// Checks the backend server for a newer APK version (legacy helper)
  static Future<AppUpdateInfo?> checkForUpdate() async {
    final result = await checkForUpdateWithDetails();
    return result.info;
  }

  /// Downloads the APK and launches the Android Package Installer
  static Future<void> downloadAndInstall({
    required String downloadUrl,
    required Function(double progress, int received, int total) onProgress,
    String? targetVersion,
  }) async {
    if (targetVersion != null && !isServerVersionHigher(targetVersion, currentVersion)) {
      throw Exception('Cannot install an older or equal build. Target: v$targetVersion, Installed: v$currentVersion.');
    }
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
    if (!info.hasUpdate || !isServerVersionHigher(info.latestVersion, info.currentVersion)) {
      if (isManualCheck) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('update_already_latest'.tr),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }
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
      _statusText = 'update_preparing'.tr;
    });

    try {
      await AppUpdateService.downloadAndInstall(
        downloadUrl: widget.info.downloadUrl,
        targetVersion: widget.info.latestVersion,
        onProgress: (progress, received, total) {
          if (!mounted) return;
          setState(() {
            _progress = progress;
            if (total > 0) {
              final receivedMb = (received / (1024 * 1024)).toStringAsFixed(1);
              final totalMb = (total / (1024 * 1024)).toStringAsFixed(1);
              _statusText = '${'update_downloading'.tr} $receivedMb MB / $totalMb MB (${(progress * 100).toInt()}%)';
            } else {
              _statusText = 'update_downloading'.tr;
            }
          });
        },
      );

      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('[AppUpdateService] Download error: $e');
      setState(() {
        _isDownloading = false;
        _errorMessage = 'update_failed'.tr;
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
                      Text(
                        'update_available_title'.tr,
                        style: const TextStyle(
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
            Text(
              'update_whats_new'.tr,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
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
                  widget.info.localizedReleaseNotes,
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
                    child: Text('update_later'.tr, style: const TextStyle(color: AppColors.textMuted)),
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
                      : Text('update_install'.tr),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
