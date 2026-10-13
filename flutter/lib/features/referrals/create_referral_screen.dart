import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/notification_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/models/app_notification.dart';
import '../../data/models/referral.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../shared/widgets/app_dropdown_field.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/form_action_buttons.dart';
import '../../shared/widgets/form_section_card.dart';
import 'referral_constants.dart';
import '../../shared/utils/app_notifications.dart';
import '../../shared/utils/app_user_identity.dart';
import 'widgets/referral_beneficiary_field.dart';

class CreateReferralScreen extends StatefulWidget {
  final String? prefillBeneficiaryType;
  final String? prefillBeneficiaryId;
  final String? prefillBeneficiaryName;
  final String? prefillBeneficiarySubtitle;
  final String? prefillReason;

  const CreateReferralScreen({
    super.key,
    this.prefillBeneficiaryType,
    this.prefillBeneficiaryId,
    this.prefillBeneficiaryName,
    this.prefillBeneficiarySubtitle,
    this.prefillReason,
  });

  bool get isPrefilled => prefillBeneficiaryId != null;

  @override
  State<CreateReferralScreen> createState() => _CreateReferralScreenState();
}

class _CreateReferralScreenState extends State<CreateReferralScreen> {
  final _referralRepo = ReferralRepository();
  final _activityRepo = ActivityLogRepository();
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();
  final _settings = SettingsRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  late String _type = widget.prefillBeneficiaryType ?? 'child';
  late ReferralBeneficiaryResult? _selected = widget.isPrefilled
      ? ReferralBeneficiaryResult(
          id: widget.prefillBeneficiaryId!,
          name: AppUserIdentity.normalizeDisplayName(widget.prefillBeneficiaryName!),
          subtitle: widget.prefillBeneficiarySubtitle ?? '',
        )
      : null;
  String _facility = ReferralConstants.facilities.first;
  late String _selectedReason = _initialReason();
  bool _isSaving = false;

  List<String> get _reasonOptions => _type == 'mother'
      ? ReferralConstants.motherReasons
      : ReferralConstants.childReasons;

  String _initialReason() {
    final opts = _reasonOptions;
    if (widget.prefillReason != null && widget.prefillReason!.isNotEmpty) {
      if (opts.contains(widget.prefillReason)) {
        return widget.prefillReason!;
      }
      return opts.last; // 'Other clinical concern'
    }
    return opts.first;
  }

  @override
  void initState() {
    super.initState();
    if (widget.prefillReason != null) {
      _reasonController.text = widget.prefillReason!;
    }
  }

  bool get _isFormValid {
    if (_selected == null) return false;
    final reason = _selectedReason == _reasonOptions.last
        ? _reasonController.text.trim()
        : _selectedReason;
    return reason.isNotEmpty;
  }

