import '../../core/utils/safe_parser.dart';

/// Represents a single feeding day/session in the feeding program.
class FeedingSession {
  final String id;
  final String programId;
  final DateTime date;
  final String status; // 'Scheduled' | 'Ongoing' | 'Completed'
  final List<String> menuItems;
  final String? feedbackNotes;
  final String? leftovers; // 'None' | 'Minimal (<10%)' | 'Moderate (10-30%)' | 'High (>30%)'
  final String? appetite; // 'Good (Eaten well)' | 'Fair' | 'Poor'
  final String barangay;
  final DateTime createdAt;

  const FeedingSession({
    required this.id,
    required this.programId,
    required this.date,
    required this.status,
    required this.menuItems,
    this.feedbackNotes,
    this.leftovers,
    this.appetite,
    required this.barangay,
    required this.createdAt,
  });

  String get menuSummary =>
      menuItems.isNotEmpty ? menuItems.join(', ') : 'Supplemental Nutritious Meal';

  FeedingSession copyWith({
    String? id,
    String? programId,
    DateTime? date,
    String? status,
    List<String>? menuItems,
    String? feedbackNotes,
    String? leftovers,
    String? appetite,
    String? barangay,
    DateTime? createdAt,
  }) {
    return FeedingSession(
      id: id ?? this.id,
      programId: programId ?? this.programId,
      date: date ?? this.date,
      status: status ?? this.status,
      menuItems: menuItems ?? this.menuItems,
      feedbackNotes: feedbackNotes ?? this.feedbackNotes,
      leftovers: leftovers ?? this.leftovers,
      appetite: appetite ?? this.appetite,
      barangay: barangay ?? this.barangay,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'programId': programId,
    'date': SafeParser.toDateString(date),
    'status': status,
    'menuItems': menuItems,
    'feedbackNotes': feedbackNotes,
    'leftovers': leftovers,
    'appetite': appetite,
    'barangay': barangay,
    'createdAt': createdAt.toIso8601String(),
  };

  factory FeedingSession.fromMap(Map map) {
    List<String> items = [];
    if (map['menuItems'] is List) {
      items = (map['menuItems'] as List).map((e) => e.toString()).toList();
    } else if (map['food'] != null && map['food'].toString().isNotEmpty) {
      items = [map['food'].toString()];
    }

    return FeedingSession(
      id: SafeParser.asNonNullString(map['id']),
      programId: SafeParser.asNonNullString(
        map['programId'] ?? map['program_id'],
        'feeding_prog',
      ),
      date: SafeParser.asDate(map['date']) ?? DateTime.now(),
      status: SafeParser.asNonNullString(map['status'], 'Completed'),
      menuItems: items,
      feedbackNotes: SafeParser.asString(map['feedbackNotes'] ?? map['notes']),
      leftovers: SafeParser.asString(map['leftovers']),
      appetite: SafeParser.asString(map['appetite']),
      barangay: SafeParser.asNonNullString(map['barangay']),
      createdAt:
          SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ??
          DateTime.now(),
    );
  }
}
