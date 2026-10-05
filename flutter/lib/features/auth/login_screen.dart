import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/local/hive_boxes.dart';
import '../../data/remote/auth_api.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../data/remote/beneficiary_api.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_text_field.dart';
import '../shell/main_shell.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _settings = SettingsRepository();

  bool _rememberMe = false;
  bool _isLoading = false;
  String _loginError = '';

  @override
  void initState() {
    super.initState();
    _rememberMe = _settings.rememberMe;
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      if (!mounted) return;
      setState(() {
        _loginError = 'Please enter both email and password.';
      });
      return;
    }

    setState(() {
      _loginError = '';
      _isLoading = true;
    });

    try {
      final session = await AuthApi.login(email: email, password: password);
      const expiryDuration = Duration(days: 30);
      final expiresAt = DateTime.now().add(expiryDuration);

      await _settings.setRememberMe(_rememberMe);
      await _settings.setAuthToken(session.token);
      await _settings.setSessionExpiresAt(expiresAt);
      await _settings.setAuthUser(
        session.toMap()['user'] as Map<String, dynamic>,
      );

      // ── Restore server data to local Hive ────────────────────────────────
      // This ensures data survives app reinstalls and account switches.
      try {
        final barangay = _settings.authUser?['barangay'] as String?;
        final newUserId = _settings.authUser?['user_id']?.toString() ?? '';

        // Detect account switch: clear beneficiary data if a different user logged in
        final prevUserId = Hive.box(HiveBoxes.settings).get('last_user_id') as String? ?? '';
        if (prevUserId.isNotEmpty && prevUserId != newUserId) {
          await Hive.box(HiveBoxes.children).clear();
          await Hive.box(HiveBoxes.mothers).clear();
          await Hive.box(HiveBoxes.measurements).clear();
          await Hive.box(HiveBoxes.referrals).clear();
          await Hive.box(HiveBoxes.notifications).clear();
          debugPrint('Account switched ($prevUserId→$newUserId): cleared local Hive data.');
        }
        await Hive.box(HiveBoxes.settings).put('last_user_id', newUserId);

        if (barangay != null && barangay.isNotEmpty) {
          final token = _settings.authToken;

          // Fetch all data in parallel for speed
          final results = await Future.wait([
            BeneficiaryApi.fetchChildrenForBarangay(barangay, token),
            BeneficiaryApi.fetchMothersForBarangay(barangay, token),
            BeneficiaryApi.fetchReferralsForBarangay(barangay, token),
            BeneficiaryApi.fetchSchedulesForBarangay(barangay, token),
          ]);

          final children  = results[0];
          final mothers   = results[1];
          final referrals = results[2];
          final schedules = results[3];

          final childBox    = Hive.box(HiveBoxes.children);
          final motherBox   = Hive.box(HiveBoxes.mothers);
          final referralBox = Hive.box(HiveBoxes.referrals);
          final scheduleBox = Hive.box(HiveBoxes.programSchedule);

          // ── Seed children (server always wins for synced records) ──
          for (final c in children) {
            final key = (c['external_id'] ?? c['child_id']).toString();
            final existing = childBox.get(key) as Map?;
            // Don't overwrite records that have unsynced local edits
            if (existing != null && existing['_syncStatus'] == 'pending') continue;
            final firstName = c['first_name'] as String? ?? '';
            final middleInitial = c['middle_initial'] as String? ?? '';
            final lastName = c['last_name'] as String? ?? '';
            final fullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
                .where((s) => s.isNotEmpty)
                .join(' ');
            childBox.put(key, {
              'id': key,
              'sequenceNo': key,
              'fullName': fullName,
              'birthDate': (c['birth_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
              'gender': c['sex'] as String? ?? 'Male',
              'address': c['purok'] as String? ?? '',
              'barangay': c['barangay'] as String? ?? barangay,
              'belongsToIpGroup': false,
              'disability': '',
              'guardian': {
                'fullName': c['guardian_name'] as String? ?? '',
                'relationship': 'Guardian',
                'contactNo': c['guardian_contact'] as String? ?? '',
                'linkedMotherId': null,
              },
              'createdAt': DateTime.now().toIso8601String(),
              'nutritionStatus': c['weight_status'] ?? existing?['nutritionStatus'] ?? 'Not weighed',
              'stuntingStatus': c['height_status'] ?? existing?['stuntingStatus'] ?? 'Not weighed',
              'wastingStatus': c['overall_status'] ?? existing?['wastingStatus'] ?? 'Not weighed',
              'lastWeighedAt': c['last_visit'] != null
                  ? (c['last_visit'] as String).split('T').first
                  : existing?['lastWeighedAt'],
              'isActive': (c['status'] as String? ?? 'active') == 'active',
              'inactiveReason': null,
              '_syncStatus': 'synced',
            });
          }

          // ── Seed mothers ──
          for (final m in mothers) {
            final key = (m['external_id'] ?? m['mother_id']).toString();
            final existing = motherBox.get(key) as Map?;
            if (existing != null && existing['_syncStatus'] == 'pending') continue;
            final firstName = m['first_name'] as String? ?? '';
            final middleInitial = m['middle_initial'] as String? ?? '';
            final lastName = m['last_name'] as String? ?? '';
            final fullName = [firstName, if (middleInitial.isNotEmpty) middleInitial, lastName]
                .where((s) => s.isNotEmpty)
                .join(' ');
            motherBox.put(key, {
              'id': key,
              'fullName': fullName,
              'birthDate': (m['birth_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
              'contactNo': m['contact_number'] as String? ?? '',
              'address': m['purok'] as String? ?? '',
              'barangay': m['barangay'] as String? ?? barangay,
              'linkedChildIds': <String>[],
              'isActive': (m['status'] as String? ?? 'active') == 'active',
              'inactiveReason': null,
              'createdAt': DateTime.now().toIso8601String(),
              '_syncStatus': 'synced',
            });
          }

          // ── Seed referrals ──
          for (final r in referrals) {
            final key = r['referral_id']?.toString() ?? '';
            if (key.isEmpty) continue;
            final existing = referralBox.get(key) as Map?;
            if (existing != null && existing['_syncStatus'] == 'pending') continue;
            referralBox.put(key, {
              'id': key,
              'beneficiaryId': (r['child_id'] ?? r['mother_id'])?.toString() ?? '',
              'beneficiaryType': r['beneficiary_type'] as String? ?? 'child',
              'beneficiaryName': '${r['beneficiary_first_name'] ?? ''} ${r['beneficiary_last_name'] ?? ''}'.trim(),
              'barangay': r['barangay'] as String? ?? barangay,
              'facility': r['referred_to']?.toString() ?? '',
              'reason': r['reason'] as String? ?? '',
              'notes': r['response_notes'] as String? ?? '',
              'status': r['status'] as String? ?? 'Pending',
              'createdAt': r['created_at'] as String? ?? DateTime.now().toIso8601String(),
              '_syncStatus': 'synced',
            });
          }

          // ── Seed schedules ──
          for (final s in schedules) {
            final key = s['schedule_id']?.toString() ?? '';
            if (key.isEmpty) continue;
            final existing = scheduleBox.get(key) as Map?;
            if (existing != null && existing['_syncStatus'] == 'pending') continue;
            scheduleBox.put(key, {
              'id': key,
              'title': s['title'] as String? ?? 'Activity',
              'programType': s['schedule_type'] as String? ?? 'feeding',
              'date': (s['schedule_date'] as String?)?.split('T').first ?? DateTime.now().toIso8601String(),
              'startTime': s['schedule_time'] as String? ?? '08:00 AM',
              'location': s['venue'] as String? ?? 'Health Center',
              'barangay': s['barangay'] as String? ?? barangay,
              'notes': s['notes'] as String? ?? '',
              'status': s['status'] as String? ?? 'pending',
              '_syncStatus': 'synced',
            });
          }

          debugPrint('Seeded ${children.length} children, ${mothers.length} mothers, ${referrals.length} referrals, ${schedules.length} schedules from server.');
        }
      } catch (seedErr) {
        // Non-fatal: proceed to main UI even if seeding failed.
        debugPrint('Failed to seed local data after login: $seedErr');
      }


      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const MainShell()));
    } catch (error) {
      if (!mounted) return;
      final raw = error.toString();
      final isNetworkError = error.runtimeType.toString() == 'SocketException' ||
          raw.contains('ClientSoftware') ||
          raw.contains('SocketException') ||
          raw.contains('connection abort') ||
          raw.contains('Failed host lookup') ||
          raw.contains('Network is unreachable') ||
          raw.contains('Connection refused') ||
          raw.contains('timed out');
      setState(() {
        _loginError = isNetworkError
            ? 'No internet connection. Please check your network and try again.'
            : raw.replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 16),
              Image.asset('assets/images/appscale_logo.png', width: 80),
              const SizedBox(height: 8),
              Text('BNS Health Monitoring', style: AppTextStyles.h1),
              const SizedBox(height: 4),
              Text(
                'Barangay Nutrition Scholar Portal',
                style: AppTextStyles.body.copyWith(
                  color: AppColors.darkGreen,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.location_on,
                    size: 14,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(width: 4),
                  Text('Municipality of Gasan', style: AppTextStyles.body),
                ],
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_loginError.isNotEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.red.withValues(alpha: 0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: Color(0xFFFEE2E2),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.error_outline_rounded,
                                color: Color(0xFFDC2626),
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _loginError,
                                style: const TextStyle(
                                  color: Color(0xFF991B1B),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  height: 1.3,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Text('Welcome BNS!', style: AppTextStyles.h2),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'Email',
                      hint: 'Enter email address',
                      icon: Icons.person_outline,
                      controller: _emailController,
                    ),
                    const SizedBox(height: 14),
                    AppTextField(
                      label: 'Password',
                      hint: 'Enter password',
                      icon: Icons.lock_outline,
                      isPassword: true,
                      controller: _passwordController,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 16,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              height: 22,
                              width: 22,
                              child: Checkbox(
                                value: _rememberMe,
                                activeColor: AppColors.primaryGreen,
                                onChanged: (v) =>
                                    setState(() => _rememberMe = v ?? false),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Remember Me',
                              style: AppTextStyles.body,
                              softWrap: false,
                            ),
                          ],
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const ForgotPasswordScreen(),
                              ),
                            );
                          },
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'Forgot Password?',
                            style: AppTextStyles.body.copyWith(
                              color: AppColors.darkGreen,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    AppButton(
                      label: 'Login',
                      onPressed: _handleLogin,
                      isLoading: _isLoading,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
