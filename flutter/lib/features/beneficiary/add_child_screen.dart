import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import '../../shared/utils/app_page_route.dart';
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
import '../../shared/widgets/form_required_note.dart';
import '../../shared/widgets/form_section_card.dart';
import '../../data/local/hive_boxes.dart';
import '../../shared/utils/app_user_identity.dart';
import '../../shared/utils/app_notifications.dart';
import '../child_profile/child_profile_screen.dart';
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
    text: widget.existingChild?.address ??
        (widget.prefillAddress.isNotEmpty ? widget.prefillAddress : 'Purok 1'),
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

  final _fullNameKey = GlobalKey();
  final _birthDateKey = GlobalKey();
  final _genderKey = GlobalKey();
  final _addressKey = GlobalKey();
  final _guardianNameKey = GlobalKey();
  final _relationshipKey = GlobalKey();
  final _guardianContactKey = GlobalKey();

  String? _fullNameError;
  String? _birthDateError;
  String? _genderError;
  String? _addressError;
  String? _guardianNameError;
  String? _relationshipError;
  String? _guardianContactError;

  DateTime? _birthDate;
  String? _gender;
  bool _belongsToIpGroup = false;
  bool _hasDisability = false;
  String? _relationship;
  DateTime? _guardianBirthDate;
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
      _hasDisability = existing.disability.isNotEmpty &&
          existing.disability.toLowerCase() != 'none specified' &&
          existing.disability.toLowerCase() != 'none' &&
          existing.disability.toLowerCase() != 'no';
      _relationship = existing.guardian.relationship;
      _guardianBirthDate = existing.guardian.birthDate;
      if (existing.guardian.linkedMotherId != null) {
        _linkedMother = _motherRepo.getById(existing.guardian.linkedMotherId!);
        _guardianIsMonitoredMother = _linkedMother != null;
        if (_guardianBirthDate == null && _linkedMother?.birthDate != null) {
          _guardianBirthDate = _linkedMother!.birthDate;
        }
      }
    } else if (widget.prefillGuardianName.isNotEmpty) {
      _relationship = 'Mother';
    }
  }

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
          _relationship != existing.guardian.relationship ||
          _guardianBirthDate != existing.guardian.birthDate;
    }

    if (_fullNameController.text.trim().isNotEmpty) return true;
    if (_birthDate != null) return true;
    if (_gender != null) return true;
    if (_disabilityController.text.trim().isNotEmpty) return true;
    if (!_keepMotherDetails) {
      if (_addressController.text.trim().isNotEmpty &&
          _addressController.text.trim() != (widget.prefillAddress.isNotEmpty ? widget.prefillAddress : 'Purok 1')) {
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
      if (_guardianBirthDate != null) return true;
      if (_relationship != null && _relationship != (widget.prefillGuardianName.isNotEmpty ? 'Mother' : null)) return true;
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
    FocusScope.of(context).unfocus();

    String? fullNameErr;
    String? birthDateErr;
    String? genderErr;
    String? addressErr;
    String? guardianNameErr;
    String? relationshipErr;
    String? guardianContactErr;

    if (_fullNameController.text.trim().isEmpty) {
      fullNameErr = 'This field is required';
    }
    if (_birthDate == null) {
      birthDateErr = 'This field is required';
    } else {
      final now = DateTime.now();
      if (_birthDate!.isAfter(now)) {
        birthDateErr = 'Birth date cannot be in the future';
      } else {
        final ageInMonths = ((now.year - _birthDate!.year) * 12) + (now.month - _birthDate!.month) -
            (now.day < _birthDate!.day ? 1 : 0);
        if (ageInMonths > 59) {
          birthDateErr = 'Child must be 0–59 months old ($ageInMonths mos)';
        }
      }
    }
    if (_gender == null || _gender!.trim().isEmpty) {
      genderErr = 'Please select a gender';
    }
    if (_addressController.text.trim().isEmpty) {
      addressErr = 'This field is required';
    }
    if (_guardianNameController.text.trim().isEmpty) {
      guardianNameErr = 'This field is required';
    }
    if (_relationship == null || _relationship!.trim().isEmpty) {
      relationshipErr = 'Please select a relationship';
    }

    final rawContact = _guardianContactController.text.trim();
    final sanitizedGuardianContact = AppUserIdentity.sanitizeMobileNumber(rawContact);
    if (rawContact.isNotEmpty && !AppUserIdentity.isValidPhilippineContactNumber(rawContact)) {
      guardianContactErr = 'Contact number must be 11 digits (e.g. 09123456789)';
    }

    if (fullNameErr != null ||
        birthDateErr != null ||
        genderErr != null ||
        addressErr != null ||
        guardianNameErr != null ||
        relationshipErr != null ||
        guardianContactErr != null) {
      setState(() {
        _fullNameError = fullNameErr;
        _birthDateError = birthDateErr;
        _genderError = genderErr;
        _addressError = addressErr;
        _guardianNameError = guardianNameErr;
        _relationshipError = relationshipErr;
        _guardianContactError = guardianContactErr;
      });

      GlobalKey? firstInvalidKey;
      if (fullNameErr != null) {
        firstInvalidKey = _fullNameKey;
      } else if (birthDateErr != null) {
        firstInvalidKey = _birthDateKey;
      } else if (genderErr != null) {
        firstInvalidKey = _genderKey;
      } else if (addressErr != null) {
        firstInvalidKey = _addressKey;
      } else if (guardianNameErr != null) {
        firstInvalidKey = _guardianNameKey;
      } else if (relationshipErr != null) {
        firstInvalidKey = _relationshipKey;
      } else if (guardianContactErr != null) {
        firstInvalidKey = _guardianContactKey;
      }

      if (firstInvalidKey?.currentContext != null) {
        Scrollable.ensureVisible(
          firstInvalidKey!.currentContext!,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          alignment: 0.1,
        );
      }

      AppNotificationUI.showWarning(
        context,
        'Please correct the highlighted fields.',
        title: 'Validation Error',
      );
      return;
    }

    // Adolescent mother warning check
    if (_guardianBirthDate != null &&
        (_relationship?.trim().toLowerCase() == 'mother')) {
      final motherAge = (DateTime.now().difference(_guardianBirthDate!).inDays / 365).floor();
      if (motherAge < 12) {
        AppNotificationUI.showWarning(
          context,
          'Mother must be at least 12 years old (recorded age: $motherAge yrs). Please correct the birth date.',
          title: 'Invalid Mother Age',
        );
        return;
      }
      if (motherAge < 18) {
        final confirmYoungMother = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: AppColors.statOrange),
                SizedBox(width: 8),
                Text('Adolescent mother'),
              ],
            ),
            content: Text(
              'Mother\'s recorded age is $motherAge years old (Adolescent mother under 18). Do you want to proceed?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Edit Date'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Proceed'),
              ),
            ],
          ),
        );
        if (confirmYoungMother != true) {
          return;
        }
      }
    }

    setState(() {
      _isSaving = true;
      _fullNameError = null;
      _birthDateError = null;
      _genderError = null;
      _addressError = null;
      _guardianNameError = null;
      _relationshipError = null;
      _guardianContactError = null;
    });

    Mother? targetMother = _linkedMother;
    final isMotherGuardian = _relationship?.trim().toLowerCase() == 'mother';

    if (isMotherGuardian) {
      if (_keepMotherDetails && _linkedMother != null) {
        targetMother = _linkedMother;
      } else {
        targetMother = await _linkService.resolveOrCreateMotherForChild(
          barangay: _currentBarangay,
          guardianName: _guardianNameController.text.trim(),
          guardianContact: sanitizedGuardianContact,
          address: _addressController.text.trim(),
          guardianBirthDate: _guardianBirthDate,
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
      gender: _gender!,
      address: _addressController.text.trim(),
      barangay: _currentBarangay,
      belongsToIpGroup: _belongsToIpGroup,
      disability: (!_hasDisability || _disabilityController.text.trim().isEmpty)
          ? 'None specified'
          : _disabilityController.text.trim(),
      guardian: Guardian(
        fullName: _guardianNameController.text.trim(),
        relationship: _relationship!,
        contactNo: sanitizedGuardianContact,
        linkedMotherId: targetMother?.id,
        birthDate: _guardianBirthDate,
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
      final birthDateChanged = widget.isEditMode &&
          widget.existingChild != null &&
          (widget.existingChild!.birthDate.year != _birthDate!.year ||
           widget.existingChild!.birthDate.month != _birthDate!.month ||
           widget.existingChild!.birthDate.day != _birthDate!.day);

      if (widget.isEditMode) {
        await _childRepo.update(child);
        if (birthDateChanged) {
          await _childRepo.recomputeAllMeasurementsForChild(child.id, child.birthDate);
        }
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

    // Refresh sequence number for subsequent saves
    _sequenceNo = _childRepo.generateSequenceNo(barangayCode: _currentBarangayCode);

    // Prompt user: View profile or add sibling
    final savedMother = targetMother;
    final savedAddress = _addressController.text.trim();
    final savedGuardianName = _guardianNameController.text.trim();
    final savedGuardianContact = sanitizedGuardianContact;
    final savedGuardianBirthDate = _guardianBirthDate;
    final savedIp = _belongsToIpGroup;

    final action = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.primaryGreen),
            const SizedBox(width: 8),
            Expanded(child: Text('Registered ${child.fullName}')),
          ],
        ),
        content: const Text(
          'Child profile has been saved. Would you like to view the profile, or add another sibling?',
        ),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(ctx, 'sibling'),
            child: const Text('Add Another Sibling'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primaryGreen),
            onPressed: () => Navigator.pop(ctx, 'profile'),
            child: const Text('View Profile'),
          ),
        ],
      ),
    );

    if (!mounted) return;

    if (action == 'profile') {
      Navigator.pop(context, child);
      Navigator.push(
        context,
        appPageRoute(ChildProfileScreen(child: child)),
      );
      return;
    }

    // Add sibling / reset form
    _fullNameController.clear();
    _birthDate = null;
    _gender = null;
    _disabilityController.clear();
    _fullNameError = null;
    _birthDateError = null;
    _genderError = null;
    _addressError = null;
    _guardianNameError = null;
    _relationshipError = null;
    _guardianContactError = null;

    if (action == 'sibling' || _keepMotherDetails) {
      _keepMotherDetails = true;
      _addressController.text = savedAddress;
      _guardianNameController.text = savedGuardianName;
      _guardianContactController.text = savedGuardianContact;
      _relationship = 'Mother';
      _guardianBirthDate = savedGuardianBirthDate;
      _belongsToIpGroup = savedIp;
      _linkedMother = savedMother;
      _guardianIsMonitoredMother = savedMother != null;
    } else {
      _addressController.text = 'Purok 1';
      _guardianNameController.clear();
      _guardianContactController.clear();
      _relationship = null;
      _guardianBirthDate = null;
      _belongsToIpGroup = false;
      _guardianIsMonitoredMother = false;
      _linkedMother = null;
      _keepMotherDetails = false;
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
                      const FormRequiredNote(),
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
                            key: _fullNameKey,
                            label: 'Full Name',
                            isRequired: true,
                            hint: "Enter child's full name",
                            icon: Icons.badge_outlined,
                            controller: _fullNameController,
                            focusNode: _fullNameFocusNode,
                            hasError: _fullNameError != null,
                            errorText: _fullNameError,
                            onChanged: (_) {
                              if (_fullNameError != null) {
                                setState(() => _fullNameError = null);
                              }
                            },
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: AppDateField(
                                  key: _birthDateKey,
                                  label: 'Birth date',
                                  isRequired: true,
                                  value: _birthDate,
                                  hasError: _birthDateError != null,
                                  errorText: _birthDateError,
                                  firstDate: DateTime(DateTime.now().year - 5, DateTime.now().month, DateTime.now().day),
                                  lastDate: DateTime.now(),
                                  onChanged: (d) => setState(() {
                                    _birthDate = d;
                                    _birthDateError = null;
                                  }),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: AppDropdownField(
                                  key: _genderKey,
                                  label: 'Gender',
                                  isRequired: true,
                                  hint: 'Select gender',
                                  value: _gender,
                                  options: const ['Female', 'Male'],
                                  hasError: _genderError != null,
                                  errorText: _genderError,
                                  onChanged: (v) => setState(() {
                                    _gender = v;
                                    _genderError = null;
                                  }),
                                ),
                              ),
                            ],
                          ),
                          AppDropdownField(
                            key: _addressKey,
                            label: 'Purok Address',
                            isRequired: true,
                            hint: 'Select Purok',
                            value: const [
                              'Purok 1',
                              'Purok 2',
                              'Purok 3',
                              'Purok 4',
                              'Purok 5',
                              'Purok 6',
                              'Purok 7',
                            ].contains(_addressController.text.trim())
                                ? _addressController.text.trim()
                                : (_addressController.text.trim().isNotEmpty
                                    ? _addressController.text.trim()
                                    : 'Purok 1'),
                            options: const [
                              'Purok 1',
                              'Purok 2',
                              'Purok 3',
                              'Purok 4',
                              'Purok 5',
                              'Purok 6',
                              'Purok 7',
                            ],
                            hasError: _addressError != null,
                            errorText: _addressError,
                            onChanged: (v) {
                              if (v != null) {
                                setState(() {
                                  _addressController.text = v;
                                  _addressError = null;
                                });
                              }
                            },
                          ),
                          AppYesNoToggle(
                            label: 'Belongs to IP group',
                            value: _belongsToIpGroup,
                            onChanged: (v) =>
                                setState(() => _belongsToIpGroup = v),
                          ),
                          AppYesNoToggle(
                            label: 'Has Disability?',
                            value: _hasDisability,
                            onChanged: (v) {
                              setState(() {
                                _hasDisability = v;
                                if (!v) {
                                  _disabilityController.clear();
                                }
                              });
                            },
                          ),
                          if (_hasDisability) ...[
                            AppTextField(
                              label: 'Specify Disability *',
                              hint: 'e.g. Visual impairment, Cerebral palsy, etc.',
                              icon: Icons.accessibility_new_outlined,
                              controller: _disabilityController,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      FormSectionCard(
                        title: 'Guardian',
                        subtitle:
                            'Required for every child, even if not a monitored mother',
                        children: [
                          AppTextField(
                            key: _guardianNameKey,
                            label: 'Full Name',
                            isRequired: true,
                            hint: "Enter guardian's name",
                            icon: Icons.person_outline,
                            controller: _guardianNameController,
                            hasError: _guardianNameError != null,
                            errorText: _guardianNameError,
                            onChanged: (_) {
                              if (_guardianNameError != null) {
                                setState(() => _guardianNameError = null);
                              } else {
                                setState(() {});
                              }
                            },
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: AppDropdownField(
                                  key: _relationshipKey,
                                  label: 'Relationship',
                                  isRequired: true,
                                  hint: 'Select relationship',
                                  value: _relationship,
                                  options: const [
                                    'Mother',
                                    'Father',
                                    'Grandparent',
                                    'Other',
                                  ],
                                  hasError: _relationshipError != null,
                                  errorText: _relationshipError,
                                  onChanged: (v) => setState(() {
                                    _relationship = v;
                                    _relationshipError = null;
                                  }),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: AppTextField(
                                  key: _guardianContactKey,
                                  label: 'Contact no.',
                                  hint: '09XXXXXXXXX',
                                  icon: Icons.call_outlined,
                                  controller: _guardianContactController,
                                  isNumericOnly: true,
                                  maxLength: 11,
                                  keyboardType: TextInputType.phone,
                                  hasError: _guardianContactError != null,
                                  errorText: _guardianContactError,
                                  onChanged: (_) {
                                    if (_guardianContactError != null) {
                                      setState(() => _guardianContactError = null);
                                    }
                                  },
                                ),
                              ),
                            ],
                          ),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: AppDateField(
                                  label: 'Guardian Birth Date (Optional)',
                                  value: _guardianBirthDate,
                                  firstDate: DateTime(1940),
                                  lastDate: DateTime.now(),
                                  onChanged: (d) => setState(() {
                                    _guardianBirthDate = d;
                                  }),
                                ),
                              ),
                            ],
                          ),
                          if (_guardianBirthDate != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2, bottom: 4),
                              child: Row(
                                children: [
                                  Text(
                                    'Age: ${Guardian(fullName: '', relationship: '', contactNo: '', birthDate: _guardianBirthDate).ageLabel}',
                                    style: AppTextStyles.body.copyWith(
                                      fontSize: 12,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                  if (Guardian(fullName: '', relationship: '', contactNo: '', birthDate: _guardianBirthDate).isAdolescent) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: const Color(0xFFF59E0B)),
                                      ),
                                      child: Text(
                                        'Adolescent mother',
                                        style: AppTextStyles.caption.copyWith(
                                          color: const Color(0xFFB45309),
                                          fontWeight: FontWeight.w600,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          if (_relationship?.trim().toLowerCase() == 'mother' &&
                              _guardianNameController.text.trim().isNotEmpty)
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
                          else if (_relationship?.trim().toLowerCase() != 'mother') ...[
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
