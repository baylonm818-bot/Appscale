import 'package:hive_flutter/hive_flutter.dart';
import '../models/mother_visit.dart';
import 'app_data_bus.dart';
import 'hive_boxes.dart';
import '../remote/beneficiary_api.dart';

/// Visits stored as a list per mother, keyed by motherId — same pattern
/// as MeasurementRepository. Newest-first, since that's what both the
/// Visits tab and MotherRiskService need.
class MotherVisitRepository {
  Box get _box => Hive.box(HiveBoxes.motherVisits);

  List<MotherVisit> getForMother(String motherId) {
    final raw = _box.get(motherId) as List?;
    if (raw == null) return [];
    final list = raw
        .map((e) => MotherVisit.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
    list.sort((a, b) => b.date.compareTo(a.date));
    return list;
  }

  Future<void> addVisit(String motherId, MotherVisit visit) async {
    final current = (_box.get(motherId) as List?) ?? [];
    final visitMap = visit.toMap()..['_syncStatus'] = 'pending';
    await _box.put(motherId, [...current, visitMap]);
    AppDataBus.notifyChanged();

    final extId = '${motherId}_${visit.date.toIso8601String().split('T').first}';
    try {
      final res = await BeneficiaryApi.syncMotherService(
        externalId: extId,
        motherExternalId: motherId,
        serviceType: 'Maternal Counseling',
        serviceName: visit.topicsCounseled.isNotEmpty
            ? visit.topicsCounseled.join(', ')
            : 'Maternal Counseling',
        serviceDate: visit.date,
        dosage: visit.breastfeedingPractice,
        notes: [
          if (visit.observation != null) 'Observation: ${visit.observation}',
          if (visit.observationNote != null) visit.observationNote,
          if (visit.concernNote != null) 'Concern: ${visit.concernNote}',
        ].join('. '),
      );
      if (res.success) {
        final updated = (_box.get(motherId) as List?) ?? [];
        final mapped = updated.map((v) {
          final m = Map<String, dynamic>.from(v as Map);
          if (m['date'] == visit.date.toIso8601String()) {
            m['_syncStatus'] = 'synced';
          }
          return m;
        }).toList();
        await _box.put(motherId, mapped);
      }
    } catch (_) {}
  }

  int get pendingCount {
    var count = 0;
    for (final motherId in _box.keys) {
      final list = (_box.get(motherId) as List?) ?? [];
      for (final item in list) {
        if (item is Map && item['_syncStatus'] == 'pending') count++;
      }
    }
    return count;
  }

  Future<void> syncPending() async {
    for (final motherId in _box.keys) {
      final list = (_box.get(motherId) as List?) ?? [];
      var hasUpdates = false;
      final updatedList = <Map<String, dynamic>>[];
      for (final item in list) {
        final m = Map<String, dynamic>.from(item as Map);
        if (m['_syncStatus'] == 'pending') {
          final visit = MotherVisit.fromMap(m);
          final extId = '${motherId}_${visit.date.toIso8601String().split('T').first}';
          try {
            final res = await BeneficiaryApi.syncMotherService(
              externalId: extId,
              motherExternalId: motherId.toString(),
              serviceType: 'Maternal Counseling',
              serviceName: visit.topicsCounseled.isNotEmpty
                  ? visit.topicsCounseled.join(', ')
                  : 'Maternal Counseling',
              serviceDate: visit.date,
              dosage: visit.breastfeedingPractice,
              notes: [
                if (visit.observation != null) 'Observation: ${visit.observation}',
                if (visit.observationNote != null) visit.observationNote,
                if (visit.concernNote != null) 'Concern: ${visit.concernNote}',
              ].join('. '),
            );
            if (res.success) {
              m['_syncStatus'] = 'synced';
              hasUpdates = true;
            }
          } catch (_) {}
        }
        updatedList.add(m);
      }
      if (hasUpdates) {
        await _box.put(motherId, updatedList);
      }
    }
  }
}
