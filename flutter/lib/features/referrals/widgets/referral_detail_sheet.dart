import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/referral.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../data/local/referral_repository.dart';

/// Read-only referral detail sheet for BNS mobile users.
///
/// Status updates and clinical resolutions are managed exclusively by the
/// RHU Admin and BHW via the Web Health Portal; this sheet allows the mobile
/// user to track status and review clinical outcome notes, completion date,
/// and supplies given.
class ReferralDetailSheet extends StatelessWidget {
  final Referral referral;

  const ReferralDetailSheet({super.key, required this.referral});

  static Future<void> show(BuildContext context, {required Referral referral}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => ReferralDetailSheet(referral: referral),
    );
  }

  Color get _statusColor {
    if (referral.isArchived) {
      return const Color(0xFF475569);
    }
    final s = referral.statusDisplay;
    switch (s) {
      case 'Pending':
        return AppColors.statOrange;
      case 'Ongoing':
      case 'In Progress':
        return AppColors.statBlue;
      case 'Completed':
        return AppColors.primaryGreen;
      case 'Cancelled':
        return AppColors.textMuted;
      default:
        return AppColors.textMuted;
    }
  }

  String get _displayName => referral.resolvedBeneficiaryName;

  String get _facilityDisplay {
    final f = referral.facility.trim();
    if (f.isNotEmpty && !RegExp(r'^\d+$').hasMatch(f)) {
      return f;
    }
    final match = RegExp(r'Facility:\s*([^|\n]+)').firstMatch(referral.notes);
    if (match != null &&
        match.group(1)!.trim().isNotEmpty &&
        !RegExp(r'^\d+$').hasMatch(match.group(1)!.trim())) {
      return match.group(1)!.trim();
    }
    return 'Rural Health Unit (RHU)';
  }

  @override
  Widget build(BuildContext context) {
    final dateStr = AppDateFormat.format(referral.createdAt);
    final statusColor = _statusColor;
    final isCompleted = referral.isCompleted;

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.sm,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _displayName,
                      style: AppTextStyles.h2.copyWith(fontSize: 18),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${referral.beneficiaryType == 'mother' ? 'Mother Beneficiary' : 'Child Beneficiary'} · Barangay ${referral.barangay}',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (referral.isArchived) ...[
                      Icon(Icons.archive_outlined, size: 13, color: statusColor),
                      const SizedBox(width: 5),
                    ] else if (isCompleted) ...[
                      Icon(Icons.check_circle, size: 13, color: statusColor),
                      const SizedBox(width: 5),
                    ] else ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      referral.isArchived ? 'Archived' : referral.statusDisplay,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Informational Notice regarding Web-Based Management
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.lightGreenBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.primaryGreen.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 16,
                  color: AppColors.darkGreen,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Referral status and clinical resolutions are managed by the RHU Admin and BHW via the Web Health Portal.',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 11.5,
                      color: AppColors.darkGreen,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          _buildDetailRow('Date Filed', dateStr, Icons.calendar_today_outlined),
          const SizedBox(height: 10),
          _buildDetailRow(
            'Referred Facility',
            _facilityDisplay,
            Icons.local_hospital_outlined,
          ),
          const SizedBox(height: 10),
          _buildDetailRow(
            'Reason for Referral',
            referral.reason,
            Icons.report_problem_outlined,
          ),
          if (isCompleted && referral.formattedCompletedDate != null) ...[
            const SizedBox(height: 10),
            _buildDetailRow(
              'Date Completed',
              referral.formattedCompletedDate!,
              Icons.event_available_outlined,
            ),
          ],
          if (referral.itemsGiven.isNotEmpty || isCompleted) ...[
            const SizedBox(height: 10),
            _buildDetailRow(
              'Items / Supplies Given',
              referral.itemsGivenFormatted,
              Icons.inventory_2_outlined,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),

          // Status & Outcome Section
          Text(
            'Resolution & RHU Feedback',
            style: AppTextStyles.label.copyWith(fontSize: 13),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isCompleted
                          ? Icons.check_circle
                          : (referral.isOngoing || referral.isInProgress
                              ? Icons.timelapse
                              : Icons.hourglass_top),
                      size: 16,
                      color: statusColor,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isCompleted
                          ? 'Resolved by RHU / BHW'
                          : (referral.isOngoing || referral.isInProgress
                              ? 'Ongoing / Under Evaluation by RHU / BHW'
                              : 'Awaiting RHU / BHW Evaluation'),
                      style: AppTextStyles.body.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
                if (referral.hasClinicalNotes) ...[
                  const SizedBox(height: 8),
                  Text(
                    'RHU / BHW Notes:',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    referral.clinicalNotes,
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          if (referral.isCompleted && !referral.isArchived) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await ReferralRepository().archive(referral.id);
                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Referral for ${referral.resolvedBeneficiaryName} archived'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.archive_outlined, size: 16),
                label: const Text('Archive Referral'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF475569),
                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ] else if (referral.isArchived) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await ReferralRepository().unarchive(referral.id);
                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Referral for ${referral.resolvedBeneficiaryName} unarchived'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.unarchive_outlined, size: 16),
                label: const Text('Unarchive Referral'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.darkGreen,
                  side: const BorderSide(color: AppColors.darkGreen),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.darkGreen,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Close',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, IconData icon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.body.copyWith(
                  fontSize: 11,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: AppTextStyles.body.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
