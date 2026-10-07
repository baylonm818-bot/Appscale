import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../models/dashboard_models.dart';

/// Web-portal–style stat card: white background, large metric on the left,
/// coloured circular icon on the right — exactly matching the Admin Dashboard.
class StatCard extends StatelessWidget {
  final StatCardData data;
  final VoidCallback? onTap;
  const StatCard({super.key, required this.data, this.onTap});

  @override
  Widget build(BuildContext context) {
    final isPositiveSub = data.subtitle.startsWith('↑') ||
        data.subtitle.contains('this month') && !data.subtitle.startsWith('No');

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: number + label + subtitle
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Label row (small, muted)
                  Text(
                    data.label,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  // Big value
                  Text(
                    data.value,
                    style: AppTextStyles.h1.copyWith(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                      height: 1.0,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  // Subtitle with optional colour indicator
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          data.subtitle,
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 10,
                            color: isPositiveSub
                                ? AppColors.primaryGreen
                                : AppColors.textMuted,
                            fontWeight: isPositiveSub
                                ? FontWeight.w600
                                : FontWeight.normal,
                            height: 1.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Right: coloured circular icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: data.accentColor.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                data.icon,
                color: data.accentColor,
                size: 22,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
