import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/mother_visit_repository.dart';
import '../../../data/local/referral_repository.dart';
import '../../../data/models/mother.dart';
import '../../masterlist/utils/mother_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';

const _kAccent = Color(0xFF1B5E20);
const _kAccentDark = Color(0xFF2E7D32);

class MotherProfileHeader extends StatelessWidget {
  final Mother mother;
  final VoidCallback onEditPressed;
  final VoidCallback onStatusActionPressed;
  final VoidCallback onAddVisitPressed;
  final VoidCallback onReferralPressed;

  const MotherProfileHeader({
    super.key,
    required this.mother,
    required this.onEditPressed,
    required this.onStatusActionPressed,
    required this.onAddVisitPressed,
    required this.onReferralPressed,
  });

  @override
  Widget build(BuildContext context) {
    final visits = MotherVisitRepository().getForMother(mother.id);
    final presentVisits = visits.where((v) => v.present).toList();
    final hasVisits = presentVisits.isNotEmpty;
    final latestVisit = hasVisits ? presentVisits.first : null;
    final needsReferral = latestVisit != null &&
        (latestVisit.isReferralNeeded || mother.riskStatus == 'At-risk');

    final referralStatus = ReferralRepository().getReferralHeaderStatus(
      beneficiaryId: mother.id,
      hasRecords: hasVisits,
      needsReferralFromRecord: needsReferral,
      recordDate: latestVisit?.effectiveCreatedAt,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_kAccent, _kAccentDark],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Single row: arrow -> title -> Add visit -> Refer (if needed) -> overflow menu.
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
                  'Mother Profile',
                  style: AppTextStyles.h2.copyWith(
                    color: Colors.white,
                    fontSize: 18,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              if (mother.isActive && !mother.isTransferPending) ...[
                _AddVisitButton(onPressed: onAddVisitPressed),
                if (referralStatus.showReferButton) ...[
                  const SizedBox(width: 6),
                  _ReferralButton(onPressed: onReferralPressed),
                ],
                const SizedBox(width: 6),
              ],
              _OverflowMenu(
                isActive: mother.isActive,
                isTransferPending: mother.isTransferPending,
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
                  mother.initials,
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
                      mother.fullName,
                      style: AppTextStyles.h2.copyWith(
                        color: Colors.white,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      mother.ageLabel,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      mother.formattedAddress,
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
              if (mother.isActive) ...[
                StatusBadge(
                  label: mother.riskStatus,
                  color: MotherStatusMeta.colorFor(mother.riskStatus),
                  onDark: true,
                ),
                if (mother.isAdolescent)
                  const StatusBadge(
                    label: 'Adolescent mother',
                    color: AppColors.statOrange,
                    onDark: true,
                  ),
              ] else
                StatusBadge(
                  label: 'Inactive · ${mother.inactiveReason ?? "Unspecified"}',
                  color: AppColors.textMuted,
                  onDark: true,
                ),
              if (referralStatus.chipLabel != null)
                StatusBadge(
                  label: referralStatus.chipLabel!,
                  color: referralStatus.chipColor!,
                  onDark: true,
                ),
            ],
          ),
        ],
      ),
    );
  }
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

class _AddVisitButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _AddVisitButton({required this.onPressed});

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
                'Visit',
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

