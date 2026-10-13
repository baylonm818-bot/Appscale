import '../models/child.dart';
import '../models/guardian.dart';
import '../models/mother.dart';
import '../../shared/utils/app_user_identity.dart';
import 'child_repository.dart';
import 'mother_repository.dart';

/// Single place that keeps a child's guardian link and a mother's linked
/// children list in sync. Call this any time a link is made or changed —
/// from Add Child, Add Mother, or their edit-mode counterparts — so the
/// two records never drift out of agreement with each other.
class BeneficiaryLinkService {
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();

  Future<void> linkChildToMother({
    required Child child,
    required Mother mother,
  }) async {
    if (child.guardian.linkedMotherId != mother.id) {
      final updatedChild = child.copyWith(
        guardian: Guardian(
          fullName: child.guardian.fullName,
          relationship: child.guardian.relationship,
          contactNo: child.guardian.contactNo,
          linkedMotherId: mother.id,
        ),
      );
      await _childRepo.update(updatedChild);
    }

    if (!mother.linkedChildIds.contains(child.id)) {
      final updatedMother = mother.copyWith(
        linkedChildIds: [...mother.linkedChildIds, child.id],
      );
      await _motherRepo.update(updatedMother);
    }
  }

  Future<void> unlinkChildFromMother({
    required Child child,
    required Mother mother,
  }) async {
    final updatedChild = child.copyWith(
      guardian: Guardian(
        fullName: child.guardian.fullName,
        relationship: child.guardian.relationship,
        contactNo: child.guardian.contactNo,
        linkedMotherId: null,
      ),
    );
    await _childRepo.update(updatedChild);

    final updatedMother = mother.copyWith(
      linkedChildIds: mother.linkedChildIds
          .where((id) => id != child.id)
          .toList(),
    );
    await _motherRepo.update(updatedMother);
  }

  /// Searches for an existing mother in the given barangay matching the guardian's
  /// full name and contact number, or an existing mother linked to a sibling
  /// who shares the same guardian name.
  Mother? findMatchingMother({
    required String barangay,
    required String fullName,
    required String contactNo,
    String? excludeChildId,
  }) {
    final cleanName = AppUserIdentity.normalizeDisplayName(fullName).trim().toLowerCase();
    if (cleanName.isEmpty) return null;

    final cleanContact = AppUserIdentity.sanitizeMobileNumber(contactNo).trim();
    final mothersInBarangay = _motherRepo.getAll().where((m) =>
        m.barangay.trim().toLowerCase() == barangay.trim().toLowerCase()).toList();

    // 1. Exact full name AND contact number match (when contact is provided)
    if (cleanContact.isNotEmpty) {
      for (final m in mothersInBarangay) {
        final mName = AppUserIdentity.normalizeDisplayName(m.fullName).trim().toLowerCase();
        final mContact = AppUserIdentity.sanitizeMobileNumber(m.contactNo).trim();
        if (mName == cleanName && mContact == cleanContact) {
          return m;
        }
      }
    }

    // 2. Check siblings: Is there another child in this barangay with the same guardian
    // name who is already linked to a mother?
    final childrenInBarangay = _childRepo.getByBarangay(barangay);
    for (final sibling in childrenInBarangay) {
      if (excludeChildId != null && sibling.id == excludeChildId) continue;
      final sibGuardianName = AppUserIdentity.normalizeDisplayName(sibling.guardian.fullName).trim().toLowerCase();
      if (sibGuardianName == cleanName &&
          sibling.guardian.linkedMotherId != null &&
          sibling.guardian.linkedMotherId!.isNotEmpty) {
        final siblingMother = _motherRepo.getById(sibling.guardian.linkedMotherId!);
        if (siblingMother != null &&
            siblingMother.barangay.trim().toLowerCase() == barangay.trim().toLowerCase()) {
          return siblingMother;
        }
      }
    }

    // 3. Exact full name match in barangay where either has empty contact or contacts match
    for (final m in mothersInBarangay) {
      final mName = AppUserIdentity.normalizeDisplayName(m.fullName).trim().toLowerCase();
      if (mName == cleanName) {
        final mContact = AppUserIdentity.sanitizeMobileNumber(m.contactNo).trim();
        if (cleanContact.isEmpty || mContact.isEmpty || cleanContact == mContact) {
          return m;
        }
      }
    }

    return null;
  }

