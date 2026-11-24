import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../data/local/mother_visit_repository.dart';
import '../../../data/models/mother.dart';
import '../../../data/models/mother_visit.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../shared/utils/app_month_year_picker.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../masterlist/widgets/status_badge.dart';

class VisitsTab extends StatefulWidget {
  final Mother mother;
  const VisitsTab({super.key, required this.mother});

  @override
  State<VisitsTab> createState() => _VisitsTabState();
}

class _VisitsTabState extends State<VisitsTab> {
  DateTime _selectedMonth = DateTime.now();
  bool _filterByMonth = true;
  String _activeFilter = 'All'; // 'All', 'Counseling', 'Normal', 'Signs of concern'

  final List<String> _filterChips = [
    'All',
    'Counseling',
    'Normal',
    'Signs of concern',
  ];

  String _toSentenceCase(String input) {
    if (input.trim().isEmpty) return input;
    final trimmed = input.trim();
    return trimmed[0].toUpperCase() + trimmed.substring(1);
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
    final allVisits = MotherVisitRepository().getForMother(widget.mother.id);
    allVisits.sort((a, b) => b.date.compareTo(a.date));

    // Newest visit ID across whole history
    final latestVisit = allVisits.isNotEmpty ? allVisits.first : null;

    // Filter by category chip
    List<MotherVisit> filtered = allVisits.where((v) {
      final isConcern = v.observation == 'Signs of concern' ||
          v.hasMedicalConcern ||
          (v.observationNote != null &&
              v.observationNote!.toLowerCase().contains('concern'));
      switch (_activeFilter) {
        case 'Counseling':
          return v.present && (v.topicsCounseled.isNotEmpty || v.breastfeedingPractice != null);
        case 'Normal':
          return v.present && !isConcern;
        case 'Signs of concern':
          return v.present && isConcern;
        case 'All':
        default:
          return true;
      }
    }).toList();

    // Filter by selected month if enabled
    if (_filterByMonth) {
      filtered = filtered.where((v) {
        return v.date.year == _selectedMonth.year && v.date.month == _selectedMonth.month;
      }).toList();
    }

    // Group visits by Month Year (e.g. "November 2026")
    final Map<String, List<MotherVisit>> grouped = {};
    for (final v in filtered) {
      final key = AppDateFormat.formatMonthYear(v.date);
      grouped.putIfAbsent(key, () => []).add(v);
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
                  ? 'No visits this month'
                  : 'No counseling visits recorded for this mother.',
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
                            '${group.value.length} ${group.value.length == 1 ? "visit" : "visits"}',
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
                  ...group.value.map((v) {
                    final isItemLatest = v == latestVisit;
                    return _buildTimelineRow(context, v, isItemLatest);
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
    MotherVisit visit,
    bool isItemLatest,
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
                    AppDateFormat.formatMonthDay(visit.date),
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppDateFormat.formatTimeOfDay(visit.date),
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
                  _buildVisitCard(context, visit),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVisitCard(BuildContext context, MotherVisit visit) {
    final isConcern = visit.observation == 'Signs of concern' ||
        visit.hasMedicalConcern ||
        (visit.observationNote != null &&
            visit.observationNote!.toLowerCase().contains('concern'));

    final statusLabel = !visit.present
        ? 'Missed'
        : (isConcern ? 'Signs of concern' : 'Appears well');

    final accentColor = !visit.present
        ? AppColors.textMuted
        : (isConcern ? AppColors.statOrange : AppColors.primaryGreen);

    // Compute observation text
    String observationText;
    if (!visit.present) {
      observationText = 'Missed visit';
    } else if (isConcern) {
      final note = visit.observationNote != null && visit.observationNote!.isNotEmpty
          ? ' (${_toSentenceCase(visit.observationNote!)})'
          : '';
      observationText = 'Signs of concern$note';
    } else {
      final note = visit.observationNote != null && visit.observationNote!.isNotEmpty
          ? ' (${_toSentenceCase(visit.observationNote!)})'
          : '';
      observationText = 'Appears well$note';
    }

    // Compute concern text
    String concernText;
    if (visit.hasMedicalConcern &&
        visit.concernNote != null &&
        visit.concernNote!.trim().isNotEmpty) {
      concernText = _toSentenceCase(visit.concernNote!);
    } else {
      concernText = 'None reported';
    }

    final feedingText = visit.breastfeedingPractice != null &&
            visit.breastfeedingPractice!.trim().isNotEmpty
        ? _toSentenceCase(visit.breastfeedingPractice!)
        : 'Not recorded';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => _showVisitDetails(context, visit, observationText, concernText, feedingText, statusLabel, accentColor),
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: date & time, observation badge
              Row(
                children: [
                  Text(
                    AppDateFormat.format(visit.date),
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  StatusBadge(label: statusLabel, color: accentColor),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 8),

              if (!visit.present)
                const Text(
                  'No show · rescheduled by BNS',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                )
              else ...[
                _buildLabeledRow('Observation', observationText),
                _buildLabeledRow('Concern', concernText),
                _buildLabeledRow('Feeding', feedingText),
              ],

              if (visit.signature != null && visit.signature!.isNotEmpty) ...[
                const SizedBox(height: 6),
                const Row(
                  children: [
                    Icon(Icons.draw, size: 13, color: AppColors.primaryGreen),
                    SizedBox(width: 4),
                    Text(
                      "Mother's Signature Attached",
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.primaryGreen,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabeledRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showVisitDetails(
    BuildContext context,
    MotherVisit visit,
    String observationText,
    String concernText,
    String feedingText,
    String statusLabel,
    Color accentColor,
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
                    'Counseling Visit Details',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  StatusBadge(label: statusLabel, color: accentColor),
                ],
              ),
              Text(
                AppDateFormat.format(visit.date),
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 12),
              _buildLabeledRow('Status', visit.present ? 'Attended' : 'Missed'),
              _buildLabeledRow('Observation', observationText),
              _buildLabeledRow('Concern', concernText),
              _buildLabeledRow('Feeding', feedingText),
              if (visit.topicsCounseled.isNotEmpty)
                _buildLabeledRow('Topics', visit.topicsCounseled.join(', ')),
              if (visit.signature != null && visit.signature!.isNotEmpty) ...[
                const SizedBox(height: 8),
                const Row(
                  children: [
                    Icon(Icons.draw, size: 14, color: AppColors.primaryGreen),
                    SizedBox(width: 4),
                    Text(
                      "Mother's Signature Attached",
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.primaryGreen,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }
}
