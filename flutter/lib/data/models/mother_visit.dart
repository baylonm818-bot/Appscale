import '../../core/utils/safe_parser.dart';

class MotherVisit {
  final DateTime date;
  final bool present;
  final String? breastfeedingPractice; // null if missed
  final List<String> topicsCounseled;
  final bool hasMedicalConcern;
  final String? concernNote;
  final String?
  observation; // 'Appears well' or 'Signs of concern' — null if missed
  final String? observationNote;

  final bool needsReferral;
  final DateTime? createdAt;

  const MotherVisit({
    required this.date,
    required this.present,
    this.breastfeedingPractice,
    this.topicsCounseled = const [],
    this.hasMedicalConcern = false,
    this.concernNote,
    this.observation,
    this.observationNote,
    this.needsReferral = false,
    this.createdAt,
  });

  bool get stoppedBreastfeeding =>
      breastfeedingPractice == 'Stopped breastfeeding';

  bool get isReferralNeeded =>
      needsReferral ||
      hasMedicalConcern ||
      observation == 'Signs of concern';

  DateTime get effectiveCreatedAt => createdAt ?? date;

  Map<String, dynamic> toMap() => {
    'date': SafeParser.toDateString(date),
    'present': present,
    'breastfeedingPractice': breastfeedingPractice,
    'topicsCounseled': topicsCounseled,
    'hasMedicalConcern': hasMedicalConcern,
    'concernNote': concernNote,
    'observation': observation,
    'observationNote': observationNote,
    'needsReferral': isReferralNeeded,
    'createdAt': effectiveCreatedAt.toIso8601String(),
  };

  factory MotherVisit.fromMap(Map map) => MotherVisit(
    date: SafeParser.asDate(map['date'] ?? map['service_date']) ?? DateTime.now(),
    present: SafeParser.asNonNullBool(map['present'], true),
    breastfeedingPractice: SafeParser.asString(map['breastfeedingPractice'] ?? map['dosage']),
    topicsCounseled: (map['topicsCounseled'] as List?)?.map((e) => e.toString()).toList() ??
        (map['service_name'] != null ? [map['service_name'].toString()] : []),
    hasMedicalConcern: SafeParser.asNonNullBool(map['hasMedicalConcern'], false),
    concernNote: SafeParser.asString(map['concernNote']),
    observation: SafeParser.asString(map['observation']),
    observationNote: SafeParser.asString(map['observationNote']),
    needsReferral: SafeParser.asNonNullBool(
      map['needsReferral'],
      SafeParser.asNonNullBool(map['hasMedicalConcern'], false) ||
          SafeParser.asString(map['observation']) == 'Signs of concern',
    ),
    createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']),
  );
}
