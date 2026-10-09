import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../shared/utils/app_user_identity.dart';
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

    // Instantly save local picked path so user picture updates immediately
    final updatedUser = Map<String, dynamic>.from(settings.authUser ?? {});
    updatedUser['profile_picture'] = pickedFile.path;
    await settings.setAuthUser(updatedUser);
    await settings.setPendingProfilePicturePath(pickedFile.path);
    AppDataBus.notifyChanged();
    if (mounted) setState(() {});

    setState(() => _isUploadingPicture = true);

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse(
          'https://appscale-1.onrender.com/api/profile/$userId/picture',
        ),
      );
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.files.add(
        await http.MultipartFile.fromPath('profile_picture', pickedFile.path),
      );

      final streamedResponse = await request.send().timeout(const Duration(seconds: 15));
      final responseBody = await streamedResponse.stream.bytesToString();
      if (streamedResponse.statusCode >= 200 && streamedResponse.statusCode < 300) {
        final parsed = responseBody.isEmpty
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(jsonDecode(responseBody) as Map);
        final uploadedPath = parsed['profile_picture'];
        if (uploadedPath != null && uploadedPath.toString().trim().isNotEmpty) {
          final serverUser = Map<String, dynamic>.from(settings.authUser ?? {});
          serverUser['profile_picture'] = uploadedPath.toString();
          await settings.setAuthUser(serverUser);
          await settings.setPendingProfilePicturePath(null);
          AppDataBus.notifyChanged();
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile photo updated and saved to server.'),
            backgroundColor: AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Photo saved to device. Will sync to server when connected.'),
            backgroundColor: AppColors.statAmber,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (error) {
      debugPrint('Profile picture upload exception: $error');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Photo saved to device. Will sync to server when connected.'),
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

    if (profileImageUrl == null || profileImageUrl.trim().isEmpty) {
      return fallback;
    }

    final trimmed = profileImageUrl.trim();
    final isLocalPath = trimmed.startsWith('/data/') ||
        trimmed.startsWith('/storage/') ||
        trimmed.startsWith('/var/') ||
        trimmed.startsWith('file://') ||
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

    final normalizedUrl = (() {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
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
                  '+63 912 345 6789',
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
                  ReferralRepository().pendingCount;

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
