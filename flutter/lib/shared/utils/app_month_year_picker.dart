import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Opens a clean, responsive month and year picker bottom sheet.
/// Features a year row with `<` and `>` arrows, a 3x4 grid of the 12 months,
/// a "Today" button to jump back to current month/year, and smooth selection.
Future<DateTime?> showAppMonthYearPicker(
  BuildContext context, {
  required DateTime initialDate,
  DateTime? firstDate,
  DateTime? lastDate,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => _AppMonthYearPickerSheet(
      initialDate: initialDate,
      firstDate: firstDate ?? DateTime(2020, 1, 1),
      lastDate: lastDate ?? DateTime(2035, 12, 31),
    ),
  );
}

class _AppMonthYearPickerSheet extends StatefulWidget {
  final DateTime initialDate;
  final DateTime firstDate;
  final DateTime lastDate;

  const _AppMonthYearPickerSheet({
    required this.initialDate,
    required this.firstDate,
    required this.lastDate,
  });

  @override
  State<_AppMonthYearPickerSheet> createState() => _AppMonthYearPickerSheetState();
}

class _AppMonthYearPickerSheetState extends State<_AppMonthYearPickerSheet> {
  static const List<String> _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  late int _selectedYear;
  late int _selectedMonth;
  bool _isSelectingYear = false;

  @override
  void initState() {
    super.initState();
    _selectedYear = widget.initialDate.year;
    _selectedMonth = widget.initialDate.month;
  }

  void _onPrevYear() {
    if (_selectedYear > widget.firstDate.year) {
      setState(() => _selectedYear--);
    }
  }

  void _onNextYear() {
    if (_selectedYear < widget.lastDate.year) {
      setState(() => _selectedYear++);
    }
  }

  void _jumpToToday() {
    final now = DateTime.now();
    setState(() {
      _selectedYear = now.year;
      _selectedMonth = now.month;
      _isSelectingYear = false;
    });
  }

  void _confirmSelection() {
    Navigator.pop(context, DateTime(_selectedYear, _selectedMonth, 1));
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

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
        top: 14,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Header title & close button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Icon(
                        Icons.calendar_month,
                        color: AppColors.darkGreen,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Select Month & Year',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.close, size: 19, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Year selector row with < > arrows
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left, color: AppColors.darkGreen),
                    visualDensity: VisualDensity.compact,
                    onPressed: _selectedYear > widget.firstDate.year ? _onPrevYear : null,
                  ),
                  InkWell(
                    onTap: () => setState(() => _isSelectingYear = !_isSelectingYear),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$_selectedYear',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.darkGreen,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            _isSelectingYear ? Icons.arrow_drop_up : Icons.arrow_drop_down,
                            color: AppColors.darkGreen,
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right, color: AppColors.darkGreen),
                    visualDensity: VisualDensity.compact,
                    onPressed: _selectedYear < widget.lastDate.year ? _onNextYear : null,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Main body: Year list grid or 3x4 Months grid
            if (_isSelectingYear)
              SizedBox(
                height: 180,
                child: GridView.builder(
                  physics: const BouncingScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 1.8,
                  ),
                  itemCount: widget.lastDate.year - widget.firstDate.year + 1,
                  itemBuilder: (context, i) {
                    final yr = widget.firstDate.year + i;
                    final isSel = yr == _selectedYear;
                    return InkWell(
                      onTap: () {
                        setState(() {
                          _selectedYear = yr;
                          _isSelectingYear = false;
                        });
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSel ? AppColors.darkGreen : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSel ? AppColors.darkGreen : AppColors.border,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '$yr',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                            color: isSel ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              )
            else
              // 3x4 Month Grid
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 2.1,
                ),
                itemCount: 12,
                itemBuilder: (context, i) {
                  final monthNum = i + 1;
                  final isSelected = monthNum == _selectedMonth;
                  final isCurrentMonth = now.year == _selectedYear && now.month == monthNum;

                  return InkWell(
                    onTap: () {
                      setState(() => _selectedMonth = monthNum);
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.darkGreen
                            : (isCurrentMonth
                                ? AppColors.primaryGreen.withValues(alpha: 0.12)
                                : AppColors.surface),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.darkGreen
                              : (isCurrentMonth ? AppColors.primaryGreen : AppColors.border),
                          width: isSelected || isCurrentMonth ? 1.5 : 1.0,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: AppColors.darkGreen.withValues(alpha: 0.2),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _months[i],
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : (isCurrentMonth ? AppColors.darkGreen : AppColors.textPrimary),
                            ),
                          ),
                          if (isCurrentMonth && !isSelected)
                            Container(
                              margin: const EdgeInsets.only(top: 2),
                              width: 4,
                              height: 4,
                              decoration: const BoxDecoration(
                                color: AppColors.primaryGreen,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            const SizedBox(height: 18),

            // Bottom action row: "Today" button and "Select" button
            Row(
              children: [
                TextButton.icon(
                  onPressed: _jumpToToday,
                  icon: const Icon(Icons.today, size: 16, color: AppColors.darkGreen),
                  label: const Text(
                    'Today',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.darkGreen,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.darkGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _confirmSelection,
                  child: Text(
                    'Select ${_months[_selectedMonth - 1]}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
