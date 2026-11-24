import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../data/local/hive_boxes.dart';
import '../../../../data/local/program_schedule_repository.dart';
import '../../../../data/local/report_signatory_repository.dart';
import '../../../../data/models/program_schedule.dart';
import '../../../../shared/utils/app_month_year_picker.dart';
import '../services/calendar_schedule_pdf_service.dart';

class PrintScheduleBottomSheet extends StatefulWidget {
  final DateTime initialMonth;
  final String initialFilter;
  final String barangay;

  const PrintScheduleBottomSheet({
    super.key,
    required this.initialMonth,
    required this.initialFilter,
    required this.barangay,
  });

  static Future<void> show({
    required BuildContext context,
    required DateTime initialMonth,
    required String initialFilter,
    required String barangay,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PrintScheduleBottomSheet(
        initialMonth: initialMonth,
        initialFilter: initialFilter,
        barangay: barangay,
      ),
    );
  }

  @override
  State<PrintScheduleBottomSheet> createState() => _PrintScheduleBottomSheetState();
}

class _PrintScheduleBottomSheetState extends State<PrintScheduleBottomSheet> {
  static const List<String> _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  late DateTime _selectedMonth;
  late String _selectedFilter;
  String _selectedLayout = 'Calendar + list';
  String _periodMode = 'Month'; // 'Month', 'Whole year', 'Date range'
  DateTime? _customStartDate;
  DateTime? _customEndDate;
  bool _isLoading = false;

  final _scheduleRepo = ProgramScheduleRepository();
  final _signatoryRepo = ReportSignatoryRepository();
  final _settings = SettingsRepository();
  final _pdfService = CalendarSchedulePdfService();

  @override
  void initState() {
    super.initState();
    _selectedMonth = DateTime(widget.initialMonth.year, widget.initialMonth.month, 1);
    _selectedFilter = widget.initialFilter.isEmpty ? 'All' : widget.initialFilter;
    _refreshSignatories();
  }

  Future<void> _refreshSignatories() async {
    try {
      await _signatoryRepo.fetchAndCacheForBarangay(widget.barangay);
    } catch (_) {}
  }

  List<ProgramSchedule> _getMatchingSchedules() {
    final all = _scheduleRepo.getAllForBarangay(widget.barangay);
    return all.where((s) {
      // Date filter
      if (_periodMode == 'Date range' && _customStartDate != null && _customEndDate != null) {
        final start = DateTime(_customStartDate!.year, _customStartDate!.month, _customStartDate!.day);
        final end = DateTime(_customEndDate!.year, _customEndDate!.month, _customEndDate!.day, 23, 59, 59);
        if (s.date.isBefore(start) || s.date.isAfter(end)) return false;
      } else if (_periodMode == 'Whole year') {
        if (s.date.year != _selectedMonth.year) return false;
      } else {
        if (s.date.year != _selectedMonth.year || s.date.month != _selectedMonth.month) {
          return false;
        }
      }

      // Program filter
      if (_selectedFilter != 'All' && s.programType != _selectedFilter) {
        return false;
      }

      return true;
    }).toList();
  }

  Future<void> _pickMonth() async {
    final picked = await showAppMonthYearPicker(
      context,
      initialDate: _selectedMonth,
    );
    if (picked != null) {
      setState(() {
        _selectedMonth = picked;
      });
    }
  }

