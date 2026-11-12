import 'package:flutter/material.dart';
import '../../../data/models/referral.dart';
import '../../../shared/utils/app_date_format.dart';
import 'referral_detail_sheet.dart';

class ReferredHeaderBadge extends StatelessWidget {
  final Referral referral;
  final VoidCallback? onTap;

  const ReferredHeaderBadge({
    super.key,
    required this.referral,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dateStr = AppDateFormat.format(referral.createdAt);
    return Material(
      color: Colors.white.withValues(alpha: 0.22),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap ?? () => ReferralDetailSheet.show(context, referral: referral),
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.assignment_turned_in,
                color: Colors.white,
                size: 14,
              ),
              const SizedBox(width: 4),
              Text(
                'Referred · $dateStr',
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
