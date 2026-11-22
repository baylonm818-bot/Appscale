import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/data/remote/auth_api.dart';

void main() {
  group('AuthApi', () {
    test('parses login response into auth session', () {
      final session = AuthApi.parseLoginResponse({
        'token': 'abc123',
        'user': {
          'user_id': 42,
          'username': 'admin',
          'full_name': 'Admin User',
          'role': 'admin',
          'barangay': 'Antipolo',
          'municipality': 'Gasan',
          'health_station': 'Antipolo Barangay Health Station',
          'active_children_count': 26,
          'active_mothers_count': 27,
          'profile_picture': null,
        },
      });

      expect(session.token, 'abc123');
      expect(session.user.userId, 42);
      expect(session.user.role, 'admin');
      expect(session.user.barangay, 'Antipolo');
      expect(session.user.healthStation, 'Antipolo Barangay Health Station');
      expect(session.user.activeChildrenCount, 26);
      expect(session.user.activeMothersCount, 27);
      expect(session.user.fullName, 'Admin User');
    });

    test('delegates forgot password requests to the auth endpoint', () async {
      expect(
        () => AuthApi.forgotPassword(email: 'admin@appscale.test'),
        throwsA(isA<Exception>()),
      );
    });

    test('delegates OTP verification to the auth endpoint', () async {
      expect(
        () => AuthApi.verifyOtp(email: 'admin@appscale.test', otp: '123456'),
        throwsA(isA<Exception>()),
      );
    });

    test('delegates reset password requests to the auth endpoint', () async {
      expect(
        () => AuthApi.resetPassword(
          email: 'admin@appscale.test',
          newPassword: 'newpass123',
        ),
        throwsA(isA<Exception>()),
      );
    });
  });
}