  Future<void> _handleSubmit() async {
    if (_isSaving) return; // Prevent double submission
    if (!_isFormValid) {
      AppNotificationUI.showWarning(
        context,
        'Please select a beneficiary and describe the reason for referral.',
        title: 'Form Incomplete',
      );
      return;
    }

    setState(() => _isSaving = true);

    // Resolve clean beneficiary name with proper fallback
    final isMother = _type.toLowerCase() == 'mother';
    String resolvedName = (_selected?.name ?? '').trim();
    if (resolvedName.isEmpty ||
        RegExp(r'^\d+$').hasMatch(resolvedName) ||
        resolvedName.toLowerCase().startsWith('child #') ||
        resolvedName.toLowerCase().startsWith('mother #') ||
        resolvedName.toLowerCase() == 'beneficiary') {
      try {
        if (isMother && Hive.isBoxOpen(HiveBoxes.mothers)) {
          final m = Hive.box(HiveBoxes.mothers).get(_selected?.id);
          if (m is Map && (m['fullName'] ?? '').toString().trim().isNotEmpty) {
            resolvedName = m['fullName'].toString().trim();
          }
        } else if (!isMother && Hive.isBoxOpen(HiveBoxes.children)) {
          final c = Hive.box(HiveBoxes.children).get(_selected?.id);
          if (c is Map && (c['fullName'] ?? '').toString().trim().isNotEmpty) {
            resolvedName = c['fullName'].toString().trim();
          }
        }
      } catch (_) {}
    }
    if (resolvedName.isEmpty ||
        RegExp(r'^\d+$').hasMatch(resolvedName) ||
        resolvedName.toLowerCase().startsWith('child #') ||
        resolvedName.toLowerCase().startsWith('mother #') ||
        resolvedName.toLowerCase() == 'beneficiary') {
      resolvedName = isMother ? 'a mother' : 'a child';
    }

    final finalReason = _selectedReason == _reasonOptions.last
        ? _reasonController.text.trim()
        : _selectedReason;

    // Issue 8: Prevent duplicate referral when an open/pending one exists
    // for the same beneficiary and reason.
    final existingReferrals = _referralRepo.getAll();
    final hasDuplicate = existingReferrals.any((r) =>
        r.beneficiaryId == _selected!.id &&
        (r.isPending || r.isOngoing) &&
        r.reason.trim().toLowerCase() == finalReason.trim().toLowerCase());

    if (hasDuplicate) {
      setState(() => _isSaving = false);
      AppNotificationUI.showWarning(
        context,
        'An open referral already exists for $resolvedName with reason "$finalReason".',
        title: 'Duplicate Referral',
      );
      return;
    }

    final referral = Referral(
      id: ReferralRepository.generateId(),
      beneficiaryType: _type,
      beneficiaryId: _selected!.id,
      beneficiaryName: resolvedName,
      barangay: _currentBarangay,
      reason: finalReason,
      facility: _facility,
      notes: _notesController.text.trim(),
      status: 'Pending',
      createdAt: DateTime.now(),
    );

    await _referralRepo.add(referral);

    // Add local in-app notification so user sees it in the notifications list immediately
    await NotificationRepository().add(
      AppNotification(
        id: NotificationRepository.generateId(),
        title: 'Referral Sent',
        message: 'Referral sent for $resolvedName.',
        type: 'referral_sent',
        referralId: referral.id,
        timestamp: DateTime.now().toUtc(),
      ),
    );

    bool syncedOnline = false;
    String? conflictMessage;
    try {
      final res = await _referralRepo.syncToWeb(referral);
      if (res.success) {
        syncedOnline = true;
      } else if (res.statusCode == 409) {
        conflictMessage = res.message;
      }
    } catch (_) {
      // Offline / network failure handled gracefully below
    }

    await _activityRepo.logActivity(
      type: 'referral_created',
      title: 'Referral created for $resolvedName',
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (conflictMessage != null && conflictMessage.isNotEmpty) {
      AppNotificationUI.showWarning(
        context,
        conflictMessage,
      );
    } else if (syncedOnline) {
      AppNotificationUI.showSuccess(
        context,
        'Referral sent for $resolvedName.',
      );
    } else {
      AppNotificationUI.showSuccess(
        context,
        'Referral saved for $resolvedName. Will sync when online.',
      );
    }

    Navigator.pop(context, referral);
  }

  @override
  Widget build(BuildContext context) {
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
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back, color: Colors.white),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Referrals',
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
                    FormSectionCard(
                      title: 'Create Referral',
                      highlighted: true,
                      children: [
                        if (widget.isPrefilled)
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.info_outline,
                                  size: 14,
                                  color: AppColors.textMuted,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Referral for ${_selected!.name}, based on their recent record.',
                                    style: AppTextStyles.body.copyWith(
                                      fontSize: 11,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          ReferralBeneficiaryField(
                            barangay: _currentBarangay,
                            type: _type,
                            onTypeChanged: (t) => setState(() => _type = t),
                            selected: _selected,
                            onSelected: (r) => setState(() => _selected = r),
                          ),
                        AppDropdownField(
                          label: 'Referral Reason *',
                          value: _selectedReason,
                          options: _reasonOptions,
                          onChanged: (v) {
                            if (v != null) {
                              setState(() {
                                _selectedReason = v;
                                if (v != _reasonOptions.last) {
                                  _reasonController.clear();
                                }
                              });
                            }
                          },
                        ),
                        if (_selectedReason == _reasonOptions.last)
                          AppTextField(
                            label: 'Specify Reason Details *',
                            hint: 'Describe the specific medical concern...',
                            icon: Icons.notes_outlined,
                            controller: _reasonController,
                            maxLines: 2,
                          ),
                        AppDropdownField(
                          label: 'Assigned Facility *',
                          value: _facility,
                          options: ReferralConstants.facilities,
                          onChanged: (v) => setState(() => _facility = v!),
                        ),
                        AppTextField(
                          label: 'Notes (Optional)',
                          hint: 'Additional notes...',
                          icon: Icons.edit_note_outlined,
                          controller: _notesController,
                          maxLines: 2,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FormActionButtons(
                      saveLabel: 'Submit Referral',
                      onSave: _handleSubmit,
                      onCancel: () => Navigator.pop(context),
                      isSaving: _isSaving,
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

  @override
  void dispose() {
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }
}
