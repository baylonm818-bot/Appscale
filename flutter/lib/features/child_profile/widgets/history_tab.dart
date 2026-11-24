import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/local/referral_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';
import '../../../data/models/referral.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../masterlist/widgets/status_badge.dart';
import '../../referrals/widgets/referral_detail_sheet.dart';
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

  @override
  Widget build(BuildContext context) {
    final rawMeasurements = MeasurementRepository().getForChild(widget.childId);
    final resolvedChild = widget.child ?? ChildRepository().getById(widget.childId);
    final referrals = ReferralRepository().getForBeneficiary(widget.childId);

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
                        onEdit: (resolvedChild != null && isLatest)
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
          const SizedBox(height: AppSpacing.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Referral History',
                style: AppTextStyles.h1.copyWith(fontSize: 18),
              ),
              if (referrals.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${referrals.length} ${referrals.length == 1 ? "record" : "records"}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primaryGreen,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (referrals.isEmpty)
            const EmptyState(
              icon: Icons.assignment_turned_in_outlined,
              message: 'No referrals recorded for this child.',
            )
          else
            Column(
              children: referrals.map((r) => _ReferralHistoryCard(referral: r)).toList(),
            ),
        ],
      ),
    );
  }
}

class _ReferralHistoryCard extends StatelessWidget {
  final Referral referral;
  const _ReferralHistoryCard({required this.referral});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return AppColors.primaryGreen;
      case 'in progress':
      case 'ongoing':
        return AppColors.statBlue;
      case 'cancelled':
        return AppColors.textMuted;
      case 'pending':
      default:
        return AppColors.statOrange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(referral.statusDisplay);
    final referredByName = referral.referredBy?.isNotEmpty == true
        ? referral.referredBy!
        : 'BNS';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        onTap: () => ReferralDetailSheet.show(context, referral: referral),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.assignment_turned_in, size: 16, color: statusColor),
                      const SizedBox(width: 6),
                      Text(
                        AppDateFormat.format(referral.createdAt),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  StatusBadge(
                    label: referral.statusDisplay,
                    color: statusColor,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Reason: ${referral.reason}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              if (referral.facility.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Referred to: ${referral.facility}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                'Referred by: $referredByName',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              if (referral.notes.isNotEmpty) ...[
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    referral.notes,
                    style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
