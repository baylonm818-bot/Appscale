import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

class AppDropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;
  final bool isRequired;
  final String? hint;
  final bool hasError;
  final String? errorText;

  const AppDropdownField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.isRequired = false,
    this.hint,
    this.hasError = false,
    this.errorText,
  });

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
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isInvalid ? AppColors.requiredAsterisk : AppColors.border,
              width: isInvalid ? 1.4 : 1.0,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: options.contains(value) ? value : null,
              hint: hint != null
                  ? Text(
                      hint!,
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 13,
                      ),
                    )
                  : null,
              isExpanded: true,
              icon: const Icon(
                Icons.keyboard_arrow_down,
                color: AppColors.textMuted,
              ),
              items: options
                  .map(
                    (o) => DropdownMenuItem(
                      value: o,
                      child: Text(
                        o,
                        style: AppTextStyles.body.copyWith(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: onChanged,
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