  /// Automatically resolves an existing mother or creates a monitored mother record
  /// for a child whose guardian is the mother.
  Future<Mother> resolveOrCreateMotherForChild({
    required String barangay,
    required String guardianName,
    required String guardianContact,
    required String address,
    DateTime? guardianBirthDate,
    bool belongsToIpGroup = false,
    String? excludeChildId,
  }) async {
    final cleanName = AppUserIdentity.normalizeDisplayName(guardianName.trim());
    final cleanContact = AppUserIdentity.sanitizeMobileNumber(guardianContact.trim());

    final existing = findMatchingMother(
      barangay: barangay,
      fullName: cleanName,
      contactNo: cleanContact,
      excludeChildId: excludeChildId,
    );

    if (existing != null) {
      var updated = existing;
      bool needsUpdate = false;
      if (existing.contactNo.isEmpty && cleanContact.isNotEmpty) {
        updated = updated.copyWith(contactNo: cleanContact);
        needsUpdate = true;
      }
      if (existing.birthDate == null && guardianBirthDate != null) {
        updated = updated.copyWith(birthDate: guardianBirthDate);
        needsUpdate = true;
      }
      if (existing.address.isEmpty && address.trim().isNotEmpty) {
        updated = updated.copyWith(address: address.trim());
        needsUpdate = true;
      }
      if (needsUpdate) {
        await _motherRepo.update(updated);
      }
      return updated;
    }

    // Create new Mother record
    final motherId = MotherRepository.generateId();
    final newMother = Mother(
      id: motherId,
      fullName: cleanName.isNotEmpty ? cleanName : 'Mother',
      birthDate: guardianBirthDate,
      contactNo: cleanContact,
      address: address.trim().isNotEmpty ? address.trim() : 'Purok 1',
      barangay: barangay,
      breastfeedingPractice: 'Exclusive',
      belongsToIpGroup: belongsToIpGroup,
      disability: 'None',
      createdAt: DateTime.now(),
      riskStatus: 'Not visited',
      isActive: true,
      linkedChildIds: [],
    );

    await _motherRepo.add(newMother);
    return newMother;
  }

  /// One-time migration / auto-link fix that scans children whose guardian is
  /// "Mother" but have no linked mother record, creating or linking the mother record.
  Future<void> autoLinkExistingMotherGuardians({String? barangay}) async {
    final allChildren = (barangay != null && barangay.isNotEmpty)
        ? _childRepo.getByBarangay(barangay)
        : _childRepo.getAll();

    for (final child in allChildren) {
      final rel = child.guardian.relationship.trim().toLowerCase();
      if (rel != 'mother') continue;

      final existingMotherId = child.guardian.linkedMotherId;
      if (existingMotherId != null && existingMotherId.isNotEmpty) {
        final existingMother = _motherRepo.getById(existingMotherId);
        if (existingMother != null) {
          if (!existingMother.linkedChildIds.contains(child.id)) {
            await _motherRepo.update(
              existingMother.copyWith(
                linkedChildIds: [...existingMother.linkedChildIds, child.id],
              ),
            );
          }
          continue;
        }
      }

      // If child has guardian "Mother" and no valid linked mother record:
      final mother = await resolveOrCreateMotherForChild(
        barangay: child.barangay,
        guardianName: child.guardian.fullName,
        guardianContact: child.guardian.contactNo,
        address: child.address,
        belongsToIpGroup: child.belongsToIpGroup,
        excludeChildId: child.id,
      );

      await linkChildToMother(child: child, mother: mother);
    }
  }
}
