import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/growth_standards/growth_classifier.dart';
import '../../data/growth_standards/measurement_validator.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/notification_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/models/app_notification.dart';
import '../../data/models/child.dart';
import '../../data/models/measurement.dart';
import '../../shared/utils/app_pickers.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_outlined_button.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/app_yes_no_toggle.dart';
import '../../shared/widgets/form_section_card.dart';
import '../masterlist/utils/child_status_meta.dart';
import '../masterlist/widgets/status_badge.dart';
import '../referrals/create_referral_screen.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/urgent_referral_dialog.dart';

class AddMeasurementScreen extends StatefulWidget {
  final Child child;
  final bool showReferralPrompt;

  const AddMeasurementScreen({
    super.key,
    required this.child,
    this.showReferralPrompt = true,
  });

  @override
  State<AddMeasurementScreen> createState() => _AddMeasurementScreenState();
}

class _AddMeasurementScreenState extends State<AddMeasurementScreen> {
  final _measurementRepo = MeasurementRepository();
  final _childRepo = ChildRepository();
  final _activityRepo = ActivityLogRepository();

  final _scrollController = ScrollController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _muacController = TextEditingController();

  final _weightFocusNode = FocusNode();
  final _heightFocusNode = FocusNode();
  final _muacFocusNode = FocusNode();

  ValidationResult _weightValidation = const ValidationResult();
  ValidationResult _heightValidation = const ValidationResult();
  ValidationResult _muacValidation = const ValidationResult();
  String? _plausibilityError;

  DateTime _monthYear = DateTime.now();
  bool _edema = false;
  bool _isSaving = false;

  Measurement? get _previousEntry {
    final history = _measurementRepo.getForChild(widget.child.id);
    return history.isNotEmpty ? history.first : null;
  }

  int get _assessmentAgeMonths => widget.child.ageInMonthsAt(_monthYear);
  bool get _isMuacEligible => _assessmentAgeMonths >= 6;

