import 'child_repository.dart';
import 'mother_repository.dart';
import 'measurement_repository.dart';
import 'mother_visit_repository.dart';
import 'referral_repository.dart';
import '../models/child.dart';
import '../models/mother.dart';

/// "Needs referral" is computed live from beneficiary severity and referral state.
/// When a referral is Completed (resolved by BHW/RHU), the beneficiary does NOT
/// show under "Needs referral" unless a newer measurement or visit after the
/// completion date flags severe or at-risk again.
class ReferralNeedsService {
  final _childRepo = ChildRepository();
  final _motherRepo = MotherRepository();
  final _referralRepo = ReferralRepository();
  final _measurementRepo = MeasurementRepository();
  final _motherVisitRepo = MotherVisitRepository();

  bool _isChildSevere(Child c) {
    if (!c.isActive) return false;
    final latest = _measurementRepo.getLatestPlausible(c.id);
    if (latest != null) {
      return latest.weightForAgeStatus == 'Severely Underweight' ||
          latest.heightForAgeStatus == 'Severely Stunted' ||
          latest.effectiveWastingStatus == 'SAM';
    }
    if (c.nutritionStatus == 'Needs re-measurement' ||
        c.stuntingStatus == 'Needs re-measurement' ||
        c.wastingStatus == 'Needs re-measurement') {
      return false;
    }
    final w = c.wastingStatus.trim().toUpperCase();
    return c.nutritionStatus == 'Severely Underweight' ||
        c.stuntingStatus == 'Severely Stunted' ||
        w == 'SAM' ||
        w == 'SEVERELY WASTED';
  }

  bool _isChildReferralActiveOrResolved(Child c) {
    final allRefs = _referralRepo.getAll().where((r) {
      if (r.isCancelled) return false;
      if (r.beneficiaryId == c.id) return true;
      if (r.resolvedBeneficiaryName.trim().toLowerCase() == c.fullName.trim().toLowerCase()) {
        return true;
      }
      return false;
    }).toList();
    if (allRefs.isEmpty) return false;

    allRefs.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    // A child with an active referral (Pending/Ongoing/In Progress) must NOT appear in Needs referral
    final hasActive = allRefs.any((r) =>
        r.isPending ||
        r.isInProgress ||
        r.isOngoing ||
        r.status.toLowerCase() == 'pending' ||
        r.status.toLowerCase() == 'ongoing' ||
        r.status.toLowerCase() == 'in progress');
    if (hasActive) return true; // excluded from "Needs referral"

    // Allow a new referral only when the old one is Completed and the child is still severe/at-risk
    final latest = allRefs.first;
    if (latest.isCompleted) {
      final measurements = _measurementRepo.getForChild(c.id);
      if (measurements.isNotEmpty) {
        final newest = measurements.first;
        final refDate = latest.updatedAt ?? latest.createdAt;
        if (newest.date.isAfter(refDate)) {
          if (!newest.isPlausible) return true;
          final isSevere = newest.weightForAgeStatus == 'Severely Underweight' ||
              newest.heightForAgeStatus == 'Severely Stunted' ||
              newest.effectiveWastingStatus == 'SAM';
          if (isSevere) return false;
        }
      }
      return true; // resolved
    }
    return false;
  }

  bool _isMotherReferralActiveOrResolved(Mother m) {
    final allRefs = _referralRepo.getAll().where((r) {
      if (r.isCancelled) return false;
      if (r.beneficiaryId == m.id) return true;
      if (r.resolvedBeneficiaryName.trim().toLowerCase() == m.fullName.trim().toLowerCase()) {
        return true;
      }
      return false;
    }).toList();
    if (allRefs.isEmpty) return false;

    allRefs.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final hasActive = allRefs.any((r) =>
        r.isPending ||
        r.isInProgress ||
        r.isOngoing ||
        r.status.toLowerCase() == 'pending' ||
        r.status.toLowerCase() == 'ongoing' ||
        r.status.toLowerCase() == 'in progress');
    if (hasActive) return true;

    final latest = allRefs.first;
    if (latest.isCompleted) {
      final visits = _motherVisitRepo.getForMother(m.id);
      if (visits.isNotEmpty) {
        final newest = visits.first;
        final refDate = latest.updatedAt ?? latest.createdAt;
        if (newest.date.isAfter(refDate)) {
          if (newest.hasMedicalConcern || newest.observation == 'Signs of concern') {
            return false;
          }
        }
      }
      return true;
    }
    return false;
  }

  List<Child> getChildrenNeedingReferral(String barangay) => _childRepo
      .getByBarangay(barangay)
      .where((c) => _isChildSevere(c) && !_isChildReferralActiveOrResolved(c))
      .toList();

  List<Mother> getMothersNeedingReferral(String barangay) => _motherRepo
      .getAll()
      .where(
        (m) =>
            m.barangay == barangay &&
            m.isActive &&
            m.riskStatus == 'At-risk' &&
            !_isMotherReferralActiveOrResolved(m),
      )
      .toList();
}
