import 'child_repository.dart';
import 'feeding_enrollment_repository.dart';
import 'measurement_repository.dart';
import '../models/child.dart';

/// Suggests, never auto-enrolls. A malnourished child appears here so a
/// BNS can decide to add them — the decision always stays a deliberate
/// action, same principle as the referral "needs attention" list.
class FeedingSuggestionService {
  final _childRepo = ChildRepository();
  final _enrollmentRepo = FeedingEnrollmentRepository();
  final _measurementRepo = MeasurementRepository();

  bool _hasMeasurements(Child c) {
    final meas = _measurementRepo.getForChild(c.id);
    return meas.any((m) => m.isPlausible);
  }

  bool _isMalnourished(Child c) {
    if (!_hasMeasurements(c)) return false;
    final meas = _measurementRepo.getForChild(c.id).where((m) => m.isPlausible).toList();
    if (meas.isNotEmpty) {
      final latest = meas.first;
      final wfa = latest.weightForAgeStatus;
      final wfl = latest.effectiveWastingStatus;
      if (wfa == 'Underweight' ||
          wfa == 'Severely Underweight' ||
          wfl == 'MAM' ||
          wfl == 'SAM') {
        return true;
      }
    }
    return c.nutritionStatus == 'Underweight' ||
        c.nutritionStatus == 'Severely Underweight' ||
        c.wastingStatus == 'MAM' ||
        c.wastingStatus == 'SAM';
  }

  List<Child> getSuggested(String barangay) => _childRepo
      .getByBarangay(barangay)
      .where(
        (c) =>
            c.isActive &&
            _hasMeasurements(c) &&
            _isMalnourished(c) &&
            !_enrollmentRepo.isEnrolled(c.id),
      )
      .toList();
}
