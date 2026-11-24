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
  final String? signature;

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
    this.signature,
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
    'signature': signature,
  };

  factory MotherVisit.fromMap(Map map) {
    String? rawObservation = SafeParser.asString(map['observation']);
    String? obsNote = SafeParser.asString(map['observationNote'] ?? map['notes']);
    String? concernNote = SafeParser.asString(map['concernNote']);
    bool hasConcern = SafeParser.asNonNullBool(map['hasMedicalConcern'], false);
    final feeding = SafeParser.asString(map['breastfeedingPractice'] ?? map['dosage']);

    // Parse structured notes if present from synced or legacy records
    if (obsNote != null && obsNote.isNotEmpty) {
      if (obsNote.contains('Signs of concern') || (rawObservation != null && rawObservation.contains('Signs of concern'))) {
        rawObservation = 'Signs of concern';
      }
      if (obsNote.contains('Concern:')) {
        hasConcern = true;
        final parts = obsNote.split('Concern:');
        if (parts.length > 1 && (concernNote == null || concernNote.isEmpty)) {
          concernNote = parts[1].trim();
          obsNote = parts[0].trim();
        }
      }
      if (obsNote.startsWith('Observation:')) {
        obsNote = obsNote.replaceFirst('Observation:', '').trim();
        if (obsNote.startsWith('Signs of concern') || obsNote.startsWith('Appears well')) {
          final afterObs = obsNote.replaceFirst(RegExp(r'^(Signs of concern|Appears well)[\.\s·]*'), '').trim();
          obsNote = afterObs.isNotEmpty ? afterObs : null;
        }
      }
    }

    if (rawObservation == null || rawObservation.isEmpty) {
      rawObservation = (obsNote != null && obsNote.toLowerCase().contains('concern')) || hasConcern
          ? 'Signs of concern'
          : 'Appears well';
    }

    return MotherVisit(
      date: SafeParser.asDate(map['date'] ?? map['service_date']) ?? DateTime.now(),
      present: SafeParser.asNonNullBool(map['present'], true),
      breastfeedingPractice: feeding,
      topicsCounseled: (map['topicsCounseled'] as List?)?.map((e) => e.toString()).toList() ??
          (map['service_name'] != null ? [map['service_name'].toString()] : []),
      hasMedicalConcern: hasConcern || (concernNote != null && concernNote.isNotEmpty),
      concernNote: concernNote,
      observation: rawObservation,
      observationNote: obsNote,
      needsReferral: SafeParser.asNonNullBool(
        map['needsReferral'],
        hasConcern || rawObservation == 'Signs of concern',
      ),
      createdAt: SafeParser.asDateTime(map['createdAt'] ?? map['created_at']),
      signature: SafeParser.asString(map['signature']),
    );
  }
}
