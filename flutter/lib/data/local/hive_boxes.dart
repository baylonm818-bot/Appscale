import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../remote/auth_api.dart';
import 'app_data_bus.dart';

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

  String? get pendingProfilePicturePath {
    final uid = authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (uid != null && uid.isNotEmpty) {
      final perUser = _box.get('pending_profile_picture_$uid') as String?;
      if (perUser != null && perUser.isNotEmpty) return perUser;
    }
    return _box.get('pending_profile_picture') as String?;
  }

  Future<void> setPendingProfilePicturePath(String? path, {String? userId}) async {
    final uid = userId ?? authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (path == null) {
      await _box.delete('pending_profile_picture');
      if (uid != null && uid.isNotEmpty) {
        await _box.delete('pending_profile_picture_$uid');
      }
    } else {
      await _box.put('pending_profile_picture', path);
      if (uid != null && uid.isNotEmpty) {
        await _box.put('pending_profile_picture_$uid', path);
      }
    }
  }

  String? getLocalProfilePicturePath([String? userId]) {
    final uid = userId ?? authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (uid == null || uid.isEmpty) return null;
    return _box.get('local_profile_photo_$uid') as String?;
  }

  Future<void> setLocalProfilePicturePath(String? path, {String? userId}) async {
    final uid = userId ?? authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (uid == null || uid.isEmpty) return;
    if (path == null) {
      await _box.delete('local_profile_photo_$uid');
    } else {
      await _box.put('local_profile_photo_$uid', path);
    }
  }

  Map<String, dynamic>? get pendingProfileUpdate {
    final uid = authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (uid != null && uid.isNotEmpty) {
      final perUser = _box.get('pending_profile_update_$uid');
      if (perUser is Map) return Map<String, dynamic>.from(perUser);
    }
    final raw = _box.get('pending_profile_update');
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  Future<void> setPendingProfileUpdate(Map<String, dynamic>? data, {String? userId}) async {
    final uid = userId ?? authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (data == null) {
      await _box.delete('pending_profile_update');
      if (uid != null && uid.isNotEmpty) {
        await _box.delete('pending_profile_update_$uid');
      }
    } else {
      await _box.put('pending_profile_update', data);
      if (uid != null && uid.isNotEmpty) {
        await _box.put('pending_profile_update_$uid', data);
      }
    }
  }

  Map<String, dynamic>? get pendingPasswordChange {
    final uid = authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (uid != null && uid.isNotEmpty) {
      final perUser = _box.get('pending_password_change_$uid');
      if (perUser is Map) return Map<String, dynamic>.from(perUser);
    }
    final raw = _box.get('pending_password_change');
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  Future<void> setPendingPasswordChange(Map<String, dynamic>? data, {String? userId}) async {
    final uid = userId ?? authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (data == null) {
      await _box.delete('pending_password_change');
      if (uid != null && uid.isNotEmpty) {
        await _box.delete('pending_password_change_$uid');
      }
    } else {
      await _box.put('pending_password_change', data);
      if (uid != null && uid.isNotEmpty) {
        await _box.put('pending_password_change_$uid', data);
      }
    }
  }

  Future<bool> refreshProfileFromServer() async {
    final token = authToken;
    if (token == null || token.isEmpty) return false;
    try {
      final serverUser = await AuthApi.getCurrentUser(token: token);
      final current = authUser ?? <String, dynamic>{};
      final merged = Map<String, dynamic>.from(current);

      for (final key in [
        'first_name', 'middle_initial', 'last_name', 'email', 'contact_number',
        'purok', 'barangay', 'municipality', 'role', 'full_name', 'username'
      ]) {
        if (serverUser[key] != null) {
          merged[key] = serverUser[key];
        }
      }

      // If no local pending photo, adopt server photo
      if (pendingProfilePicturePath == null || pendingProfilePicturePath!.isEmpty) {
        merged['profile_picture'] = serverUser['profile_picture'];
      }

      await setAuthUser(merged);
      AppDataBus.notifyChanged();
      return true;
    } catch (e) {
      debugPrint('[SettingsRepository] refreshProfileFromServer error: $e');
      return false;
    }
  }

  Future<bool> syncPendingProfileChanges() async {
    final token = authToken;
    final uid = authUser?['user_id']?.toString() ?? _box.get('last_user_id')?.toString();
    if (token == null || token.isEmpty || uid == null || uid.isEmpty) return false;

    bool anySynced = false;

    // 1. Pending profile details
    final pendingUpdate = pendingProfileUpdate;
    if (pendingUpdate != null) {
      try {
        await AuthApi.updateProfile(userId: uid, token: token, data: pendingUpdate);
        await setPendingProfileUpdate(null, userId: uid);
        anySynced = true;
      } catch (e) {
        debugPrint('[SettingsRepository] Error syncing profile update: $e');
      }
    }

    // 2. Pending profile picture
    final pendingPic = pendingProfilePicturePath;
    if (pendingPic != null && pendingPic.isNotEmpty) {
      final file = File(pendingPic);
      if (file.existsSync()) {
        try {
          final uploaded = await AuthApi.uploadProfilePicture(
            userId: uid,
            filePath: pendingPic,
            token: token,
          );
          if (uploaded != null && uploaded['profile_picture'] != null) {
            final serverUser = Map<String, dynamic>.from(authUser ?? {});
            serverUser['profile_picture'] = uploaded['profile_picture'].toString();
            await setAuthUser(serverUser);
            await setPendingProfilePicturePath(null, userId: uid);
            anySynced = true;
          }
        } catch (e) {
          debugPrint('[SettingsRepository] Error syncing profile picture: $e');
        }
      } else {
        await setPendingProfilePicturePath(null, userId: uid);
      }
    }

    // 3. Pending password change
    final pendingPass = pendingPasswordChange;
    if (pendingPass != null) {
      try {
        await AuthApi.changePassword(
          userId: uid,
          token: token,
          currentPassword: (pendingPass['current_password'] ?? '').toString(),
          newPassword: (pendingPass['new_password'] ?? '').toString(),
        );
        await setPendingPasswordChange(null, userId: uid);
        anySynced = true;
      } catch (e) {
        debugPrint('[SettingsRepository] Error syncing password change: $e');
      }
    }

    if (anySynced) {
      await refreshProfileFromServer();
      AppDataBus.notifyChanged();
    }

    return anySynced;
  }

  Future<void> clearSession() async {
    await _box.delete('auth_token');
    await _box.delete('auth_user');
    await _box.delete('session_expires_at');
    // Preserves user-keyed pending profile pictures and local photo paths across logout
  }
}
