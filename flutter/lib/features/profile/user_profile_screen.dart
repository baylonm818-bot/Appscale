import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../shared/utils/app_user_identity.dart';
import '../auth/login_screen.dart';

class UserProfileScreen extends StatelessWidget {
  final String bnsName;
  final String barangay;

  const UserProfileScreen({
    super.key,
    this.bnsName = '',
    this.barangay = '',
  });

  @override
  Widget build(BuildContext context) {
    final settings = SettingsRepository();
    final resolvedName = bnsName.isNotEmpty
        ? bnsName
        : AppUserIdentity.resolveDisplayName(settings.authUser);
    final resolvedBarangay = barangay.isNotEmpty
        ? barangay
        : AppUserIdentity.resolveBarangay(settings.authUser);
    final profileImageUrl = settings.authUser?['profile_picture']?.toString();
    final normalizedProfileImageUrl = profileImageUrl == null || profileImageUrl.trim().isEmpty
        ? null
        : profileImageUrl.trim().startsWith('http') || profileImageUrl.trim().startsWith('data:')
            ? profileImageUrl.trim()
            : profileImageUrl.trim().startsWith('/')
                ? 'https://appscale-1.onrender.com${profileImageUrl.trim()}'
                : profileImageUrl.trim().startsWith('uploads/')
                    ? 'https://appscale-1.onrender.com/${profileImageUrl.trim()}'
                    : profileImageUrl.trim();
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
                  onTap: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Select Profile Icon / Badge'),
                        content: Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          alignment: WrapAlignment.center,
                          children: ['👩‍⚕️', '🩺', '🌿', '🏥', '🍎', '📋', '👶', '❤️'].map((badge) {
                            return InkWell(
                              onTap: () {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Profile badge updated to $badge')),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.lightGreenBg,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(badge, style: const TextStyle(fontSize: 28)),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    );
                  },
                  child: Stack(
                    children: [
                      normalizedProfileImageUrl != null
                          ? ClipOval(
                              child: Image.network(
                                normalizedProfileImageUrl,
                                width: 72,
                                height: 72,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => CircleAvatar(
                                  radius: 36,
                                  backgroundColor: Colors.white,
                                  child: Text(
                                    resolvedName.isNotEmpty ? resolvedName[0].toUpperCase() : 'B',
                                    style: const TextStyle(
                                      fontSize: 32,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.darkGreen,
                                    ),
                                  ),
                                ),
                              ),
                            )
                          : CircleAvatar(
                              radius: 36,
                              backgroundColor: Colors.white,
                              child: Text(
                                resolvedName.isNotEmpty ? resolvedName[0].toUpperCase() : 'B',
                                style: const TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.darkGreen,
                                ),
                              ),
                            ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: AppColors.primaryGreen,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt, color: Colors.white, size: 14),
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
                  'Offline-First (Encrypted Hive)',
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
              'Log Out / Switch Account',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  title: const Row(
                    children: [
                      Icon(Icons.logout, color: Colors.red, size: 22),
                      SizedBox(width: 8),
                      Text('Log Out', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  content: const Text(
                    'Are you sure you want to log out? You will need to sign in again to access your account.',
                    style: TextStyle(fontSize: 14, color: Colors.black87),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.w700)),
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
