import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/mother_repository.dart';
import '../../data/models/child.dart';
import '../../data/models/child_status_filter.dart';
import '../../data/models/mother.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/empty_state.dart';
import '../child_profile/child_profile_screen.dart';
import '../mother_profile/mother_profile_screen.dart';
import 'utils/child_status_meta.dart';
import 'utils/mother_status_meta.dart';
import 'widgets/child_list_tile.dart';
import 'widgets/masterlist_header.dart';
import 'widgets/masterlist_search_bar.dart';
import 'widgets/masterlist_tabs.dart';
import 'widgets/mother_list_tile.dart';
import 'widgets/status_filter_sheet.dart';

enum MasterlistSortOption {
  severity,
  name,
  age,
  purok,
}

class MasterlistScreen extends StatefulWidget {
  final MasterlistCategory initialCategory;
  const MasterlistScreen({
    super.key,
    this.initialCategory = MasterlistCategory.children,
  });

  @override
  State<MasterlistScreen> createState() => MasterlistScreenState();
}

class MasterlistScreenState extends State<MasterlistScreen> {
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _settings = SettingsRepository();

  String get _currentBarangay =>
      _settings.authUser?['barangay']?.toString() ?? 'Tiguion';

  late MasterlistCategory _category = widget.initialCategory;
  bool _showingActive = true;
  String _query = '';
  ChildStatusFilter _filter = const ChildStatusFilter();
  String _childFilterChip = 'All';
  String _motherFilterChip = 'All';
  MasterlistSortOption _sortOption = MasterlistSortOption.severity;

  void setCategory(MasterlistCategory category) {
    setState(() {
      _category = category;
      _query = '';
      _filter = const ChildStatusFilter();
      _childFilterChip = 'All';
      _motherFilterChip = 'All';
    });
  }

  void setCategoryAndFilter(MasterlistCategory category, {String? childChip, String? motherChip}) {
    setState(() {
      _category = category;
      _query = '';
      _filter = const ChildStatusFilter();
      if (childChip != null) _childFilterChip = childChip;
      if (motherChip != null) _motherFilterChip = motherChip;
    });
  }

  Future<void> _openFilter() async {
    final result = await StatusFilterSheet.show(context, _filter);
    if (result != null) setState(() => _filter = result);
  }

