import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/local/app_data_bus.dart';
import '../../../data/local/child_repository.dart';
import '../../../data/local/hive_boxes.dart';
import '../../../data/local/vitamin_a_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/vitamin_a_record.dart';
import '../../../shared/utils/app_page_route.dart';
import '../../../data/local/program_schedule_repository.dart';
import '../../../data/models/program_schedule.dart';
import '../../../shared/utils/app_date_format.dart';
import '../schedule/add_program_schedule_screen.dart';
import 'record_vitamin_a_screen.dart';

class VitaminAScreen extends StatefulWidget {
  final String barangay;

  const VitaminAScreen({super.key, this.barangay = 'Tiguion'});

  @override
  State<VitaminAScreen> createState() => _VitaminAScreenState();
}

class _VitaminAScreenState extends State<VitaminAScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _vitARepo = VitaminARepository();
  final _childRepo = ChildRepository();
  final _scheduleRepo = ProgramScheduleRepository();
  String _searchQuery = '';
  final bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this, initialIndex: 0);
    _initData();
  }

  Future<void> _initData() async {
    try {
      _vitARepo.seedInitialIfEmpty(widget.barangay);
    } catch (e) {
      debugPrint('Vitamin A seed error: $e');
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String get _currentBarangay =>
      Hive.box(HiveBoxes.settings).get('auth_user')?['barangay']?.toString() ??
      widget.barangay;

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Vitamin A Program', style: TextStyle(color: Colors.white)),
          backgroundColor: AppColors.darkGreen,
          iconTheme: const IconThemeData(color: Colors.white),
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primaryGreen),
        ),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Vitamin A Program', style: TextStyle(color: Colors.white)),
          backgroundColor: AppColors.darkGreen,
          iconTheme: const IconThemeData(color: Colors.white),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: AppColors.statRed),
                const SizedBox(height: 12),
                Text('Failed to load Vitamin A data', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                const SizedBox(height: 6),
                Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 16),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryGreen, foregroundColor: Colors.white),
                  onPressed: () => setState(() => _errorMessage = null),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, version, childWidget) {
        List<VitaminARecord> records = [];
        List<Child> eligibleChildren = [];
        List<ProgramSchedule> schedules = [];
        Set<String> recentRecipients = {};
        int coveragePct = 0;

        try {
          records = _vitARepo.getAllForBarangay(_currentBarangay);
          final allChildren = _childRepo
              .getByBarangay(_currentBarangay)
              .where((c) => c.isActive)
              .toList();
          eligibleChildren = allChildren
              .where((c) => c.ageInMonths >= 6 && c.ageInMonths <= 59)
              .toList();

          final sixMonthsAgo = DateTime.now().subtract(const Duration(days: 180));
          recentRecipients = records
              .where((r) => r.dateGiven.isAfter(sixMonthsAgo))
              .map((r) => r.childId)
              .toSet();

          coveragePct = eligibleChildren.isEmpty
              ? 0
              : ((recentRecipients.length / eligibleChildren.length) * 100).round();

          schedules = _scheduleRepo
              .getAllForBarangay(_currentBarangay)
              .where((s) => s.programType.toLowerCase() == 'vitamin a')
              .toList();
        } catch (e) {
          return Scaffold(
            backgroundColor: AppColors.background,
            appBar: AppBar(
              title: const Text('Vitamin A Program', style: TextStyle(color: Colors.white)),
              backgroundColor: AppColors.darkGreen,
              iconTheme: const IconThemeData(color: Colors.white),
            ),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.statRed),
                    const SizedBox(height: 12),
                    Text('Failed to load Vitamin A data', style: AppTextStyles.h2.copyWith(fontSize: 16)),
                    const SizedBox(height: 6),
                    Text('$e', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryGreen, foregroundColor: Colors.white),
                      onPressed: () => setState(() {}),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
            title: const Text(
              'Vitamin A Program',
              style: TextStyle(color: Colors.white),
            ),
            backgroundColor: AppColors.darkGreen,
            foregroundColor: Colors.white,
            iconTheme: const IconThemeData(color: Colors.white),
            actions: [
              IconButton(
                icon: const Icon(Icons.calendar_month_outlined, color: Colors.white),
                tooltip: 'Schedule Vitamin A Activity',
                onPressed: () {
                  Navigator.push(
                    context,
                    appPageRoute(
                      AddProgramScheduleScreen(
                        prefillProgramType: 'Vitamin A',
                        initialTitle: 'Barangay Vitamin A Supplementation',
                      ),
                    ),
                  );
                },
              ),
            ],
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: Colors.white,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white70,
              tabs: [
                Tab(text: 'Eligible (${eligibleChildren.length})'),
                Tab(text: 'Records (${records.length})'),
                Tab(text: 'Schedule (${schedules.length})'),
              ],
            ),
          ),
          body: Column(
            children: [
              // Summary Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
                color: AppColors.surface,
                child: Row(
                  children: [
                    Expanded(
                      child: _buildMetricTile(
                        'Target Eligible',
                        '${eligibleChildren.length}',
                        '6-59 mos',
                        Colors.blueGrey,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildMetricTile(
                        'Given (6 mos)',
                        '${recentRecipients.length}',
                        'Children',
                        AppColors.primaryGreen,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildMetricTile(
                        'Coverage',
                        '$coveragePct%',
                        coveragePct >= 90 ? 'Optimal' : 'Needs Follow-up',
                        coveragePct >= 90
                            ? AppColors.primaryGreen
                            : AppColors.statOrange,
                      ),
                    ),
                  ],
                ),
              ),

              // Search Bar
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search child name or schedule...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (val) =>
                      setState(() => _searchQuery = val.trim().toLowerCase()),
                ),
              ),

              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildEligibleList(eligibleChildren, recentRecipients),
                    _buildRecordsList(records),
                    _buildScheduleList(schedules),
                  ],
                ),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            backgroundColor: AppColors.darkGreen,
            foregroundColor: Colors.white,
            icon: const Icon(Icons.add),
            label: const Text('Record Vit A'),
            onPressed: () {
              Navigator.push(
                context,
                appPageRoute(const RecordVitaminAScreen()),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildMetricTile(
    String title,
    String val,
    String subtitle,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            title,
            style: AppTextStyles.caption.copyWith(
              fontSize: 10,
              color: AppColors.textMuted,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            val,
            style: AppTextStyles.h2.copyWith(fontSize: 18, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: AppTextStyles.caption.copyWith(
              fontSize: 9,
              height: 1.15,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildRecordsList(List<VitaminARecord> records) {
    final filtered = _searchQuery.isEmpty
        ? records
        : records
              .where((r) => r.childName.toLowerCase().contains(_searchQuery))
              .toList();

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.medication_outlined,
                size: 48,
                color: AppColors.textMuted,
              ),
              const SizedBox(height: 12),
              Text(
                'No Vitamin A records found',
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 8, AppSpacing.lg, 80),
      itemCount: filtered.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final r = filtered[i];
        final isBlue =
            r.dosage.contains('Blue') || r.dosage.contains('100,000');
        final dateStr =
            '${r.dateGiven.month}/${r.dateGiven.day}/${r.dateGiven.year}';
        final nextDueStr = r.nextDueDate != null
            ? '${r.nextDueDate!.month}/${r.nextDueDate!.day}/${r.nextDueDate!.year}'
            : '—';

        return Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: isBlue
                        ? Colors.blue[100]
                        : Colors.red[100],
                    child: Icon(
                      Icons.medication,
                      size: 18,
                      color: isBlue ? Colors.blue[800] : Colors.red[800],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.childName,
                          style: AppTextStyles.h3.copyWith(fontSize: 14),
                        ),
                        Text(
                          '${r.doseType} • Age: ${r.ageInMonths} mos',
                          style: AppTextStyles.caption,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: isBlue ? Colors.blue[50] : Colors.red[50],
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isBlue ? Colors.blue : Colors.red,
                      ),
                    ),
                    child: Text(
                      r.dosage,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isBlue ? Colors.blue[800] : Colors.red[800],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Given: $dateStr by ${r.administeredBy}',
                    style: AppTextStyles.caption.copyWith(fontSize: 11),
                  ),
                  Text(
                    'Next Due: $nextDueStr',
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkGreen,
                    ),
                  ),
                ],
              ),
              if (r.remarks.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Note: ${r.remarks}',
                  style: AppTextStyles.caption.copyWith(
                    fontStyle: FontStyle.italic,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildEligibleList(
    List<Child> eligible,
    Set<String> recentRecipients,
  ) {
    final filtered = _searchQuery.isEmpty
        ? eligible
        : eligible
              .where((c) => c.fullName.toLowerCase().contains(_searchQuery))
              .toList();

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.people_outline,
                size: 48,
                color: AppColors.textMuted,
              ),
              const SizedBox(height: 12),
              Text(
                'No eligible children found',
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 8, AppSpacing.lg, 80),
      itemCount: filtered.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final child = filtered[i];
        final hasReceived = recentRecipients.contains(child.id);
        final isBlue = child.ageInMonths <= 11;
        final recommendedDose = isBlue
            ? '100,000 IU (Blue)'
            : '200,000 IU (Red)';

        return Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.darkGreen.withValues(alpha: 0.1),
                child: Text(
                  child.initials,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.darkGreen,
                    fontSize: 12,
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
                      style: AppTextStyles.h3.copyWith(fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${child.ageLabel} (${child.ageInMonths} mos) • Rec: $recommendedDose',
                      style: AppTextStyles.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (hasReceived)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 14,
                        color: AppColors.primaryGreen,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Done',
                        style: TextStyle(
                          color: AppColors.primaryGreen,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                )
              else
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.darkGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    textStyle: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () {
                    Navigator.push(
                      context,
                      appPageRoute(RecordVitaminAScreen(initialChild: child)),
                    );
                  },
                  child: const Text('Give Dose'),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildScheduleList(List<ProgramSchedule> schedules) {
    final filtered = _searchQuery.isEmpty
        ? schedules
        : schedules.where((s) =>
            s.title.toLowerCase().contains(_searchQuery) ||
            s.location.toLowerCase().contains(_searchQuery) ||
            s.targetGroup.toLowerCase().contains(_searchQuery)).toList();

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.event_available_outlined,
                size: 48,
                color: AppColors.textMuted,
              ),
              const SizedBox(height: 12),
              Text(
                'No Vitamin A schedules found',
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                icon: const Icon(Icons.add, color: AppColors.darkGreen),
                label: const Text('Schedule Vitamin A Day', style: TextStyle(color: AppColors.darkGreen)),
                onPressed: () {
                  Navigator.push(
                    context,
                    appPageRoute(
                      AddProgramScheduleScreen(
                        prefillProgramType: 'Vitamin A',
                        initialTitle: 'Barangay Vitamin A Supplementation',
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 8, AppSpacing.lg, 80),
      itemCount: filtered.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final s = filtered[index];
        final monthStr = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ][s.date.month - 1];

        return Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.statAmber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    Text(
                      monthStr.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.statAmber,
                      ),
                    ),
                    Text(
                      '${s.date.day}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.statAmber,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.title, style: AppTextStyles.h3.copyWith(fontSize: 14)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.access_time, size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          AppDateFormat.formatTimeRange(s.startTime, s.endTime),
                          style: AppTextStyles.caption.copyWith(fontSize: 11),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            s.location,
                            style: AppTextStyles.caption.copyWith(fontSize: 11),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    if (s.targetGroup.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Target: ${s.readableTargetGroup}',
                        style: AppTextStyles.caption.copyWith(
                          fontSize: 11,
                          color: AppColors.darkGreen,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
