import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/utils/app_month_year_picker.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../models/dashboard_models.dart';

class NutritionStatusCard extends StatefulWidget {
  final List<NutritionStatusItem> items;
  final int severeCount;
  final int selectedYear;
  final ValueChanged<int> onYearChanged;
  final void Function(String statusLabel) onTapCategory;
  final List<YearlyNutritionBreakdown> Function(String indicator) getYearlyComparison;

  const NutritionStatusCard({
    super.key,
    required this.items,
    required this.severeCount,
    required this.selectedYear,
    required this.onYearChanged,
    required this.onTapCategory,
    required this.getYearlyComparison,
  });

  @override
  State<NutritionStatusCard> createState() => _NutritionStatusCardState();
}

class _NutritionStatusCardState extends State<NutritionStatusCard> {
  String _activeIndicator = 'WFA'; // 'WFA', 'WFH', 'HFA'

  void _onYearTap() async {
    final picked = await showAppMonthYearPicker(
      context,
      initialDate: DateTime(widget.selectedYear, 1, 1),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      widget.onYearChanged(picked.year);
    }
  }

  @override
  Widget build(BuildContext context) {
    final yearlyData = widget.getYearlyComparison(_activeIndicator);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.035),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Accent line (Primary Green)
              Container(
                height: 3.5,
                width: double.infinity,
                color: AppColors.primaryGreen,
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header: Title + Year Selector
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Expanded(
                          child: Text(
                            'Nutritional Status (WHO)',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        // Year Selector `< 2026 >`
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              InkWell(
                                onTap: () => widget.onYearChanged(widget.selectedYear - 1),
                                borderRadius: BorderRadius.circular(12),
                                child: const Padding(
                                  padding: EdgeInsets.all(2),
                                  child: Icon(Icons.chevron_left, size: 16, color: AppColors.darkGreen),
                                ),
                              ),
                              InkWell(
                                onTap: _onYearTap,
                                borderRadius: BorderRadius.circular(8),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  child: Row(
                                    children: [
                                      Text(
                                        '${widget.selectedYear}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.darkGreen,
                                        ),
                                      ),
                                      const Icon(Icons.arrow_drop_down, size: 14, color: AppColors.darkGreen),
                                    ],
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () => widget.onYearChanged(widget.selectedYear + 1),
                                borderRadius: BorderRadius.circular(12),
                                child: const Padding(
                                  padding: EdgeInsets.all(2),
                                  child: Icon(Icons.chevron_right, size: 16, color: AppColors.darkGreen),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Callout for "Severe in any indicator: X"
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: widget.severeCount > 0
                            ? AppColors.statRed.withValues(alpha: 0.08)
                            : AppColors.lightGreenBg.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: widget.severeCount > 0
                              ? AppColors.statRed.withValues(alpha: 0.3)
                              : AppColors.primaryGreen.withValues(alpha: 0.3),
                          width: 0.8,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            widget.severeCount > 0 ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                            size: 15,
                            color: widget.severeCount > 0 ? AppColors.statRed : AppColors.darkGreen,
                          ),
                          const SizedBox(width: 7),
                          Expanded(
                            child: Text(
                              'Severe in any indicator: ${widget.severeCount}',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: widget.severeCount > 0 ? AppColors.statRed : AppColors.darkGreen,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Tappable Progress Bar Rows
                    if (widget.items.isEmpty)
                      const EmptyState(
                        icon: Icons.bar_chart_outlined,
                        message: 'No measurements recorded for this year.',
                      )
                    else
                      Column(
                        children: widget.items.map((item) {
                          return _buildTappableStatusRow(item);
                        }).toList(),
                      ),

                    const SizedBox(height: 16),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 14),

                    // Section: "Nutritional status by year"
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Nutritional status by year',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        // Segmented control: WFA | WFH | HFA
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: ['WFA', 'WFH', 'HFA'].map((indicator) {
                              final isSelected = _activeIndicator == indicator;
                              return InkWell(
                                onTap: () => setState(() => _activeIndicator = indicator),
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: isSelected ? AppColors.darkGreen : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    indicator,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                      color: isSelected ? Colors.white : AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Chart: 3-Year Comparison Stacked Bars
                    _buildYearlyComparisonChart(yearlyData),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTappableStatusRow(NutritionStatusItem item) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => widget.onTapCategory(item.label),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: item.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        item.label,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        '${item.count} (${item.percent.toStringAsFixed(1)}%)',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 3),
                      const Icon(Icons.chevron_right, size: 14, color: AppColors.textMuted),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: item.percent / 100,
                  minHeight: 6,
                  backgroundColor: item.color.withValues(alpha: 0.15),
                  valueColor: AlwaysStoppedAnimation(item.color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildYearlyComparisonChart(List<YearlyNutritionBreakdown> yearlyData) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row for each year
          ...yearlyData.map((data) {
            final total = data.totalWeighed;
            return Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 36,
                    child: Text(
                      '${data.year}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: total == 0
                        ? Container(
                            height: 12,
                            decoration: BoxDecoration(
                              color: AppColors.border.withValues(alpha: 0.4),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: const Text(
                              'No records',
                              style: TextStyle(fontSize: 8.5, color: AppColors.textMuted),
                            ),
                          )
                        : ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: SizedBox(
                              height: 14,
                              child: Row(
                                children: data.counts.entries.map((entry) {
                                  final pct = total > 0 ? (entry.value / total) : 0.0;
                                  if (pct <= 0) return const SizedBox();
                                  final color = ChildStatusMeta.colorFor(entry.key);
                                  return Expanded(
                                    flex: (pct * 100).round().clamp(1, 100),
                                    child: Container(
                                      color: color,
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 44,
                    child: Text(
                      '$total chld',
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 4),
          // Legend below
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: _getLegendForIndicator(_activeIndicator).map((leg) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: leg.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    leg.label,
                    style: const TextStyle(fontSize: 9.5, color: AppColors.textSecondary),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  List<_LegendItem> _getLegendForIndicator(String ind) {
    if (ind == 'WFA') {
      return [
        _LegendItem('Normal', AppColors.primaryGreen),
        _LegendItem('Underweight', AppColors.statOrange),
        _LegendItem('Severely Underweight', AppColors.statRed),
        _LegendItem('Overweight', AppColors.statBlue),
      ];
    } else if (ind == 'WFH') {
      return [
        _LegendItem('Normal', AppColors.primaryGreen),
        _LegendItem('Wasted', AppColors.statOrange),
        _LegendItem('SAM (Severely Wasted)', AppColors.statRed),
        _LegendItem('Overweight', AppColors.statBlue),
        _LegendItem('Obese', AppColors.statPurple),
      ];
    } else {
      return [
        _LegendItem('Normal', AppColors.primaryGreen),
        _LegendItem('Stunted', AppColors.statOrange),
        _LegendItem('Severely Stunted', AppColors.statRed),
        _LegendItem('Tall', const Color(0xFF00897B)),
      ];
    }
  }
}

class _LegendItem {
  final String label;
  final Color color;
  _LegendItem(this.label, this.color);
}
