import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/app_notification.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';

class NotificationRepository {
  Box get _box => Hive.box(HiveBoxes.notifications);

  List<AppNotification> getAll() {
    final list = _box.values
        .map(
          (n) => AppNotification.fromMap(Map<String, dynamic>.from(n as Map)),
        )
        .toList();
    list.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return list;
  }

  int getUnreadCount() => getAll().where((n) => !n.isRead).length;

  Future<void> add(AppNotification notification) async {
    await _box.put(notification.id, notification.toMap());
    AppDataBus.notifyChanged();
  }

  Future<void> markAsRead(String id) async {
    final raw = _box.get(id);
    if (raw != null) {
      final notif = AppNotification.fromMap(
        Map<String, dynamic>.from(raw as Map),
      );
      if (!notif.isRead) {
        await _box.put(id, notif.copyWith(isRead: true).toMap());
        AppDataBus.notifyChanged();
      }
    }
  }

  Future<void> markAllAsRead() async {
    for (final raw in _box.values) {
      final notif = AppNotification.fromMap(
        Map<String, dynamic>.from(raw as Map),
      );
      if (!notif.isRead) {
        await _box.put(notif.id, notif.copyWith(isRead: true).toMap());
      }
    }
    AppDataBus.notifyChanged();
  }

  /// Keep local notifications empty unless the backend pushes real updates.
  Future<void> seedInitialIfEmpty() async {
    if (_box.isNotEmpty) return;
    AppDataBus.notifyChanged();
  }

  static String generateId() => const Uuid().v4();
}
