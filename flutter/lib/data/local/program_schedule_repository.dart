import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/app_notification.dart';
import '../models/program_schedule.dart';
import 'activity_log_repository.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import 'notification_repository.dart';
import '../remote/beneficiary_api.dart';
import 'package:flutter/foundation.dart';

class ProgramScheduleRepository {
  Box get _box => Hive.box(HiveBoxes.programSchedule);

  List<ProgramSchedule> getAllForBarangay(String barangay) {
    final target = barangay.trim().toLowerCase();
    final list = _box.values
        .map(
          (e) => ProgramSchedule.fromMap(Map<String, dynamic>.from(e as Map)),
        )
        .where((s) {
          final b = s.barangay.trim().toLowerCase();
          return b == target || target.isEmpty || b.isEmpty;
        })
        .toList();
    list.sort((a, b) => a.date.compareTo(b.date));
    return list;
  }

  List<ProgramSchedule> getUpcoming(String barangay) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return getAllForBarangay(barangay).where((s) {
      final sDate = DateTime(s.date.year, s.date.month, s.date.day);
      return !sDate.isBefore(today);
    }).toList();
  }

  List<ProgramSchedule> getForDate(String barangay, DateTime date) {
    final target = DateTime(date.year, date.month, date.day);
    return getAllForBarangay(barangay).where((s) {
      final sDate = DateTime(s.date.year, s.date.month, s.date.day);
      return sDate.isAtSameMomentAs(target);
    }).toList();
  }

  Future<void> save(ProgramSchedule schedule) async {
    await _box.put(schedule.id, schedule.toMap());
    await ActivityLogRepository().logActivity(
      type: 'report_generated',
      title: 'Scheduled: ${schedule.title}',
    );
    AppDataBus.notifyChanged();

    // Fire and forget sync to remote backend so Web Admins and BHWs see it
    try {
      await BeneficiaryApi.syncSchedule(schedule);
    } catch (e) {
      debugPrint('Failed to sync schedule (non-fatal): $e');
    }
  }

  /// Processes schedule entries created or updated by RHU Admin / BHW
  /// via the Web Health Portal, storing them locally and dispatching
  /// an in-app notification to the BNS.
  Future<void> receiveWebScheduleUpdate(ProgramSchedule schedule) async {
    await _box.put(schedule.id, schedule.toMap());
    final dateStr =
        '${schedule.date.year}-${schedule.date.month.toString().padLeft(2, '0')}-${schedule.date.day.toString().padLeft(2, '0')}';

    await NotificationRepository().add(
      AppNotification(
        id: NotificationRepository.generateId(),
        title: 'New Program Schedule Set by RHU',
        message:
            '${schedule.title} (${schedule.programType}) has been scheduled for $dateStr at ${schedule.location} by RHU staff.',
        type: 'general',
        timestamp: DateTime.now(),
      ),
    );

    await ActivityLogRepository().logActivity(
      type: 'report_generated',
      title: 'RHU set schedule for ${schedule.title}',
    );

    AppDataBus.notifyChanged();
  }

  Future<void> seedInitialIfEmpty(String barangay) async {
    // No mockup seeding — display real user/backend schedules only
    return;
  }

  static String generateId() => const Uuid().v4();
}
