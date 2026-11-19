import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/app_data_bus.dart';
import '../../../data/local/hive_boxes.dart';
import 'widgets/attendance_tab.dart';
import 'widgets/feeding_header.dart';
import 'widgets/feeding_tab_bar.dart';
import 'widgets/meal_plan_tab.dart';
import 'widgets/overview_tab.dart';
import 'widgets/sessions_tab.dart';
import 'widgets/weighing_tab.dart';

class FeedingProgramScreen extends StatefulWidget {
  const FeedingProgramScreen({super.key});

  @override
  State<FeedingProgramScreen> createState() => _FeedingProgramScreenState();
}

class _FeedingProgramScreenState extends State<FeedingProgramScreen> {
  int _tabIndex = 0;

  Future<void> _confirmResetFeedingCycle(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.archive_outlined, color: AppColors.primaryGreen),
            SizedBox(width: 8),
            Text('Reset for New Cycle?'),
          ],
        ),
        content: const Text(
          'Are you sure you want to advance to the next Supplementary Feeding Cycle?\n\n'
          'Existing feeding attendance, meal records, and nutritional progress will NEVER be deleted. They will remain safely archived and available in reports and feeding effectiveness history.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primaryGreen),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm & Archive'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final box = Hive.box(HiveBoxes.settings);
      final currentBarangay = box.get('auth_user')?['barangay']?.toString() ?? 'Tiguion';
      final currentCycle = box.get('feeding_cycle_$currentBarangay', defaultValue: 1) as int;
      await box.put('feeding_cycle_$currentBarangay', currentCycle + 1);
      AppDataBus.notifyChanged();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Advanced to Feeding Cycle ${currentCycle + 1}. All previous cycles safely archived in history.'),
          backgroundColor: AppColors.primaryGreen,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ValueListenableBuilder<int>(
          valueListenable: AppDataBus.version,
          builder: (context, version, child) {
            return Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Row(
                    children: [
                      InkWell(
                        onTap: () => Navigator.pop(context),
                        child: const Icon(Icons.arrow_back),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Feeding Program',
                        style: AppTextStyles.h2.copyWith(fontSize: 18),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.restart_alt, color: AppColors.primaryGreen),
                        tooltip: 'Reset for New Cycle',
                        onPressed: () => _confirmResetFeedingCycle(context),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Column(
                    children: const [
                      FeedingHeader(),
                      SizedBox(height: AppSpacing.md),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: FeedingTabBar(
                    currentIndex: _tabIndex,
                    onChanged: (i) => setState(() => _tabIndex = i),
                  ),
                ),
                const Divider(height: 1, color: AppColors.border),
                Expanded(
                  child: IndexedStack(
                    index: _tabIndex,
                    children: [
                      OverviewTab(key: ValueKey('overview_$version')),
                      MealPlanTab(key: ValueKey('meal_plan_$version')),
                      WeighingTab(key: ValueKey('weighing_$version')),
                      AttendanceTab(key: ValueKey('attendance_$version')),
                      SessionsTab(key: ValueKey('sessions_$version')),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
