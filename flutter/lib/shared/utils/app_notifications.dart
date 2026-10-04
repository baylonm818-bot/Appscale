import 'package:flutter/material.dart';

/// Centralized UI utility for beautiful, floating, branded notification toasts
/// across the AppScale Flutter app.
class AppNotificationUI {
  AppNotificationUI._();

  /// Display a styled error toast notification
  static void showError(
    BuildContext context,
    String message, {
    String title = 'Error',
  }) {
    _showSnackBar(
      context,
      message: message,
      title: title,
      backgroundColor: const Color(0xFFB91C1C), // Deep crimson red
      borderColor: const Color(0xFFFCA5A5),
      icon: Icons.error_outline_rounded,
    );
  }

  /// Display a styled success toast notification
  static void showSuccess(
    BuildContext context,
    String message, {
    String title = 'Success',
  }) {
    _showSnackBar(
      context,
      message: message,
      title: title,
      backgroundColor: const Color(0xFF15803D), // Deep emerald green
      borderColor: const Color(0xFF86EFAC),
      icon: Icons.check_circle_outline_rounded,
    );
  }

  /// Display a styled warning/info toast notification
  static void showWarning(
    BuildContext context,
    String message, {
    String title = 'Notice',
  }) {
    _showSnackBar(
      context,
      message: message,
      title: title,
      backgroundColor: const Color(0xFFB45309), // Warm amber
      borderColor: const Color(0xFFFCD34D),
      icon: Icons.warning_amber_rounded,
    );
  }

  static void _showSnackBar(
    BuildContext context, {
    required String message,
    required String title,
    required Color backgroundColor,
    required Color borderColor,
    required IconData icon,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        elevation: 0,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        padding: EdgeInsets.zero,
        backgroundColor: Colors.transparent,
        duration: const Duration(seconds: 4),
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor.withValues(alpha: 0.4), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.22),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      message,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.95),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        height: 1.2,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
