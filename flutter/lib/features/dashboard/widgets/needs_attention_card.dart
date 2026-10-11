import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/child.dart';
import '../../../shared/widgets/section_card.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';

class NeedsAttentionCard extends StatelessWidget {
  final List<Child> children;
  final VoidCallback onViewAll;
  final ValueChanged<Child> onChildTap;

  const NeedsAttentionCard({
    super.key,
    required this.children,
    required this.onViewAll,
    required this.onChildTap,
  });

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Needs Attention',
      trailing: children.isNotEmpty
          ? InkWell(
              onTap: onViewAll,
              borderRadius: BorderRadius.circular(8),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Text(
                  'View all',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryGreen,
                  ),
                ),
              ),
            )
          : null,
      child: children.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.check_circle_outline,
                    color: AppColors.primaryGreen,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'No children need attention',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12.5,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                for (int i = 0; i < children.length; i++) ...[
                  _ChildRow(
                    child: children[i],
                    onTap: () => onChildTap(children[i]),
                  ),
                  if (i != children.length - 1)
                    const Divider(height: 16, color: AppColors.border),
                ],
              ],
            ),
    );
  }
}

class _ChildRow extends StatelessWidget {
  final Child child;
  final VoidCallback onTap;

  const _ChildRow({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final overall = ChildOverallStatus.fromChild(child);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
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
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    child.fullName,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${child.ageDisplay} · ${child.formattedAddress}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            StatusBadge(
              label: overall.label,
              color: overall.color,
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right,
              size: 16,
              color: AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
