import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';
import '../../../shared/widgets/empty_state.dart';
import 'edit_measurement_dialog.dart';
import 'measurement_tile.dart';

class HistoryTab extends StatelessWidget {
  final String childId;
  final Child? child;

  const HistoryTab({super.key, required this.childId, this.child});

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
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Measurement'),
        content: Text(
          'Are you sure you want to delete the measurement from ${_formatDate(m.date)}? Nutritional status will be recomputed.',
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
            backgroundColor: AppColors.statRed,
          ),
        );
      }
    }
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final measurements = MeasurementRepository().getForChild(childId);
    final resolvedChild = child ?? ChildRepository().getById(childId);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Measurement History',
            style: AppTextStyles.h1.copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.md),
          if (measurements.isEmpty)
            const EmptyState(
              icon: Icons.timeline_outlined,
              message:
                  'No measurements recorded yet. Tap "+ Measure" to log the first one.',
            )
          else
            ...List.generate(
              measurements.length,
              (i) => MeasurementTile(
                measurement: measurements[i],
                isLatest: i == 0,
                onEdit: resolvedChild != null
                    ? () => _handleEdit(context, resolvedChild, measurements[i])
                    : null,
                onDelete: resolvedChild != null
                    ? () => _handleDelete(context, resolvedChild, measurements[i])
                    : null,
              ),
            ),
        ],
      ),
    );
  }
}
