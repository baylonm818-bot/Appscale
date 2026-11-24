import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/mother_visit.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../masterlist/widgets/status_badge.dart';

class VisitTile extends StatelessWidget {
  final MotherVisit visit;
  final bool isLatest;

  const VisitTile({super.key, required this.visit, required this.isLatest});

  String _toSentenceCase(String input) {
    if (input.trim().isEmpty) return input;
    final trimmed = input.trim();
    return trimmed[0].toUpperCase() + trimmed.substring(1);
  }

  Widget _buildLabeledRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                color: valueColor ?? AppColors.textSecondary,
                fontWeight: valueColor != null ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isConcern = visit.observation == 'Signs of concern' ||
        visit.hasMedicalConcern ||
        (visit.observationNote != null &&
            visit.observationNote!.toLowerCase().contains('concern'));

    final statusLabel = !visit.present
        ? 'Missed'
        : (isConcern ? 'Signs of concern' : 'Appears well');

    final accentColor = !visit.present
        ? AppColors.textMuted
        : (isConcern ? AppColors.statOrange : AppColors.primaryGreen);

    // Compute clean values for each labeled row in sentence case
    String observationText;
    if (!visit.present) {
      observationText = 'Missed visit';
    } else if (isConcern) {
      final note = visit.observationNote != null && visit.observationNote!.isNotEmpty
          ? ' (${_toSentenceCase(visit.observationNote!)})'
          : '';
      observationText = 'Signs of concern$note';
    } else {
      final note = visit.observationNote != null && visit.observationNote!.isNotEmpty
          ? ' (${_toSentenceCase(visit.observationNote!)})'
          : '';
      observationText = 'Appears well$note';
    }

    String concernText;
    if (visit.hasMedicalConcern &&
        visit.concernNote != null &&
        visit.concernNote!.trim().isNotEmpty) {
      concernText = _toSentenceCase(visit.concernNote!);
    } else {
      concernText = 'None reported';
    }

    final feedingText = visit.breastfeedingPractice != null &&
            visit.breastfeedingPractice!.trim().isNotEmpty
        ? _toSentenceCase(visit.breastfeedingPractice!)
        : 'Not recorded';

    final referralText = visit.isReferralNeeded ? 'Yes' : 'No';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: const BorderRadius.horizontal(
                  left: Radius.circular(12),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          _formatDate(visit.date),
                          style: AppTextStyles.label.copyWith(fontSize: 14),
                        ),
                        if (isLatest) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.lightGreenBg,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'Latest',
                              style: TextStyle(
                                color: AppColors.darkGreen,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const Spacer(),
                        StatusBadge(label: statusLabel, color: accentColor),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 10),
                    if (!visit.present)
                      Text(
                        'No show · rescheduled by BNS',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      )
                    else ...[
                      _buildLabeledRow('Observation', observationText),
                      _buildLabeledRow('Concern', concernText),
                      _buildLabeledRow('Feeding', feedingText),
                      _buildLabeledRow(
                        'Referral needed',
                        referralText,
                        valueColor: visit.isReferralNeeded ? AppColors.statOrange : null,
                      ),
                    ],
                    if (visit.signature != null && visit.signature!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      const Row(
                        children: [
                          Icon(Icons.draw, size: 13, color: AppColors.primaryGreen),
                          SizedBox(width: 4),
                          Text(
                            "Mother's Signature Attached",
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.primaryGreen,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => AppDateFormat.format(d);
}
