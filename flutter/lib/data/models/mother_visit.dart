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
    'date': date.toIso8601String(),
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

  factory MotherVisit.fromMap(Map<String, dynamic> map) => MotherVisit(
    date: DateTime.parse(map['date'] as String),
    present: map['present'] as bool,
    breastfeedingPractice: map['breastfeedingPractice'] as String?,
    topicsCounseled:
        (map['topicsCounseled'] as List?)?.map((e) => e.toString()).toList() ??
        [],
    hasMedicalConcern: map['hasMedicalConcern'] as bool? ?? false,
    concernNote: map['concernNote'] as String?,
    observation: map['observation'] as String?,
    observationNote: map['observationNote'] as String?,
    needsReferral: map['needsReferral'] as bool? ??
        ((map['hasMedicalConcern'] as bool? ?? false) ||
            map['observation'] == 'Signs of concern'),
    createdAt: map['createdAt'] != null
        ? DateTime.tryParse(map['createdAt'] as String)
        : null,
  );
}
