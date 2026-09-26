import 'dart:async';
import 'package:flutter/material.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/local/child_repository.dart';
import '../../data/local/mother_repository.dart';
import '../auth/login_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../shell/main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _scale = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _controller.forward();

    _navigationTimer = Timer(const Duration(milliseconds: 1800), () async {
      if (!mounted) return;

      final navigator = Navigator.of(context);

      try {
        await Future.wait([
          ChildRepository().syncPending(),
          MotherRepository().syncPending(),
        ]);
      } catch (e) {
        debugPrint('Sync pending failed on splash: $e');
      }
      
      if (!mounted) return;

      final settings = SettingsRepository();

      Widget nextScreen;
      if (!settings.hasSeenOnboarding) {
        nextScreen = const OnboardingScreen();
      } else if (settings.hasValidSession) {
        nextScreen = const MainShell();
      } else {
        await settings.clearSession();
        nextScreen = const LoginScreen();
      }

      if (!mounted) return;

      navigator.pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 500),
          pageBuilder: (_, animation, _) => nextScreen,
          transitionsBuilder: (_, animation, _, child) =>
              FadeTransition(opacity: animation, child: child),
        ),
      );
    });
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Image.asset('assets/images/appscale_logo.png', width: 220),
          ),
        ),
      ),
    );
  }
}
