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

  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _muacController = TextEditingController();

  String? _weightError;
  String? _heightError;
  String? _muacError;

  DateTime _monthYear = DateTime.now();
  bool _edema = false;
  bool _isSaving = false;

  Measurement? get _previousEntry {
    final history = _measurementRepo.getForChild(widget.child.id);
    return history.isNotEmpty ? history.first : null;
  }

  bool get _isMuacEligible => widget.child.ageInMonths >= 6;

  void _validateInputsLive() {
    final w = MeasurementValidator.parseDecimal(_weightController.text);
    final h = MeasurementValidator.parseDecimal(_heightController.text);
    final m = _isMuacEligible
        ? MeasurementValidator.parseDecimal(_muacController.text)
        : null;

    setState(() {
      _weightError = w != null
          ? MeasurementValidator.validateWeight(w, widget.child.ageInMonths)
          : null;
      _heightError = h != null
          ? MeasurementValidator.validateHeight(
              h,
              widget.child.ageInMonths,
              previousHeightCm: _previousEntry?.heightCm,
            )
          : null;
      _muacError = (m != null && _isMuacEligible)
          ? MeasurementValidator.validateMuac(m, widget.child.ageInMonths)
          : null;
    });
  }

  // Computed live as the BNS types — this feeds the preview card.
  ({String weight, String height, String wasting, double bmi, String bmiStatus})?
      get _liveResult {
    final w = MeasurementValidator.parseDecimal(_weightController.text);
    final h = MeasurementValidator.parseDecimal(_heightController.text);
    if (w == null || h == null || h <= 0) return null;

    final weightStatus = GrowthClassifier.classifyWeightForAge(
      weightKg: w,
      ageMonths: widget.child.ageInMonths,
      gender: widget.child.gender,
    );
    final heightStatus = GrowthClassifier.classifyHeightForAge(
      heightCm: h,
      ageMonths: widget.child.ageInMonths,
      gender: widget.child.gender,
    );
    final wastingStatus = GrowthClassifier.classifyWeightForLength(
      weightKg: w,
      heightCm: h,
      gender: widget.child.gender,
    );

    final hMeters = h / 100;
    final bmiVal = double.parse((w / (hMeters * hMeters)).toStringAsFixed(2));
    String bmiStatus = 'Normal';
    if (bmiVal < 18.5) {
      bmiStatus = 'Underweight';
    } else if (bmiVal < 25.0) {
      bmiStatus = 'Normal';
    } else if (bmiVal < 30.0) {
      bmiStatus = 'Overweight';
    } else {
      bmiStatus = 'Obese';
    }

    return (
      weight: weightStatus,
      height: heightStatus,
      wasting: _edema ? 'SAM' : wastingStatus,
      bmi: bmiVal,
      bmiStatus: bmiStatus,
    );
  }

  Future<void> _handleSave() async {
    final rawW = MeasurementValidator.parseDecimal(_weightController.text);
    final rawH = MeasurementValidator.parseDecimal(_heightController.text);
    final rawM = _isMuacEligible
        ? MeasurementValidator.parseDecimal(_muacController.text)
        : null;

    setState(() {
      _weightError = rawW == null
          ? 'Enter weight'
          : MeasurementValidator.validateWeight(rawW, widget.child.ageInMonths);
      _heightError = rawH == null
          ? 'Enter height'
          : MeasurementValidator.validateHeight(
              rawH,
              widget.child.ageInMonths,
              previousHeightCm: _previousEntry?.heightCm,
            );
      _muacError = _isMuacEligible
          ? (rawM == null
              ? 'Enter MUAC'
              : MeasurementValidator.validateMuac(rawM, widget.child.ageInMonths))
          : null;
    });

    if (rawW == null ||
        rawH == null ||
        (_isMuacEligible && rawM == null) ||
        _weightError != null ||
        _heightError != null ||
        _muacError != null) {
      return;
    }

    final plausibilityError = MeasurementValidator.validatePlausibility(
      weight: rawW,
      height: rawH,
      muac: rawM,
      ageMonths: widget.child.ageInMonths,
      previousHeightCm: _previousEntry?.heightCm,
    );
    if (plausibilityError != null) {
      setState(() {
        if (_heightError == null && _weightError == null) {
          _heightError = plausibilityError;
        }
      });
      return;
    }

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
              Text('Computed BMI: ${_liveResult!.bmi} kg/m² (${_liveResult!.bmiStatus})'),
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

    setState(() => _isSaving = true);

    final w = rawW;
    final h = rawH;
    final muac = rawM;

    final weightStatus = GrowthClassifier.classifyWeightForAge(
      weightKg: w,
      ageMonths: widget.child.ageInMonths,
      gender: widget.child.gender,
    );
    final heightStatus = GrowthClassifier.classifyHeightForAge(
      heightCm: h,
      ageMonths: widget.child.ageInMonths,
      gender: widget.child.gender,
    );
    final wastingStatus = GrowthClassifier.classifyWeightForLength(
      weightKg: w,
      heightCm: h,
      gender: widget.child.gender,
    );

    final measurement = Measurement(
      date: _monthYear,
      weightKg: w,
      heightCm: h,
      muacCm: muac,
      bilateralPittingEdema: _edema,
      weightForAgeStatus: weightStatus,
      heightForAgeStatus: heightStatus,
      weightForLengthStatus: wastingStatus,
      customBmi: _liveResult?.bmi,
      customBmiStatus: _liveResult?.bmiStatus,
    );

    await _measurementRepo.addMeasurement(widget.child.id, measurement);

    final updatedChild = widget.child.copyWith(
      nutritionStatus: weightStatus,
      stuntingStatus: heightStatus,
      wastingStatus: measurement.effectiveWastingStatus,
      lastWeighedAt: measurement.date,
    );

    await _childRepo.update(updatedChild);

    await _activityRepo.logActivity(
      type: 'measurement_recorded',
      title: 'Recorded measurement for ${widget.child.fullName} (BMI: ${measurement.bmi} - ${measurement.bmiStatus})',
    );

    // Module 3: Notify BNS if there are beneficiaries at high risk of nutritional concerns
    final hasExistingReferral = ReferralRepository()
        .getForBeneficiary(widget.child.id)
        .any((r) =>
            r.status.toLowerCase() != 'rejected' &&
            r.status.toLowerCase() != 'cancelled');

    if ((measurement.isSevere || measurement.bmiStatus == 'Obese') &&
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
          referralId: widget.child.id,
          type: 'urgent',
        ),
      );
    }

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (measurement.isSevere &&
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
                                errorText: _weightError,
                                onChanged: (_) => _validateInputsLive(),
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
                                errorText: _heightError,
                                onChanged: (_) => _validateInputsLive(),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (_isMuacEligible) ...[
                          AppTextField(
                            label: 'MUAC (cm) *',
                            hint: 'Mid-upper arm circumference',
                            icon: Icons.favorite_outline,
                            controller: _muacController,
                            errorText: _muacError,
                            onChanged: (_) => _validateInputsLive(),
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                            ],
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
                                  label: 'BMI: ${result.bmi} (${result.bmiStatus})',
                                  color: result.bmiStatus == 'Normal'
                                      ? AppColors.primaryGreen
                                      : result.bmiStatus == 'Underweight'
                                          ? AppColors.statOrange
                                          : AppColors.statRed,
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

  @override
  void dispose() {
    _weightController.dispose();
    _heightController.dispose();
    _muacController.dispose();
    super.dispose();
  }
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
