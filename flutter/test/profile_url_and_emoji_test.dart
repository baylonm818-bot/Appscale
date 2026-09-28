import 'package:appscalev3/core/theme/app_text_styles.dart';
import 'package:appscalev3/features/dashboard/widgets/dashboard_header.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('profile image url normalization handles uploaded server paths', () {
    expect(
      DashboardHeader.normalizeProfileImageUrl('/uploads/profile-pictures/user_1_123.jpg'),
      'https://appscale-1.onrender.com/uploads/profile-pictures/user_1_123.jpg',
    );

    expect(
      DashboardHeader.normalizeProfileImageUrl('profile-pictures/user_1_123.jpg'),
      'https://appscale-1.onrender.com/uploads/profile-pictures/user_1_123.jpg',
    );
  });

  test('app text styles include emoji fallback fonts', () {
    expect(AppTextStyles.h1.fontFamilyFallback, contains('Noto Color Emoji'));
    expect(AppTextStyles.body.fontFamilyFallback, contains('Segoe UI Emoji'));
  });
}
