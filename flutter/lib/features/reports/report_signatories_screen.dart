import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/report_signatory_repository.dart';
import '../../data/models/report_signatory.dart';
import '../../shared/widgets/app_text_field.dart';
import '../../shared/widgets/form_action_buttons.dart';
import '../../data/local/hive_boxes.dart';
import '../../shared/utils/app_user_identity.dart';

class ReportSignatoriesScreen extends StatefulWidget {
  const ReportSignatoriesScreen({super.key});

  @override
  State<ReportSignatoriesScreen> createState() =>
      _ReportSignatoriesScreenState();
}

class _ReportSignatoriesScreenState extends State<ReportSignatoriesScreen> {
  final _punongBarangayController = TextEditingController();
  final _mnaoController = TextEditingController();
  final _dnpcController = TextEditingController();
  final _settings = SettingsRepository();
  String _currentBarangay = '';
  String _currentBnsName = '';
  String _barangayLogoPath = '';
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final user = _settings.authUser;
    _currentBarangay = AppUserIdentity.resolveBarangay(user);
    _currentBnsName = AppUserIdentity.resolveDisplayName(user);

    final existing = ReportSignatoryRepository().get(_currentBarangay);
    if (existing != null) {
      _punongBarangayController.text = existing.punongBarangayName;
      _mnaoController.text = existing.mnaoAdminAideName;
      _dnpcController.text = existing.dnpcName;
      _barangayLogoPath = existing.barangayLogoPath;
    }
  }

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (picked != null) {
      setState(() => _barangayLogoPath = picked.path);
    }
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    await ReportSignatoryRepository().save(
      ReportSignatory(
        barangay: _currentBarangay,
        bnsName: _currentBnsName,
        punongBarangayName: _punongBarangayController.text.trim(),
        mnaoAdminAideName: _mnaoController.text.trim(),
        dnpcName: _dnpcController.text.trim(),
        barangayLogoPath: _barangayLogoPath,
      ),
    );
    if (!mounted) return;
    Navigator.pop(context);
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
                    'Report Signatories',
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
                    Text(
                      'These names and logo print automatically on every report.',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    // ── Barangay Logo Picker ──
                    Text('Barangay Logo (for PDF report header)', style: AppTextStyles.label),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _pickLogo,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _barangayLogoPath.isNotEmpty
                                ? AppColors.primaryGreen
                                : AppColors.border,
                            width: _barangayLogoPath.isNotEmpty ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            // AppScale App Logo Preview
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white,
                                border: Border.all(color: AppColors.primaryGreen, width: 2),
                              ),
                              clipBehavior: Clip.antiAlias,
                              padding: const EdgeInsets.all(8),
                              child: Image.asset(
                                'assets/images/appscale_logo.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(width: 10),
                            // Barangay Logo Preview
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.background,
                                border: Border.all(
                                  color: _barangayLogoPath.isNotEmpty
                                      ? AppColors.primaryGreen
                                      : AppColors.border,
                                  width: _barangayLogoPath.isNotEmpty ? 2 : 1,
                                ),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: _barangayLogoPath.isNotEmpty &&
                                      File(_barangayLogoPath).existsSync()
                                  ? Image.file(
                                      File(_barangayLogoPath),
                                      fit: BoxFit.cover,
                                    )
                                  : const Icon(
                                      Icons.account_balance_outlined,
                                      size: 32,
                                      color: AppColors.textMuted,
                                    ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _barangayLogoPath.isNotEmpty
                                        ? 'Logo selected ✓'
                                        : 'Tap to choose barangay logo',
                                    style: AppTextStyles.label.copyWith(
                                      color: _barangayLogoPath.isNotEmpty
                                          ? AppColors.primaryGreen
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Pick from gallery — will appear in report header PDF',
                                    style: AppTextStyles.body.copyWith(
                                      fontSize: 11,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                  if (_barangayLogoPath.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    GestureDetector(
                                      onTap: () =>
                                          setState(() => _barangayLogoPath = ''),
                                      child: Text(
                                        'Remove logo',
                                        style: AppTextStyles.body.copyWith(
                                          fontSize: 11,
                                          color: Colors.red,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.photo_library_outlined,
                              color: AppColors.textMuted,
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    // ── Signatory Names ──
                    Text('Submitted by (BNS)', style: AppTextStyles.label),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$_currentBnsName · auto-filled from account',
                        style: AppTextStyles.body.copyWith(fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Noted by · Punong Barangay',
                      hint: 'Full name',
                      icon: Icons.person_outline,
                      controller: _punongBarangayController,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Approved by · Admin Aide, MNAO',
                      hint: 'Full name',
                      icon: Icons.person_outline,
                      controller: _mnaoController,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Approved by · DNPC',
                      hint: 'Full name',
                      icon: Icons.person_outline,
                      controller: _dnpcController,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FormActionButtons(
                      saveLabel: 'Save',
                      onSave: _save,
                      onCancel: () => Navigator.pop(context),
                      isSaving: _isSaving,
                    ),
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
    _punongBarangayController.dispose();
    _mnaoController.dispose();
    _dnpcController.dispose();
    super.dispose();
  }
}
