import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/app_data_bus.dart';
import '../../../data/local/hive_boxes.dart';
import '../../../data/local/mother_repository.dart';
import '../../../data/local/mother_visit_repository.dart';
import '../../../shared/utils/app_page_route.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../mother_profile/add_counseling_visit_screen.dart';
import '../../mother_profile/mother_profile_screen.dart';

class LactatingMothersCounselingScreen extends StatefulWidget {
  final String barangay;
  const LactatingMothersCounselingScreen({super.key, this.barangay = 'Tiguion'});

  @override
  State<LactatingMothersCounselingScreen> createState() =>
      _LactatingMothersCounselingScreenState();
}

class _LactatingMothersCounselingScreenState
    extends State<LactatingMothersCounselingScreen> {
  final _settings = SettingsRepository();
  final _searchCtrl = TextEditingController();
  String _query = '';

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? widget.barangay;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, version, _) {
        final allMothers = MotherRepository()
            .getAll()
            .where((m) => m.barangay == _currentBarangay && m.isActive)
            .toList();

        final visitRepo = MotherVisitRepository();

        final filtered = allMothers.where((m) {
          if (_query.isEmpty) return true;
          final lower = _query.toLowerCase();
          return m.fullName.toLowerCase().contains(lower) ||
              m.address.toLowerCase().contains(lower);
        }).toList();

        final totalMothers = allMothers.length;
        int counseledThisMonth = 0;
        int withMedicalConcerns = 0;

        final now = DateTime.now();
        for (final m in allMothers) {
          final visits = visitRepo.getForMother(m.id);
          if (visits.isNotEmpty) {
            final latest = visits.first;
            if (latest.date.year == now.year && latest.date.month == now.month) {
              counseledThisMonth++;
            }
            if (latest.hasMedicalConcern) {
              withMedicalConcerns++;
            }
          }
        }

        return Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            child: Column(
              children: [
                // Top Header
                Container(
                  width: double.infinity,
                  color: AppColors.darkGreen,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          InkWell(
                            onTap: () => Navigator.pop(context),
                            child: const Icon(
                              Icons.arrow_back,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              'Lactating Mothers Counseling',
                              style: AppTextStyles.h2.copyWith(
                                color: Colors.white,
                                fontSize: 18,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Monitor maternal nutrition counseling, breastfeeding support, and health follow-ups.',
                        style: AppTextStyles.caption.copyWith(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

                // Summary Stats
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          label: 'Total Mothers',
                          value: '$totalMothers',
                          color: AppColors.primaryGreen,
                          icon: Icons.pregnant_woman,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatCard(
                          label: 'Counseled (Mo)',
                          value: '$counseledThisMonth',
                          color: AppColors.statBlue,
                          icon: Icons.check_circle_outline,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _StatCard(
                          label: 'Concerns',
                          value: '$withMedicalConcerns',
                          color: AppColors.statRed,
                          icon: Icons.warning_amber_rounded,
                        ),
                      ),
                    ],
                  ),
                ),

                // Search Bar
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _query = v.trim()),
                    decoration: InputDecoration(
                      hintText: 'Search mother by name or address...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _query.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _query = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 14,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.sm),

                // List of Mothers
                Expanded(
                  child: filtered.isEmpty
                      ? const EmptyState(
                          icon: Icons.pregnant_woman_outlined,
                          message: 'No lactating mothers found.',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          itemCount: filtered.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final mother = filtered[index];
                            final visits = visitRepo.getForMother(mother.id);
                            final latestVisit =
                                visits.isNotEmpty ? visits.first : null;

                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      CircleAvatar(
                                        radius: 20,
                                        backgroundColor: const Color(0xFF6C5CE7)
                                            .withValues(alpha: 0.12),
                                        child: Text(
                                          mother.fullName.isNotEmpty
                                              ? mother.fullName[0].toUpperCase()
                                              : 'M',
                                          style: const TextStyle(
                                            color: Color(0xFF6C5CE7),
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              mother.fullName,
                                              style: AppTextStyles.h2.copyWith(
                                                fontSize: 15,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Age: ${mother.age} · ${mother.address}',
                                              style: AppTextStyles.caption
                                                  .copyWith(
                                                fontSize: 12,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      _RiskBadge(riskStatus: mother.riskStatus),
                                    ],
                                  ),
                                  const Divider(
                                    height: 18,
                                    color: AppColors.border,
                                  ),
                                  // Last Counseling Summary
                                  if (latestVisit != null) ...[
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.event_available,
                                          size: 14,
                                          color: AppColors.primaryGreen,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Last visit: ${_fmtDate(latestVisit.date)}',
                                          style: AppTextStyles.caption.copyWith(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        if (latestVisit.hasMedicalConcern) ...[
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: AppColors.statRed
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                            ),
                                            child: const Text(
                                              'Concern Logged',
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
                                    if (latestVisit.topicsCounseled.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Topics: ${latestVisit.topicsCounseled.join(', ')}',
                                        style: AppTextStyles.caption.copyWith(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ] else ...[
                                    Text(
                                      'No counseling visits recorded yet.',
                                      style: AppTextStyles.caption.copyWith(
                                        fontSize: 11,
                                        color: AppColors.textMuted,
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          side: const BorderSide(
                                            color: AppColors.border,
                                          ),
                                          shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                        ),
                                        icon: const Icon(
                                          Icons.visibility_outlined,
                                          size: 14,
                                        ),
                                        label: const Text(
                                          'History',
                                          style: TextStyle(fontSize: 12),
                                        ),
                                        onPressed: () => Navigator.push(
                                          context,
                                          appPageRoute(
                                            MotherProfileScreen(mother: mother),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor:
                                              AppColors.primaryGreen,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 6,
                                          ),
                                          shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                        ),
                                        icon: const Icon(Icons.add, size: 14),
                                        label: const Text(
                                          'Log Counseling Visit',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        onPressed: () => Navigator.push(
                                          context,
                                          appPageRoute(
                                            AddCounselingVisitScreen(
                                              mother: mother,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  static String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTextStyles.h1.copyWith(
              fontSize: 18,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontSize: 10,
              color: AppColors.textMuted,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _RiskBadge extends StatelessWidget {
  final String riskStatus;
  const _RiskBadge({required this.riskStatus});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (riskStatus.toLowerCase()) {
      case 'high risk':
        bg = AppColors.statRed.withValues(alpha: 0.12);
        fg = AppColors.statRed;
        break;
      case 'medium risk':
        bg = AppColors.statAmber.withValues(alpha: 0.15);
        fg = AppColors.statAmber;
        break;
      default:
        bg = AppColors.lightGreenBg;
        fg = AppColors.darkGreen;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        riskStatus,
        style: TextStyle(
          color: fg,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