  Future<void> _pickCustomRange() async {
    final pickedRange = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      initialDateRange: _customStartDate != null && _customEndDate != null
          ? DateTimeRange(start: _customStartDate!, end: _customEndDate!)
          : DateTimeRange(
              start: _selectedMonth,
              end: DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0),
            ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primaryGreen,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedRange != null) {
      setState(() {
        _periodMode = 'Date range';
        _customStartDate = pickedRange.start;
        _customEndDate = pickedRange.end;
      });
    }
  }

  void _showEmptySnackbar() {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _periodMode == 'Date range'
              ? 'No schedules found in the selected date range.'
              : (_periodMode == 'Whole year'
                  ? 'No schedules found in year ${_selectedMonth.year}.'
                  : 'No schedules in this month'),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        backgroundColor: Colors.orange.shade800,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _handleAction(String action) async {
    final schedules = _getMatchingSchedules();
    if (schedules.isEmpty) {
      _showEmptySnackbar();
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authUser = _settings.authUser;
      final firstName = authUser?['firstName']?.toString() ?? '';
      final lastName = authUser?['lastName']?.toString() ?? '';
      final bnsName = '$firstName $lastName'.trim();
      final purok = authUser?['purok']?.toString() ?? '';
      final signatory = _signatoryRepo.resolveForUser(authUser);
      final isWholeYear = _periodMode == 'Whole year';

      if (action == 'save') {
        final navigator = Navigator.of(context);
        final messenger = ScaffoldMessenger.of(context);
        await _pdfService.saveAsPdf(
          messenger: messenger,
          barangay: widget.barangay,
          year: _selectedMonth.year,
          month: _selectedMonth.month,
          programFilter: _selectedFilter,
          layout: _selectedLayout,
          schedules: schedules,
          bnsName: bnsName.isNotEmpty ? bnsName : null,
          purok: purok.isNotEmpty ? purok : null,
          signatory: signatory,
          isWholeYear: isWholeYear,
        );
        if (mounted) {
          navigator.pop();
        }
      } else if (action == 'print') {
        await _pdfService.printSchedule(
          barangay: widget.barangay,
          year: _selectedMonth.year,
          month: _selectedMonth.month,
          programFilter: _selectedFilter,
          layout: _selectedLayout,
          schedules: schedules,
          bnsName: bnsName.isNotEmpty ? bnsName : null,
          purok: purok.isNotEmpty ? purok : null,
          signatory: signatory,
          isWholeYear: isWholeYear,
        );
      } else if (action == 'share') {
        await _pdfService.shareSchedule(
          barangay: widget.barangay,
          year: _selectedMonth.year,
          month: _selectedMonth.month,
          programFilter: _selectedFilter,
          layout: _selectedLayout,
          schedules: schedules,
          bnsName: bnsName.isNotEmpty ? bnsName : null,
          purok: purok.isNotEmpty ? purok : null,
          signatory: signatory,
          isWholeYear: isWholeYear,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.statRed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = '${_monthNames[_selectedMonth.month - 1]} ${_selectedMonth.year}';
    final matchingCount = _getMatchingSchedules().length;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Header Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.print_outlined,
                    color: AppColors.darkGreen,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Print Schedule',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        '$matchingCount ${matchingCount == 1 ? "activity" : "activities"} found',
                        style: TextStyle(
                          fontSize: 12,
                          color: matchingCount > 0 ? AppColors.darkGreen : AppColors.statRed,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── 1. Month / Period Selector ─────────────────────────────────
            const Text(
              'Period',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: ['Month', 'Whole year', 'Date range'].map((mode) {
                  final isSel = _periodMode == mode;
                  return Expanded(
                    child: InkWell(
                      onTap: () {
                        setState(() {
                          _periodMode = mode;
                          if (mode == 'Date range' && _customStartDate == null) {
                            _customStartDate = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
                            _customEndDate = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0);
                          }
                        });
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        decoration: BoxDecoration(
                          color: isSel ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: isSel
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.05),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  ),
                                ]
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          mode,
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                            color: isSel ? AppColors.darkGreen : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 8),

            // Period selector active view
            if (_periodMode == 'Month')
              InkWell(
                onTap: _pickMonth,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.lightGreenBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primaryGreen, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_month, size: 16, color: AppColors.primaryGreen),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          monthLabel,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.darkGreen,
                          ),
                        ),
                      ),
                      const Text(
                        'Change',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primaryGreen),
                      ),
                    ],
                  ),
                ),
              )
            else if (_periodMode == 'Whole year')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.lightGreenBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primaryGreen, width: 1.2),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left, color: AppColors.darkGreen),
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        setState(() {
                          _selectedMonth = DateTime(_selectedMonth.year - 1, 1, 1);
                        });
                      },
                    ),
                    Text(
                      'Whole Year ${_selectedMonth.year}',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.darkGreen,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, color: AppColors.darkGreen),
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        setState(() {
                          _selectedMonth = DateTime(_selectedMonth.year + 1, 1, 1);
                        });
                      },
                    ),
                  ],
                ),
              )
            else
              InkWell(
                onTap: _pickCustomRange,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.lightGreenBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primaryGreen, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.date_range, size: 16, color: AppColors.primaryGreen),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _customStartDate != null && _customEndDate != null
                              ? '${_customStartDate!.day} ${_monthNames[_customStartDate!.month - 1].substring(0, 3)} - ${_customEndDate!.day} ${_monthNames[_customEndDate!.month - 1].substring(0, 3)} ${_customEndDate!.year}'
                              : 'Select Custom Date Range',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.darkGreen,
                          ),
                        ),
                      ),
                      const Text(
                        'Change',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primaryGreen),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 14),

            // ── 2. Program Filter ──────────────────────────────────────────
            const Text(
              'Program Filter',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 6),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['All', 'Feeding', 'Vitamin A', 'Deworming', 'OPT Plus'].map((filter) {
                  final isSel = _selectedFilter == filter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(filter),
                      selected: isSel,
                      labelStyle: TextStyle(
                        fontSize: 11.5,
                        fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                        color: isSel ? Colors.white : AppColors.textPrimary,
                      ),
                      selectedColor: AppColors.darkGreen,
                      backgroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: isSel ? AppColors.darkGreen : AppColors.border),
                      ),
                      onSelected: (_) => setState(() => _selectedFilter = filter),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 14),

            // ── 3. Layout Selection ────────────────────────────────────────
            const Text(
              'Layout Style',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                _layoutOption('Calendar + list', Icons.table_chart_outlined),
                const SizedBox(width: 8),
                _layoutOption('Calendar only', Icons.calendar_view_month_outlined),
                const SizedBox(width: 8),
                _layoutOption('List only', Icons.view_list_outlined),
              ],
            ),
            const SizedBox(height: 20),

            // ── 4. Action Buttons ──────────────────────────────────────────
            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation(AppColors.primaryGreen),
                  ),
                ),
              )
            else
              Row(
                children: [
                  // Print button (Android print dialog)
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.darkGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.print, size: 17),
                      label: const Text(
                        'Print',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      onPressed: () => _handleAction('print'),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Save as PDF button (Downloads folder)
                  Expanded(
                    flex: 3,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.darkGreen,
                        side: const BorderSide(color: AppColors.darkGreen, width: 1.2),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.picture_as_pdf_outlined, size: 17),
                      label: const Text(
                        'Save as PDF',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      onPressed: () => _handleAction('save'),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Share button
                  IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.surface,
                      foregroundColor: AppColors.darkGreen,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.all(12),
                    ),
                    icon: const Icon(Icons.share_outlined, size: 18),
                    tooltip: 'Share',
                    onPressed: () => _handleAction('share'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _layoutOption(String title, IconData icon) {
    final isSel = _selectedLayout == title;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedLayout = title),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
          decoration: BoxDecoration(
            color: isSel ? AppColors.darkGreen.withValues(alpha: 0.08) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSel ? AppColors.darkGreen : AppColors.border,
              width: isSel ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 16,
                color: isSel ? AppColors.darkGreen : AppColors.textMuted,
              ),
              const SizedBox(height: 3),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                  color: isSel ? AppColors.darkGreen : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
