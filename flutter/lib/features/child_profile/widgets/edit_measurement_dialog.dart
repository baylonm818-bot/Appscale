import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/growth_standards/growth_classifier.dart';
import '../../../data/growth_standards/measurement_validator.dart';
import '../../../data/local/hive_boxes.dart';
import '../../../data/local/measurement_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/measurement.dart';
import '../../../shared/utils/app_user_identity.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_outlined_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/app_yes_no_toggle.dart';

class EditMeasurementDialog extends StatefulWidget {
  final Child child;
  final Measurement measurement;

  const EditMeasurementDialog({
    super.key,
    required this.child,
    required this.measurement,
  });

  static Future<bool?> show(
    BuildContext context, {
    required Child child,
    required Measurement measurement,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => EditMeasurementDialog(
        child: child,
        measurement: measurement,
      ),
    );
  }

  @override
  State<EditMeasurementDialog> createState() => _EditMeasurementDialogState();
}

class _EditMeasurementDialogState extends State<EditMeasurementDialog> {
  late final TextEditingController _weightController;
  late final TextEditingController _heightController;
  late final TextEditingController _muacController;
  late final TextEditingController _auditNoteController;

  late bool _edema;
  bool _isSaving = false;

  int get _assessmentAgeMonths => widget.child.ageInMonthsAt(widget.measurement.date);
  bool get _isMuacEligible => _assessmentAgeMonths >= 6;

  @override
  void initState() {
    super.initState();
    _weightController = TextEditingController(
      text: widget.measurement.weightKg > 0 ? widget.measurement.weightKg.toString() : '',
    );
    _heightController = TextEditingController(
      text: widget.measurement.heightCm > 0 ? widget.measurement.heightCm.toString() : '',
    );
    _muacController = TextEditingController(
      text: widget.measurement.muacCm != null ? widget.measurement.muacCm.toString() : '',
    );
    _auditNoteController = TextEditingController();
    _edema = widget.measurement.bilateralPittingEdema;
  }

  @override
  void dispose() {
    _weightController.dispose();
    _heightController.dispose();
    _muacController.dispose();
    _auditNoteController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final rawW = MeasurementValidator.parseDecimal(_weightController.text);
    final rawH = MeasurementValidator.parseDecimal(_heightController.text);
    final rawM = _isMuacEligible && _muacController.text.trim().isNotEmpty
        ? MeasurementValidator.parseDecimal(_muacController.text)
        : null;

    if (rawW == null || rawH == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter valid numeric weight and height.'),
          backgroundColor: AppColors.statRed,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    final isPlausible = MeasurementValidator.isPlausibleRecord(
      heightCm: rawH,
      weightKg: rawW,
      muacCm: rawM,
      ageMonths: _assessmentAgeMonths,
    );

    String weightStatus = 'Needs re-measurement';
    String heightStatus = 'Needs re-measurement';
    String wastingStatus = 'Needs re-measurement';
    double? bmiVal;
    String? bmiStatus;

    if (isPlausible) {
      weightStatus = GrowthClassifier.classifyWeightForAge(
        weightKg: rawW,
        ageMonths: _assessmentAgeMonths,
        gender: widget.child.gender,
      );
      heightStatus = GrowthClassifier.classifyHeightForAge(
        heightCm: rawH,
        ageMonths: _assessmentAgeMonths,
        gender: widget.child.gender,
      );
      wastingStatus = GrowthClassifier.classifyWeightForLength(
        weightKg: rawW,
        heightCm: rawH,
        gender: widget.child.gender,
      );

      final hMeters = rawH / 100;
      if (hMeters > 0) {
        bmiVal = double.parse((rawW / (hMeters * hMeters)).toStringAsFixed(2));
        if (bmiVal < 18.5) {
          bmiStatus = 'Underweight';
        } else if (bmiVal < 25.0) {
          bmiStatus = 'Normal';
        } else if (bmiVal < 30.0) {
          bmiStatus = 'Overweight';
        } else {
          bmiStatus = 'Obese';
        }
      }
    }

    final updated = Measurement(
      date: widget.measurement.date,
      weightKg: rawW,
      heightCm: rawH,
      muacCm: rawM,
      bilateralPittingEdema: _edema,
      weightForAgeStatus: weightStatus,
      heightForAgeStatus: heightStatus,
      weightForLengthStatus: wastingStatus,
      customBmi: bmiVal,
      customBmiStatus: bmiStatus,
    );

    final settings = SettingsRepository();
    final worker = AppUserIdentity.resolveDisplayName(settings.authUser);
    final auditUserText = 'Edited by $worker on ${DateTime.now().toLocal().toString().substring(0, 16)}';
    final customNote = _auditNoteController.text.trim();
    final finalAuditNote = customNote.isNotEmpty ? '$auditUserText: $customNote' : auditUserText;

    final syncRes = await MeasurementRepository().updateMeasurement(
      childId: widget.child.id,
      originalDate: widget.measurement.date,
      updatedMeasurement: updated,
      auditNote: finalAuditNote,
    );

    if (mounted) {
      setState(() => _isSaving = false);
      if (syncRes != null && !syncRes.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Saved locally. Server sync: ${syncRes.message}'),
            backgroundColor: AppColors.statOrange,
          ),
        );
      }
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Edit Measurement',
                    style: AppTextStyles.h2.copyWith(fontSize: 18),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(context, false),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      label: 'Weight (kg) *',
                      hint: 'e.g. 12.5',
                      icon: Icons.monitor_weight_outlined,
                      controller: _weightController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: AppTextField(
                      label: 'Height (cm) *',
                      hint: 'e.g. 85',
                      icon: Icons.straighten_outlined,
                      controller: _heightController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                ],
              ),
              if (_isMuacEligible) ...[
                const SizedBox(height: 12),
                AppTextField(
                  label: 'MUAC (cm) (Optional)',
                  hint: 'Optional (e.g. 14.5)',
                  icon: Icons.favorite_outline,
                  controller: _muacController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
              ],
              const SizedBox(height: 12),
              AppYesNoToggle(
                label: 'Bilateral pitting edema',
                value: _edema,
                onChanged: (v) => setState(() => _edema = v),
              ),
              const SizedBox(height: 12),
              AppTextField(
                label: 'Reason for Edit (Audit Note)',
                hint: 'e.g. Typo in scale recording',
                icon: Icons.notes_outlined,
                controller: _auditNoteController,
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: AppOutlinedButton(
                      label: 'Cancel',
                      onPressed: () => Navigator.pop(context, false),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppButton(
                      label: _isSaving ? 'Saving...' : 'Save Changes',
                      onPressed: _isSaving ? null : _handleSave,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
