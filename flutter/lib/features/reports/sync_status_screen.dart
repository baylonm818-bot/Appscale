import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/referral_repository.dart';
import '../../data/local/hive_boxes.dart';


class SyncStatusScreen extends StatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  State<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends State<SyncStatusScreen> {
  final _children = ChildRepository();
  final _mothers = MotherRepository();
  final _settings = SettingsRepository();
  bool _isSyncing = false;
  String? _message;
  String _currentBarangay = '';

  @override
  void initState() {
    super.initState();
    final user = _settings.authUser;
    if (user != null && user['barangay'] != null) {
      _currentBarangay = user['barangay'].toString();
    }
  }

  Future<void> _syncNow() async {
    setState(() { _isSyncing = true; _message = null; });
    await Future.wait([_children.syncPending(), _mothers.syncPending()]);
    if (!mounted) return;
    setState(() {
      _isSyncing = false;
      _message = _children.pendingCount + _mothers.pendingCount == 0
          ? 'All child and mother records are synced.'
          : 'Some records remain pending. Check your connection and try again.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final current = _currentBarangay.isNotEmpty ? _currentBarangay : 'Unknown';
    final childCount = _children.getByBarangay(current).length;
    final motherCount = _mothers.getAll().where((m) => m.barangay == current).length;
    final referralCount = ReferralRepository().getForBarangay(current).length;
    final pendingCount = _children.pendingCount + _mothers.pendingCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          Container(
            width: double.infinity, color: AppColors.darkGreen,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.lg),
            child: Row(children: [
              InkWell(onTap: () => Navigator.pop(context), child: const Icon(Icons.arrow_back, color: Colors.white)),
              const SizedBox(width: AppSpacing.sm),
              Text('Sync Status', style: AppTextStyles.h2.copyWith(color: Colors.white)),
            ]),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: AppColors.statAmber.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.statAmber.withValues(alpha: 0.4))),
                  child: Row(children: [
                    Icon(pendingCount == 0 ? Icons.cloud_done_outlined : Icons.cloud_upload_outlined, color: AppColors.primaryGreen, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(pendingCount == 0 ? 'Hive records are synced with the central database.' : '$pendingCount local records are waiting to sync.', style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.darkGreen))),
                  ]),
                ),
                if (_message != null) Padding(padding: const EdgeInsets.only(top: AppSpacing.sm), child: Text(_message!, style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textSecondary))),
                const SizedBox(height: AppSpacing.lg),
                Text('Local records', style: AppTextStyles.h2.copyWith(fontSize: 15)),
                const SizedBox(height: AppSpacing.sm),
                _row('Children', childCount),
                _row('Mothers', motherCount),
                _row('Referrals', referralCount),
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity, height: 52,
                  child: OutlinedButton.icon(
                    onPressed: _isSyncing ? null : _syncNow,
                    icon: _isSyncing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.sync, size: 18),
                    label: Text(_isSyncing ? 'Syncing...' : 'Sync Now'),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.border), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _row(String label, int count) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: AppTextStyles.label.copyWith(fontSize: 14)),
        Row(children: [
          Text('$count on device', style: AppTextStyles.body.copyWith(fontSize: 12)),
          const SizedBox(width: 8),
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(20)), child: Text('0 synced', style: AppTextStyles.body.copyWith(fontSize: 10, color: AppColors.textMuted))),
        ]),
      ]),
    );
  }
}