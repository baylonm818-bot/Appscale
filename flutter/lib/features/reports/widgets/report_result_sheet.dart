import 'dart:io';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';

/// Modal bottom sheet presented after a report file is generated.
///
/// Saves the file in the app documents directory and provides 3 explicit user actions:
/// 1. "Open" — launches the system "Open with" chooser (PDF viewer, Drive, WPS, etc.)
/// 2. "Share" — triggers the system share sheet
/// 3. "Save to Downloads" — copies the file to the device's public Downloads directory
class ReportResultSheet extends StatelessWidget {
  final File file;
  final String title;
  final String mimeType;

  const ReportResultSheet({
    super.key,
    required this.file,
    required this.title,
    this.mimeType = 'application/pdf',
  });

  static Future<void> show(
    BuildContext context, {
    required File file,
    required String title,
    String mimeType = 'application/pdf',
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ReportResultSheet(
        file: file,
        title: title,
        mimeType: mimeType,
      ),
    );
  }

  String get _fileName => file.uri.pathSegments.isNotEmpty
      ? file.uri.pathSegments.last
      : 'Report.pdf';

  String get _fileSizeDisplay {
    try {
      final len = file.lengthSync();
      if (len < 1024) return '$len B';
      if (len < 1024 * 1024) return '${(len / 1024).toStringAsFixed(1)} KB';
      return '${(len / (1024 * 1024)).toStringAsFixed(1)} MB';
    } catch (_) {
      return '';
    }
  }

  Future<void> _handleOpen(BuildContext context) async {
    Navigator.pop(context);
    try {
      final result = await OpenFilex.open(
        file.path,
        type: mimeType.isNotEmpty ? mimeType : 'application/pdf',
      );

      if (result.type != ResultType.done) {
        final errorMsg = result.type == ResultType.noAppToOpen
            ? 'No compatible app found to open this PDF file. You can use Share to view or send it.'
            : 'Could not open file: ${result.message}';

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMsg),
              backgroundColor: AppColors.statOrange,
              duration: const Duration(seconds: 5),
              action: SnackBarAction(
                label: 'Share',
                textColor: Colors.white,
                onPressed: () {
                  Share.shareXFiles(
                    [XFile(file.path, mimeType: mimeType, name: _fileName)],
                    text: title,
                  );
                },
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error opening file: $e. You can use Share instead.'),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Share',
              textColor: Colors.white,
              onPressed: () {
                Share.shareXFiles(
                  [XFile(file.path, mimeType: mimeType, name: _fileName)],
                  text: title,
                );
              },
            ),
          ),
        );
      }
    }
  }

  Future<void> _handleShare(BuildContext context) async {
    Navigator.pop(context);
    try {
      await Share.shareXFiles(
        [XFile(file.path, mimeType: mimeType, name: _fileName)],
        text: title,
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to share file: $e')),
        );
      }
    }
  }

  Future<void> _handleSaveToDownloads(BuildContext context) async {
    Navigator.pop(context);
    try {
      Directory? downloadsDir;
      if (Platform.isAndroid) {
        final pubDir = Directory('/storage/emulated/0/Download');
        if (pubDir.existsSync()) {
          downloadsDir = pubDir;
        } else {
          downloadsDir = await getDownloadsDirectory();
        }
      } else {
        downloadsDir = await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
      }

      if (downloadsDir != null) {
        if (!downloadsDir.existsSync()) {
          downloadsDir.createSync(recursive: true);
        }
        final targetPath = '${downloadsDir.path}/$_fileName';
        final savedFile = await file.copy(targetPath);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Saved to Downloads: ${savedFile.uri.pathSegments.last}'),
              backgroundColor: AppColors.primaryGreen,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else {
        throw Exception('Downloads directory not available on this device');
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not save to Downloads: $e. Use Share to save to your desired folder.'),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Share',
              textColor: Colors.white,
              onPressed: () {
                Share.shareXFiles(
                  [XFile(file.path, mimeType: mimeType, name: _fileName)],
                  text: title,
                );
              },
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle_outline,
                    color: AppColors.darkGreen,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Report Generated',
                        style: AppTextStyles.h2.copyWith(fontSize: 16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _fileSizeDisplay.isNotEmpty
                            ? '$_fileName · $_fileSizeDisplay'
                            : _fileName,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: AppSpacing.sm),

            // Action 1: Open with system chooser
            _ActionTile(
              icon: Icons.open_in_new_rounded,
              iconColor: AppColors.darkGreen,
              title: 'Open',
              subtitle: 'Choose app to view (PDF Viewer, Drive, WPS)',
              onTap: () => _handleOpen(context),
            ),

            // Action 2: Share system sheet
            _ActionTile(
              icon: Icons.share_outlined,
              iconColor: AppColors.statBlue,
              title: 'Share',
              subtitle: 'Send via Messenger, Bluetooth, or nearby share',
              onTap: () => _handleShare(context),
            ),

            // Action 3: Save to Downloads
            _ActionTile(
              icon: Icons.download_rounded,
              iconColor: AppColors.primaryGreen,
              title: 'Save to Downloads',
              subtitle: 'Copy file to device Downloads folder',
              onTap: () => _handleSaveToDownloads(context),
            ),

            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.textMuted,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: const Text('Dismiss', style: TextStyle(fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: iconColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTextStyles.label.copyWith(fontSize: 13),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        subtitle,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
