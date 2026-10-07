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
    final extraBadges = <Widget>[];
    final wfhFormatted = ChildStatusMeta.formatStatus(child.wastingStatus);
    if (wfhFormatted != 'Normal' && wfhFormatted != 'Not weighed') {
      extraBadges.add(
        StatusBadge(
          label: 'WFH: $wfhFormatted',
          color: ChildStatusMeta.colorFor(wfhFormatted),
        ),
      );
    }
    final hfaFormatted = ChildStatusMeta.formatStatus(child.stuntingStatus);
    if (hfaFormatted == 'Stunted' || hfaFormatted == 'Severely Stunted') {
      extraBadges.add(
        StatusBadge(
          label: 'HFA: $hfaFormatted',
          color: ChildStatusMeta.colorFor(hfaFormatted),
        ),
      );
    }

    final wfaFormatted = ChildStatusMeta.formatStatus(child.nutritionStatus);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: needsAttention
            ? AppColors.statRed.withValues(alpha: 0.06)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: needsAttention
                    ? AppColors.statRed.withValues(alpha: 0.3)
                    : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (needsAttention)
                      const Padding(
                        padding: EdgeInsets.only(right: 6),
                        child: Icon(
                          Icons.error_outline,
                          size: 18,
                          color: AppColors.statRed,
                        ),
                      ),
                    Expanded(
                      child: Text(
                        child.fullName,
                        style: AppTextStyles.label.copyWith(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${child.ageInMonths} mos · ${child.address.startsWith("Purok") ? child.address : "Purok ${child.address}"}',
                  style: AppTextStyles.body.copyWith(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    StatusBadge(
                      label: 'WFA: $wfaFormatted',
                      color: ChildStatusMeta.colorFor(wfaFormatted),
                    ),
                    ...extraBadges,
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