  @override
  void initState() {
    super.initState();
    _weightFocusNode.addListener(() {
      if (!_weightFocusNode.hasFocus) {
        _validateWeight();
      }
    });
    _heightFocusNode.addListener(() {
      if (!_heightFocusNode.hasFocus) {
        _validateHeight();
      }
    });
    _muacFocusNode.addListener(() {
      if (!_muacFocusNode.hasFocus) {
        _validateMuac();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _weightController.dispose();
    _heightController.dispose();
    _muacController.dispose();
    _weightFocusNode.dispose();
    _heightFocusNode.dispose();
    _muacFocusNode.dispose();
    super.dispose();
  }

  void _applyWeightSuggestion(String val) {
    _weightController.text = val;
    _weightController.selection = TextSelection.fromPosition(
      TextPosition(offset: val.length),
    );
    _validateWeight();
  }

  void _applyHeightSuggestion(String val) {
    _heightController.text = val;
    _heightController.selection = TextSelection.fromPosition(
      TextPosition(offset: val.length),
    );
    _validateHeight();
  }

  void _validateWeight() {
    final raw = _weightController.text.trim();
    if (raw.isEmpty) {
      setState(() {
        _weightValidation = const ValidationResult();
      });
      return;
    }
    final w = MeasurementValidator.parseDecimal(raw);
    if (w == null) {
      setState(() {
        _weightValidation = const ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Please enter a valid numeric weight (e.g. 12.5 kg).',
        );
      });
      return;
    }
    final res = MeasurementValidator.checkWeight(w, _assessmentAgeMonths);
    setState(() {
      _weightValidation = res;
    });
  }

  void _validateHeight() {
    final raw = _heightController.text.trim();
    if (raw.isEmpty) {
      setState(() {
        _heightValidation = const ValidationResult();
      });
      return;
    }
    final h = MeasurementValidator.parseDecimal(raw);
    if (h == null) {
      setState(() {
        _heightValidation = const ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Please enter a valid numeric height (e.g. 85 cm).',
        );
      });
      return;
    }
    final res = MeasurementValidator.checkHeight(
      h,
      _assessmentAgeMonths,
      previousHeightCm: _previousEntry?.heightCm,
    );
    setState(() {
      _heightValidation = res;
    });
  }

  void _validateMuac() {
    if (!_isMuacEligible) return;
    final raw = _muacController.text.trim();
    if (raw.isEmpty) {
      setState(() => _muacValidation = const ValidationResult());
      return;
    }
    final m = MeasurementValidator.parseDecimal(raw);
    if (m == null) {
      setState(() {
        _muacValidation = const ValidationResult(
          severity: ValidationSeverity.error,
          message: 'Please enter a valid numeric MUAC (e.g. 14.5 cm).',
        );
      });
      return;
    }
    final res = MeasurementValidator.checkMuac(m, _assessmentAgeMonths);
    setState(() => _muacValidation = res);
  }

  // Computed live as the BNS types — this feeds the preview card.
  ({String weight, String height, String wasting, double bmi, String bmiStatus})?
      get _liveResult {
    final w = MeasurementValidator.parseDecimal(_weightController.text);
    final h = MeasurementValidator.parseDecimal(_heightController.text);
    if (w == null || h == null || h <= 0) return null;

    // Do not compute BMI or nutritional status from invalid values
    final wRes = MeasurementValidator.checkWeight(w, _assessmentAgeMonths);
    if (wRes.isError) return null;

    final hRes = MeasurementValidator.checkHeight(
      h,
      _assessmentAgeMonths,
      previousHeightCm: _previousEntry?.heightCm,
    );
    if (hRes.isError) return null;

    final rawMuac = _isMuacEligible ? _muacController.text.trim() : null;
    if (rawMuac != null && rawMuac.isNotEmpty) {
      final m = MeasurementValidator.parseDecimal(rawMuac);
      if (m != null) {
        final mRes = MeasurementValidator.checkMuac(m, _assessmentAgeMonths);
        if (mRes.isError) return null;
      }
    }

    final weightStatus = GrowthClassifier.classifyWeightForAge(
      weightKg: w,
      ageMonths: _assessmentAgeMonths,
      gender: widget.child.gender,
    );
    final heightStatus = GrowthClassifier.classifyHeightForAge(
      heightCm: h,
      ageMonths: _assessmentAgeMonths,
      gender: widget.child.gender,
    );
    final wastingStatus = GrowthClassifier.classifyWeightForLength(
      weightKg: w,
      heightCm: h,
      gender: widget.child.gender,
    );

    final hMeters = h / 100;
    final bmiVal = double.parse((w / (hMeters * hMeters)).toStringAsFixed(2));
    final effectiveWasting = _edema ? 'SAM' : wastingStatus;

    final isPlausible = MeasurementValidator.isPlausibleRecord(
      heightCm: h,
      weightKg: w,
      muacCm: rawMuac != null ? MeasurementValidator.parseDecimal(rawMuac) : null,
      ageMonths: _assessmentAgeMonths,
    );

    return (
      weight: isPlausible ? weightStatus : 'Needs re-measurement',
      height: isPlausible ? heightStatus : 'Needs re-measurement',
      wasting: isPlausible ? effectiveWasting : 'Needs re-measurement',
      bmi: bmiVal,
      bmiStatus: isPlausible ? effectiveWasting : 'Needs re-measurement',
    );
  }

  Future<void> _handleSave() async {
    // 1. Date Validation: Check measurement date is not before birth date or in future
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final measurementDay = DateTime(_monthYear.year, _monthYear.month, _monthYear.day);
    final childBirthDay = DateTime(
      widget.child.birthDate.year,
      widget.child.birthDate.month,
      widget.child.birthDate.day,
    );

    if (measurementDay.isAfter(today)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Measurement date cannot be in the future.'),
          backgroundColor: AppColors.statRed,
        ),
      );
      return;
    }

