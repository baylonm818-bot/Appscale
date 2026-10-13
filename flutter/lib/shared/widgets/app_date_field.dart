import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../utils/app_pickers.dart';
import '../utils/app_date_format.dart';

class AppDateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onChanged;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final bool isRequired;
  final bool hasError;
  final String? errorText;

  const AppDateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.firstDate,
    this.lastDate,
    this.isRequired = false,
    this.hasError = false,
    this.errorText,
  });

  Future<void> _pickDate(BuildContext context) async {
    final effectiveFirst = firstDate ?? DateTime(1950);
    final effectiveLast =
        lastDate ?? DateTime.now().add(const Duration(days: 365 * 5));
    final baseInitial = value ?? DateTime.now();
    final clampedInitial = baseInitial.isBefore(effectiveFirst)
        ? effectiveFirst
        : (baseInitial.isAfter(effectiveLast) ? effectiveLast : baseInitial);

    final picked = await showAppDatePicker(
      context: context,
      initialDate: clampedInitial,
      firstDate: effectiveFirst,
      lastDate: effectiveLast,
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    String cleanLabel = label;
    bool showAsterisk = isRequired;
    if (cleanLabel.endsWith(' *')) {
      cleanLabel = cleanLabel.substring(0, cleanLabel.length - 2);
      showAsterisk = true;
    } else if (cleanLabel.endsWith('*')) {
      cleanLabel = cleanLabel.substring(0, cleanLabel.length - 1).trimRight();
      showAsterisk = true;
    }

    final isInvalid = hasError || errorText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: cleanLabel,
            style: AppTextStyles.label,
            children: [
              if (showAsterisk)
                const TextSpan(
                  text: ' *',
                  style: TextStyle(
                    color: AppColors.requiredAsterisk,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: () => _pickDate(context),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isInvalid ? AppColors.requiredAsterisk : AppColors.border,
                width: isInvalid ? 1.4 : 1.0,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    value == null
                        ? 'Select date'
                        : AppDateFormat.format(value),
                    style: AppTextStyles.body.copyWith(
                      color: value == null
                          ? AppColors.textMuted
                          : AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(
                  Icons.calendar_today_outlined,
                  size: 16,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 6),
          Text(
            errorText!,
            style: const TextStyle(
              color: AppColors.requiredAsterisk,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
