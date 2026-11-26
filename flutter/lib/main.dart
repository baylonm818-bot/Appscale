import 'package:flutter/material.dart';
import 'app_strings.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'data/local/hive_boxes.dart';
import 'features/reports/services/report_notification_service.dart';
import 'features/splash/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Surface errors visibly instead of blank/grey screen in release builds
  ErrorWidget.builder = (FlutterErrorDetails details) {
    debugPrint('[ErrorWidget] Caught Flutter error: ${details.exception}');
    debugPrint('[ErrorWidget] Stack trace: ${details.stack}');
    return Material(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppColors.statRed, size: 48),
              const SizedBox(height: 12),
              const Text(
                'Something went wrong displaying this view.',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                details.exceptionAsString(),
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                textAlign: TextAlign.center,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  };

  await HiveBoxes.init();
  await L.load();
  await ReportNotificationService.initialize();
  runApp(const AppScaleApp());
}

class AppScaleApp extends StatelessWidget {
  const AppScaleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: L.lang,
      builder: (context, currentLang, child) {
        return MaterialApp(
          navigatorKey: appNavigatorKey,
          title: 'AppScale',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          builder: (context, child) {
            final mediaQuery = MediaQuery.of(context);
            final clampedScale = mediaQuery.textScaler.clamp(
              minScaleFactor: 0.9,
              maxScaleFactor: 1.25,
            );
            return MediaQuery(
              data: mediaQuery.copyWith(textScaler: clampedScale),
              child: child!,
            );
          },
          home: const SplashScreen(),
        );
      },
    );
  }
}
