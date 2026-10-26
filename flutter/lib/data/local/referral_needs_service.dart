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
    final referrals = _referralRepo.getForBeneficiary(c.id);
    if (referrals.isEmpty) return false;

    // If an open referral exists (Pending or In Progress), do not show in Needs Referral
    final hasOpen = referrals.any((r) => r.isPending || r.isInProgress);
    if (hasOpen) return true;

    // Check latest referral
    final latest = referrals.first;
    if (latest.isCompleted) {
      final measurements = _measurementRepo.getForChild(c.id);
      if (measurements.isNotEmpty) {
        final newest = measurements.first;
        if (newest.date.isAfter(latest.createdAt)) {
          if (!newest.isPlausible) return true; // Invalid record doesn't re-trigger severe referral
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
    final referrals = _referralRepo.getForBeneficiary(m.id);
    if (referrals.isEmpty) return false;

    final hasOpen = referrals.any((r) => r.isPending || r.isInProgress);
    if (hasOpen) return true;

    final latest = referrals.first;
    if (latest.isCompleted) {
      final visits = _motherVisitRepo.getForMother(m.id);
      if (visits.isNotEmpty) {
        final newest = visits.first;
        if (newest.date.isAfter(latest.createdAt)) {
          if (newest.hasMedicalConcern || newest.observation == 'Signs of concern') {
            return false;
          }
        }
      }
      return true; // resolved
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
