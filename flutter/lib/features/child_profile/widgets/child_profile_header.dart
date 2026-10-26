import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/local/referral_repository.dart';
import '../../../data/models/child.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';
import '../../../shared/utils/app_date_format.dart';

class ChildProfileHeader extends StatelessWidget {
  final Child child;
  final bool isActive;
  final VoidCallback onEditPressed;
  final VoidCallback onStatusActionPressed;
  final VoidCallback onMeasurePressed;
  final VoidCallback? onReferralPressed;
  final VoidCallback? onNoteDisabilityPressed;

  const ChildProfileHeader({
    super.key,
    required this.child,
    required this.isActive,
    required this.onEditPressed,
    required this.onStatusActionPressed,
    required this.onMeasurePressed,
    this.onReferralPressed,
    this.onNoteDisabilityPressed,
  });

  @override
  Widget build(BuildContext context) {
    final measurements = MeasurementRepository().getForChild(child.id);
    final validMeasurements = measurements.where((m) => m.isPlausible).toList();
    final hasValidMeasurements = validMeasurements.isNotEmpty;
    final latestValidMeasurement = hasValidMeasurements ? validMeasurements.first : null;

    final effectiveWfa = latestValidMeasurement?.weightForAgeStatus;
    final effectiveHfa = latestValidMeasurement?.heightForAgeStatus;
    final effectiveWfl = latestValidMeasurement?.effectiveWastingStatus;

    final showStuntingBadge = hasValidMeasurements &&
        (effectiveHfa == 'Stunted' || effectiveHfa == 'Severely Stunted');
    final showWastingBadge = hasValidMeasurements &&
        (effectiveWfl == 'SAM' || effectiveWfl == 'MAM');

    final needsReferral = hasValidMeasurements &&
        latestValidMeasurement != null &&
        (latestValidMeasurement.isSevere ||
         effectiveWfl == 'SAM' ||
         effectiveWfl == 'MAM' ||
         effectiveWfa == 'Severely Underweight');

    final referralStatus = ReferralRepository().getReferralHeaderStatus(
      beneficiaryId: child.id,
      hasRecords: hasValidMeasurements,
      needsReferralFromRecord: needsReferral,
      recordDate: latestValidMeasurement?.date,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primaryGreen, AppColors.darkGreen],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top navigation bar: back arrow -> title -> overflow menu.
          Row(
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => Navigator.pop(context),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.arrow_back, color: Colors.white),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Child Profile',
                  style: AppTextStyles.h2.copyWith(color: Colors.white, fontSize: 18),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _OverflowMenu(
                isActive: isActive,
                isTransferPending: child.isTransferPending,
                onEditPressed: onEditPressed,
                onStatusActionPressed: onStatusActionPressed,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(
                  child.initials,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.fullName,
                      style: AppTextStyles.h2.copyWith(
                        color: Colors.white,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${child.ageLabel} · ${child.formattedAddress}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      'Born: ${_formatDate(child.birthDate)}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (isActive) ...[
                if (!hasValidMeasurements) ...[
                  const StatusBadge(
                    label: 'No valid measurement yet',
                    color: AppColors.notWeighed,
                    onDark: true,
                  ),
                ] else ...[
                  // Weight-for-Age badge (WFA)
                  StatusBadge(
                    label: effectiveWfa ?? 'Normal',
                    color: ChildStatusMeta.colorFor(effectiveWfa ?? 'Normal'),
                    onDark: true,
                  ),
                  if (showStuntingBadge)
                    StatusBadge(
                      label: effectiveHfa!,
                      color: ChildStatusMeta.colorFor(effectiveHfa),
                      onDark: true,
                    ),
                  // Weight-for-Length/Height (WFH) - for under-5s, WFH replaces BMI.
                  // Never show Overweight and Obese together.
                  if (showWastingBadge ||
                      ((effectiveWfl == 'Obese' || effectiveWfl == 'Overweight') &&
                       effectiveWfa != effectiveWfl))
                    StatusBadge(
                      label: effectiveWfl!,
                      color: ChildStatusMeta.colorFor(effectiveWfl),
                      onDark: true,
                    ),
                  if (referralStatus.chipLabel != null)
                    StatusBadge(
                      label: referralStatus.chipLabel!,
                      color: referralStatus.chipColor!,
                      onDark: true,
                    ),
                ],
              ] else
                StatusBadge(
                  label: 'Inactive · ${child.inactiveReason ?? "Unspecified"}',
                  color: AppColors.textMuted,
                  onDark: true,
                ),
            ],
          ),
          if (isActive && !child.isTransferPending) ...[
            const SizedBox(height: AppSpacing.sm),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _MeasureButton(onPressed: onMeasurePressed),
                  if (onNoteDisabilityPressed != null) ...[
                    const SizedBox(width: 8),
                    _DisabilityButton(
                      hasDisability: child.disability.isNotEmpty &&
                          child.disability.toLowerCase() != 'none specified' &&
                          child.disability.toLowerCase() != 'none' &&
                          child.disability.toLowerCase() != 'no',
                      onPressed: onNoteDisabilityPressed!,
                    ),
                  ],
                  if (referralStatus.showReferButton && onReferralPressed != null) ...[
                    const SizedBox(width: 8),
                    _ReferralButton(onPressed: onReferralPressed!),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime date) => AppDateFormat.format(date);
}

class _OverflowMenu extends StatelessWidget {
  final bool isActive;
  final bool isTransferPending;
  final VoidCallback onEditPressed;
  final VoidCallback onStatusActionPressed;

  const _OverflowMenu({
    required this.isActive,
    this.isTransferPending = false,
    required this.onEditPressed,
    required this.onStatusActionPressed,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.more_vert, color: Colors.white, size: 18),
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (value) {
        if (value == 'edit') onEditPressed();
        if (value == 'status') onStatusActionPressed();
      },
      itemBuilder: (context) => [
        if (!isTransferPending)
          const PopupMenuItem(
            value: 'edit',
            child: Row(
              children: [
                Icon(
                  Icons.edit_outlined,
                  size: 18,
                  color: AppColors.textSecondary,
                ),
                SizedBox(width: 10),
                Text('Edit profile'),
              ],
            ),
          ),
        PopupMenuItem(
          value: 'status',
          child: Row(
            children: [
              Icon(
                isTransferPending
                    ? Icons.sync_problem
                    : (isActive ? Icons.person_off_outlined : Icons.replay),
                size: 18,
                color: isTransferPending
                    ? AppColors.statOrange
                    : (isActive ? AppColors.statRed : AppColors.primaryGreen),
              ),
              const SizedBox(width: 10),
              Text(
                isTransferPending
                    ? 'Transfer pending'
                    : (isActive ? 'Mark as inactive' : 'Reactivate'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MeasureButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _MeasureButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.25),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add, color: Colors.white, size: 15),
              SizedBox(width: 3),
              Text(
                'Measure',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReferralButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _ReferralButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.statOrange,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.assignment_turned_in_outlined, color: Colors.white, size: 14),
              SizedBox(width: 3),
              Text(
                'Refer',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DisabilityButton extends StatelessWidget {
  final bool hasDisability;
  final VoidCallback onPressed;

  const _DisabilityButton({
    required this.hasDisability,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: hasDisability
          ? const Color(0xFF6366F1) // Indigo/Purple accent
          : Colors.white.withValues(alpha: 0.25),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.accessibility_new, color: Colors.white, size: 14),
              const SizedBox(width: 4),
              Text(
                hasDisability ? 'Disability Noted' : 'Note Disability',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
