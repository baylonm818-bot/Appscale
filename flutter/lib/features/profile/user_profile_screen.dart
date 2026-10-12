import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/remote/auth_api.dart';
import '../../shared/utils/app_user_identity.dart';
import '../../shared/widgets/form_required_note.dart';
import '../auth/login_screen.dart';

class UserProfileScreen extends StatefulWidget {
  final String bnsName;
  final String barangay;

  const UserProfileScreen({super.key, this.bnsName = '', this.barangay = ''});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  bool _isUploadingPicture = false;
  String? _uploadError;

  void _onDataChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    AppDataBus.version.addListener(_onDataChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      SettingsRepository().refreshProfileFromServer().then((_) {
        if (mounted) setState(() {});
      });
    });
  }

  @override
  void dispose() {
    AppDataBus.version.removeListener(_onDataChanged);
    super.dispose();
  }

  @override
  void deactivate() {
    ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
    super.deactivate();
  }

  Future<bool> _checkOnline() async {
    try {
      final result = await Connectivity().checkConnectivity();
      return result.any((r) => r != ConnectivityResult.none);
    } catch (_) {
      return true;
    }
  }

  Future<void> _showEditProfileDialog() async {
    final settings = SettingsRepository();
    final user = settings.authUser ?? {};
    final firstNameCtrl = TextEditingController(text: user['first_name']?.toString() ?? '');
    final lastNameCtrl = TextEditingController(text: user['last_name']?.toString() ?? '');
    final contactCtrl = TextEditingController(text: user['contact_number']?.toString() ?? '');
    final formKey = GlobalKey<FormState>();
    bool isSaving = false;

    await showDialog<void>(
      context: context,
      barrierDismissible: !isSaving,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Edit Profile', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FormRequiredNote(padding: EdgeInsets.only(bottom: 14)),
                  TextFormField(
                    controller: firstNameCtrl,
                    decoration: const InputDecoration(
                      label: Text.rich(
                        TextSpan(
                          text: 'First Name ',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          children: [
                            TextSpan(
                              text: '*',
                              style: TextStyle(color: AppColors.requiredAsterisk, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'This field is required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: lastNameCtrl,
                    decoration: const InputDecoration(
                      label: Text.rich(
                        TextSpan(
                          text: 'Last Name ',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          children: [
                            TextSpan(
                              text: '*',
                              style: TextStyle(color: AppColors.requiredAsterisk, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'This field is required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: contactCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Contact Number',
                      hintText: 'e.g. 09123456789',
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    keyboardType: TextInputType.phone,
                    maxLength: 11,
                    buildCounter: (context, {required currentLength, required isFocused, maxLength}) => null,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(11),
                    ],
                    validator: (v) {
                      if (v != null && v.trim().isNotEmpty) {
                        if (!AppUserIdentity.isValidPhilippineContactNumber(v.trim())) {
                          return 'Contact number must be 11 digits (e.g. 09123456789)';
                        }
                      }
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
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
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
                setDialogState(() => isSaving = true);

                final firstName = firstNameCtrl.text.trim();
                final lastName = lastNameCtrl.text.trim();
                final contact = AppUserIdentity.sanitizeMobileNumber(contactCtrl.text.trim());
                final userId = user['user_id']?.toString() ?? '';
                final token = settings.authToken ?? '';

                final updatedUser = Map<String, dynamic>.from(user);
                updatedUser['first_name'] = firstName;
                updatedUser['last_name'] = lastName;
                updatedUser['full_name'] = '$firstName $lastName'.trim();
                updatedUser['contact_number'] = contact;
                await settings.setAuthUser(updatedUser);
                AppDataBus.notifyChanged();

                final payload = {
                  'first_name': firstName,
                  'last_name': lastName,
                  'contact_number': contact,
                };

                final isOnline = await _checkOnline();
                if (isOnline && token.isNotEmpty && userId.isNotEmpty) {
                  try {
                    await AuthApi.updateProfile(userId: userId, token: token, data: payload);
                    await settings.setPendingProfileUpdate(null, userId: userId);
                    await settings.refreshProfileFromServer();
                    nav.pop();
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Profile updated successfully.'),
                        backgroundColor: AppColors.primaryGreen,
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                    return;
                  } catch (e) {
                    debugPrint('API update profile failed, queueing offline: $e');
                  }
                }

                // If offline or request failed
                await settings.setPendingProfileUpdate(payload, userId: userId);
                AppDataBus.notifyChanged();
                nav.pop();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Profile saved to device. Will sync to server when connected.'),
                    backgroundColor: AppColors.statAmber,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              child: isSaving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showChangePasswordDialog() async {
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
          title: const Text('Change Password', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
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
                    decoration: const InputDecoration(
                      label: Text.rich(
                        TextSpan(
                          text: 'Current Password ',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          children: [
                            TextSpan(
                              text: '*',
                              style: TextStyle(color: AppColors.requiredAsterisk, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'This field is required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: newPassCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      label: Text.rich(
                        TextSpan(
                          text: 'New Password ',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          children: [
                            TextSpan(
                              text: '*',
                              style: TextStyle(color: AppColors.requiredAsterisk, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'This field is required';
                      if (v.length < 8) return 'Password must be at least 8 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: confirmPassCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      label: Text.rich(
                        TextSpan(
                          text: 'Confirm New Password ',
                          style: TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          children: [
                            TextSpan(
                              text: '*',
                              style: TextStyle(color: AppColors.requiredAsterisk, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      border: OutlineInputBorder(),
                      errorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.2)),
                      focusedErrorBorder: OutlineInputBorder(borderSide: BorderSide(color: AppColors.requiredAsterisk, width: 1.4)),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'This field is required';
                      if (v != newPassCtrl.text) return 'Passwords do not match';
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
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
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

                final isOnline = await _checkOnline();
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
                      const SnackBar(
                        content: Text('Password changed successfully.'),
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

                // If offline
                await settings.setPendingPasswordChange({
                  'current_password': currentPass,
                  'new_password': newPass,
                }, userId: userId);
                nav.pop();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Password update queued. Will sync when connected.'),
                    backgroundColor: AppColors.statAmber,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              child: isSaving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Update Password'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUploadProfilePicture() async {
    final settings = SettingsRepository();
    final userId = settings.authUser?['user_id']?.toString();
    final token = settings.authToken;
    if (userId == null || userId.isEmpty) return;

    final pickedFile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
      maxWidth: 512,
      maxHeight: 512,
    );
    if (pickedFile == null) return;

    // Preview / Crop Confirmation step
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Profile Photo Preview', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Preview of your new profile photo (circular crop):',
              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
            ),
            const SizedBox(height: 16),
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primaryGreen, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipOval(
                child: Image.file(
                  File(pickedFile.path),
                  width: 140,
                  height: 140,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'This photo will be saved on your device and synced with the central server.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Apply & Save'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    // Copy image to persistent application documents storage so it survives app cache purges
    String persistentPath = pickedFile.path;
    try {
      final appDocDir = await getApplicationDocumentsDirectory();
      final profileDir = Directory('${appDocDir.path}/profile_photos');
      if (!profileDir.existsSync()) {
        await profileDir.create(recursive: true);
      }
      final ext = pickedFile.path.split('.').last.toLowerCase();
      persistentPath = '${profileDir.path}/user_${userId}_avatar.$ext';
      await File(pickedFile.path).copy(persistentPath);
    } catch (e) {
      debugPrint('Failed to copy to persistent folder, using picked path: $e');
      persistentPath = pickedFile.path;
    }

    // Save local path immediately per user
    await settings.setLocalProfilePicturePath(persistentPath, userId: userId);
    await settings.setPendingProfilePicturePath(persistentPath, userId: userId);
    final updatedUser = Map<String, dynamic>.from(settings.authUser ?? {});
    updatedUser['profile_picture'] = persistentPath;
    await settings.setAuthUser(updatedUser);
    AppDataBus.notifyChanged();
    if (mounted) {
      setState(() => _uploadError = null);
    }

    // Check connectivity: only show offline wording when genuinely offline
    final isOnline = await _checkOnline();
    if (!isOnline) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Photo saved to device. Will sync to server when connected.'),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2, milliseconds: 500),
          ),
        );
      }
      return;
    }

    // If online, immediately upload to server
    setState(() {
      _isUploadingPicture = true;
      _uploadError = null;
    });

    try {
      final uploaded = await AuthApi.uploadProfilePicture(
        userId: userId,
        filePath: persistentPath,
        token: token ?? '',
      );

      if (uploaded != null && uploaded['profile_picture'] != null) {
        final serverUrl = uploaded['profile_picture'].toString();
        final serverUser = Map<String, dynamic>.from(settings.authUser ?? {});
        serverUser['profile_picture'] = serverUrl;
        await settings.setAuthUser(serverUser);
        await settings.setPendingProfilePicturePath(null, userId: userId);
        await settings.refreshProfileFromServer();
        AppDataBus.notifyChanged();
        if (!mounted) return;
        ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile photo uploaded and saved to server.'),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2, milliseconds: 500),
          ),
        );
      } else {
        throw Exception('Server did not return updated photo URL.');
      }
    } catch (error) {
      debugPrint('Profile picture upload exception: $error');
      if (mounted) {
        setState(() => _uploadError = error.toString());
        ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $error. Photo is saved on device and will sync later.'),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPicture = false);
      }
    }
  }

  Widget _buildProfileAvatar(String? profileImageUrl, String resolvedName) {
    final settings = SettingsRepository();
    final userId = settings.authUser?['user_id']?.toString() ?? '';
    final localPath = settings.getLocalProfilePicturePath(userId);

    final imagePath = (profileImageUrl != null && profileImageUrl.trim().isNotEmpty)
        ? profileImageUrl.trim()
        : (localPath != null && localPath.trim().isNotEmpty ? localPath.trim() : null);

    final initials = resolvedName.isNotEmpty ? resolvedName[0].toUpperCase() : 'B';
    final fallback = CircleAvatar(
      radius: 36,
      backgroundColor: Colors.white,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: AppColors.darkGreen,
        ),
      ),
    );

    if (imagePath == null || imagePath.isEmpty) {
      return fallback;
    }

    final trimmed = imagePath;
    final isLocalPath = trimmed.contains('profile_photos') ||
        trimmed.startsWith('/data/') ||
        trimmed.startsWith('/storage/') ||
        trimmed.startsWith('/var/') ||
        trimmed.startsWith('file://') ||
        (Platform.isWindows && (trimmed.contains(r':\') || trimmed.contains(':/'))) ||
        (trimmed.startsWith('/') &&
            !trimmed.startsWith('/uploads/') &&
            !trimmed.startsWith('/profile-pictures/'));

    if (isLocalPath) {
      final cleanPath = trimmed.replaceFirst(RegExp(r'^file://'), '');
      final file = File(cleanPath);
      if (file.existsSync()) {
        return ClipOval(
          child: Image.file(
            file,
            width: 72,
            height: 72,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => fallback,
          ),
        );
      }
    }

    if (trimmed.startsWith('data:')) {
      try {
        final commaIdx = trimmed.indexOf(',');
        if (commaIdx != -1) {
          final bytes = base64Decode(trimmed.substring(commaIdx + 1));
          return ClipOval(
            child: Image.memory(
              bytes,
              width: 72,
              height: 72,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            ),
          );
        }
      } catch (e) {
        debugPrint('[UserProfileScreen] Base64 avatar decode error: $e');
      }
    }

    final normalizedUrl = (() {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        final relative = trimmed.replaceFirst(RegExp(r'^/+'), '');
        if (relative.startsWith('uploads/')) return 'https://appscale-1.onrender.com/$relative';
        if (relative.startsWith('profile-pictures/')) return 'https://appscale-1.onrender.com/uploads/$relative';
        return trimmed;
      }
      if (trimmed.startsWith('uploads/')) return 'https://appscale-1.onrender.com/$trimmed';
      if (trimmed.startsWith('profile-pictures/')) return 'https://appscale-1.onrender.com/uploads/$trimmed';
      return trimmed;
    })();

    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      return ClipOval(
        child: Image.network(
          normalizedUrl,
          width: 72,
          height: 72,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => fallback,
        ),
      );
    }

    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    final settings = SettingsRepository();
    final resolvedName = widget.bnsName.isNotEmpty
        ? widget.bnsName
        : AppUserIdentity.resolveDisplayName(settings.authUser);
    final resolvedBarangay = widget.barangay.isNotEmpty
        ? widget.barangay
        : AppUserIdentity.resolveBarangay(settings.authUser);
    final profileImageUrl = settings.authUser?['profile_picture']?.toString();
    final barangayLabel = resolvedBarangay.trim().isEmpty
        ? 'Barangay Tiguion'
        : resolvedBarangay.toLowerCase().startsWith('barangay ')
        ? resolvedBarangay
        : 'Barangay $resolvedBarangay';
    final totalChildren = ChildRepository()
        .getAll()
        .where((c) => c.isActive)
        .length;
    final totalMothers = MotherRepository()
        .getAll()
        .where((m) => m.isActive)
        .length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Worker Profile'),
        backgroundColor: AppColors.darkGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          // Profile Header Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.xl),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.darkGreen, AppColors.primaryGreen],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.darkGreen.withValues(alpha: 0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              children: [
                GestureDetector(
                  onTap: _isUploadingPicture
                      ? null
                      : _pickAndUploadProfilePicture,
                  child: Stack(
                    children: [
                      _buildProfileAvatar(profileImageUrl, resolvedName),
                      if (_isUploadingPicture)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.45),
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 28,
                                height: 28,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: _isUploadingPicture
                                ? AppColors.textMuted
                                : AppColors.primaryGreen,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: const Icon(
                            Icons.camera_alt,
                            color: Colors.white,
                            size: 14,
                          ),
                        ),
                      ),
                      if (!_isUploadingPicture && (settings.pendingProfilePicturePath != null || _uploadError != null))
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: _uploadError != null ? AppColors.statRed : AppColors.statAmber,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 1.5),
                            ),
                            child: Icon(
                              _uploadError != null ? Icons.warning_rounded : Icons.cloud_upload,
                              color: Colors.white,
                              size: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  resolvedName,
                  style: AppTextStyles.h1.copyWith(
                    color: Colors.white,
                    fontSize: 22,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Barangay Nutrition Scholar (BNS)',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '$barangayLabel • Rural Health Unit',
                  style: AppTextStyles.body.copyWith(
                    color: Colors.white70,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // Quick Stats
          Row(
            children: [
              Expanded(
                child: _buildStatTile(
                  'Active Children',
                  '$totalChildren',
                  Icons.child_care,
                  AppColors.primaryGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatTile(
                  'Active Mothers',
                  '$totalMothers',
                  Icons.pregnant_woman,
                  const Color(0xFFD23369),
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.md),

          // Profile Actions
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text(
                    'Edit Profile',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  onPressed: _showEditProfileDialog,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.darkGreen,
                    side: const BorderSide(color: AppColors.darkGreen),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: const Icon(Icons.lock_outline, size: 16),
                  label: const Text(
                    'Change Password',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  onPressed: _showChangePasswordDialog,
                ),
              ),
            ],
          ),

          if (settings.pendingProfileUpdate != null || settings.pendingPasswordChange != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.cloud_upload_outlined, color: Color(0xFFD97706), size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Profile changes saved locally. Will sync when online.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          // Official Information
          Text(
            'Assignment & Station',
            style: AppTextStyles.h2.copyWith(fontSize: 16),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                _buildInfoRow(
                  Icons.place_outlined,
                  'Assigned Barangay',
                  barangayLabel,
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.local_hospital_outlined,
                  'Health Station',
                  'Tiguion Barangay Health Station',
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.phone_outlined,
                  'Contact Number',
                  settings.authUser?['contact_number'] != null &&
                          settings.authUser!['contact_number'].toString().trim().isNotEmpty
                      ? settings.authUser!['contact_number'].toString().trim()
                      : 'Not set',
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.badge_outlined,
                  'Accreditation',
                  'DOH / NNC Certified BNS',
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // System Info
          Text(
            'System Information',
            style: AppTextStyles.h2.copyWith(fontSize: 16),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                _buildInfoRow(
                  Icons.offline_bolt_outlined,
                  'Storage Mode',
                  'Offline-First (Encrypted device storage)',
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.info_outline,
                  'App Version',
                  'AppScale v3.2.0 (OPT Plus Standards)',
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.cloud_sync_outlined,
                  'Sync Protocol',
                  'Web Portal / RHU Connected',
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.statRed,
              side: const BorderSide(color: AppColors.statRed),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text(
              'Log Out',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            onPressed: () async {
              final pendingCount = ChildRepository().pendingCount +
                  MotherRepository().pendingCount +
                  MeasurementRepository().pendingCount +
                  ReferralRepository().pendingCount +
                  (SettingsRepository().pendingProfilePicturePath != null ? 1 : 0);

              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  title: const Row(
                    children: [
                      Icon(Icons.logout, color: Colors.red, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Log Out',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
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
                              const Icon(Icons.warning_amber_rounded,
                                  color: Color(0xFFD97706), size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '$pendingCount record(s) not yet synced! They will remain on this phone but will not show on the web portal until synced.',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF92400E),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const Text(
                        'Are you sure you want to log out? You will need to sign in again to access your account.',
                        style: TextStyle(fontSize: 14, color: Colors.black87),
                      ),
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text(
                        'Log Out',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              );
              if (confirmed != true) return;
              final settings = SettingsRepository();
              await settings.clearSession();
              if (!context.mounted) return;
              Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (_) => false,
              );
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildStatTile(String title, String val, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                val,
                style: AppTextStyles.h1.copyWith(fontSize: 20, color: color),
              ),
              Text(title, style: AppTextStyles.caption.copyWith(fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 12,
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.darkGreen),
          const SizedBox(width: 12),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontSize: 12,
              color: AppColors.textMuted,
            ),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppTextStyles.body.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
