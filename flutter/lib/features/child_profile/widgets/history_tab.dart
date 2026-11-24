import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/deworming_repository.dart';
import '../../../data/local/feeding_attendance_repository.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/local/vitamin_a_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/deworming_record.dart';
import '../../../data/models/measurement.dart';
import '../../../data/models/vitamin_a_record.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../shared/utils/app_month_year_picker.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../masterlist/utils/child_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';
import 'edit_measurement_dialog.dart';

enum ChildHistoryType { measurement, feeding, vitaminA, deworming }

class ChildHistoryItem {
  final String id;
  final ChildHistoryType type;
  final DateTime date;
  final Measurement? measurement;
  final Map<String, dynamic>? feeding;
  final VitaminARecord? vitaminA;
  final DewormingRecord? deworming;
  final double? weightChangeGrams;

  ChildHistoryItem({
    required this.id,
    required this.type,
    required this.date,
    this.measurement,
    this.feeding,
    this.vitaminA,
    this.deworming,
    this.weightChangeGrams,
  });
}

class HistoryTab extends StatefulWidget {
  final String childId;
  final Child? child;

  const HistoryTab({super.key, required this.childId, this.child});

  @override
  State<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<HistoryTab> {
  DateTime _selectedMonth = DateTime.now();
  bool _filterByMonth = true;
  String _activeFilter = 'All'; // 'All', 'Measurements', 'Feeding', 'Vitamin A', 'Deworming'

  final List<String> _filterChips = [
    'All',
    'Measurements',
    'Feeding',
    'Vitamin A',
    'Deworming',
  ];

  Future<void> _handleEditMeasurement(BuildContext context, Child resolvedChild, Measurement m) async {
    final updated = await EditMeasurementDialog.show(
      context,
      child: resolvedChild,
      measurement: m,
    );
    if (updated == true && context.mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Measurement updated successfully.'),
          backgroundColor: AppColors.primaryGreen,
        ),
      );
    }
  }

  Future<void> _handleDeleteMeasurement(BuildContext context, Child resolvedChild, Measurement m) async {
    final formattedDate = AppDateFormat.format(m.date);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Measurement'),
        content: Text(
          'Are you sure you want to delete the measurement from $formattedDate? Nutritional status will be recomputed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await MeasurementRepository().deleteMeasurement(
        childId: resolvedChild.id,
        recordDate: m.date,
      );
      if (context.mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Measurement deleted and status recomputed.'),
            backgroundColor: AppColors.primaryGreen,
          ),
        );
      }
    }
  }

  List<ChildHistoryItem> _loadAllHistory(Child? resolvedChild) {
    final items = <ChildHistoryItem>[];

    // 1. Measurements
    final rawMeasurements = MeasurementRepository().getForChild(widget.childId);
    final sortedAsc = List<Measurement>.from(rawMeasurements)
      ..sort((a, b) => a.date.compareTo(b.date));

    final deltas = <Measurement, double?>{};
    for (int i = 0; i < sortedAsc.length; i++) {
      if (i == 0) {
        deltas[sortedAsc[i]] = null;
      } else {
        deltas[sortedAsc[i]] = (sortedAsc[i].weightKg - sortedAsc[i - 1].weightKg) * 1000.0;
      }
    }

    for (final m in rawMeasurements) {
      items.add(
        ChildHistoryItem(
          id: 'meas_${m.date.millisecondsSinceEpoch}',
          type: ChildHistoryType.measurement,
          date: m.date,
          measurement: m,
          weightChangeGrams: deltas[m],
        ),
      );
    }

    // 2. Feeding Attendance
    final barangay = resolvedChild?.barangay ?? '';
    final feedingRepo = FeedingAttendanceRepository();
    final loggedDates = feedingRepo.getLoggedDates(barangay);
    for (final date in loggedDates) {
      final statuses = feedingRepo.getForDate(barangay, date);
      if (statuses.containsKey(widget.childId)) {
        final status = statuses[widget.childId] ?? 'Present';
        final remarks = feedingRepo.getRemarksForDate(barangay, date);
        final childFood = feedingRepo.getChildFoodForDate(barangay, date);
        final defaultFood = feedingRepo.getFoodServedForDate(barangay, date);
        final food = childFood[widget.childId] ??
            (defaultFood.isNotEmpty ? defaultFood : 'Supplemental Nutritious Meal');

        items.add(
          ChildHistoryItem(
            id: 'feed_${date.millisecondsSinceEpoch}',
            type: ChildHistoryType.feeding,
            date: date,
            feeding: {
              'status': status,
              'food': food,
              'remark': remarks[widget.childId] ?? '',
            },
          ),
        );
      }
    }

    // 3. Vitamin A
    final vitAList = VitaminARepository().getByChildId(widget.childId);
    for (final v in vitAList) {
      items.add(
        ChildHistoryItem(
          id: 'vita_${v.id}',
          type: ChildHistoryType.vitaminA,
          date: v.dateGiven,
          vitaminA: v,
        ),
      );
    }

    // 4. Deworming
    final dewormList = DewormingRepository().getByChildId(widget.childId);
    for (final dw in dewormList) {
      items.add(
        ChildHistoryItem(
          id: 'deworm_${dw.id}',
          type: ChildHistoryType.deworming,
          date: dw.dateGiven,
          deworming: dw,
        ),
      );
    }

    // Sort newest first
    items.sort((a, b) => b.date.compareTo(a.date));
    return items;
  }

  void _onMonthTap() async {
    final picked = await showAppMonthYearPicker(
      context,
      initialDate: _selectedMonth,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() {
        _selectedMonth = picked;
        _filterByMonth = true;
      });
    }
  }

  void _prevMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month - 1, 1);
      _filterByMonth = true;
    });
  }

  void _nextMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 1);
      _filterByMonth = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final resolvedChild = widget.child ?? ChildRepository().getById(widget.childId);
    final allItems = _loadAllHistory(resolvedChild);

    // Identify newest record across whole history for "Latest" pill
    final latestRecordId = allItems.isNotEmpty ? allItems.first.id : null;

    // Filter by type
    List<ChildHistoryItem> filtered = allItems.where((item) {
      switch (_activeFilter) {
        case 'Measurements':
          return item.type == ChildHistoryType.measurement;
        case 'Feeding':
          return item.type == ChildHistoryType.feeding;
        case 'Vitamin A':
          return item.type == ChildHistoryType.vitaminA;
        case 'Deworming':
          return item.type == ChildHistoryType.deworming;
        case 'All':
        default:
          return true;
      }
    }).toList();

    // Filter by selected month if enabled
    if (_filterByMonth) {
      filtered = filtered.where((item) {
        return item.date.year == _selectedMonth.year && item.date.month == _selectedMonth.month;
      }).toList();
    }

    // Group records by Month Year (e.g. "November 2026")
    final Map<String, List<ChildHistoryItem>> grouped = {};
    for (final item in filtered) {
      final key = AppDateFormat.formatMonthYear(item.date);
      grouped.putIfAbsent(key, () => []).add(item);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Month/Year Selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.8)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left, color: AppColors.darkGreen),
                  onPressed: _prevMonth,
                  tooltip: 'Previous month',
                  visualDensity: VisualDensity.compact,
                ),
                Expanded(
                  child: InkWell(
                    onTap: _onMonthTap,
                    borderRadius: BorderRadius.circular(10),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.calendar_month, size: 16, color: AppColors.darkGreen),
                          const SizedBox(width: 6),
                          Text(
                            AppDateFormat.formatMonthYear(_selectedMonth),
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.darkGreen,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_drop_down, size: 20, color: AppColors.darkGreen),
                        ],
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, color: AppColors.darkGreen),
                  onPressed: _nextMonth,
                  tooltip: 'Next month',
                  visualDensity: VisualDensity.compact,
                ),
                const SizedBox(width: 4),
                // Toggle between current month and All
                InkWell(
                  onTap: () {
                    setState(() {
                      _filterByMonth = !_filterByMonth;
                    });
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: !_filterByMonth ? AppColors.darkGreen : AppColors.background,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: !_filterByMonth ? AppColors.darkGreen : AppColors.border,
                      ),
                    ),
                    child: Text(
                      'All time',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: !_filterByMonth ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Horizontally scrollable filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: _filterChips.map((chip) {
                final isSelected = _activeFilter == chip;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: () => setState(() => _activeFilter = chip),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.darkGreen : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? Colors.transparent : AppColors.border,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: AppColors.darkGreen.withValues(alpha: 0.25),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isSelected) ...[
                            const Icon(Icons.check, size: 14, color: Colors.white),
                            const SizedBox(width: 5),
                          ],
                          Text(
                            chip,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),

          // Empty State
          if (filtered.isEmpty)
            EmptyState(
              icon: Icons.calendar_today_outlined,
              message: _filterByMonth
                  ? 'No records this month'
                  : 'No records recorded for this child.',
            )
          else
            ...grouped.entries.map((group) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Month header
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 12, top: 4),
                    child: Row(
                      children: [
                        Text(
                          group.key,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.darkGreen.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${group.value.length} ${group.value.length == 1 ? "record" : "records"}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.darkGreen,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Timeline items in this month
                  ...group.value.map((item) {
                    final isItemLatest = item.id == latestRecordId;
                    return _buildTimelineRow(context, item, isItemLatest, resolvedChild);
                  }),
                  const SizedBox(height: 12),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _buildTimelineRow(
    BuildContext context,
    ChildHistoryItem item,
    bool isItemLatest,
    Child? resolvedChild,
  ) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Date & Time Column (Left)
          SizedBox(
            width: 72,
            child: Padding(
              padding: const EdgeInsets.only(top: 4, right: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    AppDateFormat.formatMonthDay(item.date),
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppDateFormat.formatTimeOfDay(item.date),
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 2. Vertical Line & Dot
          SizedBox(
            width: 22,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Positioned(
                  top: 0,
                  bottom: 0,
                  left: 10,
                  child: Container(
                    width: 2,
                    color: AppColors.border.withValues(alpha: 0.9),
                  ),
                ),
                Positioned(
                  top: 6,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isItemLatest ? AppColors.darkGreen : AppColors.primaryGreen,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.darkGreen.withValues(alpha: 0.25),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. Right Card Column
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isItemLatest) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.fiber_manual_record, size: 7, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Latest',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  _buildCard(context, item, resolvedChild, isItemLatest),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(
    BuildContext context,
    ChildHistoryItem item,
    Child? resolvedChild,
    bool isItemLatest,
  ) {
    switch (item.type) {
      case ChildHistoryType.measurement:
        return _buildMeasurementCard(context, item, resolvedChild, isItemLatest);
      case ChildHistoryType.feeding:
        return _buildFeedingCard(context, item);
      case ChildHistoryType.vitaminA:
        return _buildVitaminACard(context, item);
      case ChildHistoryType.deworming:
        return _buildDewormingCard(context, item);
    }
  }

  Widget _buildCardWrapper({
    required VoidCallback onTap,
    required Widget child,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _buildMeasurementCard(
    BuildContext context,
    ChildHistoryItem item,
    Child? resolvedChild,
    bool isItemLatest,
  ) {
    final m = item.measurement!;
    final isPlausible = m.isPlausible;
    final wastingLabel = m.effectiveWastingStatus;

    return _buildCardWrapper(
      onTap: () => _showMeasurementDetails(context, m, resolvedChild, isItemLatest),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with icon
          Row(
            children: [
              const Text(
                'Growth Measurement',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.statBlue.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.monitor_weight_outlined,
                  size: 15,
                  color: AppColors.statBlue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Weight, Height & Weight Change
          Row(
            children: [
              Text(
                '${m.weightKg} kg · ${m.heightCm} cm',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.darkGreen,
                ),
              ),
              if (item.weightChangeGrams != null) ...[
                const SizedBox(width: 8),
                _buildWeightDiffBadge(item.weightChangeGrams!),
              ],
            ],
          ),
          const SizedBox(height: 8),

          // Status Badges
          if (!isPlausible)
            const StatusBadge(
              label: 'Needs re-measurement',
              color: AppColors.statRed,
            )
          else
            Wrap(
              spacing: 6,
              runSpacing: 5,
              children: [
                StatusBadge(
                  label: m.weightForAgeStatus,
                  color: ChildStatusMeta.colorFor(m.weightForAgeStatus),
                ),
                StatusBadge(
                  label: m.heightForAgeStatus,
                  color: ChildStatusMeta.colorFor(m.heightForAgeStatus),
                ),
                StatusBadge(
                  label: wastingLabel,
                  color: ChildStatusMeta.colorFor(wastingLabel),
                ),
                if (m.bilateralPittingEdema)
                  const StatusBadge(
                    label: 'Edema',
                    color: AppColors.statRed,
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildWeightDiffBadge(double gramsDiff) {
    final grams = gramsDiff.round();
    final isGain = grams > 0;
    final isLoss = grams < 0;

    final color = isGain
        ? AppColors.darkGreen
        : (isLoss ? AppColors.statOrange : AppColors.textMuted);
    final bg = isGain
        ? AppColors.lightGreenBg
        : (isLoss ? AppColors.statOrange.withValues(alpha: 0.12) : AppColors.background);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isGain
                ? Icons.arrow_upward
                : (isLoss ? Icons.arrow_downward : Icons.remove),
            size: 11,
            color: color,
          ),
          const SizedBox(width: 2),
          Text(
            '${isGain ? "+" : ""}${grams}g',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedingCard(BuildContext context, ChildHistoryItem item) {
    final feeding = item.feeding ?? {};
    final status = feeding['status']?.toString() ?? 'Present';
    final food = feeding['food']?.toString() ?? 'Supplemental Meal';
    final remark = feeding['remark']?.toString() ?? '';
    final isPresent = status == 'Present';

    return _buildCardWrapper(
      onTap: () => _showFeedingDetails(context, item.date, feeding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Feeding Program',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.statOrange.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.restaurant_outlined,
                  size: 15,
                  color: AppColors.statOrange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              StatusBadge(
                label: status,
                color: isPresent ? AppColors.primaryGreen : AppColors.statOrange,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  food,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (remark.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Note: $remark',
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textMuted,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVitaminACard(BuildContext context, ChildHistoryItem item) {
    final v = item.vitaminA!;

    return _buildCardWrapper(
      onTap: () => _showVitaminADetails(context, v),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Vitamin A Supplement',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.statPurple.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.medical_services_outlined,
                  size: 15,
                  color: AppColors.statPurple,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            v.dosage,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.darkGreen,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${v.doseType} · ${AppDateFormat.format(v.dateGiven)}',
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDewormingCard(BuildContext context, ChildHistoryItem item) {
    final dw = item.deworming!;

    return _buildCardWrapper(
      onTap: () => _showDewormingDetails(context, dw),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Deworming Service',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.medication_outlined,
                  size: 15,
                  color: AppColors.primaryGreen,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            dw.drugName,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.darkGreen,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${dw.round} · ${AppDateFormat.format(dw.dateGiven)}',
            style: const TextStyle(
              fontSize: 11.5,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  // Details sheets / dialogs
  void _showMeasurementDetails(
    BuildContext context,
    Measurement m,
    Child? resolvedChild,
    bool isItemLatest,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Measurement Details',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (resolvedChild != null)
                    Row(
                      children: [
                        if (isItemLatest)
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 20, color: AppColors.primaryGreen),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _handleEditMeasurement(context, resolvedChild, m);
                            },
                          ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.statRed),
                          onPressed: () {
                            Navigator.pop(ctx);
                            _handleDeleteMeasurement(context, resolvedChild, m);
                          },
                        ),
                      ],
                    ),
                ],
              ),
              Text(
                AppDateFormat.format(m.date),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 12),
              _detailRow('Weight', '${m.weightKg} kg'),
              _detailRow('Height', '${m.heightCm} cm'),
              _detailRow('BMI', m.isPlausible ? '${m.bmi}' : '—'),
              if (m.muacCm != null && m.muacCm! > 0)
                _detailRow('MUAC', '${m.muacCm} cm'),
              _detailRow('Weight-for-Age', m.weightForAgeStatus),
              _detailRow('Height-for-Age', m.heightForAgeStatus),
              _detailRow('Weight-for-Length', m.effectiveWastingStatus),
              _detailRow('Edema', m.bilateralPittingEdema ? 'Yes (Present)' : 'None'),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  void _showFeedingDetails(BuildContext context, DateTime date, Map<String, dynamic> feeding) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Feeding Attendance Details',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                AppDateFormat.format(date),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 12),
              _detailRow('Status', feeding['status']?.toString() ?? 'Present'),
              _detailRow('Meal Served', feeding['food']?.toString() ?? 'Supplemental Meal'),
              if ((feeding['remark']?.toString() ?? '').isNotEmpty)
                _detailRow('Remarks', feeding['remark'].toString()),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  void _showVitaminADetails(BuildContext context, VitaminARecord v) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Vitamin A Record Details',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                AppDateFormat.format(v.dateGiven),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 12),
              _detailRow('Dosage', v.dosage),
              _detailRow('Dose Type', v.doseType),
              _detailRow('Administered By', v.administeredBy),
              if (v.remarks.isNotEmpty) _detailRow('Remarks', v.remarks),
              if (v.nextDueDate != null)
                _detailRow('Next Due Date', AppDateFormat.format(v.nextDueDate!)),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  void _showDewormingDetails(BuildContext context, DewormingRecord dw) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Deworming Record Details',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                AppDateFormat.format(dw.dateGiven),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 12),
              _detailRow('Medicine', dw.drugName),
              _detailRow('Round', dw.round),
              _detailRow('Adverse Events', dw.adverseEvents),
              _detailRow('Administered By', dw.administeredBy),
              if (dw.remarks.isNotEmpty) _detailRow('Remarks', dw.remarks),
              if (dw.nextDueDate != null)
                _detailRow('Next Due Date', AppDateFormat.format(dw.nextDueDate!)),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
