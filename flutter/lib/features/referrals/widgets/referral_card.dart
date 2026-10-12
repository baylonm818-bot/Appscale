import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/referral.dart';
import 'referral_detail_sheet.dart';

class ReferralCard extends StatelessWidget {
  final Referral referral;
  final bool showBeneficiaryName;

  const ReferralCard({
    super.key,
    required this.referral,
    this.showBeneficiaryName = false,
  });

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

  bool get _isMother =>
      referral.beneficiaryType.toLowerCase() == 'mother' ||
      referral.beneficiaryType.toLowerCase() == 'lactating_mother';

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

  void _openDetailSheet(BuildContext context) {
    ReferralDetailSheet.show(context, referral: referral);
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor;
    final isCompleted = referral.isCompleted;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _openDetailSheet(context),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (showBeneficiaryName) ...[
                                Flexible(
                                  child: Text(
                                    _displayName,
                                    style: AppTextStyles.label.copyWith(fontSize: 14),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: _isMother
                                      ? const Color(0xFFF3E5F5)
                                      : const Color(0xFFE3F2FD),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _isMother
                                        ? const Color(0xFFCE93D8)
                                        : const Color(0xFF90CAF9),
                                    width: 0.8,
                                  ),
                                ),
                                child: Text(
                                  _isMother ? 'Lactating Mother' : 'Child',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: _isMother
                                        ? const Color(0xFF7B1FA2)
                                        : const Color(0xFF1565C0),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${referral.createdAt.year}-${referral.createdAt.month.toString().padLeft(2, '0')}-${referral.createdAt.day.toString().padLeft(2, '0')}',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (referral.isArchived) ...[
                            Icon(Icons.archive_outlined, size: 12, color: statusColor),
                            const SizedBox(width: 4),
                          ] else if (isCompleted) ...[
                            Icon(Icons.check_circle, size: 12, color: statusColor),
                            const SizedBox(width: 4),
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
                const SizedBox(height: 8),
                Text(
                  referral.reason,
                  style: AppTextStyles.body.copyWith(fontSize: 12),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _facilityDisplay,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          'View details',
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.darkGreen,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(
                          Icons.chevron_right,
                          size: 14,
                          color: AppColors.darkGreen,
                        ),
                      ],
                    ),
                  ],
                ),
                if (referral.notes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.border.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          isCompleted
                              ? Icons.check_circle_outline
                              : Icons.notes,
                          size: 13,
                          color: statusColor,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            isCompleted
                                ? 'RHU Resolution: ${referral.notes}'
                                : 'RHU Note: ${referral.notes}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.body.copyWith(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
