import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Reusable text styles. Screens call AppTextStyles.h1, never TextStyle(...)
/// directly, so font changes and sizing tweaks happen in one place.
class AppTextStyles {
  AppTextStyles._();

  static bool get _isTest {
    try {
      return WidgetsBinding.instance.runtimeType.toString().contains('Test');
    } catch (_) {
      return false;
    }
  }

  static const List<String> _emojiFallbackFonts = [
    'Noto Color Emoji',
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'sans-serif',
  ];

  static TextStyle _withEmojiFallback(TextStyle style) => style.copyWith(
    fontFamilyFallback: _emojiFallbackFonts,
  );

  static TextStyle _font({
    required double fontSize,
    required FontWeight fontWeight,
    required Color color,
  }) {
    if (_isTest) {
      return _withEmojiFallback(TextStyle(
        fontFamily: 'Poppins',
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      ));
    }
    return _withEmojiFallback(GoogleFonts.poppins(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    ));
  }

  static TextStyle get h1 => _font(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static TextStyle get h2 => _font(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: AppColors.darkGreen,
  );

  static TextStyle get h3 => _font(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static TextStyle get body => _font(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  static TextStyle get caption => _font(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  static TextStyle get label => _font(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
  );

  static TextStyle get button => _font(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: Colors.white,
  );
}
