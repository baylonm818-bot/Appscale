import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/purok_repository.dart';
import '../../data/models/child.dart';
import '../../data/remote/auth_api.dart';
import '../../shared/utils/app_notifications.dart';
import '../../shared/utils/app_user_identity.dart';
import '../../shared/widgets/form_required_note.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _settings = SettingsRepository();
  final _formKey = GlobalKey<FormState>();

  late final Map<String, dynamic> _initialUser;
  late final TextEditingController _firstNameCtrl;
  late final TextEditingController _lastNameCtrl;
  late final TextEditingController _contactCtrl;
  late final TextEditingController _emailCtrl;

  late String _selectedPurok;
  late List<String> _purokOptions;
  late String _healthStation;
  late String _accreditation;

  bool _isSaving = false;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    _initialUser = Map<String, dynamic>.from(_settings.authUser ?? {});

    _firstNameCtrl = TextEditingController(text: _initialUser['first_name']?.toString() ?? '');
    _lastNameCtrl = TextEditingController(text: _initialUser['last_name']?.toString() ?? '');
    _contactCtrl = TextEditingController(text: _initialUser['contact_number']?.toString() ?? '');
    _emailCtrl = TextEditingController(text: _initialUser['email']?.toString() ?? '');

    _firstNameCtrl.addListener(_checkForChanges);
    _lastNameCtrl.addListener(_checkForChanges);
    _contactCtrl.addListener(_checkForChanges);
    _emailCtrl.addListener(_checkForChanges);

    final rawBarangay = AppUserIdentity.resolveBarangay(_initialUser);
    _healthStation = _initialUser['health_station']?.toString().trim().isNotEmpty == true
        ? _initialUser['health_station'].toString().trim()
        : (rawBarangay.isNotEmpty ? '$rawBarangay ${AppStrings.t('health_station')}' : AppStrings.t('rural_health_unit'));
    _accreditation = _initialUser['accreditation']?.toString().trim().isNotEmpty == true
        ? _initialUser['accreditation'].toString().trim()
        : AppStrings.t('accreditation_val');

    _initPurokOptions(rawBarangay);
  }

  void _initPurokOptions(String barangay) {
    final currentPurok = _initialUser['purok']?.toString().trim() ?? '';
    final optionsSet = <String>{};

    try {
      final repoPuroks = PurokRepository().getByBarangay(barangay).map((p) => p.name.trim()).where((s) => s.isNotEmpty);
      optionsSet.addAll(repoPuroks);

      final childPuroks = ChildRepository().getByBarangay(barangay).map((c) => Child.normalizePurok(c.address)).where((s) => s.isNotEmpty);
      optionsSet.addAll(childPuroks);

      final motherPuroks = MotherRepository().getByBarangay(barangay).map((m) => Child.normalizePurok(m.address)).where((s) => s.isNotEmpty);
      optionsSet.addAll(motherPuroks);
    } catch (_) {}

    if (optionsSet.isEmpty) {
      for (int i = 1; i <= 7; i++) {
        optionsSet.add('Purok $i');
      }
    }

    if (currentPurok.isNotEmpty) {
      optionsSet.add(currentPurok);
    }

    final sorted = optionsSet.toList()..sort();
    _purokOptions = sorted;
    if (currentPurok.isNotEmpty && _purokOptions.contains(currentPurok)) {
      _selectedPurok = currentPurok;
    } else if (_purokOptions.isNotEmpty) {
      _selectedPurok = _purokOptions.first;
    } else {
      _selectedPurok = 'Purok 1';
      _purokOptions = [_selectedPurok];
    }
  }

  void _checkForChanges() {
    final origFirst = (_initialUser['first_name']?.toString() ?? '').trim();
    final origLast = (_initialUser['last_name']?.toString() ?? '').trim();
    final origContact = (_initialUser['contact_number']?.toString() ?? '').trim();
    final origEmail = (_initialUser['email']?.toString() ?? '').trim();
    final origPurok = (_initialUser['purok']?.toString() ?? '').trim();

    final changed = _firstNameCtrl.text.trim() != origFirst ||
        _lastNameCtrl.text.trim() != origLast ||
        _contactCtrl.text.trim() != origContact ||
        _emailCtrl.text.trim() != origEmail ||
        _selectedPurok.trim() != origPurok;

    if (changed != _hasChanges) {
      setState(() => _hasChanges = changed);
    }
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _contactCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<bool> _isOnline() async {
    try {
      final res = await Connectivity().checkConnectivity();
      return res.any((r) => r != ConnectivityResult.none);
    } catch (_) {
      return true;
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final firstName = _firstNameCtrl.text.trim();
    final lastName = _lastNameCtrl.text.trim();
    final contact = AppUserIdentity.sanitizeMobileNumber(_contactCtrl.text.trim());
    final email = _emailCtrl.text.trim();
    final purok = _selectedPurok.trim();
    final userId = _initialUser['user_id']?.toString() ?? '';
    final token = _settings.authToken ?? '';

    // 1. Save to Hive first (Offline-first)
    final updatedUser = Map<String, dynamic>.from(_initialUser);
    updatedUser['first_name'] = firstName;
    updatedUser['last_name'] = lastName;
    updatedUser['full_name'] = '$firstName $lastName'.trim();
    updatedUser['contact_number'] = contact;
    updatedUser['email'] = email;
    updatedUser['purok'] = purok;

    await _settings.setAuthUser(updatedUser);
    AppDataBus.notifyChanged();

    final payload = {
      'first_name': firstName,
      'last_name': lastName,
      'contact_number': contact,
      'email': email,
      'purok': purok,
    };

    // 2. Sync to API if online
    final isOnline = await _isOnline();
    if (isOnline && token.isNotEmpty && userId.isNotEmpty) {
      try {
        final res = await AuthApi.updateProfile(userId: userId, token: token, data: payload);
        if (res['user'] is Map) {
          final serverUser = Map<String, dynamic>.from(res['user'] as Map);
          final current = Map<String, dynamic>.from(_settings.authUser ?? {});
          current.addAll(serverUser);
          await _settings.setAuthUser(current);
        }
        await _settings.setPendingProfileUpdate(null, userId: userId);
        await _settings.refreshProfileFromServer();
        AppDataBus.notifyChanged();

        if (mounted) {
          Navigator.of(context).pop();
          AppNotificationUI.showSuccess(context, AppStrings.t('profile_updated_synced'));
        }
        return;
      } catch (e) {
        debugPrint('API update profile failed, queueing offline: $e');
      }
    }

    // Queue offline if offline or failed
    await _settings.setPendingProfileUpdate(payload, userId: userId);
    AppDataBus.notifyChanged();

    if (mounted) {
      Navigator.of(context).pop();
      AppNotificationUI.showSuccess(context, AppStrings.t('profile_saved_locally'));
    }
  }

  String get _avatarInitials {
    final first = _firstNameCtrl.text.trim();
    final last = _lastNameCtrl.text.trim();
    if (first.isNotEmpty && last.isNotEmpty) {
      return '${first[0]}${last[0]}'.toUpperCase();
    }
    if (first.isNotEmpty) return first[0].toUpperCase();
    final name = (_settings.authUser?['full_name']?.toString() ?? 'BNS').trim();
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : 'B';
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? helperText,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        textCapitalization: textCapitalization,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        validator: validator,
        style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
        decoration: InputDecoration(
          labelText: label,
          helperText: helperText,
          helperStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          prefixIcon: Icon(icon, color: AppColors.primaryGreen, size: 20),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.6),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.requiredAsterisk, width: 1.2),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.requiredAsterisk, width: 1.4),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white, size: 22),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          AppStrings.t('edit_profile_title'),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: AppColors.darkGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar & Role at the top
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primaryGreen, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primaryGreen.withValues(alpha: 0.15),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _avatarInitials,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.darkGreen,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        AppStrings.t('bns_title'),
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.darkGreen,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              const FormRequiredNote(padding: EdgeInsets.only(bottom: 16)),

              // First Name (Required *)
              _buildTextField(
                controller: _firstNameCtrl,
                label: '${AppStrings.t('first_name')} *',
                icon: Icons.person_outline,
                helperText: 'e.g. Maria',
                textCapitalization: TextCapitalization.words,
                validator: (v) => (v == null || v.trim().isEmpty) ? AppStrings.t('field_required') : null,
              ),

              // Last Name (Required *)
              _buildTextField(
                controller: _lastNameCtrl,
                label: '${AppStrings.t('last_name')} *',
                icon: Icons.badge_outlined,
                helperText: 'e.g. Santos',
                textCapitalization: TextCapitalization.words,
                validator: (v) => (v == null || v.trim().isEmpty) ? AppStrings.t('field_required') : null,
              ),

              // Contact Number
              _buildTextField(
                controller: _contactCtrl,
                label: AppStrings.t('contact_number'),
                icon: Icons.phone_outlined,
                helperText: '11 digits, e.g. 09123456789',
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(11),
                ],
                validator: (v) {
                  if (v != null && v.trim().isNotEmpty) {
                    if (!AppUserIdentity.isValidPhilippineContactNumber(v.trim())) {
                      return AppStrings.t('invalid_contact');
                    }
                  }
                  return null;
                },
              ),

              // Email
              _buildTextField(
                controller: _emailCtrl,
                label: AppStrings.t('email'),
                icon: Icons.email_outlined,
                helperText: 'e.g. worker@example.com',
                keyboardType: TextInputType.emailAddress,
                validator: (v) {
                  if (v != null && v.trim().isNotEmpty) {
                    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                    if (!emailRegex.hasMatch(v.trim())) {
                      return AppStrings.t('invalid_email');
                    }
                  }
                  return null;
                },
              ),

              // Purok / Address Dropdown
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: DropdownButtonFormField<String>(
                  initialValue: _purokOptions.contains(_selectedPurok) ? _selectedPurok : _purokOptions.first,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t('purok')} *',
                    helperText: 'Select your assigned purok / area',
                    helperStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    prefixIcon: const Icon(Icons.location_on_outlined, color: AppColors.primaryGreen, size: 20),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.6),
                    ),
                  ),
                  items: _purokOptions
                      .map((p) => DropdownMenuItem(
                            value: p,
                            child: Text(p, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary)),
                          ))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _selectedPurok = val);
                      _checkForChanges();
                    }
                  },
                ),
              ),

              // Assigned by Admin Card (Read-only)
              Container(
                margin: const EdgeInsets.only(bottom: 24),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.8)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.lock_outline, size: 16, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Text(
                          '${AppStrings.t('admin_only')} - Assigned by Admin',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'These official assignments can only be changed by the RHU Administrator.',
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 12),
                    const Divider(height: 1, color: AppColors.border),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.local_hospital_outlined, size: 18, color: AppColors.textMuted),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(AppStrings.t('health_station'), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                              Text(_healthStation, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(Icons.verified_outlined, size: 18, color: AppColors.textMuted),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(AppStrings.t('accreditation'), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                              Text(_accreditation, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.6))),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              TextButton(
                onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
                style: TextButton.styleFrom(
                  minimumSize: const Size(80, 48),
                ),
                child: Text(
                  AppStrings.t('cancel'),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.border,
                    disabledForegroundColor: AppColors.textMuted,
                    minimumSize: const Size(double.infinity, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: _hasChanges ? 2 : 0,
                  ),
                  onPressed: (_hasChanges && !_isSaving) ? _handleSave : null,
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                        )
                      : Text(
                          AppStrings.t('save'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
