import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/activity_log_repository.dart';
import '../../data/local/beneficiary_link_service.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/models/child.dart';
import '../../data/models/mother.dart';
import '../../shared/widgets/app_date_field.dart';
import '../../shared/widgets/app_dropdown_field.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/app_yes_no_toggle.dart';
import '../../shared/widgets/form_action_buttons.dart';
import '../../shared/widgets/form_section_card.dart';
import 'widgets/child_picker_field.dart';
import '../../data/local/mother_visit_repository.dart';
import '../../shared/utils/app_user_identity.dart';
import '../../shared/utils/app_notifications.dart';

class AddMotherScreen extends StatefulWidget {
  final Mother? existingMother;

  /// Used when opened as a shortcut from the child form's
  /// "Create mother profile" action — pre-fills Personal Information only.
  final String prefillFullName;
  final String prefillContact;
  final String prefillAddress;

  const AddMotherScreen({
    super.key,
    this.existingMother,
    this.prefillFullName = '',
    this.prefillContact = '',
    this.prefillAddress = '',
  });

  bool get isEditMode => existingMother != null;

  @override
  State<AddMotherScreen> createState() => _AddMotherScreenState();
}

class _AddMotherScreenState extends State<AddMotherScreen> {
  final _motherRepo = MotherRepository();
  final _childRepo = ChildRepository();
  final _activityRepo = ActivityLogRepository();
  final _linkService = BeneficiaryLinkService();
  final _settings = SettingsRepository();

  String get _currentBarangay =>
      AppUserIdentity.resolveBarangay(_settings.authUser).isNotEmpty
          ? AppUserIdentity.resolveBarangay(_settings.authUser)
          : 'Tiguion';

  late final _fullNameController = TextEditingController(
    text: widget.existingMother?.fullName ?? widget.prefillFullName,
  );
  late final _contactController = TextEditingController(
    text: widget.existingMother?.contactNo ?? widget.prefillContact,
  );
  late final _addressController = TextEditingController(
    text: widget.existingMother?.address ?? widget.prefillAddress,
  );
  late final _disabilityController = TextEditingController(
    text: widget.existingMother?.disability == 'None specified'
        ? ''
        : widget.existingMother?.disability ?? '',
  );

  final _scrollController = ScrollController();
  final _fullNameFocusNode = FocusNode();

