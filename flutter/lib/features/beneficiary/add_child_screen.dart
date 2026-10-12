import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/beneficiary_link_service.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/models/child.dart';
import '../../data/models/guardian.dart';
import '../../data/models/mother.dart';
import '../../shared/widgets/app_date_field.dart';
import '../../shared/widgets/app_dropdown_field.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/app_yes_no_toggle.dart';
import '../../shared/widgets/form_action_buttons.dart';
import '../../shared/widgets/form_section_card.dart';
import '../../data/local/hive_boxes.dart';
import '../../shared/utils/app_user_identity.dart';
import '../../shared/utils/app_notifications.dart';
import 'widgets/mother_picker_field.dart';

class AddChildScreen extends StatefulWidget {
  /// Pass an existing child to switch this screen into edit mode.
  final Child? existingChild;

  /// Used when this screen is opened as a shortcut from the mother form's
  /// "Register new child" action — pre-fills the guardian section only.
  final String prefillGuardianName;
  final String prefillGuardianContact;
  final String prefillAddress;

  const AddChildScreen({
    super.key,
    this.existingChild,
    this.prefillGuardianName = '',
    this.prefillGuardianContact = '',
    this.prefillAddress = '',
  });

  bool get isEditMode => existingChild != null;

  @override
  State<AddChildScreen> createState() => _AddChildScreenState();
}

class _AddChildScreenState extends State<AddChildScreen> {
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _activityRepo = ActivityLogRepository();
  final _linkService = BeneficiaryLinkService();
  final _settings = SettingsRepository();

  late final String _currentBarangay =
      AppUserIdentity.resolveBarangay(_settings.authUser).isNotEmpty
          ? AppUserIdentity.resolveBarangay(_settings.authUser)
          : 'Tiguion';
  late final String _currentBarangayCode = _currentBarangay.isNotEmpty
      ? _currentBarangay.substring(0, 3).toUpperCase()
      : 'TIG';

  late final _fullNameController = TextEditingController(
    text: widget.existingChild?.fullName ?? '',
  );
  late final _addressController = TextEditingController(
    text: widget.existingChild?.address ?? widget.prefillAddress,
  );
  late final _guardianNameController = TextEditingController(
    text: widget.existingChild?.guardian.fullName ?? widget.prefillGuardianName,
  );
  late final _guardianContactController = TextEditingController(
    text:
        widget.existingChild?.guardian.contactNo ??
        widget.prefillGuardianContact,
  );
  late final _disabilityController = TextEditingController(
    text: widget.existingChild?.disability == 'None specified'
        ? ''
        : widget.existingChild?.disability ?? '',
  );

  final _scrollController = ScrollController();
  final _fullNameFocusNode = FocusNode();

  DateTime? _birthDate;
  String _gender = 'Female';
  bool _belongsToIpGroup = false;
  String _relationship = 'Mother';
  bool _guardianIsMonitoredMother = false;
  Mother? _linkedMother;
  bool _isSaving = false;
  bool _keepMotherDetails = false;

  late String _sequenceNo =
      widget.existingChild?.sequenceNo ??
      _childRepo.generateSequenceNo(barangayCode: _currentBarangayCode);

  @override
  void initState() {
    super.initState();
    final existing = widget.existingChild;
    if (existing != null) {
      _birthDate = existing.birthDate;
      _gender = existing.gender;
      _belongsToIpGroup = existing.belongsToIpGroup;
      _relationship = existing.guardian.relationship;
      if (existing.guardian.linkedMotherId != null) {
        _linkedMother = _motherRepo.getById(existing.guardian.linkedMotherId!);
        _guardianIsMonitoredMother = _linkedMother != null;
      }
    }
  }

  bool get _isFormValid =>
      _fullNameController.text.trim().isNotEmpty &&
      _birthDate != null &&
      _addressController.text.trim().isNotEmpty &&
      _guardianNameController.text.trim().isNotEmpty;

