class GrowthAgeRange {
  final int minMonth;
  final int maxMonth;
  final double hardMinWeight;
  final double softMinWeight;
  final double softMaxWeight;
  final double hardMaxWeight;
  final double hardMinHeight;
  final double softMinHeight;
  final double softMaxHeight;
  final double hardMaxHeight;

  const GrowthAgeRange({
    required this.minMonth,
    required this.maxMonth,
    required this.hardMinWeight,
    required this.softMinWeight,
    required this.softMaxWeight,
    required this.hardMaxWeight,
    required this.hardMinHeight,
    required this.softMinHeight,
    required this.softMaxHeight,
    required this.hardMaxHeight,
  });

  String get expectedWeightLabel {
    final minStr = softMinWeight.truncateToDouble() == softMinWeight
        ? softMinWeight.toInt().toString()
        : softMinWeight.toStringAsFixed(1);
    final maxStr = softMaxWeight.truncateToDouble() == softMaxWeight
        ? softMaxWeight.toInt().toString()
        : softMaxWeight.toStringAsFixed(1);
    return '$minStr-$maxStr kg';
  }

  String get expectedHeightLabel {
    final minStr = softMinHeight.truncateToDouble() == softMinHeight
        ? softMinHeight.toInt().toString()
        : softMinHeight.toStringAsFixed(1);
    final maxStr = softMaxHeight.truncateToDouble() == softMaxHeight
        ? softMaxHeight.toInt().toString()
        : softMaxHeight.toStringAsFixed(1);
    return '$minStr-$maxStr cm';
  }
}

class GrowthRangeConfig {
  const GrowthRangeConfig._();

  static const List<GrowthAgeRange> table = [
    // 0-1 month
    GrowthAgeRange(
      minMonth: 0,
      maxMonth: 1,
      hardMinWeight: 1.2,
      softMinWeight: 2.2,
      softMaxWeight: 6.0,
      hardMaxWeight: 7.5,
      hardMinHeight: 38.0,
      softMinHeight: 44.0,
      softMaxHeight: 60.0,
      hardMaxHeight: 66.0,
    ),
    // 2-3 months
    GrowthAgeRange(
      minMonth: 2,
      maxMonth: 3,
      hardMinWeight: 1.8,
      softMinWeight: 3.0,
      softMaxWeight: 8.5,
      hardMaxWeight: 10.5,
      hardMinHeight: 42.0,
      softMinHeight: 48.0,
      softMaxHeight: 68.0,
      hardMaxHeight: 75.0,
    ),
    // 4-6 months (e.g. 6 mos: weight expected 3-12 kg, height expected 55-80 cm)
    GrowthAgeRange(
      minMonth: 4,
      maxMonth: 6,
      hardMinWeight: 2.2,
      softMinWeight: 3.0,
      softMaxWeight: 12.0,
      hardMaxWeight: 15.0,
      hardMinHeight: 48.0,
      softMinHeight: 55.0,
      softMaxHeight: 80.0,
      hardMaxHeight: 86.0,
    ),
    // 7-11 months
    GrowthAgeRange(
      minMonth: 7,
      maxMonth: 11,
      hardMinWeight: 3.0,
      softMinWeight: 4.5,
      softMaxWeight: 13.5,
      hardMaxWeight: 17.5,
      hardMinHeight: 50.0,
      softMinHeight: 58.0,
      softMaxHeight: 85.0,
      hardMaxHeight: 93.0,
    ),
    // 12-23 months (1 year)
    GrowthAgeRange(
      minMonth: 12,
      maxMonth: 23,
      hardMinWeight: 4.0,
      softMinWeight: 5.5,
      softMaxWeight: 16.5,
      hardMaxWeight: 21.0,
      hardMinHeight: 55.0,
      softMinHeight: 65.0,
      softMaxHeight: 95.0,
      hardMaxHeight: 105.0,
    ),
    // 24-35 months (2 years)
    GrowthAgeRange(
      minMonth: 24,
      maxMonth: 35,
      hardMinWeight: 5.0,
      softMinWeight: 7.0,
      softMaxWeight: 19.5,
      hardMaxWeight: 26.0,
      hardMinHeight: 62.0,
      softMinHeight: 74.0,
      softMaxHeight: 105.0,
      hardMaxHeight: 116.0,
    ),
    // 36-47 months (3 years)
    GrowthAgeRange(
      minMonth: 36,
      maxMonth: 47,
      hardMinWeight: 6.0,
      softMinWeight: 8.5,
      softMaxWeight: 22.5,
      hardMaxWeight: 30.0,
      hardMinHeight: 68.0,
      softMinHeight: 80.0,
      softMaxHeight: 115.0,
      hardMaxHeight: 126.0,
    ),
    // 48-59 months (4 years)
    GrowthAgeRange(
      minMonth: 48,
      maxMonth: 59,
      hardMinWeight: 7.0,
      softMinWeight: 9.5,
      softMaxWeight: 26.0,
      hardMaxWeight: 35.0,
      hardMinHeight: 72.0,
      softMinHeight: 85.0,
      softMaxHeight: 125.0,
      hardMaxHeight: 136.0,
    ),
    // 60+ months (fallback)
    GrowthAgeRange(
      minMonth: 60,
      maxMonth: 120,
      hardMinWeight: 8.0,
      softMinWeight: 10.0,
      softMaxWeight: 35.0,
      hardMaxWeight: 50.0,
      hardMinHeight: 75.0,
      softMinHeight: 90.0,
      softMaxHeight: 135.0,
      hardMaxHeight: 150.0,
    ),
  ];

  static GrowthAgeRange getForAge(int ageMonths) {
    for (final r in table) {
      if (ageMonths >= r.minMonth && ageMonths <= r.maxMonth) {
        return r;
      }
    }
    return table.last;
  }
}
