import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../../data/local/beneficiary_link_service.dart';
import '../../../data/local/mother_repository.dart';
import '../../../data/models/child.dart';
import '../../../data/models/mother.dart';
import '../../../shared/utils/app_notifications.dart';
import '../../../shared/utils/app_page_route.dart';
import '../../../shared/widgets/detail_row.dart';
import '../../../shared/widgets/section_card.dart';
import '../../beneficiary/add_mother_screen.dart';
import '../../masterlist/utils/mother_status_meta.dart';
import '../../masterlist/widgets/status_badge.dart';
import '../../mother_profile/mother_profile_screen.dart';

class InfoTab extends StatelessWidget {
  final Child child;
  const InfoTab({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final linkedMother = child.guardian.linkedMotherId != null
        ? MotherRepository().getById(child.guardian.linkedMotherId!)
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionCard(
            title: 'Basic Information',
            child: Column(
              children: [
                DetailRow(
                  icon: Icons.badge_outlined,
                  label: 'Full Name',
                  value: child.fullName,
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.cake_outlined,
                  label: 'Age',
                  value: child.ageLabel,
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.wc_outlined,
                  label: 'Gender',
                  value: child.gender,
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.event_outlined,
                  label: 'Birth Date',
                  value: _formatDate(child.birthDate),
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.location_on_outlined,
                  label: 'Address',
                  value: child.formattedAddress,
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.groups_outlined,
                  label: 'IP Group',
                  value: child.belongsToIpGroup ? 'Yes' : 'None',
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(
                  icon: Icons.accessibility_new_outlined,
                  label: 'Disability',
                  value: child.disability,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Guardian',
            style: AppTextStyles.h2.copyWith(
              fontSize: 15,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  child.guardian.fullName,
                  style: AppTextStyles.label.copyWith(fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text(
                  '${child.guardian.relationship}${child.guardian.contactNo.isNotEmpty ? ' · ${child.guardian.contactNo}' : ''}',
                  style: AppTextStyles.body.copyWith(fontSize: 12),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      'Age: ${child.guardian.ageLabel}',
                      style: AppTextStyles.body.copyWith(fontSize: 12, color: AppColors.textMuted),
                    ),
                    if (child.guardian.isAdolescent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFF59E0B)),
                        ),
                        child: Text(
                          'Adolescent mother',
                          style: AppTextStyles.caption.copyWith(
                            color: const Color(0xFFB45309),
                            fontWeight: FontWeight.w600,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Monitored mother record',
            style: AppTextStyles.h2.copyWith(
              fontSize: 15,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (linkedMother != null)
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                Navigator.push(
                  context,
                  appPageRoute(MotherProfileScreen(mother: linkedMother)),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primaryGreen.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        linkedMother.initials,
                        style: const TextStyle(
                          color: AppColors.primaryGreen,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            linkedMother.fullName,
                            style: AppTextStyles.label.copyWith(fontSize: 15),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Text(
                                linkedMother.ageLabel,
                                style: AppTextStyles.body.copyWith(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(width: 8),
                              StatusBadge(
                                label: linkedMother.riskStatus,
                                color: MotherStatusMeta.colorFor(
                                  linkedMother.riskStatus,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppColors.textMuted),
                  ],
                ),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'No mother record linked',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primaryGreen,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: const Icon(Icons.link, size: 16),
                    label: const Text(
                      'Link mother',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    onPressed: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.white,
                      shape: const RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(20)),
                      ),
                      builder: (_) => _LinkMotherSheet(child: child),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) => AppDateFormat.format(date);
}

class _LinkMotherSheet extends StatefulWidget {
  final Child child;
  const _LinkMotherSheet({required this.child});

  @override
  State<_LinkMotherSheet> createState() => _LinkMotherSheetState();
}

class _LinkMotherSheetState extends State<_LinkMotherSheet> {
  final _searchController = TextEditingController();
  final _motherRepo = MotherRepository();
  List<Mother> _mothers = [];

  @override
  void initState() {
    super.initState();
    _mothers = _motherRepo.search('', barangay: widget.child.barangay, limit: 10);
  }

  void _onQueryChanged(String query) {
    setState(() {
      _mothers = _motherRepo.search(query, barangay: widget.child.barangay, limit: 15);
    });
  }

  Future<void> _linkMother(Mother mother) async {
    await BeneficiaryLinkService().linkChildToMother(
      child: widget.child,
      mother: mother,
    );
    if (!mounted) return;
    Navigator.pop(context);
    AppNotificationUI.showSuccess(
      context,
      'Linked to ${mother.fullName}',
    );
  }

  Future<void> _createNewMother() async {
    final created = await Navigator.push<Mother>(
      context,
      appPageRoute(
        AddMotherScreen(
          prefillFullName:
              widget.child.guardian.relationship.toLowerCase() == 'mother'
                  ? widget.child.guardian.fullName
                  : '',
          prefillContact:
              widget.child.guardian.relationship.toLowerCase() == 'mother'
                  ? widget.child.guardian.contactNo
                  : '',
          prefillAddress: widget.child.address,
        ),
      ),
    );
    if (created != null && mounted) {
      await BeneficiaryLinkService().linkChildToMother(
        child: widget.child,
        mother: created,
      );
      if (mounted) {
        Navigator.pop(context);
        AppNotificationUI.showSuccess(
          context,
          'Created and linked ${created.fullName}',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
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
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Link Mother Record',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: AppColors.primaryGreen),
              ),
              tileColor: AppColors.lightGreenBg,
              leading: const Icon(
                Icons.person_add_outlined,
                color: AppColors.primaryGreen,
              ),
              title: const Text(
                'Register new mother',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: AppColors.darkGreen,
                ),
              ),
              subtitle: Text(
                'Create a new beneficiary record and link to ${widget.child.fullName}',
                style: const TextStyle(fontSize: 12, color: AppColors.darkGreen),
              ),
              onTap: _createNewMother,
            ),
            const SizedBox(height: 14),
            Text(
              'Or choose existing mother in ${widget.child.barangay}:',
              style: AppTextStyles.label.copyWith(fontSize: 13),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _searchController,
              onChanged: _onQueryChanged,
              decoration: InputDecoration(
                hintText: 'Search mother by name...',
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                filled: true,
                fillColor: AppColors.surface,
              ),
            ),
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: _mothers.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          'No matching mothers found in ${widget.child.barangay}.',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: _mothers.length,
                      itemBuilder: (context, index) {
                        final m = _mothers[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: ListTile(
                            dense: true,
                            title: Text(
                              m.fullName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            subtitle: Text(
                              '${m.ageLabel} · ${m.formattedAddress}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                            trailing: const Icon(
                              Icons.link,
                              color: AppColors.primaryGreen,
                              size: 20,
                            ),
                            onTap: () => _linkMother(m),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
