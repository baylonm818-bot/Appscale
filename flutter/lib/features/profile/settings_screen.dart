import 'package:flutter/material.dart';

import '../../app_strings.dart';
import '../../core/services/app_update_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import 'profile_dialogs.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _checkingUpdate = false;

  void _onDataChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    AppDataBus.version.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    AppDataBus.version.removeListener(_onDataChanged);
    super.dispose();
  }

  Future<void> _handleManualUpdateCheck() async {
    setState(() => _checkingUpdate = true);
    try {
      final result = await AppUpdateService.checkForUpdateWithDetails();
      if (!mounted) return;

      switch (result.status) {
        case AppUpdateStatus.noInternet:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('update_no_internet'.tr),
              backgroundColor: AppColors.statRed,
              behavior: SnackBarBehavior.floating,
            ),
          );
          break;
        case AppUpdateStatus.serverUnreachable:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('update_server_unreachable'.tr),
              backgroundColor: AppColors.statAmber,
              behavior: SnackBarBehavior.floating,
            ),
          );
          break;
        case AppUpdateStatus.alreadyLatest:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('update_already_latest'.tr),
              backgroundColor: AppColors.primaryGreen,
              behavior: SnackBarBehavior.floating,
            ),
          );
          break;
        case AppUpdateStatus.updateAvailable:
          if (result.info != null) {
            await AppUpdateService.showUpdateDialog(context, result.info!, isManualCheck: true);
          }
          break;
      }
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm, top: AppSpacing.md),
      child: Text(
        title,
        style: AppTextStyles.h2.copyWith(fontSize: 15, color: AppColors.textPrimary),
      ),
    );
  }

  Widget _buildCard({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('settings_title'.tr),
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
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          // ── Section 1: Account & Profile ──
          _buildSectionHeader('account_and_profile'.tr),
          _buildCard(
            children: [
              // Edit Profile
              InkWell(
                onTap: () => showEditProfileDialog(context),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.person_outline, size: 20, color: AppColors.primaryGreen),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'edit_profile'.tr,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              'edit_profile_sub'.tr,
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 20, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ),
              const Divider(height: 1, color: AppColors.border),

              // Change Password
              InkWell(
                onTap: () => showChangePasswordDialog(context),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_outline, size: 20, color: AppColors.primaryGreen),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'change_password'.tr,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              'change_password_sub'.tr,
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 20, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // ── Section 2: Preferences ──
          _buildSectionHeader('preferences'.tr),
          _buildCard(
            children: [
              // Language Switcher (EN | TL)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.language, size: 20, color: AppColors.primaryGreen),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'language'.tr,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              'language_sub'.tr,
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'en', label: Text('EN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                        ButtonSegment(value: 'tl', label: Text('TL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                      ],
                      selected: {L.lang.value},
                      onSelectionChanged: (newSelection) async {
                        final chosen = newSelection.first;
                        await L.set(chosen);
                        setState(() {});
                      },
                      style: const ButtonStyle(
                        visualDensity: VisualDensity.compact,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Section 3: App ──
          _buildSectionHeader('app_section'.tr),
          _buildCard(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.system_update_rounded, size: 20, color: AppColors.primaryGreen),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'app_update'.tr,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            'update_installed_version'.trArgs({'version': AppUpdateService.currentVersion}),
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen.withValues(alpha: 0.12),
                        foregroundColor: AppColors.primaryGreen,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _checkingUpdate ? null : _handleManualUpdateCheck,
                      child: _checkingUpdate
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryGreen),
                            )
                          : Text(
                              'update_check_btn'.tr,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Section 4: System Information (Read-only) ──
          _buildSectionHeader('system_information'.tr),
          _buildCard(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.offline_bolt_outlined, size: 20, color: AppColors.primaryGreen),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'storage_mode'.tr,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            'storage_mode_val'.tr,
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.border),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_sync_outlined, size: 20, color: AppColors.primaryGreen),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'sync_protocol'.tr,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            'sync_protocol_val'.tr,
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
