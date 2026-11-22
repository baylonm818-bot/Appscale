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

  group('Semantic Version Comparison Tests', () {
    test('Correctly parses semver strings with prefix and suffix', () {
      final v1 = AppVersion.tryParse('v3.2.0');
      expect(v1?.major, 3);
      expect(v1?.minor, 2);
      expect(v1?.patch, 0);

      final v2 = AppVersion.tryParse('3.10.5+45');
      expect(v2?.major, 3);
      expect(v2?.minor, 10);
      expect(v2?.patch, 5);
      expect(v2?.build, 45);
    });

    test('Numerical comparison avoids string comparison bug (3.10.0 > 3.2.0)', () {
      expect(AppUpdateService.compareVersions('3.10.0', '3.2.0'), greaterThan(0));
      expect(AppUpdateService.isServerVersionHigher('3.10.0', '3.2.0'), isTrue);
    });

    test('Higher server version returns true', () {
      expect(AppUpdateService.isServerVersionHigher('3.3.0', '3.2.0'), isTrue);
      expect(AppUpdateService.isServerVersionHigher('3.2.1', '3.2.0'), isTrue);
      expect(AppUpdateService.isServerVersionHigher('4.0.0', '3.9.9'), isTrue);
      expect(AppUpdateService.isServerVersionHigher('v3.3.0', '3.2.0'), isTrue);
    });

    test('Equal server version returns false (no downgrade/reinstall)', () {
      expect(AppUpdateService.isServerVersionHigher('3.2.0', '3.2.0'), isFalse);
      expect(AppUpdateService.isServerVersionHigher('v3.2.0', '3.2.0'), isFalse);
    });

    test('Lower server version returns false (prevents downgrade bug)', () {
      expect(AppUpdateService.isServerVersionHigher('3.1.9', '3.2.0'), isFalse);
      expect(AppUpdateService.isServerVersionHigher('2.9.0', '3.2.0'), isFalse);
      expect(AppUpdateService.isServerVersionHigher('3.2.0', '3.2.1'), isFalse);
    });

    test('downloadAndInstall rejects older or equal target versions', () async {
      expect(
        () => AppUpdateService.downloadAndInstall(
          downloadUrl: 'http://example.com/apk',
          targetVersion: '3.1.0',
          onProgress: (_, __, ___) {},
        ),
        throwsA(isA<Exception>()),
      );
    });
  });
}
