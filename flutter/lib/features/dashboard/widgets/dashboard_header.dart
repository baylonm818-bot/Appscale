import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_gradient_header.dart';

class DashboardHeader extends StatelessWidget {
  final String bnsName;
  final String barangayName;
  final int pendingSyncCount;
  final int failedSyncCount;
  final int unreadNotificationCount;
  final String? profileImageUrl;
  final VoidCallback onNotificationTap;
  final VoidCallback onSyncTap;
  final VoidCallback? onProfileTap;

  const DashboardHeader({
    super.key,
    required this.bnsName,
    required this.barangayName,
    required this.pendingSyncCount,
    this.failedSyncCount = 0,
    this.unreadNotificationCount = 0,
    this.profileImageUrl,
    required this.onNotificationTap,
    required this.onSyncTap,
    this.onProfileTap,
  });

  static String? normalizeProfileImageUrl(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final resolved = ApiConstants.resolveMediaUrl(value);
    return resolved.isNotEmpty ? resolved : null;
  }

  Widget _buildAvatarWidget(String? rawUrl, String initials) {
    if (rawUrl == null || rawUrl.trim().isEmpty) {
      return CircleAvatar(
        radius: 18,
        backgroundColor: Colors.white,
        child: Text(
          initials,
          style: const TextStyle(
            color: AppColors.darkGreen,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
    }

    final trimmed = rawUrl.trim();
    final isLocalPath = trimmed.contains('profile_photos') ||
        trimmed.startsWith('/data/') ||
        trimmed.startsWith('/storage/') ||
        trimmed.startsWith('/var/') ||
        trimmed.startsWith('file://') ||
        (Platform.isWindows && (trimmed.contains(r':\') || trimmed.contains(':/'))) ||
        (trimmed.startsWith('/') &&
            !trimmed.startsWith('/uploads/') &&
            !trimmed.startsWith('/profile-pictures/'));

    if (isLocalPath) {
      final cleanPath = trimmed.replaceFirst(RegExp(r'^file://'), '');
      final file = File(cleanPath);
      if (file.existsSync()) {
        return ClipOval(
          child: Image.file(
            file,
            width: 36,
            height: 36,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white,
              child: Text(
                initials,
                style: const TextStyle(
                  color: AppColors.darkGreen,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }
    }

    if (trimmed.startsWith('data:')) {
      try {
        final commaIdx = trimmed.indexOf(',');
        if (commaIdx != -1) {
          final bytes = base64Decode(trimmed.substring(commaIdx + 1));
          return ClipOval(
            child: Image.memory(
              bytes,
              width: 36,
              height: 36,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => CircleAvatar(
                radius: 18,
                backgroundColor: Colors.white,
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: AppColors.darkGreen,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          );
        }
      } catch (e) {
        debugPrint('[DashboardHeader] Base64 avatar decode error: $e');
      }
    }

    final networkUrl = normalizeProfileImageUrl(trimmed);
    if (networkUrl != null && (networkUrl.startsWith('http://') || networkUrl.startsWith('https://'))) {
      return ClipOval(
        child: Image.network(
          networkUrl,
          width: 36,
          height: 36,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => CircleAvatar(
            radius: 18,
            backgroundColor: Colors.white,
            child: Text(
              initials,
              style: const TextStyle(
                color: AppColors.darkGreen,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      );
    }

    return CircleAvatar(
      radius: 18,
      backgroundColor: Colors.white,
      child: Text(
        initials,
        style: const TextStyle(
          color: AppColors.darkGreen,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasFailed = failedSyncCount > 0;
    final syncLabel = hasFailed
        ? '$failedSyncCount failed'
        : (pendingSyncCount == 0 ? '0 pending' : '$pendingSyncCount pending');

    return AppGradientHeader(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome!',
                  style: AppTextStyles.body.copyWith(
                    color: Colors.white70,
                    fontSize: 15,
                  ),
                ),
                Text(
                  bnsName,
                  style: AppTextStyles.h1.copyWith(
                    color: Colors.white,
                    fontSize: 25,
                  ),
                ),
                Text(
                  barangayName,
                  style: AppTextStyles.body.copyWith(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onSyncTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: hasFailed
                    ? AppColors.statRed.withValues(alpha: 0.9)
                    : Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Icon(
                    hasFailed ? Icons.warning_amber_rounded : Icons.sync,
                    color: Colors.white,
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    syncLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onNotificationTap,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.notifications_outlined,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
                if (unreadNotificationCount > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.statRed,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        unreadNotificationCount > 9
                            ? '9+'
                            : '$unreadNotificationCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onProfileTap,
            child: _buildAvatarWidget(profileImageUrl, initials),
          ),
        ],
      ),
    );
  }
}
