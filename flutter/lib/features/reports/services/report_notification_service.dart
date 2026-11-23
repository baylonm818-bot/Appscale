import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:open_filex/open_filex.dart';
import '../../../core/theme/app_colors.dart';

/// Global navigator key for presenting snackbars and dialogs from background notification handlers
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

class ReportNotificationService {
  ReportNotificationService._();

  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String _channelId = 'reports_download_channel';
  static const String _channelName = 'Report Downloads';
  static const String _channelDescription =
      'Notifications for downloaded report documents';

  static bool _initialized = false;

  /// Initializes the local notification plugin, creates notification channels,
  /// and sets up tap listeners for foreground, background, and cold start.
  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/launcher_icon');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
    );

    await _notificationsPlugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
    );

    if (Platform.isAndroid) {
      final androidPlatform = _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

      // Create notification channel for downloads
      const channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDescription,
        importance: Importance.high,
        playSound: true,
      );
      await androidPlatform?.createNotificationChannel(channel);

      // Request POST_NOTIFICATIONS permission on Android 13+ (API 33+)
      await androidPlatform?.requestNotificationsPermission();
    }

    _initialized = true;

    // Check cold launch (app was opened directly by tapping the notification)
    try {
      final launchDetails =
          await _notificationsPlugin.getNotificationAppLaunchDetails();
      if (launchDetails?.didNotificationLaunchApp == true &&
          launchDetails?.notificationResponse?.payload != null) {
        final payload = launchDetails!.notificationResponse!.payload!;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          openFileFromPayload(payload);
        });
      }
    } catch (e) {
      debugPrint('[ReportNotificationService] Cold launch check error: $e');
    }
  }

  /// Notification tap callback for foreground and background.
  @pragma('vm:entry-point')
  static void _onNotificationResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) {
      openFileFromPayload(payload);
    }
  }

  /// Opens the file referenced inside JSON payload.
  static Future<void> openFileFromPayload(String payloadJson) async {
    try {
      final data = jsonDecode(payloadJson) as Map<String, dynamic>;
      final filePath = data['filePath']?.toString() ?? '';
      final mimeType = data['mimeType']?.toString();
      final fileName = data['fileName']?.toString();

      if (filePath.isNotEmpty) {
        await openFile(
          filePath,
          mimeType: mimeType,
          fileName: fileName,
        );
      }
    } catch (e) {
      debugPrint('[ReportNotificationService] Error parsing payload: $e');
    }
  }

  /// Shows the download complete notification with an Open action button.
  /// Uses a unique integer ID per file name to prevent duplicate notifications for the same file.
  static Future<void> showDownloadNotification({
    required String fileName,
    required String filePath,
    required String mimeType,
  }) async {
    try {
      await initialize();

      final payload = jsonEncode({
        'fileName': fileName,
        'filePath': filePath,
        'mimeType': mimeType,
      });

      final notificationId = fileName.hashCode.abs() % 100000;

      final androidDetails = AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/launcher_icon',
        actions: const <AndroidNotificationAction>[
          AndroidNotificationAction(
            'open_file_action',
            'Open',
            showsUserInterface: true,
            cancelNotification: true,
          ),
        ],
      );

      const darwinDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      final notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: darwinDetails,
      );

      await _notificationsPlugin.show(
        notificationId,
        'Download complete',
        fileName,
        notificationDetails,
        payload: payload,
      );
    } catch (e) {
      debugPrint('[ReportNotificationService] Error showing notification: $e');
    }
  }

  /// Helper to extract base file name without requiring external package
  static String _extractBasename(String path) {
    final sanitized = path.replaceAll('\\', '/');
    final segments = sanitized.split('/');
    return segments.isNotEmpty ? segments.last : path;
  }

  /// Resolves the file location, validates existence, and opens it using OpenFilex.
  /// If missing or no viewer exists, displays a floating snackbar with user guidance.
  static Future<void> openFile(
    String filePath, {
    String? mimeType,
    String? fileName,
    BuildContext? context,
  }) async {
    String targetPath = filePath;
    File candidate = File(targetPath);

    // 1. Verify existence at primary path
    if (!candidate.existsSync()) {
      // Check in standard Android Downloads folder
      final resolvedName = fileName ?? _extractBasename(filePath);
      final downloadCandidate = File('/storage/emulated/0/Download/$resolvedName');
      if (downloadCandidate.existsSync()) {
        targetPath = downloadCandidate.path;
      } else {
        _showFloatingSnackBar(
          message: 'File not found. Export again.',
          isError: true,
        );
        return;
      }
    }

    try {
      final result = await OpenFilex.open(targetPath, type: mimeType);
      switch (result.type) {
        case ResultType.done:
          break;
        case ResultType.noAppToOpen:
          _showFloatingSnackBar(
            message: 'No app found to open this file. Find it in Downloads.',
            isWarning: true,
          );
          break;
        case ResultType.fileNotFound:
          _showFloatingSnackBar(
            message: 'File not found. Export again.',
            isError: true,
          );
          break;
        case ResultType.permissionDenied:
          _showFloatingSnackBar(
            message: 'Storage permission denied. Find file in Downloads.',
            isError: true,
          );
          break;
        case ResultType.error:
          _showFloatingSnackBar(
            message: 'Could not open file: ${result.message}',
            isError: true,
          );
          break;
      }
    } catch (e) {
      debugPrint('[ReportNotificationService] OpenFilex error: $e');
      _showFloatingSnackBar(
        message: 'Unable to open file: $e',
        isError: true,
      );
    }
  }

  /// Helper to display consistent floating snackbars across app screens and handlers.
  static void _showFloatingSnackBar({
    required String message,
    bool isError = false,
    bool isWarning = false,
  }) {
    final ctx = appNavigatorKey.currentContext;
    if (ctx == null) return;

    final color = isError
        ? AppColors.statRed
        : isWarning
            ? Colors.orange.shade800
            : AppColors.primaryGreen;

    final icon = isError
        ? Icons.error_outline_rounded
        : isWarning
            ? Icons.warning_amber_rounded
            : Icons.check_circle_outline_rounded;

    ScaffoldMessenger.of(ctx).hideCurrentSnackBar();
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        backgroundColor: color,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
