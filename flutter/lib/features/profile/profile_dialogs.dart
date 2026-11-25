import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/remote/auth_api.dart';
import '../../data/local/secure_token_storage.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/form_required_note.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';

Future<bool> _isDeviceOnline() async {
  try {
    final result = await Connectivity().checkConnectivity();
    return result.any((r) => r != ConnectivityResult.none);
  } catch (_) {
    return true;
  }
}

Future<void> showEditProfileDialog(BuildContext context) async {
  await Navigator.push(
    context,
    appPageRoute(const EditProfileScreen()),
  );
}

Future<void> showChangePasswordDialog(BuildContext context) async {
  final settings = SettingsRepository();
  final user = settings.authUser ?? {};
  final currentPassCtrl = TextEditingController();
  final newPassCtrl = TextEditingController();
  final confirmPassCtrl = TextEditingController();
  final formKey = GlobalKey<FormState>();
  bool isSaving = false;
  String? dialogError;

  await showDialog<void>(
    context: context,
    barrierDismissible: !isSaving,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDialogState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(AppStrings.t('change_password'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FormRequiredNote(padding: EdgeInsets.only(bottom: 14)),
                if (dialogError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(8),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(dialogError!, style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
                  ),
                ],
                TextFormField(
                  controller: currentPassCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t('current_password')} *',
                    border: const OutlineInputBorder(),
                    errorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                    focusedErrorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  validator: (v) => (v == null || v.isEmpty) ? AppStrings.t('field_required') : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: newPassCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t('new_password')} *',
                    border: const OutlineInputBorder(),
                    errorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                    focusedErrorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return AppStrings.t('field_required');
                    if (v.length < 8) return AppStrings.t('password_min_length');
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: confirmPassCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: '${AppStrings.t('confirm_password')} *',
                    border: const OutlineInputBorder(),
                    errorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                    focusedErrorBorder: const OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return AppStrings.t('field_required');
                    if (v != newPassCtrl.text) return AppStrings.t('passwords_dont_match');
                    return null;
                  },
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: isSaving ? null : () => Navigator.pop(ctx),
            child: Text(AppStrings.t('cancel'), style: const TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: isSaving ? null : () async {
              if (!formKey.currentState!.validate()) return;
              final messenger = ScaffoldMessenger.of(context);
              final nav = Navigator.of(ctx);
              setDialogState(() {
                isSaving = true;
                dialogError = null;
              });

              final currentPass = currentPassCtrl.text;
              final newPass = newPassCtrl.text;
              final userId = user['user_id']?.toString() ?? '';
              final token = settings.authToken ?? '';

              final isOnline = await _isDeviceOnline();
              if (isOnline && token.isNotEmpty && userId.isNotEmpty) {
                try {
                  await AuthApi.changePassword(
                    userId: userId,
                    token: token,
                    currentPassword: currentPass,
                    newPassword: newPass,
                  );
                  await settings.setPendingPasswordChange(null, userId: userId);
                  nav.pop();
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(AppStrings.t('password_changed_success')),
                      backgroundColor: AppColors.primaryGreen,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                  return;
                } catch (e) {
                  final errStr = e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
                  setDialogState(() {
                    isSaving = false;
                    dialogError = errStr;
                  });
                  return;
                }
              }

              // Offline
              await settings.setPendingPasswordChange({
                'current_password': currentPass,
                'new_password': newPass,
              }, userId: userId);
              nav.pop();
              messenger.showSnackBar(
                SnackBar(
                  content: Text(AppStrings.t('password_update_queued')),
                  backgroundColor: AppColors.statAmber,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            child: isSaving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(AppStrings.t('update_password_btn')),
          ),
        ],
      ),
    ),
  );
}

Future<void> showLogoutConfirmationDialog(BuildContext context) async {
  final pendingCount = ChildRepository().pendingCount +
      MotherRepository().pendingCount +
      MeasurementRepository().pendingCount +
      ReferralRepository().pendingCount +
      (SettingsRepository().pendingProfilePicturePath != null ? 1 : 0);

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          const Icon(Icons.logout, color: Colors.red, size: 22),
          const SizedBox(width: 8),
          Text(
            AppStrings.t('logout_confirm_title'),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pendingCount > 0) ...[
            Container(
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      AppStrings.t('logout_warning_unsynced'),
                      style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
            ),
          ],
          Text(AppStrings.t('logout_confirm_msg')),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(AppStrings.t('cancel'), style: const TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(AppStrings.t('logout_confirm_btn')),
        ),
      ],
    ),
  );

  if (confirmed == true && context.mounted) {
    await SettingsRepository().clearSession();
    await SecureTokenStorage.clearTokens();
    AppDataBus.notifyChanged();
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }
}
