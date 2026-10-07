import 'package:flutter/material.dart';
import '../../../core/theme/app_text_styles.dart';
import '../models/dashboard_models.dart';

/// Sizes itself to its own content — no forced aspect ratio. Two of these
/// placed in an IntrinsicHeight Row will always match each other's height
/// naturally, and neither can ever overflow regardless of device font
/// scaling or screen density.
class StatCard extends StatelessWidget {
  final StatCardData data;
  final VoidCallback? onTap;
  const StatCard({super.key, required this.data, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: data.accentColor,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: data.accentColor.withValues(alpha: 0.35),
              blurRadius: 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              data.value,
              style: AppTextStyles.h1.copyWith(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              data.label,
              style: AppTextStyles.body.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              data.subtitle,
              style: AppTextStyles.body.copyWith(
                fontSize: 10,
                color: Colors.white.withValues(alpha: 0.88),
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
