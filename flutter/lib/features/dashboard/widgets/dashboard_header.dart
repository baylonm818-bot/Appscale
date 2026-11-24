import 'package:flutter/material.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/utils/barangay_assets.dart';
import '../../../shared/widgets/app_gradient_header.dart';

class DashboardHeader extends StatelessWidget {
  final String bnsName;
  final String barangayName;
  final int pendingSyncCount;
  final int failedSyncCount;
  final int unreadNotificationCount;
  final String? profileImageUrl;
  final VoidCallback onNotificationTap;
  final VoidCallback? onSyncTap;
  final VoidCallback? onProfileTap;

  const DashboardHeader({
    super.key,
    required this.bnsName,
    required this.barangayName,
    this.pendingSyncCount = 0,
    this.failedSyncCount = 0,
    this.unreadNotificationCount = 0,
    this.profileImageUrl,
    required this.onNotificationTap,
    this.onSyncTap,
    this.onProfileTap,
  });

  /// Normalizes profile picture URL to handle server paths and fallbacks
  static String? normalizeProfileImageUrl(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final resolved = ApiConstants.resolveMediaUrl(value);
    return resolved.isNotEmpty ? resolved : null;
  }

  Widget _buildBarangayAvatar() {
    final cleanBarangay = barangayName.replaceFirst(RegExp(r'^Barangay\s+', caseSensitive: false), '').trim();
    final sealAssetPath = getBarangaySealAssetPath(cleanBarangay);

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipOval(
        child: Image.asset(
          sealAssetPath,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _buildFallbackProfileAvatar(),
        ),
      ),
    );
  }

  Widget _buildFallbackProfileAvatar() {
    final initials = bnsName.trim().split(RegExp(r'\s+')).length >= 2
        ? (bnsName.trim().split(RegExp(r'\s+'))[0][0] +
                bnsName.trim().split(RegExp(r'\s+'))[1][0])
            .toUpperCase()
        : (bnsName.trim().isNotEmpty ? bnsName.trim()[0].toUpperCase() : 'B');

    return Container(
      alignment: Alignment.center,
      color: Colors.white,
      child: Text(
        initials,
        style: const TextStyle(
          color: AppColors.darkGreen,
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppGradientHeader(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Compact greeting & Barangay Name & Sync Status Pill
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Welcome, $bnsName',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  barangayName,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                // Sync status pill ("0 pending")
                InkWell(
                  onTap: onSyncTap,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: pendingSyncCount > 0
                          ? AppColors.statOrange.withValues(alpha: 0.25)
                          : Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: pendingSyncCount > 0
                            ? AppColors.statOrange.withValues(alpha: 0.6)
                            : Colors.white.withValues(alpha: 0.35),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          pendingSyncCount > 0 ? Icons.sync_problem : Icons.cloud_done_outlined,
                          size: 13,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          '$pendingSyncCount pending',
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
              ],
            ),
          ),
          const SizedBox(width: 12),

          // 2. Notification bell with non-overlapping badge
          GestureDetector(
            onTap: onNotificationTap,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  const Icon(
                    Icons.notifications_outlined,
                    color: Colors.white,
                    size: 20,
                  ),
                  if (unreadNotificationCount > 0)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: AppColors.statRed,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.darkGreen, width: 1.5),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 15,
                          minHeight: 15,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          unreadNotificationCount > 9 ? '9+' : '$unreadNotificationCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                            height: 1,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),

          // 3. Barangay logo avatar
          GestureDetector(
            onTap: onProfileTap,
            child: _buildBarangayAvatar(),
          ),
        ],
      ),
    );
  }
}
