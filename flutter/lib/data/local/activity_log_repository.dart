import 'package:hive_flutter/hive_flutter.dart';
import 'activity_log_entry.dart';
import 'hive_boxes.dart';
import 'app_data_bus.dart';

/// Every feature that changes data — Add Child, Record Measurement,
/// Create Referral, Generate Report, etc. — should call
/// ActivityLogRepository().logActivity(...) right when it saves.
/// The Dashboard only ever reads from here; it never needs to know
/// which screen produced the entry. This is what makes Recent Activity
/// real instead of hardcoded.
class ActivityLogRepository {
  Box get _box => Hive.box(HiveBoxes.activityLog);

  Future<void> logActivity({
    required String type,
    required String title,
  }) async {
    await _box.add(
      ActivityLogEntry(
        type: type,
        title: title,
        timestamp: DateTime.now(),
      ).toMap(),
    );
    AppDataBus.notifyChanged();
  }

  List<ActivityLogEntry> getRecent({int limit = 5}) {
    if (_box.isNotEmpty) {
      final entries =
          _box.values.map((e) => ActivityLogEntry.fromMap(e as Map)).toList()
            ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      return entries.take(limit).toList();
    }

    // Fallback: If no explicit activities have been logged yet in this session,
    // construct recent activities dynamically from latest records.
    final derived = <ActivityLogEntry>[];
    try {
      if (Hive.isBoxOpen(HiveBoxes.measurements)) {
        final mBox = Hive.box(HiveBoxes.measurements);
        for (final key in mBox.keys) {
          final childId = key.toString();
          String childName = '';
          if (Hive.isBoxOpen(HiveBoxes.children)) {
            final c = Hive.box(HiveBoxes.children).get(childId);
            if (c is Map) childName = (c['fullName'] ?? '').toString();
          }

          final list = mBox.get(key);
          final records = list is List ? list : [list];
          for (final raw in records) {
            if (raw is! Map) continue;
            final recTimeStr = raw['_syncedAt'] ?? raw['createdAt'] ?? raw['date'];
            final date = DateTime.tryParse((recTimeStr ?? '').toString());
            final measureDateStr = raw['date']?.toString();
            if (date != null) {
              String subtitle = childName.isNotEmpty
                  ? 'Recorded measurement for $childName'
                  : 'Recorded child measurement';
              if (measureDateStr != null && measureDateStr.isNotEmpty) {
                final mDate = DateTime.tryParse(measureDateStr);
                if (mDate != null) {
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  subtitle += ' (${months[mDate.month - 1]} ${mDate.day})';
                }
              }
              derived.add(
                ActivityLogEntry(
                  type: 'measurement_recorded',
                  title: subtitle,
                  timestamp: date,
                ),
              );
            }
          }
        }
      }

      if (Hive.isBoxOpen(HiveBoxes.referrals)) {
        for (final raw in Hive.box(HiveBoxes.referrals).values) {
          if (raw is Map) {
            final date = DateTime.tryParse((raw['createdAt'] ?? '').toString());
            final name = (raw['beneficiaryName'] ?? 'beneficiary').toString();
            if (date != null) {
              derived.add(
                ActivityLogEntry(
                  type: 'referral_created',
                  title: 'Referral opened for $name',
                  timestamp: date,
                ),
              );
            }
          }
        }
      }

      if (Hive.isBoxOpen(HiveBoxes.children)) {
        for (final raw in Hive.box(HiveBoxes.children).values) {
          if (raw is Map) {
            final date = DateTime.tryParse((raw['createdAt'] ?? '').toString());
            final name = (raw['fullName'] ?? '').toString();
            if (date != null && name.isNotEmpty) {
              derived.add(
                ActivityLogEntry(
                  type: 'child_added',
                  title: 'Registered $name',
                  timestamp: date,
                ),
              );
            }
          }
        }
      }

      if (Hive.isBoxOpen(HiveBoxes.mothers)) {
        for (final raw in Hive.box(HiveBoxes.mothers).values) {
          if (raw is Map) {
            final date = DateTime.tryParse((raw['createdAt'] ?? '').toString());
            final name = (raw['fullName'] ?? '').toString();
            if (date != null && name.isNotEmpty) {
              derived.add(
                ActivityLogEntry(
                  type: 'mother_added',
                  title: 'Registered $name',
                  timestamp: date,
                ),
              );
            }
          }
        }
      }
    } catch (_) {}

    derived.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return derived.take(limit).toList();
  }
}
