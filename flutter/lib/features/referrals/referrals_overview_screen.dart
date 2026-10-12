import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/referral_needs_service.dart';
import '../../data/local/referral_repository.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/empty_state.dart';
import 'create_referral_screen.dart';
import 'widgets/referral_card.dart';

class ReferralsOverviewScreen extends StatefulWidget {
  const ReferralsOverviewScreen({super.key});

  @override
  State<ReferralsOverviewScreen> createState() => _ReferralsOverviewScreenState();
}

class _ReferralsOverviewScreenState extends State<ReferralsOverviewScreen> {
  static final _settings = SettingsRepository();
  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  String _selectedFilter = 'All'; // 'All', 'Pending', 'Completed'

  @override
  void initState() {
    super.initState();
    // Pull fresh referral records from server when screen opens
    ReferralRepository().pullLatest(barangay: _currentBarangay);
  }

  Future<void> _handleRefresh() async {
    await ReferralRepository().pullLatest(barangay: _currentBarangay);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              color: AppColors.darkGreen,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back, color: Colors.white),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Referral Monitoring',
                    style: AppTextStyles.h2.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ValueListenableBuilder<int>(
                valueListenable: AppDataBus.version,
                builder: (context, version, child) {
                  final needs = ReferralNeedsService();
                  final childrenNeeding = needs.getChildrenNeedingReferral(
                    _currentBarangay,
                  );
                  final mothersNeeding = needs.getMothersNeedingReferral(
                    _currentBarangay,
                  );
                  final referrals = ReferralRepository().getForBarangay(
                    _currentBarangay,
                  );

                  final pendingCount =
                      referrals.where((r) => r.isPending).length;
                  final ongoingCount =
                      referrals.where((r) => r.isOngoing).length;
                  final completedCount =
                      referrals.where((r) => r.isCompleted).length;

                  final filteredReferrals = referrals.where((r) {
                    if (_selectedFilter == 'Pending') {
                      return r.isPending;
                    }
                    if (_selectedFilter == 'Ongoing') {
                      return r.isOngoing;
                    }
                    if (_selectedFilter == 'Completed') {
                      return r.isCompleted;
                    }
                    return true;
                  }).toList();

                  return RefreshIndicator(
                    onRefresh: _handleRefresh,
                    color: AppColors.darkGreen,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppButton(
                            label: '+ New Referral',
                            onPressed: () => Navigator.push(
                              context,
                              appPageRoute(const CreateReferralScreen()),
                            ),
                          ),
                          if (childrenNeeding.isNotEmpty ||
                              mothersNeeding.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.lg),
                            Text(
                              'Needs referral',
                              style: AppTextStyles.h2.copyWith(
                                fontSize: 15,
                                color: AppColors.statRed,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Currently severe or at-risk, no referral opened yet.',
                              style: AppTextStyles.body.copyWith(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            ...childrenNeeding.map(
                              (c) => _NeedsReferralTile(
                                name: c.fullName,
                                subtitle: '${c.ageLabel} · ${c.formattedAddress}',
                                reason: [
                                  c.nutritionStatus,
                                  c.stuntingStatus,
                                  c.wastingStatus,
                                ]
                                    .where(
                                      (s) =>
                                          s.startsWith('Severely') ||
                                          s == 'SAM',
                                    )
                                    .join(', '),
                                onCreate: () => Navigator.push(
                                  context,
                                  appPageRoute(
                                    CreateReferralScreen(
                                      prefillBeneficiaryType: 'child',
                                      prefillBeneficiaryId: c.id,
                                      prefillBeneficiaryName: c.fullName,
                                      prefillBeneficiarySubtitle:
                                          '${c.ageLabel} · ${c.formattedAddress}',
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            ...mothersNeeding.map(
                              (m) => _NeedsReferralTile(
                                name: m.fullName,
                                subtitle: m.formattedAddress,
                                reason: 'At-risk',
                                onCreate: () => Navigator.push(
                                  context,
                                  appPageRoute(
                                    CreateReferralScreen(
                                      prefillBeneficiaryType: 'mother',
                                      prefillBeneficiaryId: m.id,
                                      prefillBeneficiaryName: m.fullName,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Referral records',
                                style: AppTextStyles.h2.copyWith(fontSize: 15),
                              ),
                              Text(
                                '${filteredReferrals.length} of ${referrals.length}',
                                style: AppTextStyles.body.copyWith(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          // Filter Chips: All, Pending, Completed
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _ReferralFilterChip(
                                  label: 'All',
                                  count: referrals.length,
                                  isSelected: _selectedFilter == 'All',
                                  onTap: () => setState(() => _selectedFilter = 'All'),
                                ),
                                const SizedBox(width: 8),
                                _ReferralFilterChip(
                                  label: 'Pending',
                                  count: pendingCount,
                                  isSelected: _selectedFilter == 'Pending',
                                  color: AppColors.statOrange,
                                  onTap: () => setState(() => _selectedFilter = 'Pending'),
                                ),
                                const SizedBox(width: 8),
                                _ReferralFilterChip(
                                  label: 'Ongoing',
                                  count: ongoingCount,
                                  isSelected: _selectedFilter == 'Ongoing',
                                  color: AppColors.statBlue,
                                  onTap: () => setState(() => _selectedFilter = 'Ongoing'),
                                ),
                                const SizedBox(width: 8),
                                _ReferralFilterChip(
                                  label: 'Completed',
                                  count: completedCount,
                                  isSelected: _selectedFilter == 'Completed',
                                  color: AppColors.primaryGreen,
                                  onTap: () => setState(() => _selectedFilter = 'Completed'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          if (filteredReferrals.isEmpty)
                            EmptyState(
                              icon: Icons.local_hospital_outlined,
                              message: _selectedFilter == 'All'
                                  ? 'No referrals recorded yet.'
                                  : 'No $_selectedFilter referrals found.',
                            )
                          else
                            ...filteredReferrals.map(
                              (r) => ReferralCard(
                                referral: r,
                                showBeneficiaryName: true,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReferralFilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final Color? color;
  final VoidCallback onTap;

  const _ReferralFilterChip({
    required this.label,
    required this.count,
    required this.isSelected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppColors.darkGreen;
    final bg = isSelected ? chipColor : Colors.white;
    final fg = isSelected ? Colors.white : AppColors.textPrimary;
    final border = isSelected ? chipColor : AppColors.border;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: fg,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.25)
                    : AppColors.background,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? Colors.white : AppColors.textMuted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NeedsReferralTile extends StatelessWidget {
  final String name;
  final String subtitle;
  final String reason;
  final VoidCallback onCreate;

  const _NeedsReferralTile({
    required this.name,
    required this.subtitle,
    required this.reason,
    required this.onCreate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.statRed.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.statRed.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppTextStyles.label.copyWith(fontSize: 14)),
                Text(
                  subtitle,
                  style: AppTextStyles.body.copyWith(
                    fontSize: 11,
                    color: AppColors.textMuted,
                  ),
                ),
                Text(
                  reason,
                  style: AppTextStyles.body.copyWith(
                    fontSize: 11,
                    color: AppColors.statRed,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 32,
            child: FilledButton(
              onPressed: onCreate,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.statRed,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Create',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
