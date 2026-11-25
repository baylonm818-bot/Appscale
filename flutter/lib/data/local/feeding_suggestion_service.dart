import 'child_repository.dart';
import 'feeding_enrollment_repository.dart';
import 'measurement_repository.dart';
import '../models/child.dart';
import '../../features/masterlist/utils/child_status_meta.dart';

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
    final status = ChildOverallStatus.fromChild(c);
    return status.isSevere || status.isAtRisk;
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
