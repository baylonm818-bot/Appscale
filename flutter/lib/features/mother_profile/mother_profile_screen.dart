import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../data/local/app_data_bus.dart';
import '../../data/local/mother_repository.dart';
import '../../data/local/mother_visit_repository.dart';
import '../../data/models/mother.dart';
import '../../data/remote/beneficiary_api.dart';
import '../../shared/utils/app_page_route.dart';
import '../../shared/widgets/deactivate_beneficiary_sheet.dart';
import '../beneficiary/add_mother_screen.dart';
import '../referrals/create_referral_screen.dart';
import 'widgets/children_tab.dart';
import 'widgets/info_tab.dart';
import 'widgets/mother_profile_header.dart';
import 'widgets/mother_profile_tab_bar.dart';
import 'widgets/visits_tab.dart';
import 'add_counseling_visit_screen.dart';

class MotherProfileScreen extends StatefulWidget {
  final Mother mother;
  const MotherProfileScreen({super.key, required this.mother});

  @override
  State<MotherProfileScreen> createState() => _MotherProfileScreenState();
}

class _MotherProfileScreenState extends State<MotherProfileScreen> {
  int _tabIndex = 0;
  late final String _motherId = widget.mother.id;

  Future<void> _handleEdit(Mother current) async {
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
    await Navigator.push<Mother>(
      context,
      appPageRoute(AddMotherScreen(existingMother: current)),
    );
  }

  Future<void> _handleAddVisit(Mother current) async {
    if (current.isTransferPending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hindi maaaring magdagdag ng visit habang pending ang transfer sync.',
          ),
        ),
      );
      return;
    }
    await Navigator.push(
      context,
      appPageRoute(AddCounselingVisitScreen(mother: current)),
    );
  }

  Future<void> _handleCreateReferral(Mother current) async {
    final visits = MotherVisitRepository().getForMother(current.id);
    final present = visits.where((v) => v.present).toList();
    final parts = <String>[];
    if (present.isNotEmpty) {
      final latest = present.first;
      if (latest.observation == 'Signs of concern') {
        parts.add(latest.observationNote?.isNotEmpty == true
            ? latest.observationNote!
            : 'Signs of concern observed');
      }
      if (latest.hasMedicalConcern) {
        parts.add(latest.concernNote?.isNotEmpty == true
            ? latest.concernNote!
            : 'Medical concern reported');
      }
    }
    final reason = parts.isNotEmpty
        ? parts.join(' · ')
        : 'Maternal health assessment referral';

    await Navigator.push(
      context,
      appPageRoute(
        CreateReferralScreen(
          prefillBeneficiaryType: 'mother',
          prefillBeneficiaryId: current.id,
          prefillBeneficiaryName: current.fullName,
          prefillBeneficiarySubtitle: current.formattedAddress,
          prefillReason: reason,
        ),
      ),
    );
  }

  Future<void> _handleStatusAction(Mother current) async {
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
        isChild: false,
        hasLinkedBeneficiary: current.linkedChildIds.isNotEmpty,
        accentColor: AppColors.darkGreen,
      );
      if (result == null) return;

      if (result.isTransfer) {
        final targetBarangay = result.targetBarangay!;

        // 1. Duplicate guard check (Local Hive check + Remote API check)
        bool hasDuplicate = false;
        final localDuplicate = MotherRepository().getAll().any((m) =>
            m.id != current.id &&
            m.barangay.trim().toLowerCase() ==
                targetBarangay.trim().toLowerCase() &&
            m.fullName.trim().toLowerCase() ==
                current.fullName.trim().toLowerCase() &&
            m.birthDate?.year == current.birthDate?.year &&
            m.birthDate?.month == current.birthDate?.month &&
            m.birthDate?.day == current.birthDate?.day);

        if (localDuplicate) {
          hasDuplicate = true;
        } else {
          hasDuplicate = await BeneficiaryApi.checkDuplicate(
            entityType: 'mother',
            targetBarangay: targetBarangay,
            fullName: current.fullName,
            birthDate: current.birthDate ?? DateTime(2000, 1, 1),
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
        await MotherRepository().transferMother(
          mother: current,
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
        await MotherRepository().update(
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
      await MotherRepository().update(
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
      builder: (context, version, child) {
        final mother = MotherRepository().getById(_motherId) ?? widget.mother;

        return Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            child: Column(
              children: [
                MotherProfileHeader(
                  mother: mother,
                  onEditPressed: () => _handleEdit(mother),
                  onStatusActionPressed: () => _handleStatusAction(mother),
                  onAddVisitPressed: () => _handleAddVisit(mother),
                  onReferralPressed: () => _handleCreateReferral(mother),
                ),
                if (mother.isTransferPending)
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
                            'Pending transfer sa Barangay ${mother.pendingTargetBarangay ?? 'bagong barangay'}. Naghihintay ng koneksyon para mai-sync.',
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
                MotherProfileTabBar(
                  currentIndex: _tabIndex,
                  onChanged: (i) => setState(() => _tabIndex = i),
                ),
                Expanded(
                  child: IndexedStack(
                    index: _tabIndex,
                    children: [
                      InfoTab(mother: mother),
                      VisitsTab(mother: mother),
                      ChildrenTab(mother: mother, onChanged: () {}),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