  void _openSortSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.dotInactive,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Sort by',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (_category == MasterlistCategory.children)
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _openFilter();
                        },
                        child: const Text(
                          'Advanced Filters',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryGreen,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                _buildSortTile(
                  title: 'Severity (Pinakamalala una)',
                  subtitle: 'Severe, At risk, Overweight/Obese, Normal',
                  option: MasterlistSortOption.severity,
                  icon: Icons.priority_high,
                ),
                _buildSortTile(
                  title: 'Name (A to Z)',
                  subtitle: 'Alphabetical order',
                  option: MasterlistSortOption.name,
                  icon: Icons.sort_by_alpha,
                ),
                _buildSortTile(
                  title: 'Age',
                  subtitle: _category == MasterlistCategory.children
                      ? 'Pinakabata muna'
                      : 'Edad ng ina',
                  option: MasterlistSortOption.age,
                  icon: Icons.cake_outlined,
                ),
                _buildSortTile(
                  title: 'Purok / Address',
                  subtitle: 'Ayon sa purok o tirahan',
                  option: MasterlistSortOption.purok,
                  icon: Icons.location_on_outlined,
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSortTile({
    required String title,
    required String subtitle,
    required MasterlistSortOption option,
    required IconData icon,
  }) {
    final isSelected = _sortOption == option;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.darkGreen.withValues(alpha: 0.1)
              : AppColors.background,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 18,
          color: isSelected ? AppColors.darkGreen : AppColors.textSecondary,
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
          color: isSelected ? AppColors.darkGreen : AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontSize: 12,
          color: AppColors.textMuted,
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check_circle, color: AppColors.darkGreen, size: 20)
          : null,
      onTap: () {
        setState(() => _sortOption = option);
        Navigator.pop(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, value, childWidget) {
        final childrenCount = _childRepo.getByBarangay(_currentBarangay).length;
        final mothersCount = _motherRepo
            .getAll()
            .where((m) => m.barangay == _currentBarangay)
            .length;

        return Column(
          children: [
            MasterlistHeader(
              selected: _category,
              childrenCount: childrenCount,
              mothersCount: mothersCount,
              onChanged: (c) => setState(() {
                _category = c;
                _query = '';
                _filter = const ChildStatusFilter();
                _childFilterChip = 'All';
                _motherFilterChip = 'All';
              }),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: MasterlistTabs(
                activeCount: _category == MasterlistCategory.children
                    ? _childRepo.countActive(_currentBarangay)
                    : _motherRepo.countActive(_currentBarangay),
                inactiveCount: _category == MasterlistCategory.children
                    ? _childRepo.countInactive(_currentBarangay)
                    : _motherRepo.countInactive(_currentBarangay),
                showingActive: _showingActive,
                onChanged: (v) => setState(() => _showingActive = v),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  120,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MasterlistSearchBar(
                      hint: _category == MasterlistCategory.children
                          ? 'Search children...'
                          : 'Search mothers...',
                      onChanged: (v) => setState(() => _query = v),
                      onFilterTap: _openSortSheet,
                    ),
                    const SizedBox(height: 10),
                    _buildFilterChips(),
                    const SizedBox(height: AppSpacing.md),
                    if (!_showingActive) ...[
                      Row(
                        children: [
                          Icon(
                            _category == MasterlistCategory.children
                                ? Icons.school_outlined
                                : Icons.no_food_outlined,
                            size: 14,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _category == MasterlistCategory.children
                                ? 'Children who completed monitoring'
                                : 'Mothers who stopped breastfeeding',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    if (_category == MasterlistCategory.children)
                      _buildChildrenList()
                    else
                      _buildMothersList(),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFilterChips() {
    if (_category == MasterlistCategory.children) {
      final baseChildren = _childRepo.getFiltered(
        barangay: _currentBarangay,
        activeOnly: _showingActive,
        query: _query,
        filter: _showingActive ? _filter : null,
      );

      final severeCount = baseChildren
          .where((c) =>
              ChildOverallStatus.fromChild(c).category ==
              ChildOverallCategory.severe)
          .length;
      final atRiskCount = baseChildren
          .where((c) =>
              ChildOverallStatus.fromChild(c).category ==
              ChildOverallCategory.atRisk)
          .length;
      final overweightCount = baseChildren
          .where((c) =>
              ChildOverallStatus.fromChild(c).category ==
              ChildOverallCategory.overweight)
          .length;
      final obeseCount = baseChildren
          .where((c) =>
              ChildOverallStatus.fromChild(c).category ==
              ChildOverallCategory.obese)
          .length;
      final normalCount = baseChildren
          .where((c) =>
              ChildOverallStatus.fromChild(c).category ==
              ChildOverallCategory.normal)
          .length;

      Widget wrapWithFade(Widget child) {
        return ShaderMask(
          shaderCallback: (Rect bounds) {
            return const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                Colors.purple,
                Colors.purple,
                Colors.purple,
                Colors.transparent,
              ],
              stops: [0.0, 0.05, 0.94, 1.0],
            ).createShader(bounds);
          },
          blendMode: BlendMode.dstIn,
          child: child,
        );
      }

      return wrapWithFade(
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              _buildChipItem(
                label: 'All',
                count: baseChildren.length,
                isSelected: _childFilterChip == 'All',
                onTap: () => setState(() => _childFilterChip = 'All'),
              ),
              _buildChipItem(
                label: 'Severe',
                count: severeCount,
                isSelected: _childFilterChip == 'Severe',
                dotColor: AppColors.statRed,
                onTap: () => setState(() => _childFilterChip = 'Severe'),
              ),
              _buildChipItem(
                label: 'At risk',
                count: atRiskCount,
                isSelected: _childFilterChip == 'At risk',
                dotColor: AppColors.statOrange,
                onTap: () => setState(() => _childFilterChip = 'At risk'),
              ),
              _buildChipItem(
                label: 'Overweight',
                count: overweightCount,
                isSelected: _childFilterChip == 'Overweight',
                dotColor: AppColors.statBlue,
                onTap: () => setState(() => _childFilterChip = 'Overweight'),
              ),
              _buildChipItem(
                label: 'Obese',
                count: obeseCount,
                isSelected: _childFilterChip == 'Obese',
                dotColor: AppColors.statPurple,
                onTap: () => setState(() => _childFilterChip = 'Obese'),
              ),
              _buildChipItem(
                label: 'Normal',
                count: normalCount,
                isSelected: _childFilterChip == 'Normal',
                dotColor: AppColors.primaryGreen,
                onTap: () => setState(() => _childFilterChip = 'Normal'),
              ),
            ],
          ),
        ),
      );
    } else {
      final baseMothers = _motherRepo.getFiltered(
        barangay: _currentBarangay,
        activeOnly: _showingActive,
        query: _query,
      );

      final atRiskCount = baseMothers
          .where((m) =>
              MotherStatusMeta.formatStatus(m.riskStatus) == 'At-risk')
          .length;
      final normalCount = baseMothers
          .where((m) =>
              MotherStatusMeta.formatStatus(m.riskStatus) == 'Normal')
          .length;
      final notVisitedCount = baseMothers
          .where((m) =>
              MotherStatusMeta.formatStatus(m.riskStatus) == 'Not visited')
          .length;

      Widget wrapWithFade(Widget child) {
        return ShaderMask(
          shaderCallback: (Rect bounds) {
            return const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                Colors.purple,
                Colors.purple,
                Colors.purple,
                Colors.transparent,
              ],
              stops: [0.0, 0.05, 0.94, 1.0],
            ).createShader(bounds);
          },
          blendMode: BlendMode.dstIn,
          child: child,
        );
      }

      return wrapWithFade(
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              _buildChipItem(
                label: 'All',
                count: baseMothers.length,
                isSelected: _motherFilterChip == 'All',
                onTap: () => setState(() => _motherFilterChip = 'All'),
              ),
              _buildChipItem(
                label: 'At-risk',
                count: atRiskCount,
                isSelected: _motherFilterChip == 'At-risk',
                dotColor: AppColors.statRed,
                onTap: () => setState(() => _motherFilterChip = 'At-risk'),
              ),
              _buildChipItem(
                label: 'Normal',
                count: normalCount,
                isSelected: _motherFilterChip == 'Normal',
                dotColor: AppColors.primaryGreen,
                onTap: () => setState(() => _motherFilterChip = 'Normal'),
              ),
              _buildChipItem(
                label: 'Not visited',
                count: notVisitedCount,
                isSelected: _motherFilterChip == 'Not visited',
                dotColor: AppColors.notWeighed,
                onTap: () => setState(() => _motherFilterChip = 'Not visited'),
              ),
            ],
          ),
        ),
      );
    }
  }

  Widget _buildChipItem({
    required String label,
    required int count,
    required bool isSelected,
    required VoidCallback onTap,
    Color? dotColor,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.darkGreen : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? AppColors.darkGreen : AppColors.border,
              width: 1.0,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dotColor != null && !isSelected) ...[
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
              ],
              Text(
                '$label ($count)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _sortChildren(List<Child> list) {
    switch (_sortOption) {
      case MasterlistSortOption.severity:
        list.sort((a, b) {
          final aRank = ChildOverallStatus.fromChild(a).severityRank;
          final bRank = ChildOverallStatus.fromChild(b).severityRank;
          if (aRank != bRank) return aRank.compareTo(bRank);
          return a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase());
        });
        break;
      case MasterlistSortOption.name:
        list.sort((a, b) =>
            a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));
        break;
      case MasterlistSortOption.age:
        list.sort((a, b) => b.birthDate.compareTo(a.birthDate));
        break;
      case MasterlistSortOption.purok:
        list.sort((a, b) {
          final cmp =
              a.address.toLowerCase().compareTo(b.address.toLowerCase());
          if (cmp != 0) return cmp;
          return a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase());
        });
        break;
    }
  }

  int _motherSeverityRank(Mother m) {
    final status = MotherStatusMeta.formatStatus(m.riskStatus);
    if (status == 'At-risk') return 0;
    if (status == 'Normal') return 1;
    return 2;
  }

  void _sortMothers(List<Mother> list) {
    switch (_sortOption) {
      case MasterlistSortOption.severity:
        list.sort((a, b) {
          final aRank = _motherSeverityRank(a);
          final bRank = _motherSeverityRank(b);
          if (aRank != bRank) return aRank.compareTo(bRank);
          return a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase());
        });
        break;
      case MasterlistSortOption.name:
        list.sort((a, b) =>
            a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));
        break;
      case MasterlistSortOption.age:
        list.sort((a, b) {
          if (a.birthDate == null && b.birthDate == null) return 0;
          if (a.birthDate == null) return 1;
          if (b.birthDate == null) return -1;
          return b.birthDate!.compareTo(a.birthDate!);
        });
        break;
      case MasterlistSortOption.purok:
        list.sort((a, b) {
          final cmp =
              a.address.toLowerCase().compareTo(b.address.toLowerCase());
          if (cmp != 0) return cmp;
          return a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase());
        });
        break;
    }
  }

  Widget _buildChildrenList() {
    var results = _childRepo.getFiltered(
      barangay: _currentBarangay,
      activeOnly: _showingActive,
      query: _query,
      filter: _showingActive ? _filter : null,
    );

    if (_childFilterChip != 'All') {
      results = results.where((c) {
        final overall = ChildOverallStatus.fromChild(c);
        switch (_childFilterChip) {
          case 'Severe':
            return overall.category == ChildOverallCategory.severe;
          case 'At risk':
            return overall.category == ChildOverallCategory.atRisk;
          case 'Overweight':
            return overall.category == ChildOverallCategory.overweight;
          case 'Obese':
            return overall.category == ChildOverallCategory.obese;
          case 'Overweight/Obese':
            return overall.category == ChildOverallCategory.overweight ||
                overall.category == ChildOverallCategory.obese;
          case 'Normal':
            return overall.category == ChildOverallCategory.normal;
          default:
            return true;
        }
      }).toList();
    }

    _sortChildren(results);

    if (results.isEmpty) {
      return EmptyState(
        icon: Icons.child_care_outlined,
        message: _showingActive
            ? 'No children match this search or filter yet.'
            : 'No graduated children yet.',
      );
    }

    return Column(
      children: results
          .map(
            (c) => ChildListTile(child: c, onTap: () => _openChildProfile(c)),
          )
          .toList(),
    );
  }

  Widget _buildMothersList() {
    var results = _motherRepo.getFiltered(
      barangay: _currentBarangay,
      activeOnly: _showingActive,
      query: _query,
    );

    if (_motherFilterChip != 'All') {
      results = results.where((m) {
        final formatted = MotherStatusMeta.formatStatus(m.riskStatus);
        return formatted == _motherFilterChip;
      }).toList();
    }

    _sortMothers(results);

    if (results.isEmpty) {
      return EmptyState(
        icon: Icons.pregnant_woman_outlined,
        message: _showingActive
            ? 'No mothers match this search yet.'
            : 'No inactive mothers yet.',
      );
    }

    return Column(
      children: results
          .map(
            (m) =>
                MotherListTile(mother: m, onTap: () => _openMotherProfile(m)),
          )
          .toList(),
    );
  }

  void _openChildProfile(Child child) {
    Navigator.push(context, appPageRoute(ChildProfileScreen(child: child)));
  }

  void _openMotherProfile(Mother mother) {
    Navigator.push(context, appPageRoute(MotherProfileScreen(mother: mother)));
  }
}
