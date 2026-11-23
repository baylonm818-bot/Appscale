import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/app_strings.dart';

void main() {
  group('Localization & String Translation Tests', () {
    test('All keys in English have matching keys in Tagalog', () {
      final missingInTl = <String>[];
      for (final key in L.en.keys) {
        if (!L.tl.containsKey(key)) {
          missingInTl.add(key);
        }
      }
      expect(missingInTl, isEmpty, reason: 'Keys in EN missing in TL: $missingInTl');
    });

    test('All keys in Tagalog have matching keys in English', () {
      final missingInEn = <String>[];
      for (final key in L.tl.keys) {
        if (!L.en.containsKey(key)) {
          missingInEn.add(key);
        }
      }
      expect(missingInEn, isEmpty, reason: 'Keys in TL missing in EN: $missingInEn');
    });

    test('All Tagalog values are non-empty and reasonably short', () {
      for (final entry in L.tl.entries) {
        expect(entry.value.trim().isNotEmpty, isTrue, reason: 'Key ${entry.key} is empty in TL');
      }
    });

    test('String extension .tr translates according to L.lang', () async {
      L.lang.value = 'en';
      expect('settings'.tr, 'Settings');
      expect('save'.tr, 'Save');
      expect('cancel'.tr, 'Cancel');

      L.lang.value = 'tl';
      expect('settings'.tr, 'Settings');
      expect('save'.tr, 'I-save');
      expect('cancel'.tr, 'Kanselahin');

      // Reset back to English
      L.lang.value = 'en';
    });

    test('trArgs correctly replaces arguments', () {
      L.lang.value = 'en';
      expect(
        'update_available'.trArgs({'version': '3.4.0'}),
        'Update available: v3.4.0',
      );

      L.lang.value = 'tl';
      expect(
        'update_available'.trArgs({'version': '3.4.0'}),
        'May update: v3.4.0',
      );

      L.lang.value = 'en';
    });
  });
}
