import 'package:flutter/material.dart';
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
  final _repo = ReportSignatoryRepository();

  String _currentBarangay = '';
  String _currentBnsName = '';
  String _userId = '';
  bool _remember = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final user = _settings.authUser;
    _currentBarangay = AppUserIdentity.resolveBarangay(user);
    _currentBnsName = AppUserIdentity.resolveDisplayName(user);
    _userId = user?['id']?.toString() ??
        user?['user_id']?.toString() ??
        user?['username']?.toString() ??
        '';

    final remembered = _repo.getRemembered(_userId);
    if (remembered != null) {
      _remember = true;
      _punongBarangayController.text = remembered.punongBarangayName;
      _mnaoController.text = remembered.mnaoAdminAideName;
      _dnpcController.text = remembered.dnpcName;
    } else {
      // Fallback to official admin-configured signatories
      final adminConfigured = _repo.resolveForUser(_settings.authUser);
      _punongBarangayController.text = adminConfigured.punongBarangayName;
      _mnaoController.text = adminConfigured.mnaoAdminAideName;
      _dnpcController.text = adminConfigured.dnpcName;
      _remember = false;
    }
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);

    final signatory = ReportSignatory(
      barangay: _currentBarangay,
      bnsName: _currentBnsName, // Always current logged-in user
      punongBarangayName: _punongBarangayController.text.trim(),
      mnaoAdminAideName: _mnaoController.text.trim(),
      dnpcName: _dnpcController.text.trim(),
    );

    if (_remember) {
      await _repo.saveRemembered(_userId, signatory);
    } else {
      await _repo.clearRemembered(_userId);
    }

    if (!mounted) return;
    Navigator.pop(context, signatory);
  }

  Future<void> _clearRemembered() async {
    await _repo.clearRemembered(_userId);
    setState(() {
      _remember = false;
      _punongBarangayController.clear();
      _mnaoController.clear();
      _dnpcController.clear();
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Remembered signatory names cleared.'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasSaved = _repo.hasRemembered(_userId);
    final isBns = _settings.authUser?['role']?.toString().toLowerCase() != 'admin';

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
                  Expanded(
                    child: Text(
                      'Report Signatories',
                      style: AppTextStyles.h2.copyWith(color: Colors.white),
                    ),
                  ),
                  if (hasSaved && !isBns)
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white70,
                        visualDensity: VisualDensity.compact,
                      ),
                      onPressed: _clearRemembered,
                      icon: const Icon(Icons.delete_outline, size: 16),
                      label: const Text(
                        'Clear',
                        style: TextStyle(fontSize: 12),
                      ),
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
                    if (isBns) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: AppSpacing.md),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.primaryGreen.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.admin_panel_settings_outlined, color: AppColors.primaryGreen, size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Official report signatories are configured by the Municipal Administrator on the Web Portal. Signatories shown below are applied to all generated reports.',
                                style: TextStyle(fontSize: 12, color: AppColors.darkGreen, height: 1.3),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      Text(
                        'Names left blank will print an empty line for physical signature after printing.',
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),

                    // ── Signatory Names ──
                    Text('Submitted / Prepared by (BNS)', style: AppTextStyles.label),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.lock_outline, size: 16, color: AppColors.textMuted),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '$_currentBnsName (Auto-filled)',
                              style: AppTextStyles.body.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppColors.darkGreen,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Noted by · Punong Barangay',
                      hint: 'Configured by Admin',
                      icon: Icons.person_outline,
                      controller: _punongBarangayController,
                      readOnly: isBns,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Approved by · Admin Aide, MNAO',
                      hint: 'Configured by Admin',
                      icon: Icons.person_outline,
                      controller: _mnaoController,
                      readOnly: isBns,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppTextField(
                      label: 'Approved by · DNPC',
                      hint: 'Configured by Admin',
                      icon: Icons.person_outline,
                      controller: _dnpcController,
                      readOnly: isBns,
                    ),
                    const SizedBox(height: AppSpacing.md),

                    if (!isBns) ...[
                      // ── Remember Checkbox ──
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        value: _remember,
                        onChanged: (val) {
                          setState(() => _remember = val ?? false);
                        },
                        title: const Text(
                          'Remember for next time',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        subtitle: const Text(
                          'Saves these names for your account on this device.',
                          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),

                      FormActionButtons(
                        saveLabel: 'Save',
                        onSave: _save,
                        onCancel: () => Navigator.pop(context),
                        isSaving: _isSaving,
                      ),
                    ] else ...[
                      const SizedBox(height: AppSpacing.lg),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primaryGreen,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
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
