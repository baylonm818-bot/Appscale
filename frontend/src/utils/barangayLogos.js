// Utility to resolve barangay seal asset path for reports & display

export function getBarangaySealPath(barangayName) {
  if (!barangayName) return '/assets/barangays/tiguion.png';
  const clean = String(barangayName).trim().toLowerCase().replace(/['.]/g, '');
  if (clean.includes('antipolo')) return '/assets/barangays/antipolo.png';
  if (clean.includes('ibaba')) return '/assets/barangays/bachao_ibaba.png';
  if (clean.includes('ilaya')) return '/assets/barangays/bachao_ilaya.png';
  if (clean.includes('bacong')) return '/assets/barangays/bacong_bacong.png';
  if (clean.includes('bahi')) return '/assets/barangays/bahi.png';
  if (clean.includes('bangbang')) return '/assets/barangays/bangbang.png';
  if (clean.includes('banot')) return '/assets/barangays/banot.png';
  if (clean.includes('banuyo')) return '/assets/barangays/banuyo.png';
  if (clean.includes('bognuyan')) return '/assets/barangays/bognuyan.png';
  if (clean.includes('cabugao')) return '/assets/barangays/cabugao.png';
  if (clean.includes('dawis')) return '/assets/barangays/dawis.png';
  if (clean.includes('dili')) return '/assets/barangays/dili.png';
  if (clean.includes('libtangin')) return '/assets/barangays/libtangin.png';
  if (clean.includes('mahunig')) return '/assets/barangays/mahunig.png';
  if (clean.includes('mangiliol')) return '/assets/barangays/mangiliol.png';
  if (clean.includes('masiga')) return '/assets/barangays/masiga.png';
  if (clean.includes('mat') || clean.includes('matandang')) return '/assets/barangays/matandang_gasan.png';
  if (clean.includes('pangi')) return '/assets/barangays/pangi.png';
  if (clean.includes('pinggan')) return '/assets/barangays/pinggan.png';
  if (clean.includes('tabionan')) return '/assets/barangays/tabionan.png';
  if (clean.includes('tapuyan')) return '/assets/barangays/tapuyan.png';
  if (clean.includes('uno') || clean.endsWith(' 1') || clean.endsWith('-1')) return '/assets/barangays/brgy_uno.png';
  if (clean.includes('dos') || clean.endsWith(' 2') || clean.endsWith('-2')) return '/assets/barangays/brgy_dos.png';
  if (clean.includes('tres') || clean.endsWith(' 3') || clean.endsWith('-3')) return '/assets/barangays/brgy_tres.png';
  if (clean.includes('tiguion')) return '/assets/barangays/tiguion.png';
  return '/assets/barangays/tiguion.png';
}
