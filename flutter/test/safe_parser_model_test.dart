import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/core/utils/safe_parser.dart';
import 'package:appscalev3/data/models/child.dart';
import 'package:appscalev3/data/models/deworming_record.dart';
import 'package:appscalev3/data/models/measurement.dart';
import 'package:appscalev3/data/models/mother.dart';
import 'package:appscalev3/data/models/referral.dart';
import 'package:appscalev3/data/models/report_signatory.dart';
import 'package:appscalev3/data/models/vitamin_a_record.dart';
import 'package:appscalev3/core/theme/app_colors.dart';
import 'package:appscalev3/features/masterlist/utils/child_status_meta.dart';

void main() {
  group('SafeParser tests', () {
    test('SafeParser handles int, String, and null conversions correctly', () {
      expect(SafeParser.asString(123), '123');
      expect(SafeParser.asString('abc'), 'abc');
      expect(SafeParser.asString(null), isNull);

      expect(SafeParser.asNonNullString(123), '123');
      expect(SafeParser.asNonNullString(null, 'default'), 'default');

      expect(SafeParser.asInt(123), 123);
      expect(SafeParser.asInt('456'), 456);
      expect(SafeParser.asInt(78.9), 78);
      expect(SafeParser.asInt(null), isNull);

      expect(SafeParser.asDouble(12), 12.0);
      expect(SafeParser.asDouble('34.5'), 34.5);
      expect(SafeParser.asDouble(null), isNull);

      expect(SafeParser.asBool(1), isTrue);
      expect(SafeParser.asBool(0), isFalse);
      expect(SafeParser.asBool('1'), isTrue);
      expect(SafeParser.asBool('true'), isTrue);
      expect(SafeParser.asBool('false'), isFalse);
      expect(SafeParser.asBool(null), isNull);

      expect(SafeParser.toDateString(DateTime(2026, 8, 28)), '2026-08-28');
    });

    test('SafeParser friendlyNetworkError converts socket and timeout exceptions', () {
      const socketErr = "SocketFailed host lookup 'appscale-1.onrender.com' (OS Error: No address associated with hostname, errno = 7)";
      expect(
        SafeParser.friendlyNetworkError(socketErr),
        'No internet connection or server not reachable. Will retry automatically.',
      );

      const timeoutErr = 'TimeoutException after 0:00:30.000000: Future not completed';
      expect(
        SafeParser.friendlyNetworkError(timeoutErr),
        'No internet connection or server not reachable. Will retry automatically.',
      );
    });
  });

  group('Model parsing with int, String, and null IDs', () {
    test('VitaminARecord parses int and string IDs and values', () {
      final fromInts = {
        'id': 1001,
        'childId': 2002,
        'childName': 'Test Child',
        'barangay': 'Bahi',
        'dateGiven': '2026-08-28',
        'doseType': 1,
        'dosage': '100,000 IU',
        'administeredBy': 'Nurse 1',
        'remarks': null,
      };
      final record = VitaminARecord.fromMap(fromInts);
      expect(record.id, '1001');
      expect(record.childId, '2002');
      expect(record.doseType, '1');
      expect(record.remarks, '');
      expect(record.dateGiven.year, 2026);
      expect(record.dateGiven.month, 8);
      expect(record.dateGiven.day, 28);
      expect(SafeParser.toDateString(record.dateGiven), '2026-08-28');

      final fromStrings = {
        'id': 'str-101',
        'childId': 'str-202',
        'childName': 'Test Child 2',
        'barangay': 'Bahi',
        'dateGiven': '2026-08-28T14:30:00Z',
        'doseType': 'Routine',
        'dosage': '200,000 IU',
        'administeredBy': 'BNS',
      };
      final recordStr = VitaminARecord.fromMap(fromStrings);
      expect(recordStr.id, 'str-101');
      expect(recordStr.childId, 'str-202');
      expect(SafeParser.toDateString(recordStr.dateGiven), '2026-08-28');
    });

    test('DewormingRecord parses int, string, and null IDs', () {
      final fromInts = {
        'id': 3003,
        'childId': 4004,
        'childName': 'Deworm Child',
        'barangay': 'Mat. Gasan',
        'dateGiven': '2026-08-28',
        'drugName': 1, // int passed as drugName
        'dosage': 400,
        'round': 1,
        'administeredBy': 'BNS Jane',
      };
      final record = DewormingRecord.fromMap(fromInts);
      expect(record.id, '3003');
      expect(record.childId, '4004');
      expect(record.drugName, '1');
      expect(record.round, '1');
      expect(SafeParser.toDateString(record.dateGiven), '2026-08-28');
    });

    test('Child model parses int IDs and date-only strings without shift', () {
      final childMap = {
        'id': 330002,
        'firstName': 'Jana',
        'lastName': 'Kramer',
        'fullName': 'Jana Kramer',
        'sex': 'Female',
        'birthDate': '2026-08-28',
        'barangay': 'Bahi',
        'guardian': {
          'name': 'Mother Kramer',
          'relationship': 'Mother',
          'linkedMotherId': 55001,
        },
      };
      final child = Child.fromMap(childMap);
      expect(child.id, '330002');
      expect(child.birthDate.year, 2026);
      expect(child.birthDate.month, 8);
      expect(child.birthDate.day, 28);
      expect(child.guardian.linkedMotherId, '55001');

      // Check serialization uses date-only string yyyy-MM-dd
      final serialized = child.toMap();
      expect(serialized['birthDate'], '2026-08-28');
    });

    test('Mother model parses int IDs and date-only birth date', () {
      final motherMap = {
        'id': 77001,
        'fullName': 'Maria Santos',
        'birthDate': '1995-04-15',
        'contactNo': '09123456789',
        'barangay': 'Mat. Gasan',
        'isActive': 1,
        'linkedChildIds': [101, 102, '103'],
      };
      final mother = Mother.fromMap(motherMap);
      expect(mother.id, '77001');
      expect(mother.birthDate?.year, 1995);
      expect(mother.birthDate?.month, 4);
      expect(mother.birthDate?.day, 15);
      expect(mother.isActive, isTrue);
      expect(mother.linkedChildIds, containsAll(['101', '102', '103']));
    });

    test('Measurement model parses int and double metrics safely', () {
      final mJson = {
        'date': '2026-08-28',
        'weightKg': 12, // int instead of double
        'heightCm': 85, // int instead of double
        'muacCm': null,
        'weightForAge': 'Normal',
        'heightForAge': 'Normal',
        'weightForHeight': 'Normal',
      };
      final m = Measurement.fromMap(mJson);
      expect(m.weightKg, 12.0);
      expect(m.heightCm, 85.0);
      expect(m.date.year, 2026);
      expect(m.date.month, 8);
      expect(m.date.day, 28);
    });

    test('Referral model parses int beneficiary IDs safely', () {
      final refJson = {
        'id': 8801,
        'beneficiaryId': 330002,
        'beneficiaryName': 'Jana Kramer',
        'beneficiaryType': 'child',
        'barangay': 'Bahi',
        'facility': 'RHU Gasan',
        'reason': 'Underweight',
        'date': '2026-08-28',
        'status': 'pending',
      };
      final ref = Referral.fromMap(refJson);
      expect(ref.id, '8801');
      expect(ref.beneficiaryId, '330002');
    });

    test('ReportSignatory and ReportSnapshot parse int values safely', () {
      final sigJson = {
        'barangay': 'Bahi',
        'bnsName': 12345,
      };
      final sig = ReportSignatory.fromMap(sigJson);
      expect(sig.barangay, 'Bahi');
      expect(sig.bnsName, '12345');
    });
  });

  group('ChildStatusMeta Normalization & Colors', () {
    test('Severe variants map to AppColors.statRed', () {
      final severeVariants = [
        'Severe',
        'severe',
        'severely_underweight',
        'Severely Underweight',
        'severely_stunted',
        'Severely Stunted',
        'severely_wasted',
        'sam',
        'SAM',
        'wasting_severe',
        'severe_acute_malnutrition',
      ];
      for (final variant in severeVariants) {
        expect(ChildStatusMeta.colorFor(variant), AppColors.statRed,
            reason: 'Variant "$variant" must map to statRed');
      }
    });

    test('At risk variants map to AppColors.statOrange', () {
      final atRiskVariants = [
        'At risk',
        'at_risk',
        'moderate',
        'moderate_at_risk',
        'underweight',
        'Underweight',
        'stunted',
        'Stunted',
        'wasted',
        'mam',
        'MAM',
      ];
      for (final variant in atRiskVariants) {
        expect(ChildStatusMeta.colorFor(variant), AppColors.statOrange,
            reason: 'Variant "$variant" must map to statOrange');
      }
    });

    test('Normal variants map to AppColors.primaryGreen', () {
      for (final variant in ['Normal', 'normal', 'N', 'tall', 'Tall']) {
        expect(ChildStatusMeta.colorFor(variant), AppColors.primaryGreen);
      }
    });

    test('Overweight & Obese map to statBlue and statPurple', () {
      expect(ChildStatusMeta.colorFor('Overweight'), AppColors.statBlue);
      expect(ChildStatusMeta.colorFor('overweight'), AppColors.statBlue);
      expect(ChildStatusMeta.colorFor('Obese'), AppColors.statPurple);
      expect(ChildStatusMeta.colorFor('obese'), AppColors.statPurple);
    });

    test('Not weighed maps to AppColors.notWeighed', () {
      for (final variant in ['Not weighed', 'not_weighed', 'unweighed', '--', 'none']) {
        expect(ChildStatusMeta.colorFor(variant), AppColors.notWeighed);
      }
    });

    test('Unknown status returns visible warning color (statAmber) instead of silent gray', () {
      expect(ChildStatusMeta.colorFor('completely_unknown_xyz'), AppColors.statAmber);
    });
  });
}

