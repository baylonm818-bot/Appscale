import 'package:uuid/uuid.dart';
import '../models/app_notification.dart';
import 'activity_log_repository.dart';
import 'child_repository.dart';
import 'notification_repository.dart';

/// Runs once per app session (called from Dashboard).
/// Scans active children for anyone who has reached 59 months and sets their record
/// to inactive (Graduated) automatically, and notifies Admin, BNS, and BHW.
class AutoGraduationService {
  final _childRepo = ChildRepository();
  final _activityRepo = ActivityLogRepository();
  final _notifRepo = NotificationRepository();

  Future<int> runForBarangay(String barangay) async {
    final candidates = _childRepo
        .getByBarangay(barangay)
        .where((c) => c.isActive && c.ageInMonths >= 59)
        .toList();

    for (final child in candidates) {
      await _childRepo.update(
        child.copyWith(isActive: false, inactiveReason: 'Graduated'),
      );

      await _activityRepo.logActivity(
        type: 'child_graduated',
        title: '${child.fullName} completed program at 59 months (Graduated)',
      );

      // Create local notification for graduation
      await _notifRepo.add(
        AppNotification(
          id: const Uuid().v4(),
          title: 'Child Graduated (59 Months)',
          message: '${child.fullName} has reached 59 months and graduated from the program.',
          type: 'child_graduated',
          timestamp: DateTime.now(),
        ),
      );
    }
    return candidates.length;
  }
}
