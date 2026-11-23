import 'package:flutter/material.dart';

import '../../core/localization/app_strings.dart';
import '../../core/services/app_update_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/hive_boxes.dart';
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
      final updateInfo = await AppUpdateService.checkForUpdate();
      if (!mounted) return;
      if (updateInfo != null && updateInfo.hasUpdate) {
        await AppUpdateService.showUpdateDialog(context, updateInfo, isManualCheck: true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              updateInfo == null
                  ? AppStrings.t('cannot_connect_update')
                  : AppStrings.t('up_to_date'),
            ),
            backgroundColor: updateInfo == null ? AppColors.statAmber : AppColors.primaryGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
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
    final settings = SettingsRepository();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(AppStrings.t('settings_title')),
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
          _buildSectionHeader(AppStrings.t('account_and_profile')),
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
                        child: Text(
                          AppStrings.t('edit_profile'),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
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
                              AppStrings.t('change_password'),
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              AppStrings.t('change_password_sub'),
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
          _buildSectionHeader(AppStrings.t('preferences')),
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
                              AppStrings.t('language'),
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              settings.language == 'tl'
                                  ? AppStrings.t('language_tl')
                                  : AppStrings.t('language_en'),
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
                      selected: {settings.language},
                      onSelectionChanged: (newSelection) async {
                        final chosen = newSelection.first;
                        await settings.setLanguage(chosen);
                        AppDataBus.notifyChanged();
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
              const Divider(height: 1, color: AppColors.border),

              // Age Format with Days toggle
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.cake_outlined, size: 20, color: AppColors.primaryGreen),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppStrings.t('age_format_days'),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            AppStrings.t('age_format_days_sub'),
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: settings.ageFormatDays,
                      activeThumbColor: AppColors.primaryGreen,
                      onChanged: (val) async {
                        await settings.setAgeFormatDays(val);
                        AppDataBus.notifyChanged();
                        setState(() {});
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Section 3: App Update ──
          _buildSectionHeader(AppStrings.t('app_update')),
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
                            AppStrings.t('app_update'),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            '${AppStrings.t('installed_version')}: v${AppUpdateService.currentVersion}',
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
                              AppStrings.t('check_update'),
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Section 4: System Information (Read-only) ──
          _buildSectionHeader(AppStrings.t('system_information')),
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
                            AppStrings.t('storage_mode'),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            AppStrings.t('storage_mode_val'),
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
                            AppStrings.t('sync_protocol'),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          Text(
                            AppStrings.t('sync_protocol_val'),
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

          // ── Section 5: Logout ──
          const SizedBox(height: AppSpacing.md),
          _buildCard(
            children: [
              InkWell(
                onTap: () => showLogoutConfirmationDialog(context),
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.logout, size: 20, color: AppColors.statRed),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppStrings.t('logout'),
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.statRed),
                            ),
                            Text(
                              AppStrings.t('logout_sub'),
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 20, color: AppColors.statRed),
                    ],
                  ),
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
