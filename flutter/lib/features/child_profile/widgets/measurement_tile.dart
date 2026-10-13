import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/growth_standards/measurement_validator.dart';
import '../../../data/models/measurement.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';
import '../../../shared/utils/app_date_format.dart';

class MeasurementTile extends StatelessWidget {
  final Measurement measurement;
  final bool isLatest;

  const MeasurementTile({
    super.key,
    required this.measurement,
    required this.isLatest,
  });

  @override
  Widget build(BuildContext context) {
    // Edema overrides the wasting badge to SAM — same rule used at save time.
    final wastingLabel = measurement.effectiveWastingStatus;
    final accentColor = ChildStatusMeta.colorFor(
      measurement.weightForAgeStatus,
    );

    final isPlausible = MeasurementValidator.isPlausibleRecord(
      heightCm: measurement.heightCm,
      weightKg: measurement.weightKg,
      muacCm: measurement.muacCm,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPlausible ? AppColors.border : AppColors.statRed.withValues(alpha: 0.5),
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: isPlausible ? accentColor : AppColors.statRed,
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
                          _formatDate(measurement.date),
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
                            child: Text(
                              'Latest',
                              style: TextStyle(
                                color: AppColors.darkGreen,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        if (!isPlausible) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.statRed.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.statRed, width: 0.8),
                            ),
                            child: const Text(
                              'Invalid Value Flagged',
                              style: TextStyle(
                                color: AppColors.statRed,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (!isPlausible) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.statRed.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Entry outside plausible ranges for 0-59 months (H: 45-125 cm, W: 2-30 kg, MUAC: 8-20 cm). BMI and nutritional status cannot be reliably determined.',
                          style: TextStyle(
                            color: AppColors.statRed,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ] else ...[
                      // Three badges — weight-for-age, height-for-age, wasting
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusBadge(
                            label: measurement.weightForAgeStatus,
                            color: ChildStatusMeta.colorFor(
                              measurement.weightForAgeStatus,
                            ),
                          ),
                          StatusBadge(
                            label: measurement.heightForAgeStatus,
                            color: ChildStatusMeta.colorFor(
                              measurement.heightForAgeStatus,
                            ),
                          ),
                          StatusBadge(
                            label: 'BMI: ${measurement.bmi} (${measurement.bmiStatus})',
                            color: measurement.bmiStatus == 'Normal'
                                ? AppColors.primaryGreen
                                : measurement.bmiStatus == 'Underweight'
                                    ? AppColors.statOrange
                                    : AppColors.statRed,
                          ),
                          StatusBadge(
                            label: wastingLabel,
                            color: ChildStatusMeta.colorFor(wastingLabel),
                          ),
                          if (measurement.bilateralPittingEdema)
                            const StatusBadge(
                              label: 'Edema',
                              color: AppColors.statRed,
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 10),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _MetricItem(
                          icon: Icons.monitor_weight_outlined,
                          iconColor: AppColors.statBlue,
                          label: 'Weight',
                          value: '${measurement.weightKg} kg',
                        ),
                        _MetricItem(
                          icon: Icons.straighten_outlined,
                          iconColor: AppColors.statOrange,
                          label: 'Height',
                          value: '${measurement.heightCm} cm',
                        ),
                        _MetricItem(
                          icon: Icons.calculate_outlined,
                          iconColor: AppColors.primaryGreen,
                          label: 'BMI',
                          value: '${measurement.bmi}',
                        ),
                        _MetricItem(
                          icon: Icons.favorite_outline,
                          iconColor: const Color(0xFFCC2E6D),
                          label: 'MUAC',
                          value: measurement.muacCm != null
                              ? '${measurement.muacCm} cm'
                              : 'N/A',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) => AppDateFormat.format(date);
}

class _MetricItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _MetricItem({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: 15, color: iconColor),
          const SizedBox(width: 5),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTextStyles.body.copyWith(
                    fontSize: 10,
                    color: AppColors.textMuted,
                  ),
                ),
                Text(
                  value,
                  style: AppTextStyles.label.copyWith(fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
