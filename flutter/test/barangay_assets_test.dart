import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/shared/utils/barangay_assets.dart';

void main() {
  group('Barangay Assets & Logo Mapping Tests', () {
    test('Correctly maps all 25 Gasan barangays to their seal assets', () {
      final expectations = {
        'Antipolo': 'antipolo.png',
        'B. Ibaba': 'bachao_ibaba.png',
        'Bachao Ibaba': 'bachao_ibaba.png',
        'B. Ilaya': 'bachao_ilaya.png',
        'Bachao Ilaya': 'bachao_ilaya.png',
        'Bacong-Bacong': 'bacong_bacong.png',
        'Bahi': 'bahi.png',
        'Bangbang': 'bangbang.png',
        'Banot': 'banot.png',
        'Banuyo': 'banuyo.png',
        'Bognuyan': 'bognuyan.png',
        'Cabugao': 'cabugao.png',
        'Dawis': 'dawis.png',
        'Dili': 'dili.png',
        'Libtangin': 'libtangin.png',
        'Mahunig': 'mahunig.png',
        'Mangiliol': 'mangiliol.png',
        'Masiga': 'masiga.png',
        'Mat. Gasan': 'matandang_gasan.png',
        'Matandang Gasan': 'matandang_gasan.png',
        'Pangi': 'pangi.png',
        'Pinggan': 'pinggan.png',
        'Tabionan': 'tabionan.png',
        'Tapuyan': 'tapuyan.png',
        'Tiguion': 'tiguion.png',
        'Brgy. Uno': 'brgy_uno.png',
        'Barangay Uno': 'brgy_uno.png',
        'Brgy. Dos': 'brgy_dos.png',
        'Barangay Dos': 'brgy_dos.png',
        'Brgy. Tres': 'brgy_tres.png',
        'Barangay Tres': 'brgy_tres.png',
      };

      for (final entry in expectations.entries) {
        final fileName = getBarangaySealFileName(entry.key);
        expect(fileName, equals(entry.value), reason: 'Failed for ${entry.key}');
        expect(getBarangaySealAssetPath(entry.key), equals('assets/images/barangays/${entry.value}'));
      }
    });

    test('Gracefully defaults to tiguion.png when barangay is empty or null', () {
      expect(getBarangaySealFileName(null), equals('tiguion.png'));
      expect(getBarangaySealFileName(''), equals('tiguion.png'));
      expect(getBarangaySealAssetPath(null), equals('assets/images/barangays/tiguion.png'));
    });
  });
}