    if (measurementDay.isBefore(childBirthDay)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Measurement date cannot be before the child\'s birth date.'),
          backgroundColor: AppColors.statRed,
        ),
      );
      return;
    }

    final rawW = MeasurementValidator.parseDecimal(_weightController.text);
    final rawH = MeasurementValidator.parseDecimal(_heightController.text);
    // MUAC is completely optional: null if empty, never required
    final rawM = _isMuacEligible && _muacController.text.trim().isNotEmpty
        ? MeasurementValidator.parseDecimal(_muacController.text)
        : null;

    final weightRes = rawW == null
        ? const ValidationResult(
            severity: ValidationSeverity.error,
            message: 'Weight is required.',
          )
        : MeasurementValidator.checkWeight(rawW, _assessmentAgeMonths);

    final heightRes = rawH == null
        ? const ValidationResult(
            severity: ValidationSeverity.error,
            message: 'Height is required.',
          )
        : MeasurementValidator.checkHeight(
            rawH,
            _assessmentAgeMonths,
            previousHeightCm: _previousEntry?.heightCm,
          );

    // Apply MUAC check only if entered and child is 6-59 months
    final muacRes = (_isMuacEligible && rawM != null)
        ? MeasurementValidator.checkMuac(rawM, _assessmentAgeMonths)
        : const ValidationResult();

    setState(() {
      _weightValidation = weightRes;
      _heightValidation = heightRes;
      _muacValidation = muacRes;
      _plausibilityError = null;
    });

    if (rawW == null || rawH == null) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
      if (rawW == null) {
        _weightFocusNode.requestFocus();
      } else {
        _heightFocusNode.requestFocus();
      }
      return;
    }

    // Check if any field has hard error
    final hasHardErrors = weightRes.isError || heightRes.isError || muacRes.isError;
    bool forceFlagImplausible = false;

    if (hasHardErrors) {
      // Suggestion text or error explanation
      final errorLines = <String>[];
      if (weightRes.isError) errorLines.add('• ${weightRes.fullMessage}');
      if (heightRes.isError) errorLines.add('• ${heightRes.fullMessage}');
      if (muacRes.isError) errorLines.add('• ${muacRes.fullMessage}');

      final proceedAnyway = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.error_outline_rounded, color: AppColors.statRed),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Out-of-range Value Detected',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...errorLines.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(e, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                  )),
              const SizedBox(height: 8),
              const Text(
                'This value is outside expected physiological ranges. If you save anyway, it will be flagged as "Needs re-measurement" and will not produce a nutritional classification.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Edit'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.statRed),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save anyway'),
            ),
          ],
        ),
      );

      if (proceedAnyway != true) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
        return;
      }
      forceFlagImplausible = true;
    }

    if (!forceFlagImplausible) {
      final plausibilityErr = MeasurementValidator.validatePlausibility(
        weight: rawW,
        height: rawH,
        muac: rawM,
        ageMonths: _assessmentAgeMonths,
        previousHeightCm: _previousEntry?.heightCm,
      );
      if (plausibilityErr != null) {
        setState(() => _plausibilityError = plausibilityErr);
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
        return;
      }
    }

    final hasSoftWarnings =
        weightRes.isWarning || heightRes.isWarning || muacRes.isWarning;

    if (hasSoftWarnings && !forceFlagImplausible) {
      if (!mounted) return;
      final confirmedWarning = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.statOrange),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hindi karaniwan ang value na ito. Tama ba?',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (weightRes.isWarning) ...[
                Text(
                  '• ${weightRes.fullMessage}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
              ],
              if (heightRes.isWarning) ...[
                Text(
                  '• ${heightRes.fullMessage}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
              ],
              if (muacRes.isWarning) ...[
                Text(
                  '• ${muacRes.fullMessage}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
              ],
              const SizedBox(height: 8),
              const Text(
                'Maaaring totoo ito sa batang may severe acute malnutrition (SAM) o stunted. Sigurado ka bang tama ang naitalang sukat?',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Edit'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primaryGreen,
              ),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Yes, save'),
            ),
          ],
        ),
      );

      if (confirmedWarning != true) return;
    } else if (!forceFlagImplausible) {
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Review measurement before saving'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Weight: ${rawW.toStringAsFixed(1)} kg'),
              Text('Height: ${rawH.toStringAsFixed(1)} cm'),
              if (rawM != null) Text('MUAC: ${rawM.toStringAsFixed(1)} cm'),
              const SizedBox(height: 8),
              const Text('Auto-computed nutritional status:'),
              if (_liveResult != null) ...[
                Text(
                  'Computed BMI: ${_liveResult!.bmi} kg/m² (${_liveResult!.bmiStatus})',
                ),
                Text('Weight-for-age: ${_liveResult!.weight}'),
                Text('Height-for-age: ${_liveResult!.height}'),
                Text('Wasting: ${_liveResult!.wasting}'),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Edit'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save'),
            ),
          ],
        ),
      );

      if (confirmed != true) return;
    }

    setState(() => _isSaving = true);

    final w = rawW;
    final h = rawH;
    final muac = rawM;

    final weightStatus = GrowthClassifier.classifyWeightForAge(
      weightKg: w,
      ageMonths: _assessmentAgeMonths,
      gender: widget.child.gender,
    );
    final heightStatus = GrowthClassifier.classifyHeightForAge(
      heightCm: h,
      ageMonths: _assessmentAgeMonths,
      gender: widget.child.gender,
    );
    final wastingStatus = GrowthClassifier.classifyWeightForLength(
      weightKg: w,
      heightCm: h,
      gender: widget.child.gender,
    );

    final isPlausible = !forceFlagImplausible && MeasurementValidator.isPlausibleRecord(
      heightCm: h,
      weightKg: w,
      muacCm: muac,
      ageMonths: _assessmentAgeMonths,
    );

    final measurement = Measurement(
      date: _monthYear,
      weightKg: w,
      heightCm: h,
      muacCm: muac,
      bilateralPittingEdema: _edema,
      weightForAgeStatus: isPlausible ? weightStatus : 'Needs re-measurement',
      heightForAgeStatus: isPlausible ? heightStatus : 'Needs re-measurement',
      weightForLengthStatus: isPlausible ? wastingStatus : 'Needs re-measurement',
      customBmi: isPlausible ? _liveResult?.bmi : null,
      customBmiStatus: isPlausible ? _liveResult?.bmiStatus : 'Needs re-measurement',
    );

    await _measurementRepo.addMeasurement(widget.child.id, measurement);

    // Recompute child status based on latest VALID measurement
    await _childRepo.recomputeChildStatusFromMeasurements(widget.child.id);
    final updatedChild = _childRepo.getById(widget.child.id) ?? widget.child;

    await _activityRepo.logActivity(
      type: 'measurement_recorded',
      title: 'Recorded measurement for ${widget.child.fullName} (BMI: ${isPlausible ? measurement.bmi : "—"} - ${measurement.bmiStatus})',
    );

    // Module 3: Notify BNS if there are beneficiaries at high risk of nutritional concerns
    // NEVER create high-risk alerts or auto-referrals from invalid measurements
    final hasExistingReferral = ReferralRepository()
        .getForBeneficiary(widget.child.id)
        .any((r) =>
            r.status.toLowerCase() != 'rejected' &&
            r.status.toLowerCase() != 'cancelled');

    if (isPlausible &&
        (measurement.isSevere || measurement.bmiStatus == 'Obese') &&
        !hasExistingReferral) {
      final severeReason = _buildSevereReason(measurement);
      await NotificationRepository().add(
        AppNotification(
          id: NotificationRepository.generateId(),
          title: 'High Risk Alert: ${widget.child.fullName}',
          message:
              '${widget.child.fullName} is at high risk of nutritional concerns: $severeReason (Computed BMI: ${measurement.bmi} kg/m²). Referral to BHW recommended.',
          timestamp: DateTime.now().toUtc(),
          isRead: false,
          referralId: null,
          type: 'urgent',
        ),
      );
    }

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (isPlausible &&
        measurement.isSevere &&
        widget.showReferralPrompt &&
        !hasExistingReferral) {
      await _showReferralPrompt(measurement, updatedChild);
      return;
    }

    Navigator.pop(context, updatedChild);
  }

  Future<void> _showReferralPrompt(
    Measurement measurement,
    Child updatedChild,
  ) async {
    final reason = _buildSevereReason(measurement);
    await UrgentReferralDialog.show(
      context,
      beneficiaryName: widget.child.fullName,
      reason: reason,
      onCreateReferral: () async {
        await Navigator.push(
          context,
          appPageRoute(
            CreateReferralScreen(
              prefillBeneficiaryType: 'child',
              prefillBeneficiaryId: widget.child.id,
              prefillBeneficiaryName: widget.child.fullName,
              prefillBeneficiarySubtitle:
                  '${widget.child.ageLabel} · ${widget.child.formattedAddress}',
              prefillReason: reason,
            ),
          ),
        );
        if (mounted) Navigator.pop(context, updatedChild);
      },
      onLater: () {
        if (mounted) Navigator.pop(context, updatedChild);
      },
    );
  }

  String _buildSevereReason(Measurement m) {
    final reasons = <String>[];
    if (m.weightForAgeStatus == 'Severely Underweight') {
      reasons.add('Severely Underweight');
    }
    if (m.heightForAgeStatus == 'Severely Stunted') {
      reasons.add('Severely Stunted');
    }
    if (m.bilateralPittingEdema) reasons.add('Bilateral Pitting Edema');
    if (m.weightForLengthStatus == 'SAM' && !m.bilateralPittingEdema) {
      reasons.add('SAM (weight-for-length)');
    }
    return reasons.join(', ');
  }

  @override
  Widget build(BuildContext context) {
    final result = _liveResult;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              color: AppColors.darkGreen,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Row(
                children: [
                  InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => Navigator.pop(context),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.arrow_back, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Measurement',
                    style: AppTextStyles.h2.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: AppColors.lightGreenBg,
                            child: Text(
                              widget.child.initials,
                              style: const TextStyle(
                                color: AppColors.darkGreen,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.child.fullName,
                                style: AppTextStyles.label.copyWith(
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                '${widget.child.ageLabel} · ${widget.child.formattedAddress}',
                                style: AppTextStyles.body.copyWith(
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    FormSectionCard(
                      title: 'Measurement',
                      highlighted: true,
                      children: [
                        _MonthYearField(
                          value: _monthYear,
                          onChanged: (d) => setState(() => _monthYear = d),
                        ),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: AppTextField(
                                label: 'Weight (kg) *',
                                hint: 'e.g. 12.5',
                                icon: Icons.monitor_weight_outlined,
                                controller: _weightController,
                                focusNode: _weightFocusNode,
                                hasError: _weightValidation.isError,
                                hasWarning: _weightValidation.isWarning,
                                onChanged: (_) {
                                  if (_weightValidation.hasMessage) {
                                    setState(() {
                                      _weightValidation = const ValidationResult();
                                    });
                                  } else {
                                    setState(() {});
                                  }
                                },
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: AppTextField(
                                label: 'Height (cm) *',
                                hint: 'e.g. 85',
                                icon: Icons.straighten_outlined,
                                controller: _heightController,
                                focusNode: _heightFocusNode,
                                hasError: _heightValidation.isError,
                                hasWarning: _heightValidation.isWarning,
                                onChanged: (_) {
                                  if (_heightValidation.hasMessage) {
                                    setState(() {
                                      _heightValidation = const ValidationResult();
                                    });
                                  } else {
                                    setState(() {});
                                  }
                                },
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (_weightValidation.hasMessage)
                          _MeasurementAlertBanner(
                            result: _weightValidation,
                            onApplySuggestion: _weightValidation.suggestionValue != null
                                ? () => _applyWeightSuggestion(_weightValidation.suggestionValue!)
                                : null,
                          ),
                        if (_heightValidation.hasMessage)
                          _MeasurementAlertBanner(
                            result: _heightValidation,
                            onApplySuggestion: _heightValidation.suggestionValue != null
                                ? () => _applyHeightSuggestion(_heightValidation.suggestionValue!)
                                : null,
                          ),
                        if (_plausibilityError != null)
                          _MeasurementAlertBanner(
                            result: ValidationResult(
                              severity: ValidationSeverity.error,
                              message: _plausibilityError,
                            ),
                          ),
                        if (_isMuacEligible) ...[
                          AppTextField(
                            label: 'MUAC (cm) (Optional)',
                            hint: 'Mid-upper arm circumference (optional)',
                            icon: Icons.favorite_outline,
                            controller: _muacController,
                            focusNode: _muacFocusNode,
                            hasError: _muacValidation.isError,
                            hasWarning: _muacValidation.isWarning,
                            onChanged: (_) {
                              if (_muacValidation.hasMessage) {
                                setState(() {
                                  _muacValidation = const ValidationResult();
                                });
                              } else {
                                setState(() {});
                              }
                            },
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                            ],
                          ),
                          if (_muacValidation.hasMessage)
                            _MeasurementAlertBanner(
                              result: _muacValidation,
                            ),
                          Text(
                            'Supporting measurement, used for wasting screening ages 6–59 months',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ] else
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'MUAC screening isn\'t applicable under 6 months — not required for this child.',
                              style: AppTextStyles.body.copyWith(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ),
                        AppYesNoToggle(
                          label: 'Bilateral pitting edema',
                          value: _edema,
                          onChanged: (v) => setState(() => _edema = v),
                        ),
                      ],
                    ),
                    if (result != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFAEEDA),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFEF9F27)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(
                                  Icons.favorite,
                                  size: 15,
                                  color: Color(0xFF633806),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Auto-computed Nutritional Status',
                                  style: TextStyle(
                                    color: const Color(0xFF633806),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                StatusBadge(
                                  label: 'BMI: ${result.bmi}',
                                  color: ChildStatusMeta.colorFor(result.wasting),
                                ),
                                StatusBadge(
                                  label: 'WFA: ${result.weight}',
                                  color: ChildStatusMeta.colorFor(
                                    result.weight,
                                  ),
                                ),
                                StatusBadge(
                                  label: 'HFA: ${result.height}',
                                  color: ChildStatusMeta.colorFor(
                                    result.height,
                                  ),
                                ),
                                StatusBadge(
                                  label: 'WFH: ${result.wasting}',
                                  color: ChildStatusMeta.colorFor(
                                    result.wasting,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (_previousEntry != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Previous Entry',
                        style: AppTextStyles.h2.copyWith(fontSize: 15),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          _PreviousStat(
                            label: 'Weight',
                            value: '${_previousEntry!.weightKg} kg',
                          ),
                          _PreviousStat(
                            label: 'Height',
                            value: '${_previousEntry!.heightCm} cm',
                          ),
                          _PreviousStat(
                            label: 'MUAC',
                            value: (_previousEntry!.muacCm == null ||
                                    _previousEntry!.muacCm == 0.0 ||
                                    widget.child.ageInMonths < 6)
                                ? 'N/A'
                                : '${_previousEntry!.muacCm} cm',
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Last recorded: ${_formatMonthYear(_previousEntry!.date)}',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    AppButton(
                      label: 'Save Measurement',
                      onPressed: _handleSave,
                      isLoading: _isSaving,
                    ),
                    const SizedBox(height: 10),
                    AppOutlinedButton(
                      label: 'Cancel',
                      onPressed: _isSaving
                          ? null
                          : () => Navigator.pop(context),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static const _monthAbbr = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  String _formatMonthYear(DateTime d) =>
      '${_monthAbbr[d.month - 1]} ${d.year}';
}

class _MonthYearField extends StatelessWidget {
  final DateTime value;
  final ValueChanged<DateTime> onChanged;
  const _MonthYearField({required this.value, required this.onChanged});

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Month / Year *', style: AppTextStyles.label),
        const SizedBox(height: 6),
        InkWell(
          onTap: () async {
            final picked = await showAppDatePicker(
              context: context,
              initialDate: value,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
            );
            if (picked != null) onChanged(DateTime(picked.year, picked.month));
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_months[value.month - 1]} ${value.year}',
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
                const Icon(
                  Icons.calendar_today_outlined,
                  size: 16,
                  color: AppColors.textMuted,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PreviousStat extends StatelessWidget {
  final String label;
  final String value;
  const _PreviousStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: AppTextStyles.body.copyWith(
                fontSize: 11,
                color: AppColors.textMuted,
              ),
            ),
            Text(value, style: AppTextStyles.label.copyWith(fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _MeasurementAlertBanner extends StatelessWidget {
  final ValidationResult result;
  final VoidCallback? onApplySuggestion;

  const _MeasurementAlertBanner({
    required this.result,
    this.onApplySuggestion,
  });

  @override
  Widget build(BuildContext context) {
    if (result.isValid || result.message == null) return const SizedBox.shrink();

    final isError = result.isError;
    final bgColor = isError ? const Color(0xFFFFEBEE) : const Color(0xFFFFF3E0);
    final borderColor = isError ? AppColors.statRed : AppColors.statOrange;
    final textColor = isError ? AppColors.statRed : const Color(0xFFB25E00);
    final iconData = isError ? Icons.error_outline : Icons.warning_amber_rounded;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(iconData, size: 18, color: textColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  result.fullMessage ?? result.message ?? '',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                ),
              ),
            ],
          ),
          if (result.suggestionValue != null && onApplySuggestion != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: InkWell(
                onTap: onApplySuggestion,
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: borderColor.withValues(alpha: 0.6)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check, size: 14, color: textColor),
                      const SizedBox(width: 4),
                      Text(
                        'Gamitin ang ${result.suggestionValue}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: textColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

