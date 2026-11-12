import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

class AppTextField extends StatefulWidget {
  final String label;
  final String hint;
  final IconData icon;
  final bool isPassword;
  final bool isNumericOnly;
  final TextEditingController? controller;
  final int maxLines;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final FocusNode? focusNode;
  final bool hasError;
  final bool hasWarning;
  final bool isRequired;
  final int? maxLength;
  final String? errorText;
  final String? warningText;
  final String? suffixText;
  final Widget? inlineExtra;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;

  const AppTextField({
    super.key,
    required this.label,
    required this.hint,
    required this.icon,
    this.isPassword = false,
    this.isNumericOnly = false,
    this.isRequired = false,
    this.maxLength,
    this.controller,
    this.focusNode,
    this.hasError = false,
    this.hasWarning = false,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
    this.errorText,
    this.warningText,
    this.suffixText,
    this.inlineExtra,
    this.textInputAction,
    this.autofillHints,
    this.onChanged,
    this.onFieldSubmitted,
  });

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _obscure = widget.isPassword;
  }

  @override
  Widget build(BuildContext context) {
    String cleanLabel = widget.label;
    bool showAsterisk = widget.isRequired;
    if (cleanLabel.endsWith(' *')) {
      cleanLabel = cleanLabel.substring(0, cleanLabel.length - 2);
      showAsterisk = true;
    } else if (cleanLabel.endsWith('*')) {
      cleanLabel = cleanLabel.substring(0, cleanLabel.length - 1).trimRight();
      showAsterisk = true;
    }

    final resolvedKeyboardType = widget.keyboardType ??
        (widget.isNumericOnly ? TextInputType.number : null);
    final resolvedFormatters = <TextInputFormatter>[
      ...?widget.inputFormatters,
      if (widget.isNumericOnly) FilteringTextInputFormatter.digitsOnly,
      if (widget.maxLength != null)
        LengthLimitingTextInputFormatter(widget.maxLength),
    ];

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
        TextField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          obscureText: _obscure,
          keyboardType: resolvedKeyboardType,
          maxLength: widget.maxLength,
          buildCounter: widget.maxLength != null
              ? (context, {required currentLength, required isFocused, maxLength}) => null
              : null,
          inputFormatters: resolvedFormatters,
          textInputAction: widget.textInputAction,
          autofillHints: widget.autofillHints,
          onChanged: widget.onChanged,
          onSubmitted: widget.onFieldSubmitted,
          style: AppTextStyles.body.copyWith(color: AppColors.textPrimary),
          maxLines: widget.isPassword ? 1 : widget.maxLines,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: AppTextStyles.body.copyWith(color: AppColors.textMuted),
            prefixIcon: Icon(widget.icon, color: AppColors.textMuted, size: 20),
            suffixIcon: widget.isPassword
                ? IconButton(
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  )
                : (widget.suffixText != null
                    ? Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Center(
                          widthFactor: 1.0,
                          child: Text(
                            widget.suffixText!,
                            style: AppTextStyles.body.copyWith(
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                    : null),
            filled: true,
            fillColor: AppColors.surface,
            contentPadding: const EdgeInsets.symmetric(
              vertical: 14,
              horizontal: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: (widget.hasError || widget.errorText != null)
                    ? AppColors.requiredAsterisk
                    : (widget.hasWarning || widget.warningText != null)
                        ? AppColors.statOrange
                        : AppColors.border,
                width: (widget.hasError || widget.errorText != null || widget.hasWarning || widget.warningText != null) ? 1.4 : 1.0,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(
                color: (widget.hasError || widget.errorText != null)
                    ? AppColors.requiredAsterisk
                    : (widget.hasWarning || widget.warningText != null)
                        ? AppColors.statOrange
                        : AppColors.borderFocused,
                width: 1.4,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.requiredAsterisk, width: 1.2),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.requiredAsterisk, width: 1.4),
            ),
          ),
        ),
        if (widget.errorText != null || widget.warningText != null) ...[
          const SizedBox(height: 5),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(
                  widget.errorText != null
                      ? Icons.error_outline
                      : Icons.warning_amber_rounded,
                  size: 14,
                  color: widget.errorText != null
                      ? AppColors.statRed
                      : AppColors.statOrange,
                ),
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  widget.errorText ?? widget.warningText!,
                  style: TextStyle(
                    color: widget.errorText != null
                        ? AppColors.statRed
                        : const Color(0xFFB25E00),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    height: 1.25,
                  ),
                ),
              ),
            ],
          ),
        ],
        if (widget.inlineExtra != null) ...[
          const SizedBox(height: 4),
          widget.inlineExtra!,
        ],
      ],
    );
  }
}
