import '../../core/utils/safe_parser.dart';

class FeedingFeedback {
  final String id;
  final DateTime date;
  final String note;
  final String? tag; // 'Went well' or 'Needs improvement' — a field
  // observation only, never rolled into a percentage.
  final String barangay;

  const FeedingFeedback({
    required this.id,
    required this.date,
    required this.note,
    this.tag,
    required this.barangay,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'date': SafeParser.toDateString(date),
    'note': note,
    'tag': tag,
    'barangay': barangay,
  };

  factory FeedingFeedback.fromMap(Map map) => FeedingFeedback(
    id: SafeParser.asNonNullString(map['id']),
    date: SafeParser.asDate(map['date']) ?? DateTime.now(),
    note: SafeParser.asNonNullString(map['note']),
    tag: SafeParser.asString(map['tag']),
    barangay: SafeParser.asNonNullString(map['barangay']),
  );
}
