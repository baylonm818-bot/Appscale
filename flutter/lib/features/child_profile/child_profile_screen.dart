import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/measurement_repository.dart';
import '../../data/models/child.dart';
import '../../data/remote/beneficiary_api.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/deactivate_beneficiary_sheet.dart';
import '../beneficiary/add_child_screen.dart';
import '../referrals/create_referral_screen.dart';
import 'add_measurement_screen.dart';
import 'widgets/charts_tab.dart';
import 'widgets/child_profile_header.dart';
import 'widgets/history_tab.dart';
import 'widgets/info_tab.dart';
import 'widgets/profile_tab_bar.dart';
import 'widgets/child_programs_tab.dart';

class ChildProfileScreen extends StatefulWidget {
  final Child child;
  const ChildProfileScreen({super.key, required this.child});

  @override
  State<ChildProfileScreen> createState() => _ChildProfileScreenState();
}

class _ChildProfileScreenState extends State<ChildProfileScreen> {
  int _tabIndex = 0;
  late final String _childId = widget.child.id;

  Future<void> _handleEdit(Child current) async {
    if (current.isTransferPending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hindi maaaring i-edit ang record habang pending ang transfer sync.',
          ),
        ),
      );
      return;
    }
    await Navigator.push<Child>(
      context,
      appPageRoute(AddChildScreen(existingChild: current)),
    );
  }

  Future<void> _handleNoteDisability(Child current) async {
    final hasCurrentDisability = current.disability.isNotEmpty &&
        current.disability.toLowerCase() != 'none specified' &&
        current.disability.toLowerCase() != 'none' &&
        current.disability.toLowerCase() != 'no';

    bool isDisabilityChecked = hasCurrentDisability;
    final textController = TextEditingController(
      text: hasCurrentDisability ? current.disability : '',
    );

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.accessibility_new,
                      color: AppColors.primaryGreen,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Disability Note',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text(
                      'Child has a disability / condition',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      isDisabilityChecked ? 'Checked: Specify below' : 'Auto: No disability',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                    value: isDisabilityChecked,
                    activeColor: AppColors.primaryGreen,
                    onChanged: (val) {
                      setDialogState(() {
                        isDisabilityChecked = val ?? false;
                        if (!isDisabilityChecked) {
                          textController.clear();
                        }
                      });
                    },
                  ),
                  if (isDisabilityChecked) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: textController,
                      autofocus: true,
                      decoration: InputDecoration(
                        labelText: 'Specify Disability Details',
                        hintText: 'e.g. Visual impairment, Cerebral palsy, Autism...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        isDense: true,
                      ),
                      maxLines: 2,
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                  ),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    if (saved == true) {
      final updatedDisability = (!isDisabilityChecked || textController.text.trim().isEmpty)
          ? 'None specified'
          : textController.text.trim();

      await ChildRepository().update(
        current.copyWith(disability: updatedDisability),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isDisabilityChecked
                  ? 'Disability note updated: $updatedDisability'
                  : 'Disability set to None.',
            ),
            backgroundColor: AppColors.primaryGreen,
          ),
        );
      }
    }
  }

  Future<void> _handleMeasure(Child current) async {
    if (current.isTransferPending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hindi maaaring magdagdag ng measurement habang pending ang transfer sync.',
          ),
        ),
      );
      return;
    }
    await Navigator.push<Child>(
      context,
      appPageRoute(AddMeasurementScreen(child: current)),
    );
  }

  Future<void> _handleCreateReferral(Child current) async {
    final rawMeasurements = MeasurementRepository().getForChild(current.id);
    final validMeasurements = rawMeasurements.where((m) => m.isPlausible).toList();
    String reason = 'Child nutrition referral';
    if (validMeasurements.isNotEmpty) {
      final latest = validMeasurements.first;
      final parts = <String>[];
      if (latest.effectiveWastingStatus == 'SAM') {
        parts.add('Severely Wasted (SAM)');
      } else if (latest.effectiveWastingStatus == 'MAM') {
        parts.add('Moderately Wasted (MAM)');
      }
      if (latest.heightForAgeStatus == 'Severely Stunted') {
        parts.add('Severely Stunted');
      }
      if (latest.weightForAgeStatus == 'Severely Underweight') {
        parts.add('Severely Underweight');
      }
      if (parts.isNotEmpty) {
        reason = parts.join(' · ');
      }
    } else if (current.wastingStatus == 'SAM' ||
        current.wastingStatus == 'MAM' ||
        current.nutritionStatus == 'Severely Underweight') {
      reason =
          'Nutritional concern: ${current.nutritionStatus} · ${current.wastingStatus}';
    }

    await Navigator.push(
      context,
      appPageRoute(
        CreateReferralScreen(
          prefillBeneficiaryType: 'child',
          prefillBeneficiaryId: current.id,
          prefillBeneficiaryName: current.fullName,
          prefillBeneficiarySubtitle:
              '${current.ageLabel} · ${current.formattedAddress}',
          prefillReason: reason,
        ),
      ),
    );
  }

  Future<void> _handleStatusAction(Child current) async {
    if (current.isTransferPending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Pending transfer pa ang record na ito. Hindi muna mababago ang status.',
          ),
        ),
      );
      return;
    }

    if (current.isActive) {
      final result = await DeactivateBeneficiarySheet.show(
        context,
        beneficiaryName: current.fullName,
        currentBarangay: current.barangay,
        isChild: true,
        hasLinkedBeneficiary: current.guardian.linkedMotherId != null &&
            current.guardian.linkedMotherId!.isNotEmpty,
      );
      if (result == null) return;

      if (result.isTransfer) {
        final targetBarangay = result.targetBarangay!;

        // 1. Duplicate guard check (Local Hive check + Remote API check)
        bool hasDuplicate = false;
        final localDuplicate = ChildRepository().getAll().any((c) =>
            c.id != current.id &&
            c.barangay.trim().toLowerCase() ==
                targetBarangay.trim().toLowerCase() &&
            c.fullName.trim().toLowerCase() ==
                current.fullName.trim().toLowerCase() &&
            c.birthDate.year == current.birthDate.year &&
            c.birthDate.month == current.birthDate.month &&
            c.birthDate.day == current.birthDate.day);

        if (localDuplicate) {
          hasDuplicate = true;
        } else {
          hasDuplicate = await BeneficiaryApi.checkDuplicate(
            entityType: 'child',
            targetBarangay: targetBarangay,
            fullName: current.fullName,
            birthDate: current.birthDate,
          );
        }

        if (hasDuplicate && mounted) {
          final proceed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Babala sa Duplicate'),
              content: Text(
                'May umiiral nang ${current.fullName} sa Barangay $targetBarangay. Ituloy pa rin?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Huwag Ituloy'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.statRed,
                  ),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Ituloy Pa Rin'),
                ),
              ],
            ),
          );
          if (proceed != true) return;
        }

        // 2. Confirmation dialog
        if (!mounted) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Kumpirmahin ang Paglipat'),
            content: Text(
              'Ilipat si ${current.fullName} sa Barangay $targetBarangay? Mawawala siya sa listahan ng barangay ninyo.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Kanselahin'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryGreen,
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Kumpirmahin'),
              ),
            ],
          ),
        );
        if (confirmed != true) return;

        // 3. Execute transfer
        await ChildRepository().transferChild(
          child: current,
          targetBarangay: targetBarangay,
          reason: result.reason,
          transferDate: result.date,
          alsoTransferLinked: result.alsoTransferLinked,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Nailipat na si ${current.fullName} sa Barangay $targetBarangay.',
              ),
            ),
          );
          Navigator.pop(context);
        }
      } else {
        await ChildRepository().update(
          current.copyWith(
            isActive: false,
            inactiveReason: result.reason,
            inactiveDate: result.date,
          ),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Inilipat si ${current.fullName} sa Inactive list (${result.reason}).',
              ),
            ),
          );
        }
      }
    } else {
      await ChildRepository().update(
        current.copyWith(
          isActive: true,
          inactiveReason: null,
          inactiveDate: null,
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ibinalik si ${current.fullName} sa Active list.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: AppDataBus.version,
      builder: (context, value, childWidget) {
        final child = ChildRepository().getAll().firstWhere(
          (c) => c.id == _childId,
          orElse: () => widget.child,
        );

        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.light,
            statusBarBrightness: Brightness.dark,
          ),
          child: Scaffold(
            backgroundColor: AppColors.background,
            body: SafeArea(
              child: Column(
                children: [
                  ChildProfileHeader(
                    child: child,
                    isActive: child.isActive,
                    onEditPressed: () => _handleEdit(child),
                    onStatusActionPressed: () => _handleStatusAction(child),
                    onMeasurePressed: () => _handleMeasure(child),
                    onReferralPressed: () => _handleCreateReferral(child),
                    onNoteDisabilityPressed: () => _handleNoteDisability(child),
                  ),
                if (child.isTransferPending)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    color: const Color(0xFFFFF3CD),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.sync_problem,
                          color: Color(0xFF856404),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Pending transfer sa Barangay ${child.pendingTargetBarangay ?? 'bagong barangay'}. Naghihintay ng koneksyon para mai-sync.',
                            style: const TextStyle(
                              color: Color(0xFF856404),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ProfileTabBar(
                  currentIndex: _tabIndex,
                  onChanged: (i) => setState(() => _tabIndex = i),
                ),
                Expanded(
                  child: IndexedStack(
                    index: _tabIndex,
                    children: [
                      InfoTab(child: child),
                      HistoryTab(childId: child.id, child: child),
                      ChartsTab(childId: child.id),
                      ChildProgramsTab(child: child),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
}

