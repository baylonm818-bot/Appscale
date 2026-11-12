import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/feeding_session.dart';
import 'app_data_bus.dart';
import 'feeding_attendance_repository.dart';
import 'hive_boxes.dart';
import 'meal_plan_repository.dart';

class FeedingSessionRepository {
  Box get _box => Hive.box(HiveBoxes.feedingSessions);

  static String _formatDateKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String _key(String barangay, DateTime date) =>
      '$barangay|${_formatDateKey(date)}';

  /// Ensures a FeedingSession exists for the given barangay and date.
  /// Automatically populates menu from active meal plan or recorded food served.
  Future<FeedingSession> getOrCreateForDate(
    String barangay,
    DateTime date, {
    String? programId,
    List<String>? menuItems,
  }) async {
    final existing = getForDate(barangay, date);
    if (existing != null) {
      if (menuItems != null && menuItems.isNotEmpty && existing.menuItems.isEmpty) {
        final updated = existing.copyWith(menuItems: menuItems);
        await save(updated);
        return updated;
      }
      return existing;
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final targetDate = DateTime(date.year, date.month, date.day);

    // Initial status determination
    String initialStatus;
    if (targetDate.isAfter(today)) {
      initialStatus = 'Scheduled';
    } else if (targetDate.isAtSameMomentAs(today)) {
      final todayAttendance =
          FeedingAttendanceRepository().getForDate(barangay, date);
      initialStatus = todayAttendance.isNotEmpty ? 'Completed' : 'Ongoing';
    } else {
      initialStatus = 'Completed';
    }

    // Determine initial menu
    List<String> items = menuItems ?? [];
    if (items.isEmpty) {
      final foodServed =
          FeedingAttendanceRepository().getFoodServedForDate(barangay, date);
      if (foodServed.trim().isNotEmpty) {
        items = foodServed
            .split(RegExp(r'[,•\n]+'))
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList();
      }
    }
    if (items.isEmpty) {
      final activePlan = MealPlanRepository().getActiveForDate(barangay, date);
      if (activePlan != null && activePlan.foodItems.isNotEmpty) {
        items = List<String>.from(activePlan.foodItems);
      }
    }
    if (items.isEmpty) {
      items = ['Nutritious Hot Meal', 'Boiled Egg', 'Fresh Banana'];
    }

    final newSession = FeedingSession(
      id: const Uuid().v4(),
      programId: programId ?? 'feeding_prog_${barangay.toLowerCase()}',
      date: targetDate,
      status: initialStatus,
      menuItems: items,
      feedbackNotes: null,
      leftovers: null,
      appetite: null,
      barangay: barangay,
      createdAt: now,
    );

    await save(newSession);
    return newSession;
  }

  FeedingSession? getForDate(String barangay, DateTime date) {
    final key = _key(barangay, date);
    final raw = _box.get(key);
    if (raw == null) {
      // Also check if stored by session id
      for (final v in _box.values) {
        if (v is Map) {
          final s = FeedingSession.fromMap(Map<String, dynamic>.from(v));
          if (s.barangay == barangay &&
              s.date.year == date.year &&
              s.date.month == date.month &&
              s.date.day == date.day) {
            return s;
          }
        }
      }
      return null;
    }
    try {
      return FeedingSession.fromMap(Map<String, dynamic>.from(raw as Map));
    } catch (e) {
      debugPrint('Error parsing FeedingSession for $key: $e');
      return null;
    }
  }

  /// Returns all sessions for the given barangay, sorted newest first.
  /// Merges past logged dates from attendance repository so all historical sessions show up.
  List<FeedingSession> getAllForBarangay(String barangay) {
    final Map<String, FeedingSession> sessionMap = {};

    // 1. Load all stored sessions
    for (final v in _box.values) {
      try {
        if (v is Map) {
          final s = FeedingSession.fromMap(Map<String, dynamic>.from(v));
          if (s.barangay == barangay) {
            sessionMap[_formatDateKey(s.date)] = s;
          }
        }
      } catch (_) {}
    }

    // 2. Discover dates with logged attendance in FeedingAttendanceRepository
    try {
      final loggedDates = FeedingAttendanceRepository().getLoggedDates(barangay);
      for (final d in loggedDates) {
        final dateKey = _formatDateKey(d);
        if (!sessionMap.containsKey(dateKey)) {
          final foodServed =
              FeedingAttendanceRepository().getFoodServedForDate(barangay, d);
          List<String> items = [];
          if (foodServed.trim().isNotEmpty) {
            items = foodServed
                .split(RegExp(r'[,•\n]+'))
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .toList();
          }
          if (items.isEmpty) {
            final activePlan =
                MealPlanRepository().getActiveForDate(barangay, d);
            if (activePlan != null) items = List<String>.from(activePlan.foodItems);
          }
          if (items.isEmpty) {
            items = ['Nutritious Meal', 'Fruit'];
          }

          final synthesized = FeedingSession(
            id: 'session_${barangay}_$dateKey',
            programId: 'feeding_prog_${barangay.toLowerCase()}',
            date: DateTime(d.year, d.month, d.day),
            status: 'Completed',
            menuItems: items,
            feedbackNotes: null,
            leftovers: null,
            appetite: null,
            barangay: barangay,
            createdAt: d,
          );
          sessionMap[dateKey] = synthesized;
          // Store so next lookup is fast
          _box.put(_key(barangay, d), synthesized.toMap());
        }
      }
    } catch (_) {}

    final list = sessionMap.values.toList();
    list.sort((a, b) => b.date.compareTo(a.date));
    return list;
  }

  Future<void> save(FeedingSession session) async {
    final key = _key(session.barangay, session.date);
    await _box.put(key, session.toMap());
    AppDataBus.notifyChanged();
  }

  Future<void> updateFeedback({
    required String barangay,
    required DateTime date,
    String? feedbackNotes,
    String? leftovers,
    String? appetite,
    List<String>? menuItems,
    String? status,
  }) async {
    final session = await getOrCreateForDate(barangay, date);
    final updated = session.copyWith(
      feedbackNotes: feedbackNotes ?? session.feedbackNotes,
      leftovers: leftovers ?? session.leftovers,
      appetite: appetite ?? session.appetite,
      menuItems: menuItems ?? session.menuItems,
      status: status ?? session.status,
    );
    await save(updated);
  }

  Future<void> deleteSession(String barangay, DateTime date) async {
    final key = _key(barangay, date);
    await _box.delete(key);
    AppDataBus.notifyChanged();
  }
}
