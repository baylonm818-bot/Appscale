import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/remote/beneficiary_api.dart';
import 'app_button.dart';
import 'app_date_field.dart';
import 'app_dropdown_field.dart';
import 'app_text_field.dart';

class DeactivateResult {
  final String reason;
  final DateTime date;
  final String? targetBarangay;
  final bool alsoTransferLinked;

  const DeactivateResult({
    required this.reason,
    required this.date,
    this.targetBarangay,
    this.alsoTransferLinked = false,
  });

  bool get isTransfer => reason == 'Transferred';
}

/// Generic reason-required deactivation & transfer sheet, reused by both Child
/// and Mother profiles.
class DeactivateBeneficiarySheet extends StatefulWidget {
  final String beneficiaryName;
  final String currentBarangay;
  final bool isChild;
  final bool hasLinkedBeneficiary;
  final List<String> reasons;
  final Color accentColor;

  const DeactivateBeneficiarySheet({
    super.key,
    required this.beneficiaryName,
    required this.currentBarangay,
    required this.isChild,
    this.hasLinkedBeneficiary = false,
    required this.reasons,
    required this.accentColor,
  });

  static Future<DeactivateResult?> show(
    BuildContext context, {
    required String beneficiaryName,
    required String currentBarangay,
    bool isChild = true,
    bool hasLinkedBeneficiary = false,
    List<String>? reasons,
    Color accentColor = AppColors.primaryGreen,
  }) {
    final effectiveReasons = reasons ??
        (isChild
            ? const ['Transferred', 'Deceased', 'Graduated', 'Other']
            : const ['Transferred', 'Deceased', 'Other']);

    return showModalBottomSheet<DeactivateResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => DeactivateBeneficiarySheet(
        beneficiaryName: beneficiaryName,
        currentBarangay: currentBarangay,
        isChild: isChild,
        hasLinkedBeneficiary: hasLinkedBeneficiary,
        reasons: effectiveReasons,
        accentColor: accentColor,
      ),
    );
  }

  @override
  State<DeactivateBeneficiarySheet> createState() =>
      _DeactivateBeneficiarySheetState();
}

class _DeactivateBeneficiarySheetState
    extends State<DeactivateBeneficiarySheet> {
  final _otherController = TextEditingController();
  late String _reason;
  late DateTime _selectedDate;
  String? _targetBarangay;
  bool _alsoTransferLinked = false;
  List<String> _barangays = [];
  bool _loadingBarangays = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _reason = widget.reasons.first;
    _selectedDate = DateTime.now();
    _loadBarangays();
  }

  Future<void> _loadBarangays() async {
    setState(() => _loadingBarangays = true);
    try {
      final list = await BeneficiaryApi.fetchBarangays();
      final filtered = list
          .where((b) =>
              b.trim().toLowerCase() !=
              widget.currentBarangay.trim().toLowerCase())
          .toList();
      if (mounted) {
        setState(() {
          _barangays = filtered;
          if (_barangays.isNotEmpty) {
            _targetBarangay = _barangays.first;
          }
          _loadingBarangays = false;
        });
      }
    } catch (_) {
      final fallback = BeneficiaryApi.defaultBarangays
          .where((b) =>
              b.trim().toLowerCase() !=
              widget.currentBarangay.trim().toLowerCase())
          .toList();
      if (mounted) {
        setState(() {
          _barangays = fallback;
          if (_barangays.isNotEmpty) {
            _targetBarangay = _barangays.first;
          }
          _loadingBarangays = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  void _onConfirm() {
    setState(() => _errorMessage = null);

    if (_reason == 'Transferred') {
      if (_targetBarangay == null || _targetBarangay!.trim().isEmpty) {
        setState(() => _errorMessage = 'Pumili ng bagong barangay.');
        return;
      }
    } else if (_reason == 'Other') {
      if (_otherController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Mangyaring ilagay ang dahilan.');
        return;
      }
    }

    final finalReason = _reason == 'Other'
        ? _otherController.text.trim()
        : _reason;

    Navigator.pop(
      context,
      DeactivateResult(
        reason: finalReason,
        date: _selectedDate,
        targetBarangay: _reason == 'Transferred' ? _targetBarangay : null,
        alsoTransferLinked: _reason == 'Transferred' && _alsoTransferLinked,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.sm,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Text(
              _reason == 'Transferred'
                  ? 'Ilipat si ${widget.beneficiaryName}'
                  : 'I-deactivate si ${widget.beneficiaryName}',
              style: AppTextStyles.h2.copyWith(fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              _reason == 'Transferred'
                  ? 'Ililipat ang buong record sa bagong barangay.'
                  : 'Kailangan ang dahilan at petsa para sa opisyal na talaan.',
              style: AppTextStyles.body.copyWith(
                fontSize: 12,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            RadioGroup<String>(
              groupValue: _reason,
              onChanged: (v) {
                if (v != null) {
                  setState(() {
                    _reason = v;
                    _errorMessage = null;
                  });
                }
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: widget.reasons
                    .map(
                      (r) => RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        value: r,
                        title: Text(
                          r,
                          style: AppTextStyles.body.copyWith(
                            fontSize: 13,
                            fontWeight: _reason == r
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                        activeColor: widget.accentColor,
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppDateField(
              label: 'Petsa / Date (Required)',
              value: _selectedDate,
              onChanged: (d) => setState(() => _selectedDate = d),
              lastDate: DateTime.now(),
            ),
            if (_reason == 'Transferred') ...[
              const SizedBox(height: AppSpacing.md),
              if (_loadingBarangays)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(),
                )
              else if (_barangays.isEmpty)
                Text(
                  'Walang ibang barangay na magagamit.',
                  style: AppTextStyles.caption.copyWith(color: AppColors.statRed),
                )
              else
                AppDropdownField(
                  label: 'Lumipat sa anong barangay? (Required)',
                  value: _targetBarangay ?? _barangays.first,
                  options: _barangays,
                  onChanged: (v) {
                    if (v != null) setState(() => _targetBarangay = v);
                  },
                ),
              if (widget.hasLinkedBeneficiary) ...[
                const SizedBox(height: AppSpacing.sm),
                CheckboxListTile(
                  value: _alsoTransferLinked,
                  onChanged: (v) =>
                      setState(() => _alsoTransferLinked = v ?? false),
                  title: Text(
                    widget.isChild
                        ? 'Ilipat din ba ang ina?'
                        : 'Ilipat din ba ang mga anak?',
                    style: AppTextStyles.body.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    widget.isChild
                        ? 'Isasama ang nakalink na record ng ina sa paglipat.'
                        : 'Isasama ang lahat ng nakalink na anak sa paglipat.',
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  activeColor: widget.accentColor,
                ),
              ],
            ],
            if (_reason == 'Other') ...[
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: 'Mangyaring tukuyin ang dahilan (Required)',
                hint: 'Ilagay ang dahilan',
                icon: Icons.edit_note_outlined,
                controller: _otherController,
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _errorMessage!,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.statRed,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: _reason == 'Transferred' ? 'Ilipat' : 'Kumpirmahin',
              onPressed: _onConfirm,
            ),
          ],
        ),
      ),
    );
  }
}
