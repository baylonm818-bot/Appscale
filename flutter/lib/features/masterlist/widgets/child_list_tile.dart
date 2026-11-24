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

  Widget _buildColumn(String type, String rawStatus) {
    final status = ChildStatusMeta.formatStatus(rawStatus);
    final color = ChildStatusMeta.colorFor(status);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          type,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: AppColors.textMuted,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          status,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: color == AppColors.primaryGreen ? AppColors.darkGreen : color,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final overall = ChildOverallStatus.fromChild(child);

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
                    // Colored strip on the left edge by overall status
                    Container(
                      width: 5,
                      color: overall.color,
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
                                child.initials,
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
                                  // Line 1: Child Name and One Main Status Chip on the right
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          child.fullName,
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
                                      StatusBadge(
                                        label: overall.label,
                                        color: overall.color,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  // Line 2: Age and Purok (without barangay name)
                                  Text(
                                    '${child.ageDisplay} · ${child.formattedAddress.isNotEmpty ? child.formattedAddress : "Purok"}',
                                    style: AppTextStyles.caption.copyWith(
                                      fontSize: 12,
                                      color: AppColors.textMuted,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 8),
                                  // Line 3: Single row of three equal columns (WFA, HFA, WFH)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: AppColors.background,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(child: _buildColumn('WFA', child.nutritionStatus)),
                                        Container(width: 1, height: 22, color: AppColors.border),
                                        Expanded(child: _buildColumn('HFA', child.stuntingStatus)),
                                        Container(width: 1, height: 22, color: AppColors.border),
                                        Expanded(child: _buildColumn('WFH', child.wastingStatus)),
                                      ],
                                    ),
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
