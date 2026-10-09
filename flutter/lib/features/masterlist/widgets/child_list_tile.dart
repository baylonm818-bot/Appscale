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

  @override
  Widget build(BuildContext context) {
    final needsAttention = ChildStatusMeta.needsAttention(
      child.nutritionStatus,
    );
    final wfaFormatted = ChildStatusMeta.formatStatus(child.nutritionStatus);
    final wfhFormatted = ChildStatusMeta.formatStatus(child.wastingStatus);
    final hfaFormatted = ChildStatusMeta.formatStatus(child.stuntingStatus);

    String? secondaryLabel;
    Color? secondaryColor;

    if (wfhFormatted == 'SAM' || wfhFormatted == 'MAM') {
      secondaryLabel = 'WFH: $wfhFormatted';
      secondaryColor = ChildStatusMeta.colorFor(wfhFormatted);
    } else if (hfaFormatted == 'Stunted' || hfaFormatted == 'Severely Stunted') {
      secondaryLabel = 'HFA: $hfaFormatted';
      secondaryColor = ChildStatusMeta.colorFor(hfaFormatted);
    }

    final ageStr = child.ageDisplay;
    final addressStr = child.formattedAddress;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: needsAttention
            ? AppColors.neutralGrayBg
            : AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: needsAttention
                    ? AppColors.neutralGray.withValues(alpha: 0.35)
                    : AppColors.border,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: needsAttention
                        ? AppColors.neutralGray.withValues(alpha: 0.16)
                        : AppColors.primaryGreen.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    child.initials,
                    style: TextStyle(
                      color: needsAttention ? AppColors.neutralGray : AppColors.darkGreen,
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
                        child.fullName,
                        style: AppTextStyles.label.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$ageStr · $addressStr',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          StatusBadge(
                            label: 'WFA: $wfaFormatted',
                            color: ChildStatusMeta.colorFor(wfaFormatted),
                          ),
                          if (secondaryLabel != null && secondaryColor != null)
                            StatusBadge(
                              label: secondaryLabel,
                              color: secondaryColor,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