  bool _hasUnsavedInput() {
    if (widget.isEditMode) {
      final existing = widget.existingChild!;
      return _fullNameController.text.trim() != existing.fullName ||
          _birthDate != existing.birthDate ||
          _gender != existing.gender ||
          _addressController.text.trim() != existing.address ||
          _belongsToIpGroup != existing.belongsToIpGroup ||
          _guardianNameController.text.trim() != existing.guardian.fullName ||
          _guardianContactController.text.trim() != existing.guardian.contactNo ||
          _relationship != existing.guardian.relationship;
    }

    if (_fullNameController.text.trim().isNotEmpty) return true;
    if (_birthDate != null) return true;
    if (_disabilityController.text.trim().isNotEmpty) return true;
    if (!_keepMotherDetails) {
      if (_addressController.text.trim().isNotEmpty &&
          _addressController.text.trim() != widget.prefillAddress) {
        return true;
      }
      if (_guardianNameController.text.trim().isNotEmpty &&
          _guardianNameController.text.trim() != widget.prefillGuardianName) {
        return true;
      }
      if (_guardianContactController.text.trim().isNotEmpty &&
          _guardianContactController.text.trim() != widget.prefillGuardianContact) {
        return true;
      }
    }
    return false;
  }

  Future<bool> _confirmLeave() async {
    if (!_hasUnsavedInput()) return true;
    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Discard Unsaved Changes?'),
        content: const Text(
          'You have unsaved information on this form. Are you sure you want to leave?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Editing', style: TextStyle(color: AppColors.textMuted)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB91C1C),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Discard & Leave'),
          ),
        ],
      ),
    );
    return shouldLeave ?? false;
  }

  Future<void> _handleLeave() async {
    final nav = Navigator.of(context);
    final canLeave = await _confirmLeave();
    if (canLeave && mounted) {
      nav.pop();
    }
  }

  Future<void> _handleSave() async {
    if (_isSaving) return;

    if (!_isFormValid) {
      AppNotificationUI.showWarning(
        context,
        'Please fill in all required fields marked with *',
        title: 'Required Information Missing',
      );
      return;
    }

    setState(() => _isSaving = true);

    final rawContact = _guardianContactController.text.trim();
    final sanitizedGuardianContact = AppUserIdentity.sanitizeMobileNumber(rawContact);
    if (rawContact.isNotEmpty && !AppUserIdentity.isValidPhilippineContactNumber(rawContact)) {
      AppNotificationUI.showWarning(
        context,
        'Please enter a valid 11-digit guardian mobile number starting with 09 (e.g. 09123456789).',
        title: 'Invalid Contact Number',
      );
      setState(() => _isSaving = false);
      return;
    }

    Mother? targetMother = _linkedMother;
    final isMotherGuardian = _relationship.trim().toLowerCase() == 'mother';

    if (isMotherGuardian) {
      if (_keepMotherDetails && _linkedMother != null) {
        targetMother = _linkedMother;
      } else {
        targetMother = await _linkService.resolveOrCreateMotherForChild(
          barangay: _currentBarangay,
          guardianName: _guardianNameController.text.trim(),
          guardianContact: sanitizedGuardianContact,
          address: _addressController.text.trim(),
          belongsToIpGroup: _belongsToIpGroup,
          excludeChildId: widget.existingChild?.id,
        );
      }
    } else if (!_guardianIsMonitoredMother) {
      targetMother = null;
    }

    final child = Child(
      id: widget.existingChild?.id ?? ChildRepository.generateId(),
      sequenceNo: _sequenceNo,
      fullName: _fullNameController.text.trim(),
      birthDate: _birthDate!,
      gender: _gender,
      address: _addressController.text.trim(),
      barangay: _currentBarangay,
      belongsToIpGroup: _belongsToIpGroup,
      disability: _disabilityController.text.trim().isEmpty
          ? 'None specified'
          : _disabilityController.text.trim(),
      guardian: Guardian(
        fullName: _guardianNameController.text.trim(),
        relationship: _relationship,
        contactNo: sanitizedGuardianContact,
        linkedMotherId: targetMother?.id,
      ),
      createdAt: widget.existingChild?.createdAt ?? DateTime.now(),
      nutritionStatus: widget.existingChild?.nutritionStatus ?? 'Not weighed',
      lastWeighedAt: widget.existingChild?.lastWeighedAt,
      isActive: widget.existingChild?.isActive ?? true,
      inactiveReason: widget.existingChild?.inactiveReason,
      stuntingStatus: widget.existingChild?.stuntingStatus ?? 'Not weighed',
      wastingStatus: widget.existingChild?.wastingStatus ?? 'Not weighed',
    );

    try {
      if (widget.isEditMode) {
        await _childRepo.update(child);
      } else {
        await _childRepo.add(child);
      }

      final oldMotherId = widget.existingChild?.guardian.linkedMotherId;
      if (targetMother != null) {
        if (oldMotherId != null && oldMotherId != targetMother.id) {
          final oldMother = _motherRepo.getById(oldMotherId);
          if (oldMother != null) {
            await _linkService.unlinkChildFromMother(
              child: child,
              mother: oldMother,
            );
          }
        }
        await _linkService.linkChildToMother(
          child: child,
          mother: targetMother,
        );
      } else if (oldMotherId != null) {
        final oldMother = _motherRepo.getById(oldMotherId);
        if (oldMother != null) {
          await _linkService.unlinkChildFromMother(
            child: child,
            mother: oldMother,
          );
        }
      }

      await _activityRepo.logActivity(
        type: 'child_added',
        title: widget.isEditMode
            ? 'Updated ${child.fullName}\'s profile'
            : 'Registered ${child.fullName}',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      AppNotificationUI.showError(
        context,
        'Failed to save child record: $e',
        title: 'Save Failed',
      );
      return;
    }

    // Check connectivity for appropriate message
    bool online = false;
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      online = connectivityResult.any((r) => r != ConnectivityResult.none);
    } catch (_) {
      online = false;
    }

    final message = widget.isEditMode
        ? 'Child profile updated successfully.'
        : (online
            ? 'Child added: ${child.fullName}'
            : 'Saved. Will sync when online.');

    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.primaryGreen,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );

    if (widget.isEditMode) {
      setState(() => _isSaving = false);
      Navigator.pop(context, child);
      return;
    }

    // Clean reset for next child
    _fullNameController.clear();
    _birthDate = null;
    _gender = 'Female';
    _disabilityController.clear();
    _sequenceNo = _childRepo.generateSequenceNo(barangayCode: _currentBarangayCode);

    if (!_keepMotherDetails) {
      _addressController.clear();
      _guardianNameController.clear();
      _guardianContactController.clear();
      _relationship = 'Mother';
      _belongsToIpGroup = false;
      _guardianIsMonitoredMother = false;
      _linkedMother = null;
    } else {
      _linkedMother = targetMother;
    }

    setState(() => _isSaving = false);

    // Scroll to top
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }

    // Focus first field
    _fullNameFocusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final nav = Navigator.of(context);
        final canLeave = await _confirmLeave();
        if (canLeave && mounted) {
          nav.pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              _ScreenHeader(
                title: widget.isEditMode
                    ? 'Edit Child Profile'
                    : 'Add Child Profile',
                onBack: _handleLeave,
                onDone: _handleLeave,
                showDone: !widget.isEditMode,
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FormSectionCard(
                        title: 'Personal Information',
                        highlighted: true,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 10,
                              horizontal: 12,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: RichText(
                              text: TextSpan(
                                style: AppTextStyles.body.copyWith(fontSize: 12),
                                children: [
                                  const TextSpan(text: 'Sequence no. '),
                                  TextSpan(
                                    text: _sequenceNo,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  TextSpan(
                                    text: widget.isEditMode
                                        ? ''
                                        : ' · auto-assigned',
                                  ),
                                ],
                              ),
                            ),
                          ),
                          AppTextField(
                            label: 'Full Name *',
                            hint: "Enter child's full name",
                            icon: Icons.badge_outlined,
                            controller: _fullNameController,
                            focusNode: _fullNameFocusNode,
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: AppDateField(
                                  label: 'Birth date *',
                                  value: _birthDate,
                                  firstDate: DateTime.now().subtract(const Duration(days: 365 * 6)),
                                  lastDate: DateTime.now(),
                                  onChanged: (d) =>
                                      setState(() => _birthDate = d),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: AppDropdownField(
                                  label: 'Gender *',
                                  value: _gender,
                                  options: const ['Female', 'Male'],
                                  onChanged: (v) => setState(() => _gender = v!),
                                ),
                              ),
                            ],
                          ),
                          AppTextField(
                            label: 'Address *',
                            hint: 'Purok, Tiguion',
                            icon: Icons.location_on_outlined,
                            controller: _addressController,
                          ),
                          AppYesNoToggle(
                            label: 'Belongs to IP group',
                            value: _belongsToIpGroup,
                            onChanged: (v) =>
                                setState(() => _belongsToIpGroup = v),
                          ),
                          AppTextField(
                            label: 'Disability, if any',
                            hint: 'None specified',
                            icon: Icons.accessibility_new_outlined,
                            controller: _disabilityController,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      FormSectionCard(
                        title: 'Guardian',
                        subtitle:
                            'Required for every child, even if not a monitored mother',
                        children: [
                          AppTextField(
                            label: 'Full Name *',
                            hint: "Enter guardian's name",
                            icon: Icons.person_outline,
                            controller: _guardianNameController,
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: AppDropdownField(
                                  label: 'Relationship',
                                  value: _relationship,
                                  options: const [
                                    'Mother',
                                    'Father',
                                    'Grandparent',
                                    'Other',
                                  ],
                                  onChanged: (v) =>
                                      setState(() => _relationship = v!),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: AppTextField(
                                  label: 'Contact no.',
                                  hint: '09XXXXXXXXX',
                                  icon: Icons.call_outlined,
                                  controller: _guardianContactController,
                                  isNumericOnly: true,
                                ),
                              ),
                            ],
                          ),
                          if (_relationship.trim().toLowerCase() == 'mother')
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.lightGreenBg,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppColors.primaryGreen.withValues(alpha: 0.35),
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.check_circle_outline,
                                    color: AppColors.primaryGreen,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Mother beneficiary record will be automatically linked.',
                                      style: AppTextStyles.body.copyWith(
                                        fontSize: 12,
                                        color: AppColors.darkGreen,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Link to monitored mother? (Optional)',
                                      style: AppTextStyles.body.copyWith(
                                        fontSize: 12,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  Switch(
                                    value: _guardianIsMonitoredMother,
                                    activeThumbColor: AppColors.primaryGreen,
                                    onChanged: (v) => setState(() {
                                      _guardianIsMonitoredMother = v;
                                      if (!v) _linkedMother = null;
                                    }),
                                  ),
                                ],
                              ),
                            ),
                            if (_guardianIsMonitoredMother)
                              MotherPickerField(
                                barangay: _currentBarangay,
                                selected: _linkedMother,
                                prefillFullName: _guardianNameController.text,
                                prefillContact: _guardianContactController.text,
                                prefillAddress: _addressController.text,
                                onSelected: (mother) => setState(() {
                                  _linkedMother = mother;
                                  if (mother != null) {
                                    _guardianNameController.text = mother.fullName;
                                    _guardianContactController.text =
                                        mother.contactNo;
                                  }
                                }),
                              ),
                          ],
                        ],
                      ),
                      if (!widget.isEditMode) ...[
                        const SizedBox(height: AppSpacing.md),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: CheckboxListTile(
                            value: _keepMotherDetails,
                            onChanged: (v) => setState(() => _keepMotherDetails = v ?? false),
                            title: const Text(
                              "Keep mother's details for the next child",
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            subtitle: const Text(
                              'Retains address, guardian name, contact and links sibling to the same mother',
                              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                            activeColor: AppColors.primaryGreen,
                            controlAffinity: ListTileControlAffinity.leading,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      FormActionButtons(
                        saveLabel: widget.isEditMode
                            ? 'Save Changes'
                            : 'Save Child Profile',
                        onSave: _handleSave,
                        onCancel: _handleLeave,
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
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _fullNameFocusNode.dispose();
    _fullNameController.dispose();
    _addressController.dispose();
    _guardianNameController.dispose();
    _guardianContactController.dispose();
    _disabilityController.dispose();
    super.dispose();
  }
}

class _ScreenHeader extends StatelessWidget {
  final String title;
  final VoidCallback onBack;
  final VoidCallback? onDone;
  final bool showDone;

  const _ScreenHeader({
    required this.title,
    required this.onBack,
    this.onDone,
    this.showDone = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.darkGreen,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: onBack,
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.arrow_back, color: Colors.white),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              title,
              style: AppTextStyles.h2.copyWith(color: Colors.white),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (showDone)
            TextButton(
              onPressed: onDone ?? onBack,
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              ),
              child: const Text(
                'Done',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
