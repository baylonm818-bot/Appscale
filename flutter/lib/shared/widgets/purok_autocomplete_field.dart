import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import 'app_text_field.dart';

class PurokAutocompleteField extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final GlobalKey? fieldKey;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final List<String> suggestions;

  const PurokAutocompleteField({
    super.key,
    required this.controller,
    this.focusNode,
    this.fieldKey,
    this.errorText,
    this.onChanged,
    this.suggestions = const [],
  });

  @override
  State<PurokAutocompleteField> createState() => _PurokAutocompleteFieldState();
}

class _PurokAutocompleteFieldState extends State<PurokAutocompleteField> {
  late final FocusNode _effectiveFocusNode = widget.focusNode ?? FocusNode();

  @override
  void dispose() {
    if (widget.focusNode == null) {
      _effectiveFocusNode.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<String>(
      textEditingController: widget.controller,
      focusNode: _effectiveFocusNode,
      optionsBuilder: (TextEditingValue textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) {
          return const Iterable<String>.empty();
        }
        return widget.suggestions.where(
          (s) => s.toLowerCase().contains(query),
        );
      },
      onSelected: (String selection) {
        widget.controller.text = selection;
        widget.controller.selection = TextSelection.collapsed(
          offset: selection.length,
        );
        widget.onChanged?.call(selection);
      },
      fieldViewBuilder: (
        BuildContext context,
        TextEditingController textEditingController,
        FocusNode focusNode,
        VoidCallback onFieldSubmitted,
      ) {
        return AppTextField(
          key: widget.fieldKey,
          label: 'Purok Address',
          hint: 'Enter purok (e.g. Purok 7, Purok Mabuhay)',
          icon: Icons.location_on_outlined,
          isRequired: true,
          maxLength: 50,
          controller: textEditingController,
          focusNode: focusNode,
          hasError: widget.errorText != null,
          errorText: widget.errorText,
          textCapitalization: TextCapitalization.words,
          onChanged: (val) {
            widget.onChanged?.call(val);
          },
          onFieldSubmitted: (_) => onFieldSubmitted(),
        );
      },
      optionsViewBuilder: (
        BuildContext context,
        AutocompleteOnSelected<String> onSelected,
        Iterable<String> options,
      ) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 6,
            borderRadius: BorderRadius.circular(12),
            color: Colors.white,
            shadowColor: Colors.black26,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: 200,
                maxWidth: MediaQuery.of(context).size.width - (AppSpacing.lg * 2),
              ),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 4),
                shrinkWrap: true,
                itemCount: options.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, color: AppColors.border),
                itemBuilder: (BuildContext context, int index) {
                  final option = options.elementAt(index);
                  return InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => onSelected(option),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 11,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.location_on_outlined,
                            size: 17,
                            color: AppColors.primaryGreen,
                          ),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              option,
                              style: AppTextStyles.body.copyWith(
                                fontSize: 13.5,
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}
