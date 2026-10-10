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
        ? (mother.fullName.trim().split(RegExp(r'\s+'))[0][0] + mother.fullName.trim().split(RegExp(r'\s+'))[1][0]).toUpperCase()
        : (mother.fullName.isNotEmpty ? mother.fullName[0].toUpperCase() : '?');

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.statAmber.withValues(alpha: 0.12),
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
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        mother.fullName,
                        style: AppTextStyles.label.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        mother.formattedAddress,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(label: label, color: color),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
