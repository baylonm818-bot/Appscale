import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/child.dart';
import '../utils/child_status_meta.dart';
import 'status_badge.dart';

class ChildListTile extends StatelessWidget {
  final Child child;
  final VoidCallback onTap;

  const ChildListTile({super.key, required this.child, required this.onTap});

  Widget _buildIndicator(String type, String rawStatus) {
    final status = ChildStatusMeta.formatStatus(rawStatus);
    final color = ChildStatusMeta.colorFor(status);
    String shortText;
    switch (status) {
      case 'Severely Underweight':
      case 'Severely Stunted':
        shortText = 'Severe';
        break;
      case 'Underweight':
        shortText = 'Underwt';
        break;
      case 'Stunted':
        shortText = 'Stunted';
        break;
      case 'SAM':
        shortText = 'SAM';
        break;
      case 'MAM':
        shortText = 'MAM';
        break;
      case 'Overweight':
        shortText = 'Overwt';
        break;
      case 'Obese':
        shortText = 'Obese';
        break;
      case 'Normal':
        shortText = 'Normal';
        break;
      case 'Tall':
        shortText = 'Tall';
        break;
      case 'Not weighed':
        shortText = '--';
        break;
      default:
        shortText = status;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            '$type · $shortText',
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final overall = ChildOverallStatus.fromChild(child);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1.0),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(11),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 4px colored strip on the left edge
                    Container(
                      width: 4,
                      color: overall.color,
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Neutral light green avatar
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: AppColors.darkGreen.withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                child.initials,
                                style: const TextStyle(
                                  color: AppColors.darkGreen,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            // Info column
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Line 1: Name and Overall Status Badge
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          child.fullName,
                                          style: AppTextStyles.label.copyWith(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      StatusBadge(
                                        label: overall.label,
                                        color: overall.color,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  // Line 2: Age · Address
                                  Text(
                                    '${child.ageDisplay} · ${child.formattedAddress}',
                                    style: AppTextStyles.caption.copyWith(
                                      fontSize: 11.5,
                                      color: AppColors.textMuted,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 5),
                                  // Line 3: 3 small indicators side-by-side in one row
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _buildIndicator('WFA', child.nutritionStatus),
                                      ),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: _buildIndicator('HFA', child.stuntingStatus),
                                      ),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: _buildIndicator('WFH', child.wastingStatus),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(
                              Icons.chevron_right,
                              size: 18,
                              color: AppColors.textMuted,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
