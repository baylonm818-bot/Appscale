import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/section_card.dart';
import '../models/dashboard_models.dart';

class NutritionStatusCard extends StatelessWidget {
  final List<NutritionStatusItem> items;
  const NutritionStatusCard({super.key, required this.items});

  String _shortLabel(String label) {
    if (label == 'Severely Underweight') return 'Severely UW';
    return label;
  }

  Widget _buildStackedBar(List<NutritionStatusItem> items) {
    final positiveItems = items.where((i) => i.count > 0).toList();
    if (positiveItems.isEmpty) {
      return Container(
        height: 14,
        decoration: BoxDecoration(
          color: AppColors.neutralGrayBg,
          borderRadius: BorderRadius.circular(7),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(7),
      child: SizedBox(
        height: 14,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: positiveItems.map((item) {
            return Expanded(
              flex: item.count,
              child: Container(
                color: item.color,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildLegendItem(NutritionStatusItem? item) {
    if (item == null) return const SizedBox();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: item.color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            '${_shortLabel(item.label)} ${item.count} (${item.percent.toStringAsFixed(1)}%)',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
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
    NutritionStatusItem? findItem(String label) {
      try {
        return items.firstWhere((i) => i.label == label);
      } catch (_) {
        return null;
      }
    }

    final normalItem = findItem('Normal') ??
        const NutritionStatusItem(
          label: 'Normal',
          count: 0,
          percent: 0,
          color: AppColors.primaryGreen,
        );
    final underweightItem = findItem('Underweight') ??
        const NutritionStatusItem(
          label: 'Underweight',
          count: 0,
          percent: 0,
          color: AppColors.statAmber,
        );
    final severelyUwItem = findItem('Severely Underweight') ??
        const NutritionStatusItem(
          label: 'Severely Underweight',
          count: 0,
          percent: 0,
          color: AppColors.statRed,
        );
    final overweightItem = findItem('Overweight') ??
        const NutritionStatusItem(
          label: 'Overweight',
          count: 0,
          percent: 0,
          color: AppColors.statBlue,
        );
    final notWeighedItem = findItem('Not weighed') ??
        const NutritionStatusItem(
          label: 'Not weighed',
          count: 0,
          percent: 0,
          color: AppColors.notWeighed,
        );

    return SectionCard(
      title: 'Nutritional Status (Weight-for-Age)',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStackedBar(items),
          const SizedBox(height: 14),
          // Row 1: Normal & Underweight
          Row(
            children: [
              Expanded(child: _buildLegendItem(normalItem)),
              const SizedBox(width: 8),
              Expanded(child: _buildLegendItem(underweightItem)),
            ],
          ),
          const SizedBox(height: 8),
          // Row 2: Severely UW & Overweight
          Row(
            children: [
              Expanded(child: _buildLegendItem(severelyUwItem)),
              const SizedBox(width: 8),
              Expanded(child: _buildLegendItem(overweightItem)),
            ],
          ),
          const SizedBox(height: 8),
          // Row 3: Not weighed & spacer
          Row(
            children: [
              Expanded(child: _buildLegendItem(notWeighedItem)),
              const SizedBox(width: 8),
              const Expanded(child: SizedBox()),
            ],
          ),
        ],
      ),
    );
  }
}