  DateTime? _birthDate;
  String _breastfeedingPractice = 'Exclusive breastfeeding';
  bool _belongsToIpGroup = false;
  List<Child> _linkedChildren = [];
  bool _isSaving = false;
  bool get _hasLoggedVisits =>
      widget.isEditMode &&
      MotherVisitRepository()
          .getForMother(widget.existingMother!.id)
          .isNotEmpty;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingMother;
    if (existing != null) {
      _birthDate = existing.birthDate;
      _breastfeedingPractice = existing.breastfeedingPractice;
      _belongsToIpGroup = existing.belongsToIpGroup;
      _linkedChildren = _childRepo.getByIds(existing.linkedChildIds);
    }
  }

  bool get _isFormValid =>
      _fullNameController.text.trim().isNotEmpty &&
      _birthDate != null &&
      _addressController.text.trim().isNotEmpty;

  bool _hasUnsavedInput() {
    if (widget.isEditMode) {
      final existing = widget.existingMother!;
      return _fullNameController.text.trim() != existing.fullName ||
          _contactController.text.trim() != existing.contactNo ||
          _addressController.text.trim() != existing.address ||
          _birthDate != existing.birthDate ||
          _breastfeedingPractice != existing.breastfeedingPractice ||
          _belongsToIpGroup != existing.belongsToIpGroup ||
          _linkedChildren.length != existing.linkedChildIds.length;
    }

    if (_fullNameController.text.trim().isNotEmpty &&
        _fullNameController.text.trim() != widget.prefillFullName) {
      return true;
    }
    if (_contactController.text.trim().isNotEmpty &&
        _contactController.text.trim() != widget.prefillContact) {
      return true;
    }
    if (_addressController.text.trim().isNotEmpty &&
        _addressController.text.trim() != widget.prefillAddress) {
      return true;
    }
    if (_birthDate != null) return true;
    if (_disabilityController.text.trim().isNotEmpty) return true;
    if (_linkedChildren.isNotEmpty) return true;
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

    final rawContact = _contactController.text.trim();
    final sanitizedContact = AppUserIdentity.sanitizeMobileNumber(rawContact);
    if (rawContact.isNotEmpty && !AppUserIdentity.isValidPhilippineContactNumber(rawContact)) {
      AppNotificationUI.showWarning(
        context,
        'Please enter a valid 11-digit mobile contact number starting with 09 (e.g. 09123456789).',
        title: 'Invalid Contact Number',
      );
      setState(() => _isSaving = false);
      return;
    }

    final motherAge = DateTime.now().year - _birthDate!.year;
    if (motherAge < 18) {
      final confirmYoungMother = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Young Mother Registered'),
          content: Text(
            'Mother\'s recorded age is $motherAge years old. Please confirm registration details for young lactating mother.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Edit Birth Date'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm'),
            ),
          ],
        ),
      );
      if (confirmYoungMother != true) {
        setState(() => _isSaving = false);
        return;
      }
    }

    final mother = Mother(
      id: widget.existingMother?.id ?? MotherRepository.generateId(),
      fullName: _fullNameController.text.trim(),
      birthDate: _birthDate!,
      contactNo: sanitizedContact,
      address: _addressController.text.trim(),
      barangay: _currentBarangay,
      breastfeedingPractice: _breastfeedingPractice,
      belongsToIpGroup: _belongsToIpGroup,
      disability: _disabilityController.text.trim().isEmpty
          ? 'None specified'
          : _disabilityController.text.trim(),
      createdAt: widget.existingMother?.createdAt ?? DateTime.now(),
      riskStatus: widget.existingMother?.riskStatus ?? 'Normal',
      isActive: widget.existingMother?.isActive ?? true,
      inactiveReason: widget.existingMother?.inactiveReason,
      linkedChildIds: _linkedChildren.map((c) => c.id).toList(),
    );

    try {
      if (widget.isEditMode) {
        await _motherRepo.update(mother);
      } else {
        await _motherRepo.add(mother);
      }

      // Reciprocal write-back
      if (widget.isEditMode) {
        final currentLinkedIds = _linkedChildren.map((c) => c.id).toSet();
        for (final oldChildId in widget.existingMother!.linkedChildIds) {
          if (!currentLinkedIds.contains(oldChildId)) {
            final oldChildren = _childRepo.getByIds([oldChildId]);
            if (oldChildren.isNotEmpty) {
              await _linkService.unlinkChildFromMother(
                child: oldChildren.first,
                mother: mother,
              );
            }
          }
        }
      }

      for (final child in _linkedChildren) {
        await _linkService.linkChildToMother(child: child, mother: mother);
      }

      await _activityRepo.logActivity(
        type: 'mother_added',
        title: widget.isEditMode
            ? 'Updated ${mother.fullName}\'s profile'
            : 'Registered ${mother.fullName}',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      AppNotificationUI.showError(
        context,
        'Failed to save mother record: $e',
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
        ? 'Mother profile updated successfully.'
        : (online
            ? 'Mother added: ${mother.fullName}'
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
      Navigator.pop(context, mother);
      return;
    }

    // Clean reset for next mother
    _fullNameController.clear();
    _contactController.clear();
    _addressController.clear();
    _disabilityController.clear();
    _birthDate = null;
    _breastfeedingPractice = 'Exclusive breastfeeding';
    _belongsToIpGroup = false;
    _linkedChildren = [];

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
              Container(
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
                      onTap: _handleLeave,
                      child: const Padding(
                        padding: EdgeInsets.all(4),
                        child: Icon(Icons.arrow_back, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        widget.isEditMode
                            ? 'Edit Mother Profile'
                            : 'Add Mother Profile',
                        style: AppTextStyles.h2.copyWith(color: Colors.white),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (!widget.isEditMode)
                      TextButton(
                        onPressed: _handleLeave,
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
                          AppTextField(
                            label: 'Full Name *',
                            hint: "Enter mother's full name",
                            icon: Icons.badge_outlined,
                            controller: _fullNameController,
                            focusNode: _fullNameFocusNode,
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: AppDateField(
                                  label: 'Birth Date *',
                                  value: _birthDate,
                                  firstDate: DateTime(1940),
                                  lastDate: DateTime.now(),
                                  onChanged: (d) =>
                                      setState(() => _birthDate = d),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: AppTextField(
                                  label: 'Contact no.',
                                  hint: '09XXXXXXXXX',
                                  icon: Icons.call_outlined,
                                  controller: _contactController,
                                  isNumericOnly: true,
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
                          if (_hasLoggedVisits)
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Breastfeeding practice: $_breastfeedingPractice',
                                      style: AppTextStyles.body.copyWith(
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const Icon(
                                    Icons.lock_outline,
                                    size: 14,
                                    color: AppColors.textMuted,
                                  ),
                                ],
                              ),
                            )
                          else
                            AppDropdownField(
                              label: 'Current breastfeeding practice',
                              value: _breastfeedingPractice,
                              options: const [
                                'Exclusive breastfeeding',
                                'Mixed feeding',
                                'Complementary feeding',
                                'Bottle feeding',
                              ],
                              onChanged: (v) =>
                                  setState(() => _breastfeedingPractice = v!),
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
                        title: 'Linked Children',
                        subtitle:
                            'Children this mother is a guardian or caregiver for',
                        children: [
                          ChildPickerField(
                            barangay: _currentBarangay,
                            selected: _linkedChildren,
                            prefillGuardianName: _fullNameController.text,
                            prefillGuardianContact: _contactController.text,
                            prefillAddress: _addressController.text,
                            onChanged: (children) =>
                                setState(() => _linkedChildren = children),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      FormActionButtons(
                        saveLabel: widget.isEditMode
                            ? 'Save Changes'
                            : 'Save Mother Profile',
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
    _contactController.dispose();
    _addressController.dispose();
    _disabilityController.dispose();
    super.dispose();
  }
}
