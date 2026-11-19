import '../../core/utils/safe_parser.dart';

class Purok {
  final int id;
  final int barangayId;
  final String barangayName;
  final String name;
  final bool isActive;

  const Purok({
    required this.id,
    required this.barangayId,
    required this.barangayName,
    required this.name,
    this.isActive = true,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'barangay_id': barangayId,
    'barangay_name': barangayName,
    'name': name,
    'is_active': isActive ? 1 : 0,
  };

  factory Purok.fromMap(Map<dynamic, dynamic> map) => Purok(
    id: SafeParser.asNonNullInt(map['id'] ?? map['purok_id'], 0),
    barangayId: SafeParser.asNonNullInt(map['barangay_id'], 0),
    barangayName: SafeParser.asNonNullString(map['barangay_name'] ?? map['barangay']),
    name: SafeParser.asNonNullString(map['name'] ?? map['purok'], 'Purok 1'),
    isActive: SafeParser.asNonNullInt(map['is_active'], 1) == 1,
  );
}
