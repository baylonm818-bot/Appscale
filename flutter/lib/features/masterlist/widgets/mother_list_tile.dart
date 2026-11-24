import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/mother.dart';
import '../utils/mother_status_meta.dart';
import 'status_badge.dart';

class MotherListTile extends StatelessWidget {
  final Mother mother;
  final VoidCallback onTap;

  const MotherListTile({super.key, required this.mother, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final formattedStatus = MotherStatusMeta.formatStatus(mother.riskStatus);
    final color = mother.isActive
        ? MotherStatusMeta.colorFor(formattedStatus)
        : AppColors.textMuted;
    final label = mother.isActive ? formattedStatus : 'Inactive';

    final initials = mother.fullName.trim().split(RegExp(r'\s+')).length >= 2
        ? (mother.fullName.trim().split(RegExp(r'\s+'))[0][0] +
                mother.fullName.trim().split(RegExp(r'\s+'))[1][0])
            .toUpperCase()
        : (mother.fullName.isNotEmpty ? mother.fullName[0].toUpperCase() : '?');

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
                      color: color,
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
                                initials,
                                style: const TextStyle(
                                  color: AppColors.darkGreen,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            // Details column
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
                                          mother.fullName,
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
                                      StatusBadge(label: label, color: color),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  // Line 2: Age · Address
                                  Text(
                                    '${mother.ageLabel} · ${mother.formattedAddress}',
                                    style: AppTextStyles.caption.copyWith(
                                      fontSize: 11.5,
                                      color: AppColors.textMuted,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  // Line 3: Breastfeeding practice and labeled status chip
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.child_care,
                                        size: 13,
                                        color: AppColors.textMuted,
                                      ),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          mother.breastfeedingPractice.trim().isNotEmpty
                                              ? mother.breastfeedingPractice
                                              : 'Not recorded',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textSecondary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      StatusBadge(
                                        label: formattedStatus,
                                        color: color,
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
