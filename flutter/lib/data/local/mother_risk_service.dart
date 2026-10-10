import 'mother_repository.dart';
import 'mother_visit_repository.dart';

/// The single place that ever writes riskStatus or breastfeedingPractice
/// onto a Mother record. Call recomputeAndSave right after any visit is
/// logged — no other screen should set these fields directly, so there
/// is exactly one source of truth for both, always traceable to a
/// specific dated visit.
class MotherRiskService {
  final _motherRepo = MotherRepository();
  final _visitRepo = MotherVisitRepository();

  Future<void> recomputeAndSave(String motherId) async {
    final mother = _motherRepo.getById(motherId);
    if (mother == null) return;

    final visits = _visitRepo.getForMother(motherId);
    if (visits.isEmpty) {
      if (mother.riskStatus != 'Not visited') {
        await _motherRepo.update(mother.copyWith(riskStatus: 'Not visited'));
      }
      return;
    }

    final presentVisits = visits.where((v) => v.present).toList();
    if (presentVisits.isEmpty) {
      if (mother.riskStatus != 'Not visited') {
        await _motherRepo.update(mother.copyWith(riskStatus: 'Not visited'));
      }
      return;
    }

    final latest = presentVisits.first;

    final newRisk = latest.observation == 'Signs of concern'
        ? 'At-risk'
        : 'Normal';
    final newBreastfeeding =
        latest.breastfeedingPractice ?? mother.breastfeedingPractice;

    await _motherRepo.update(
      mother.copyWith(
        riskStatus: newRisk,
        breastfeedingPractice: newBreastfeeding,
      ),
    );
  }
}
