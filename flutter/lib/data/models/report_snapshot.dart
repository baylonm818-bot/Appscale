import '../../core/utils/safe_parser.dart';

class ReportSnapshot {
  final String id;
  final String reportTypeId;
  final String barangay;
  final String period; // e.g. '2026-09'
  final Map<String, int> counts;
  final DateTime generatedAt;

  const ReportSnapshot({
    required this.id,
    required this.reportTypeId,
    required this.barangay,
    required this.period,
    required this.counts,
    required this.generatedAt,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'reportTypeId': reportTypeId,
    'barangay': barangay,
    'period': period,
    'counts': counts,
    'generatedAt': generatedAt.toIso8601String(),
  };

  factory ReportSnapshot.fromMap(Map map) {
    final rawCounts = map['counts'];
    final countsMap = <String, int>{};
    if (rawCounts is Map) {
      for (final e in rawCounts.entries) {
        countsMap[e.key.toString()] = SafeParser.asNonNullInt(e.value, 0);
      }
    }
    return ReportSnapshot(
      id: SafeParser.asNonNullString(map['id']),
      reportTypeId: SafeParser.asNonNullString(map['reportTypeId']),
      barangay: SafeParser.asNonNullString(map['barangay']),
      period: SafeParser.asNonNullString(map['period']),
      counts: countsMap,
      generatedAt: SafeParser.asDateTime(map['generatedAt']) ?? DateTime.now(),
    );
  }
}
