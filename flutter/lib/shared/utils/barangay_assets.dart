/// Helper utilities for resolving official barangay logos and seal assets.
library;

String getBarangaySealFileName(String? barangayName) {
  if (barangayName == null || barangayName.isEmpty) return 'tiguion.png';
  final clean = barangayName.trim().toLowerCase().replaceAll(RegExp(r"['.]"), '');
  if (clean.contains('antipolo')) return 'antipolo.png';
  if (clean.contains('ibaba')) return 'bachao_ibaba.png';
  if (clean.contains('ilaya')) return 'bachao_ilaya.png';
  if (clean.contains('bacong')) return 'bacong_bacong.png';
  if (clean.contains('bahi')) return 'bahi.png';
  if (clean.contains('bangbang')) return 'bangbang.png';
  if (clean.contains('banot')) return 'banot.png';
  if (clean.contains('banuyo')) return 'banuyo.png';
  if (clean.contains('bognuyan')) return 'bognuyan.png';
  if (clean.contains('cabugao')) return 'cabugao.png';
  if (clean.contains('dawis')) return 'dawis.png';
  if (clean.contains('dili')) return 'dili.png';
  if (clean.contains('libtangin')) return 'libtangin.png';
  if (clean.contains('mahunig')) return 'mahunig.png';
  if (clean.contains('mangiliol')) return 'mangiliol.png';
  if (clean.contains('masiga')) return 'masiga.png';
  if (clean.contains('mat') || clean.contains('matandang')) return 'matandang_gasan.png';
  if (clean.contains('pangi')) return 'pangi.png';
  if (clean.contains('pinggan')) return 'pinggan.png';
  if (clean.contains('tabionan')) return 'tabionan.png';
  if (clean.contains('tapuyan')) return 'tapuyan.png';
  if (clean.contains('uno') || clean.endsWith(' 1') || clean.endsWith('-1')) return 'brgy_uno.png';
  if (clean.contains('dos') || clean.endsWith(' 2') || clean.endsWith('-2')) return 'brgy_dos.png';
  if (clean.contains('tres') || clean.endsWith(' 3') || clean.endsWith('-3')) return 'brgy_tres.png';
  if (clean.contains('tiguion')) return 'tiguion.png';
  return 'tiguion.png';
}

String getBarangaySealAssetPath(String? barangayName) {
  return 'assets/images/barangays/${getBarangaySealFileName(barangayName)}';
}
