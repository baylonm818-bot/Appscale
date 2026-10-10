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

  int _severityRank(String status) {
    final s = status.toLowerCase();
    if (s == 'sam' || s.contains('severely') || s == 'sst' || s == 'suw') return 0;
    if (s == 'mam' || s == 'underweight' || s == 'stunted' || s == 'obese' || s == 'overweight' || s == 'uw' || s == 'st' || s == 'ob' || s == 'ow') return 1;
    if (s == 'normal' || s == 'tall' || s == 'n') return 2;
    if (s == 'not weighed') return 3;
    return 4;
  }

  @override
  Widget build(BuildContext context) {
    final isNotWeighed = child.nutritionStatus.trim().toLowerCase() == 'not weighed' ||
        child.nutritionStatus.trim().isEmpty;

    final List<_StatusChipData> chips = [];

    if (isNotWeighed) {
      chips.add(_StatusChipData(
        label: 'Not weighed',
        color: AppColors.notWeighed,
        severity: 3,
      ));
    } else {
      final wfaFormatted = ChildStatusMeta.formatStatus(child.nutritionStatus);
      chips.add(_StatusChipData(
        label: 'WFA: $wfaFormatted',
        color: ChildStatusMeta.colorFor(wfaFormatted),
        severity: _severityRank(wfaFormatted),
      ));

      if (child.stuntingStatus.isNotEmpty &&
          child.stuntingStatus.toLowerCase() != 'not weighed') {
        final hfaFormatted = ChildStatusMeta.formatStatus(child.stuntingStatus);
        chips.add(_StatusChipData(
          label: 'HFA: $hfaFormatted',
          color: ChildStatusMeta.colorFor(hfaFormatted),
          severity: _severityRank(hfaFormatted),
        ));
      }

      if (child.wastingStatus.isNotEmpty &&
          child.wastingStatus.toLowerCase() != 'not weighed') {
        final wfhFormatted = ChildStatusMeta.formatStatus(child.wastingStatus);
        chips.add(_StatusChipData(
          label: 'WFH: $wfhFormatted',
          color: ChildStatusMeta.colorFor(wfhFormatted),
          severity: _severityRank(wfhFormatted),
        ));
      }

      // Sort so most severe status (lowest rank number) appears first
      chips.sort((a, b) => a.severity.compareTo(b.severity));
    }

    final topColor = chips.isNotEmpty ? chips.first.color : AppColors.primaryGreen;

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
              border: Border.all(
                color: isNotWeighed
                    ? AppColors.border
                    : topColor.withValues(alpha: 0.35),
                width: isNotWeighed ? 1.0 : 1.2,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: isNotWeighed
                        ? AppColors.notWeighed.withValues(alpha: 0.15)
                        : topColor.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isNotWeighed
                          ? AppColors.notWeighed.withValues(alpha: 0.4)
                          : topColor.withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    child.initials,
                    style: TextStyle(
                      color: isNotWeighed
                          ? AppColors.textMuted
                          : (topColor == AppColors.primaryGreen
                              ? AppColors.darkGreen
                              : topColor),
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
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${child.ageDisplay} · ${child.formattedAddress}',
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
                        children: chips
                            .map((chip) => StatusBadge(
                                  label: chip.label,
                                  color: chip.color,
                                ))
                            .toList(),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusChipData {
  final String label;
  final Color color;
  final int severity;

  _StatusChipData({
    required this.label,
    required this.color,
    required this.severity,
  });
}
