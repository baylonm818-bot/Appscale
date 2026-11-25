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

    // Distance from Normal (0 = Normal, 1 = Mild/At-risk, 2 = Moderate, 3 = Severe)
    int distanceToNormal(String? s) {
      if (s == null) return 1;
      final lower = s.toLowerCase();
      if (lower.contains('sam') || lower.contains('severely wasted')) return 3;
      if (lower.contains('severely underweight') || lower.contains('severely stunted') || lower.contains('obese')) return 2;
      if (lower.contains('mam') || lower.contains('moderately wasted')) return 2;
      if (lower.contains('underweight') || lower.contains('stunted') || lower.contains('overweight')) return 1;
      if (lower.contains('normal')) return 0;
      return 1;
    }

    bool isHighWeight(String? s) {
      if (s == null) return false;
      final lower = s.toLowerCase();
      return lower.contains('overweight') || lower.contains('obese');
    }

    final baseStatus = baseline.effectiveWastingStatus.isNotEmpty
        ? baseline.effectiveWastingStatus
        : baseline.weightForAgeStatus;
    final latestStatus = latest.effectiveWastingStatus.isNotEmpty
        ? latest.effectiveWastingStatus
        : latest.weightForAgeStatus;

    final baseDist = distanceToNormal(baseStatus);
    final latestDist = distanceToNormal(latestStatus);

    String status = 'No change';
    if (latestDist < baseDist) {
      // Moved closer to Normal status
      status = 'Improved';
    } else if (latestDist > baseDist) {
      // Moved further away from Normal status
      status = 'Declined';
    } else {
      // Same categorical tier: check weight direction relative to target
      final isHigh = isHighWeight(baseStatus) || isHighWeight(latestStatus);
      if (isHigh) {
        if (diff <= -0.1) {
          status = 'Improved';
        } else if (diff >= 0.1) {
          status = 'Declined';
        } else {
          status = 'No change';
        }
      } else {
        if (diff >= 0.1) {
          status = 'Improved';
        } else if (diff <= -0.1) {
          status = 'Declined';
        } else {
          status = 'No change';
        }
      }
    }

    return FeedingChildProgress(
      baseline: baseline,
      latest: latest,
      status: status,
      weightDiff: diff,
    );
  }
}
