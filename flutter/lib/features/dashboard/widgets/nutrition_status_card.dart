import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/section_card.dart';
import '../models/dashboard_models.dart';

class NutritionStatusCard extends StatelessWidget {
  final List<NutritionStatusItem> items;
  const NutritionStatusCard({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Nutritional Status (Weight-for-Age)',
      child: items.isEmpty
          ? const EmptyState(
              icon: Icons.bar_chart_outlined,
              message:
                  'No measurements recorded yet. This updates as children get weighed.',
            )
          : Column(
              children: [
                for (int i = 0; i < items.length; i++)
                  _StatusRow(
                    item: items[i],
                    isLast: i == items.length - 1,
                  ),
              ],
            ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  final NutritionStatusItem item;
  final bool isLast;
  const _StatusRow({required this.item, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(item.label, style: AppTextStyles.label),
              Text(
                '${item.count} (${item.percent.toStringAsFixed(1)}%)',
                style: AppTextStyles.body.copyWith(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: item.percent / 100,
              minHeight: 7,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(item.color),
            ),
          ),
        ],
      ),
    );
  }
}
