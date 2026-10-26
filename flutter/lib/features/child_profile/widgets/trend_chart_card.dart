import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/measurement.dart';

/// One reusable line chart card — weight, height, and MUAC trends all
/// use this same widget with a different color and value selector,
/// instead of three near-identical chart implementations.
class TrendChartCard extends StatelessWidget {
  final String title;
  final Color color;
  final List<Measurement> measurementsAscending;
  final double? Function(Measurement) valueOf;

  const TrendChartCard({
    super.key,
    required this.title,
    required this.color,
    required this.measurementsAscending,
    required this.valueOf,
  });

  static const _monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (int i = 0; i < measurementsAscending.length; i++) {
      final v = valueOf(measurementsAscending[i]);
      if (v == null) continue;
      spots.add(FlSpot(i.toDouble(), v));
    }

    if (spots.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: AppTextStyles.h2.copyWith(fontSize: 15, color: color),
            ),
            const SizedBox(height: 16),
            Container(
              height: 100,
              alignment: Alignment.center,
              child: Text(
                'No $title data recorded yet.',
                style: AppTextStyles.body.copyWith(
                  fontSize: 12,
                  color: AppColors.textMuted,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (spots.length == 1) {
      final singleSpot = spots.first;
      final singleDate = measurementsAscending.first.date;
      final dateLabel = '${_monthLabels[singleDate.month - 1]} ${singleDate.day}, ${singleDate.year}';

      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: AppTextStyles.h2.copyWith(fontSize: 15, color: color),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '1 measurement',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.show_chart, color: color, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${singleSpot.y.toStringAsFixed(1)} ${title.toLowerCase().contains("weight") ? "kg" : "cm"}',
                          style: AppTextStyles.h2.copyWith(fontSize: 18, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Recorded on $dateLabel',
                          style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.info_outline, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Add another measurement to see trend lines and progress.',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 11.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b);
    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final yPadding = (maxY - minY == 0)
        ? 2.0
        : ((maxY - minY) * 0.2).clamp(0.5, 5.0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.h2.copyWith(fontSize: 15, color: color),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 180,
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: (measurementsAscending.length - 1).toDouble(),
                minY: (minY - yPadding).clamp(0.0, double.infinity),
                maxY: maxY + yPadding,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: _yInterval(spots),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 34,
                      getTitlesWidget: (v, _) => Text(
                        v.toStringAsFixed(0),
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 1.0,
                      reservedSize: 24,
                      getTitlesWidget: (value, _) {
                        if (value % 1 != 0) return const SizedBox.shrink();
                        final index = value.toInt();
                        if (index < 0 || index >= measurementsAscending.length) {
                          return const SizedBox.shrink();
                        }
                        final m = measurementsAscending[index];
                        final dateStr = '${m.date.day} ${_monthLabels[m.date.month - 1]}';
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            dateStr,
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.textMuted,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: spots.length > 1,
                    color: color,
                    barWidth: 3,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, pct, bar, index) =>
                          FlDotCirclePainter(
                            radius: 4,
                            color: color,
                            strokeWidth: 0,
                          ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      color: color.withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          // WHO Growth Standards / Standard Deviation (SD) Legend
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.info_outline, size: 13, color: AppColors.textMuted),
                    const SizedBox(width: 5),
                    Text(
                      'WHO Growth Standards / SD Reference',
                      style: AppTextStyles.caption.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    _sdBadge('<-3SD', 'Severe', const Color(0xFFEF4444)),
                    _sdBadge('-3SD to -2SD', 'Moderate', const Color(0xFFF97316)),
                    _sdBadge('-2SD to +2SD', 'Median / Normal', const Color(0xFF22C55E)),
                    _sdBadge('>+2SD', 'Overweight / High', const Color(0xFF3B82F6)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sdBadge(String sd, String label, Color c) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: c,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          '$sd ($label)',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  double _yInterval(List<FlSpot> spots) {
    if (spots.isEmpty) return 1;
    final values = spots.map((s) => s.y);
    final range =
        values.reduce((a, b) => a > b ? a : b) -
        values.reduce((a, b) => a < b ? a : b);
    if (range <= 0) return 1;
    return (range / 4).clamp(0.5, double.infinity);
  }
}
