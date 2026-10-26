/// SD cutoff points from a single row of an NNC/WHO growth standards
/// table. Also supports optional median, posThreeSD, and LMS parameters for exact z-score calculation.
class SdThresholds {
  final double negThreeSD;
  final double negTwoSD;
  final double? negOneSD;
  final double? median;
  final double? posOneSD;
  final double posTwoSD;
  final double? posThreeSD;
  final double? l;
  final double? m;
  final double? s;

  const SdThresholds({
    required this.negThreeSD,
    required this.negTwoSD,
    this.negOneSD,
    this.median,
    this.posOneSD,
    required this.posTwoSD,
    this.posThreeSD,
    this.l,
    this.m,
    this.s,
  });
}

