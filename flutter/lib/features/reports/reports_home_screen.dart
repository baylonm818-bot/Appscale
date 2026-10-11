import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_dropdown_field.dart';
import '../../shared/widgets/form_section_card.dart';
import 'report_preview_screen.dart';
import 'report_signatories_screen.dart';
import 'report_types.dart';
import 'sync_status_screen.dart';

import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/remote/sync_service.dart';

class ReportsHomeScreen extends StatefulWidget {
  const ReportsHomeScreen({super.key});

  @override
  State<ReportsHomeScreen> createState() => _ReportsHomeScreenState();
}

class _ReportsHomeScreenState extends State<ReportsHomeScreen> {
  final _childRepo = ChildRepository();
  final _measurementRepo = MeasurementRepository();
  final _motherRepo = MotherRepository();
  final _settings = SettingsRepository();

  String _selectedCategory = 'Consolidation reports';
  ReportTypeInfo _selectedReport = ReportTypes.consolidation0to23;

  int get _pendingRecordsCount =>
      _childRepo.pendingCount +
      _measurementRepo.pendingCount +
      _motherRepo.pendingCount;

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  Future<void> _handleRefresh() async {
    final token = _settings.authToken ?? '';
    await SyncService.instance.pullFromServer(
      barangay: _currentBarangay,
      token: token,
    );
    AppDataBus.notifyChanged();
  }

  final List<String> _categories = [
    'Consolidation reports',
    'Individual records',
    'Masterlists',
  ];

  List<ReportTypeInfo> get _currentReportOptions {
    switch (_selectedCategory) {
      case 'Consolidation reports':
        return ReportTypes.consolidationTypes;
      case 'Individual records':
        return ReportTypes.recordTypes;
      case 'Masterlists':
        return ReportTypes.masterlistTypes;
      default:
        return ReportTypes.consolidationTypes;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, _, _) {
        return Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.darkGreen, AppColors.primaryGreen],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Reports & Analytics',
                    style: AppTextStyles.h1.copyWith(
                      color: Colors.white,
                      fontSize: 22,
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.push(
                      context,
                      appPageRoute(const SyncStatusScreen()),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.cloud_sync, color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _handleRefresh,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_pendingRecordsCount > 0)
                        Container(
                          margin: const EdgeInsets.only(bottom: AppSpacing.md),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF3E0),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFFB74D)),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.cloud_upload_outlined,
                                color: Color(0xFFE65100),
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  '$_pendingRecordsCount ${_pendingRecordsCount == 1 ? "record" : "records"} not yet synced',
                                  style: const TextStyle(
                                    color: Color(0xFFBF360C),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              TextButton(
                                style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                ),
                                onPressed: () => Navigator.push(
                                  context,
                                  appPageRoute(const SyncStatusScreen()),
                                ),
                                child: const Text(
                                  'Sync Now',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFE65100),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      FormSectionCard(
                        title: 'Report Configuration',
                        children: [
                          AppDropdownField(
                            label: 'Report Category',
                            value: _selectedCategory,
                            options: _categories,
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedCategory = val;
                                  _selectedReport = _currentReportOptions.first;
                                });
                              }
                            },
                          ),
                          const SizedBox(height: 16),
                          AppDropdownField(
                            label: 'Specific Report Form',
                            value: _selectedReport.title,
                            options: _currentReportOptions.map((e) => e.title).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedReport = _currentReportOptions.firstWhere((e) => e.title == val);
                                });
                              }
                            },
                          ),
                          const SizedBox(height: 24),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.lightGreenBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.info_outline, color: AppColors.primaryGreen, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'The generated report includes all local records from device storage, including newly entered records that are not yet synced to the cloud.',
                                    style: AppTextStyles.caption.copyWith(color: AppColors.textPrimary),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                
                const SizedBox(height: AppSpacing.xl),
                
                AppButton(
                  label: 'Generate & Preview Report',
                  onPressed: () => Navigator.push(
                    context,
                    appPageRoute(ReportPreviewScreen(reportType: _selectedReport)),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.push(
                      context,
                      appPageRoute(const ReportSignatoriesScreen()),
                    ),
                    icon: const Icon(Icons.draw_outlined, size: 20),
                    label: const Text(
                      'Edit Signatories',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.darkGreen,
                      side: const BorderSide(color: AppColors.primaryGreen),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
      ),
    ],
  );
      },
    );
  }
}
