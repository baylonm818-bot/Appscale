import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/constants/api_constants.dart';
import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/remote/auth_api.dart';
import '../../shared/utils/app_user_identity.dart';
import 'settings_screen.dart';

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

    // Preview / Confirmation step
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(AppStrings.t('photo_preview'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(AppStrings.t('crop_preview'), style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 12),
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primaryGreen, width: 3),
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
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppStrings.t('cancel'), style: const TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryGreen,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(AppStrings.t('upload_photo')),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    // Save image to persistent local storage
    String persistentPath = pickedFile.path;
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final photosDir = Directory('${appDir.path}/profile_photos');
      if (!photosDir.existsSync()) {
        photosDir.createSync(recursive: true);
      }
      final ext = pickedFile.path.contains('.') ? pickedFile.path.split('.').last : 'jpg';
      final savedFile = File('${photosDir.path}/user_${userId}_avatar.$ext');
      await File(pickedFile.path).copy(savedFile.path);
      persistentPath = savedFile.path;
    } catch (e) {
      debugPrint('Failed to save avatar locally: $e');
    }

    // Always update local cache first (Offline-first!)
    await settings.setPendingProfilePicturePath(persistentPath, userId: userId);
    final localUser = Map<String, dynamic>.from(settings.authUser ?? {});
    localUser['profile_picture'] = persistentPath;
    await settings.setAuthUser(localUser);
    AppDataBus.notifyChanged();

    final isOnline = await _checkOnline();
    if (!isOnline) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppStrings.t('photo_saved_locally')),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    // Online upload
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
          SnackBar(
            content: Text(AppStrings.t('photo_uploaded_server')),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
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
            content: Text(AppStrings.t('photo_upload_failed')),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
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

    final normalizedUrl = ApiConstants.resolveMediaUrl(trimmed);
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

  Widget _buildStatTile(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.primaryGreen),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = SettingsRepository();
    final liveDisplayName = AppUserIdentity.resolveDisplayName(settings.authUser);
    final resolvedName = liveDisplayName.isNotEmpty && liveDisplayName != 'Worker'
        ? liveDisplayName
        : (widget.bnsName.isNotEmpty ? widget.bnsName : (settings.authUser?['username']?.toString() ?? 'Worker'));
    final rawBarangay = widget.barangay.isNotEmpty
        ? widget.barangay
        : AppUserIdentity.resolveBarangay(settings.authUser);
    final resolvedBarangay = rawBarangay.trim();
    final profileImageUrl = settings.authUser?['profile_picture']?.toString();
    final barangayLabel = resolvedBarangay.isEmpty
        ? AppStrings.t('unassigned')
        : resolvedBarangay.toLowerCase().startsWith('barangay ')
            ? resolvedBarangay
            : 'Barangay $resolvedBarangay';

    // Health Station from API record or derived from barangay
    final rawHealthStation = settings.authUser?['health_station']?.toString().trim();
    final healthStation = (rawHealthStation != null && rawHealthStation.isNotEmpty)
        ? rawHealthStation
        : (resolvedBarangay.isNotEmpty
            ? (resolvedBarangay.toLowerCase().startsWith('barangay ')
                ? '$resolvedBarangay Health Station'
                : '$resolvedBarangay Barangay Health Station')
            : 'Rural Health Unit');

    // Counts from user record or local repository
    final dynamic serverChildren = settings.authUser?['active_children_count'];
    final dynamic serverMothers = settings.authUser?['active_mothers_count'];

    final int totalChildren = serverChildren is int
        ? serverChildren
        : (serverChildren != null ? int.tryParse('$serverChildren') : null) ??
            (resolvedBarangay.isNotEmpty
                ? ChildRepository().getByBarangay(resolvedBarangay).where((c) => c.isActive).length
                : ChildRepository().getAll().where((c) => c.isActive).length);

    final int totalMothers = serverMothers is int
        ? serverMothers
        : (serverMothers != null ? int.tryParse('$serverMothers') : null) ??
            (resolvedBarangay.isNotEmpty
                ? MotherRepository().getAll().where((m) => m.barangay.trim().toLowerCase() == resolvedBarangay.trim().toLowerCase() && m.isActive).length
                : MotherRepository().getAll().where((m) => m.isActive).length);

    final contactNumber = settings.authUser?['contact_number'] != null &&
            settings.authUser!['contact_number'].toString().trim().isNotEmpty
        ? settings.authUser!['contact_number'].toString().trim()
        : AppStrings.t('not_set');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(AppStrings.t('worker_profile')),
        backgroundColor: AppColors.darkGreen,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          fontFamily: 'Poppins',
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            tooltip: AppStrings.t('settings'),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          // ── Profile Header Card ──
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
                  onTap: _isUploadingPicture ? null : _pickAndUploadProfilePicture,
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
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
                            color: _isUploadingPicture ? AppColors.textMuted : AppColors.primaryGreen,
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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    AppStrings.t('bns_title'),
                    style: const TextStyle(
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

          // ── Quick Stats ──
          Row(
            children: [
              Expanded(
                child: _buildStatTile(
                  AppStrings.t('active_children'),
                  '$totalChildren',
                  Icons.child_care,
                  AppColors.primaryGreen,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatTile(
                  AppStrings.t('active_mothers'),
                  '$totalMothers',
                  Icons.pregnant_woman,
                  const Color(0xFFD23369),
                ),
              ),
            ],
          ),

          if (settings.pendingProfileUpdate != null || settings.pendingPasswordChange != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_upload_outlined, color: Color(0xFFD97706), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      AppStrings.t('changes_saved_offline'),
                      style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          // ── Official Information (Read-only / Admin controlled) ──
          Text(
            AppStrings.t('assignment_and_station'),
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
                  AppStrings.t('assigned_barangay'),
                  barangayLabel,
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.local_hospital_outlined,
                  AppStrings.t('health_station'),
                  healthStation,
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.phone_outlined,
                  AppStrings.t('contact_number'),
                  contactNumber,
                ),
                const Divider(height: 1, color: AppColors.border),
                _buildInfoRow(
                  Icons.badge_outlined,
                  AppStrings.t('accreditation'),
                  AppStrings.t('accreditation_val'),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // ── Quick Settings Shortcut ──
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryGreen,
              side: const BorderSide(color: AppColors.primaryGreen, width: 1.2),
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.settings_outlined, size: 18),
            label: Text(
              AppStrings.t('settings'),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
