import 'child.dart';
import 'measurement.dart';

/// Evaluates child improvement during the feeding program by comparing
/// the latest measurement against the weighing at enrollment (or earliest baseline).
class FeedingChildProgress {
  final Measurement? baseline;
  final Measurement? latest;
  final String status; // 'Improved' | 'No change' | 'Declined'
  final double? weightDiff;

  const FeedingChildProgress({
    this.baseline,
    this.latest,
    required this.status,
    this.weightDiff,
  });

  static FeedingChildProgress evaluate(
    Child child,
    List<Measurement> allMeasurements, {
    DateTime? sessionDate,
  }) {
    final valid = allMeasurements
        .where((m) =>
            m.isPlausible &&
            (sessionDate == null ||
                !m.date.isAfter(DateTime(
                  sessionDate.year,
                  sessionDate.month,
                  sessionDate.day,
                  23,
                  59,
                  59,
                ))))
        .toList();
    valid.sort((a, b) => a.date.compareTo(b.date)); // Oldest to newest

    if (valid.isEmpty) {
      return const FeedingChildProgress(status: 'No change');
    }

    final baseline = valid.first;
    final latest = valid.last;

    if (valid.length == 1) {
      return FeedingChildProgress(
        baseline: baseline,
        latest: latest,
        status: 'No change',
        weightDiff: 0.0,
      );
    }

    final diff = latest.weightKg - baseline.weightKg;

    // Numerical rank for status comparison: SAM (0) < MAM (1) < Underweight (2) < Normal (3)
    int rank(String? s) {
      if (s == null) return 2;
      final lower = s.toLowerCase();
      if (lower.contains('sam') || lower.contains('severely wasted')) return 0;
      if (lower.contains('mam') || lower.contains('moderately wasted')) return 1;
      if (lower.contains('severely underweight') || lower.contains('severely stunted')) return 1;
      if (lower.contains('underweight') || lower.contains('stunted')) return 2;
      if (lower.contains('normal')) return 3;
      return 2;
    }

    final baseStatus = baseline.effectiveWastingStatus.isNotEmpty
        ? baseline.effectiveWastingStatus
        : baseline.weightForAgeStatus;
    final latestStatus = latest.effectiveWastingStatus.isNotEmpty
        ? latest.effectiveWastingStatus
        : latest.weightForAgeStatus;

    final baseRank = rank(baseStatus);
    final latestRank = rank(latestStatus);

    String status = 'No change';
    if (latestRank > baseRank || diff >= 0.1) {
      status = 'Improved';
    } else if (latestRank < baseRank || diff <= -0.1) {
      status = 'Declined';
    } else {
      status = 'No change';
    }

    return FeedingChildProgress(
      baseline: baseline,
      latest: latest,
      status: status,
      weightDiff: diff,
    );
  }
}
