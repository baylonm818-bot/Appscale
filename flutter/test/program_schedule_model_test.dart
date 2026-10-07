import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/data/models/program_schedule.dart';

void main() {
  group('ProgramSchedule.fromMap', () {
    test('normalizes backend schedule types and source metadata', () {
      final schedule = ProgramSchedule.fromMap({
        'id': 'abc',
        'title': 'Feeding Session',
        'programType': 'feeding',
        'date': '2026-10-10T00:00:00.000',
        'startTime': '08:00 AM',
        'endTime': '10:00 AM',
        'location': 'Barangay Hall',
        'targetGroup': 'bns',
        'notes': 'Follow up',
        'barangay': 'Tiguion',
        'facilitator': 'RHU Admin',
        'createdAt': '2026-10-01T09:00:00.000',
      });

      expect(schedule.programType, 'Feeding');
      expect(schedule.createdBy, 'RHU Admin');
      expect(schedule.targetGroup, 'bns');
    });
  });
}
