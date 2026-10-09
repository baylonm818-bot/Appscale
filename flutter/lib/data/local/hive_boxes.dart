import 'package:flutter/widgets.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Single source of truth for Hive box names, so a typo in a box name
/// never silently creates a second box somewhere else in the app.
class HiveBoxes {
  HiveBoxes._();

  static const settings = 'settings_box';
  static const activityLog = 'activity_log_box';
  static const mothers = 'mothers_box';
  static const children = 'children_box';
  static const measurements = 'measurements_box';
  static const motherVisits = 'mother_visits_box';
  static const referrals = 'referrals_box';
  static const feedingEnrollment = 'feeding_enrollment_box';
  static const feedingSchedule = 'feeding_schedule_box';
  static const mealPlans = 'meal_plans_box';
  static const feedingAttendance = 'feeding_attendance_box';
  static const feedingFeedback = 'feeding_feedback_box';
  static const notifications = 'notifications_box';
  static const programSchedule = 'program_schedule_box';
  static const vitaminA = 'vitamin_a_box';
  static const deworming = 'deworming_box';
  static const reportSignatories = 'report_signatories_box';
  static const reportSnapshots = 'report_snapshots_box';

  static Future<void> init() async {
    WidgetsFlutterBinding.ensureInitialized();

    if (!Hive.isBoxOpen(settings)) {
      await Hive.initFlutter();
    }

    final boxNames = [
      settings,
      activityLog,
      mothers,
      children,
      measurements,
      motherVisits,
      referrals,
      feedingEnrollment,
      feedingSchedule,
      mealPlans,
      feedingAttendance,
      feedingFeedback,
      notifications,
      programSchedule,
      vitaminA,
      deworming,
      reportSignatories,
      reportSnapshots,
    ];

    for (final boxName in boxNames) {
      if (!Hive.isBoxOpen(boxName)) {
        await Hive.openBox(boxName);
      }
    }
  }
}

/// Small typed helper so screens don't sprinkle Hive.box(...) calls everywhere.
class SettingsRepository {
  final _box = Hive.box(HiveBoxes.settings);

  bool get hasSeenOnboarding =>
      _box.get('has_seen_onboarding', defaultValue: false);
  Future<void> setSeenOnboarding() => _box.put('has_seen_onboarding', true);

  bool get rememberMe => _box.get('remember_me', defaultValue: false);
  Future<void> setRememberMe(bool value) => _box.put('remember_me', value);

  DateTime? get sessionExpiresAt {
    final raw = _box.get('session_expires_at');
    if (raw is int) return DateTime.fromMillisecondsSinceEpoch(raw);
    if (raw is String && raw.isNotEmpty) {
      return DateTime.tryParse(raw);
    }
    return null;
  }

  Future<void> setSessionExpiresAt(DateTime? value) async {
    if (value == null) {
      await _box.delete('session_expires_at');
      return;
    }
    await _box.put('session_expires_at', value.millisecondsSinceEpoch);
  }

  bool get hasValidSession {
    final token = authToken;
    if (token == null || token.isEmpty) return false;
    final expiresAt = sessionExpiresAt;
    if (expiresAt == null) return false;
    return DateTime.now().isBefore(expiresAt);
  }

  String? get authToken => _box.get('auth_token');
  Future<void> setAuthToken(String? value) =>
      value == null ? _box.delete('auth_token') : _box.put('auth_token', value);

  Map<String, dynamic>? get authUser {
    final raw = _box.get('auth_user');
    if (raw == null) return null;
    return Map<String, dynamic>.from(raw as Map);
  }

  Future<void> setAuthUser(Map<String, dynamic>? value) =>
      value == null ? _box.delete('auth_user') : _box.put('auth_user', value);

  String? get pendingProfilePicturePath =>
      _box.get('pending_profile_picture');
  Future<void> setPendingProfilePicturePath(String? path) =>
      path == null
          ? _box.delete('pending_profile_picture')
          : _box.put('pending_profile_picture', path);

  Future<void> clearSession() async {
    await _box.delete('auth_token');
    await _box.delete('auth_user');
    await _box.delete('session_expires_at');
    await _box.delete('pending_profile_picture');
  }
}
