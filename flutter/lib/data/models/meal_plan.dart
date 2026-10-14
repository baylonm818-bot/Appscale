import '../../core/utils/safe_parser.dart';

class MealPlan {
  final String id;
  final List<String> foodItems;
  final DateTime effectiveFrom;
  final DateTime? effectiveTo; // null = active until a new plan replaces it
  final String barangay;
  final DateTime createdAt;

  const MealPlan({
    required this.id,
    required this.foodItems,
    required this.effectiveFrom,
    this.effectiveTo,
    required this.barangay,
    required this.createdAt,
  });

  String get itemsSummary => foodItems.join(', ');

  MealPlan copyWith({DateTime? effectiveTo}) => MealPlan(
    id: id,
    foodItems: foodItems,
    effectiveFrom: effectiveFrom,
    effectiveTo: effectiveTo ?? this.effectiveTo,
    barangay: barangay,
    createdAt: createdAt,
  );

  Map<String, dynamic> toMap() => {
    'id': id,
    'foodItems': foodItems,
    'effectiveFrom': SafeParser.toDateString(effectiveFrom),
    'effectiveTo': effectiveTo != null ? SafeParser.toDateString(effectiveTo!) : null,
    'barangay': barangay,
    'createdAt': createdAt.toIso8601String(),
  };

  factory MealPlan.fromMap(Map map) => MealPlan(
    id: SafeParser.asNonNullString(map['id'] ?? map['plan_id'] ?? map['external_id']),
    foodItems: (map['foodItems'] as List?)?.map((e) => e.toString()).toList() ??
        (map['meal_name'] != null ? [map['meal_name'].toString()] : []),
    effectiveFrom: SafeParser.asDate(map['effectiveFrom'] ?? map['effective_from'] ?? map['created_at']) ?? DateTime.now(),
    effectiveTo: SafeParser.asDate(map['effectiveTo'] ?? map['effective_to']),
    barangay: SafeParser.asNonNullString(map['barangay']),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']) ?? DateTime.now(),
  );
}
