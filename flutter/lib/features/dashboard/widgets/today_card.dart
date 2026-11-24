import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/program_schedule.dart';
import '../../../shared/utils/app_date_format.dart';

class TodayCard extends StatelessWidget {
  final List<ProgramSchedule> todayActivities;
  final int dueForWeighingCount;
  final VoidCallback onViewSchedule;
  final VoidCallback? onWeighingTap;

  const TodayCard({
    super.key,
    required this.todayActivities,
    required this.dueForWeighingCount,
    required this.onViewSchedule,
    this.onWeighingTap,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.035),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Accent line (Primary Green)
              Container(
                height: 3.5,
                width: double.infinity,
                color: AppColors.primaryGreen,
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header row: Icon + "Today" + "View schedule" Link
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.darkGreen.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.calendar_today_rounded,
                            size: 16,
                            color: AppColors.darkGreen,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Today',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              AppDateFormat.format(now),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        InkWell(
                          onTap: onViewSchedule,
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Text(
                                  'View schedule',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primaryGreen,
                                  ),
                                ),
                                SizedBox(width: 3),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 14,
                                  color: AppColors.primaryGreen,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 12),

                    // Section 1: Scheduled Activities for Today
                    if (todayActivities.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.check_circle_outline, size: 16, color: AppColors.primaryGreen),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'No activities scheduled for today.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Column(
                        children: todayActivities.map((act) {
                          final cleanTime = AppDateFormat.formatTime(act.startTime);
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    act.programType,
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.darkGreen,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        act.title,
                                        style: const TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textPrimary,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      if (cleanTime.isNotEmpty || act.location.isNotEmpty) ...[
                                        const SizedBox(height: 1),
                                        Text(
                                          [if (cleanTime.isNotEmpty) cleanTime, if (act.location.isNotEmpty) act.location].join(' · '),
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.textMuted,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),

                    const SizedBox(height: 10),

                    // Section 2: Children Due for Weighing
                    InkWell(
                      onTap: onWeighingTap,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        decoration: BoxDecoration(
                          color: dueForWeighingCount > 0
                              ? const Color(0xFFFFF8E1)
                              : AppColors.lightGreenBg.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: dueForWeighingCount > 0
                                ? const Color(0xFFFFD54F)
                                : AppColors.primaryGreen.withValues(alpha: 0.3),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.monitor_weight_outlined,
                              size: 17,
                              color: dueForWeighingCount > 0
                                  ? const Color(0xFFE65100)
                                  : AppColors.darkGreen,
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                dueForWeighingCount > 0
                                    ? '$dueForWeighingCount children due for weighing this month'
                                    : 'All monitored children are weighed and up to date',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: dueForWeighingCount > 0
                                      ? const Color(0xFFB71C1C)
                                      : AppColors.darkGreen,
                                ),
                              ),
                            ),
                            if (dueForWeighingCount > 0)
                              const Icon(
                                Icons.chevron_right,
                                size: 16,
                                color: Color(0xFFB71C1C),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
