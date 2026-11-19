import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/core/services/app_update_service.dart';

void main() {
  group('AppUpdateInfo Tests', () {
    test('Calculates hasUpdate correctly when newer versionCode is available', () {
      const info = AppUpdateInfo(
        hasUpdate: true,
        currentVersion: '3.2.0',
        latestVersion: '3.3.0',
        currentVersionCode: 32,
        latestVersionCode: 33,
        hasApk: true,
        downloadUrl: 'https://example.com/api/download-apk',
        fileSizeBytes: 25 * 1024 * 1024,
        releaseNotes: 'Purok improvements and dashboard fixes',
      );

      expect(info.hasUpdate, isTrue);
      expect(info.latestVersion, '3.3.0');
      expect(info.fileSizeFormatted, '25.0 MB');
    });

    test('hasUpdate is false when version is already up to date', () {
      const info = AppUpdateInfo(
        hasUpdate: false,
        currentVersion: '3.2.0',
        latestVersion: '3.2.0',
        currentVersionCode: 32,
        latestVersionCode: 32,
        hasApk: true,
        downloadUrl: 'https://example.com/api/download-apk',
        fileSizeBytes: 20 * 1024 * 1024,
        releaseNotes: 'No changes',
      );

      expect(info.hasUpdate, isFalse);
    });

    test('hasUpdate is false when server has no APK file', () {
      const info = AppUpdateInfo(
        hasUpdate: false,
        currentVersion: '3.2.0',
        latestVersion: '3.3.0',
        currentVersionCode: 32,
        latestVersionCode: 33,
        hasApk: false,
        downloadUrl: 'https://example.com/api/download-apk',
        fileSizeBytes: 0,
        releaseNotes: 'No APK',
      );

      expect(info.hasUpdate, isFalse);
      expect(info.fileSizeFormatted, '');
    });
  });
}
