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
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Colored strip on the left edge
                    Container(
                      width: 5,
                      color: color,
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Avatar
                            Container(
                              width: 42,
                              height: 42,
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
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Line 1: Mother Name and Risk Status on right
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          mother.fullName,
                                          style: AppTextStyles.label.copyWith(
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      StatusBadge(label: label, color: color),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  // Line 2: Age · Address
                                  Text(
                                    '${mother.ageLabel} · ${mother.formattedAddress}',
                                    style: AppTextStyles.caption.copyWith(
                                      fontSize: 12,
                                      color: AppColors.textMuted,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 6),
                                  // Line 3: Breastfeeding practice
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
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textSecondary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
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
