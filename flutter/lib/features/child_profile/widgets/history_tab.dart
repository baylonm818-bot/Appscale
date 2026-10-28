import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../shared/widgets/empty_state.dart';
import 'edit_measurement_dialog.dart';
import 'measurement_tile.dart';

class HistoryTab extends StatefulWidget {
  final String childId;
  final Child? child;

  const HistoryTab({super.key, required this.childId, this.child});

  @override
  State<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<HistoryTab> {
  bool _newestFirst = true;

  Future<void> _handleEdit(BuildContext context, Child resolvedChild, Measurement m) async {
    final updated = await EditMeasurementDialog.show(
      context,
      child: resolvedChild,
      measurement: m,
    );
    if (updated == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Measurement updated successfully.'),
          backgroundColor: AppColors.primaryGreen,
        ),
      );
    }
  }

  Future<void> _handleDelete(BuildContext context, Child resolvedChild, Measurement m) async {
    final formattedDate = AppDateFormat.format(m.date);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Measurement'),
        content: Text(
          'Are you sure you want to delete the measurement from $formattedDate? Nutritional status will be recomputed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await MeasurementRepository().deleteMeasurement(
        childId: resolvedChild.id,
        recordDate: m.date,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Measurement deleted and status recomputed.'),
            backgroundColor: AppColors.primaryGreen,
          ),
        );
      }
    }
  }

  String _formatDate(DateTime d) => AppDateFormat.format(d);

  @override
  Widget build(BuildContext context) {
    final rawMeasurements = MeasurementRepository().getForChild(widget.childId);
    final resolvedChild = widget.child ?? ChildRepository().getById(widget.childId);

    final measurements = List<Measurement>.from(rawMeasurements);
    measurements.sort((a, b) => _newestFirst ? b.date.compareTo(a.date) : a.date.compareTo(b.date));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Measurement History',
                style: AppTextStyles.h1.copyWith(fontSize: 18),
              ),
              if (measurements.isNotEmpty)
                InkWell(
                  onTap: () {
                    setState(() {
                      _newestFirst = !_newestFirst;
                    });
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _newestFirst ? Icons.arrow_downward : Icons.arrow_upward,
                          size: 14,
                          color: AppColors.primaryGreen,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _newestFirst ? 'Newest' : 'Oldest',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (measurements.isEmpty)
            const EmptyState(
              icon: Icons.timeline_outlined,
              message:
                  'No measurements recorded yet. Tap "+ Measure" to log the first one.',
            )
          else ...[
            Builder(
              builder: (context) {
                // Find latest valid/plausible measurement
                // If newestFirst, measurements is ordered newest to oldest, so the first plausible is the latest.
                // If oldestFirst, the last plausible is the latest.
                final latestValidMeasurement = _newestFirst
                    ? measurements.where((m) => m.isPlausible).firstOrNull
                    : measurements.where((m) => m.isPlausible).lastOrNull;

                return Column(
                  children: List.generate(
                    measurements.length,
                    (i) {
                      final m = measurements[i];
                      final isLatest = m.isPlausible && (m == latestValidMeasurement);
                      return MeasurementTile(
                        measurement: m,
                        isLatest: isLatest,
                        onEdit: resolvedChild != null
                            ? () => _handleEdit(context, resolvedChild, m)
                            : null,
                        onDelete: resolvedChild != null
                            ? () => _handleDelete(context, resolvedChild, m)
                            : null,
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
