import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../data/remote/auth_api.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_text_field.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  final _pageController = PageController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // 6 separate digit controllers & focus nodes
  final List<TextEditingController> _digitControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _digitFocusNodes = List.generate(6, (_) => FocusNode());

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  int _currentStep = 0; // 0 = Step 1 (Email), 1 = Step 2 (OTP), 2 = Step 3 (New Password)
  bool _otpRequested = false;
  bool _otpVerified = false;
  bool _isLoading = false;

  String _maskedRecipient = '';
  String? _resetToken;

  // Timers
  Timer? _cooldownTimer;
  int _resendCooldown = 0;
  Timer? _expiryTimer;
  int _codeExpirySeconds = 300; // 5 minutes

  // OTP Validation State
  bool _otpHasError = false;
  String _otpErrorMessage = '';

  // Password visibility & rules state
  bool _obscureNewPass = true;
  bool _obscureConfirmPass = true;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _shakeController, curve: Curves.easeInOut),
    );

    for (int i = 0; i < 6; i++) {
      final index = i;
      _digitControllers[index].addListener(() {
        if (mounted) setState(() {});
      });
      _digitFocusNodes[index].addListener(() {
        if (mounted) setState(() {});
      });
    }
  }

  void _startTimers() {
    // 60-second resend cooldown
    _cooldownTimer?.cancel();
    setState(() => _resendCooldown = 60);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() => _resendCooldown = 0);
      } else {
        setState(() => _resendCooldown--);
      }
    });

    // 5-minute code expiration timer (300 seconds)
    _expiryTimer?.cancel();
    setState(() => _codeExpirySeconds = 300);
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_codeExpirySeconds <= 1) {
        timer.cancel();
        setState(() => _codeExpirySeconds = 0);
      } else {
        setState(() => _codeExpirySeconds--);
      }
    });
  }

  String _formatTimer(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _maskEmail(String email) {
    if (!email.contains('@')) return email;
    final parts = email.split('@');
    final local = parts[0];
    final domain = parts[1];
    if (local.length <= 2) return '$local@$domain';
    final first = local.substring(0, 2);
    final last = local.substring(local.length - 1);
    return '$first*****$last@$domain';
  }

  void _goToStep(int step) {
    if (step < 0 || step > 2) return;
    if (step == 1 && !_otpRequested) {
      _showMessage('enter_email_first'.tr);
      return;
    }
    if (step == 2 && !_otpVerified) {
      _showMessage('verify_otp_first'.tr);
      return;
    }
    setState(() => _currentStep = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _handleBack() {
    if (_currentStep > 0) {
      _goToStep(_currentStep - 1);
    } else {
      Navigator.of(context).pop();
    }
  }

  Future<void> _requestOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showMessage('enter_email'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final res = await AuthApi.forgotPassword(
        email: email,
      );
      if (!mounted) return;

      final serverMasked = res['masked_recipient']?.toString();
      _maskedRecipient = (serverMasked != null && serverMasked.isNotEmpty)
          ? serverMasked
          : _maskEmail(email);

      setState(() {
        _otpRequested = true;
        _otpHasError = false;
        _otpErrorMessage = '';
      });

      _clearOtpBoxes();
      _startTimers();
      _goToStep(1);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_digitFocusNodes.isNotEmpty) {
          _digitFocusNodes[0].requestFocus();
        }
      });
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resendOtp() async {
    if (_resendCooldown > 0 || _isLoading) return;
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showMessage('enter_email'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final res = await AuthApi.forgotPassword(
        email: email,
      );
      if (!mounted) return;

      setState(() {
        final serverMasked = res['masked_recipient']?.toString();
        _maskedRecipient = (serverMasked != null && serverMasked.isNotEmpty)
            ? serverMasked
            : _maskEmail(email);
        _otpHasError = false;
        _otpErrorMessage = '';
      });

      _clearOtpBoxes();
      _startTimers();
      _showMessage(res['message']?.toString() ?? 'A new code has been sent.');
      _digitFocusNodes[0].requestFocus();
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String get _currentOtp {
    return _digitControllers.map((c) => c.text).join();
  }

  void _clearOtpBoxes() {
    for (final c in _digitControllers) {
      c.clear();
    }
  }

  void _triggerShakeError(String message) {
    setState(() {
      _otpHasError = true;
      _otpErrorMessage = message;
    });
    _shakeController.forward(from: 0.0);

    // Clear boxes after brief delay and focus box 0
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        _clearOtpBoxes();
        setState(() {
          _otpHasError = false;
          _otpErrorMessage = '';
        });
        _digitFocusNodes[0].requestFocus();
      }
    });
  }

  Future<void> _verifyOtp() async {
    final email = _emailController.text.trim();
    final otp = _currentOtp;

    if (email.isEmpty) {
      _showMessage('enter_email'.tr);
      return;
    }

    if (otp.length != 6) {
      _triggerShakeError('enter_full_otp'.tr);
      return;
    }

    if (_codeExpirySeconds <= 0) {
      _triggerShakeError('incorrect_expired_code'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final res = await AuthApi.verifyOtp(email: email, otp: otp);
      if (!mounted) return;

      setState(() {
        _otpVerified = true;
        _resetToken = res['resetToken']?.toString();
      });

      _goToStep(2);
    } catch (error) {
      _triggerShakeError('incorrect_expired_code'.tr);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Password rules evaluation
  bool get _hasMinLength => _passwordController.text.length >= 8;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passwordController.text);
  bool get _hasLowercase => RegExp(r'[a-z]').hasMatch(_passwordController.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_passwordController.text);
  bool get _isPasswordValid =>
      _hasMinLength && _hasUppercase && _hasLowercase && _hasNumber;
  bool get _passwordsMatch =>
      _passwordController.text.isNotEmpty &&
      _passwordController.text == _confirmPasswordController.text;

  int get _passwordStrengthScore {
    int score = 0;
    if (_hasMinLength) score++;
    if (_hasUppercase) score++;
    if (_hasLowercase) score++;
    if (_hasNumber) score++;
    return score;
  }

  Future<void> _resetPassword() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (!_isPasswordValid) {
      _showMessage('password_min_length'.tr);
      return;
    }

    if (password != confirmPassword) {
      _showMessage('passwords_dont_match'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.resetPassword(
        email: email,
        newPassword: password,
        resetToken: _resetToken,
      );
      if (!mounted) return;
      _showSuccessBottomSheet();
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSuccessBottomSheet() {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 36),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.primaryGreen,
                  size: 40,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'password_changed_title'.tr,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'password_changed_desc'.tr,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 28),
              AppButton(
                label: 'back_to_login'.tr,
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentStep == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(
            'forgot_pass_title'.tr,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          backgroundColor: AppColors.primaryGreen,
          iconTheme: const IconThemeData(color: Colors.white),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _handleBack,
            tooltip: _currentStep > 0 ? 'Previous Step' : 'Back to Login',
          ),
          actions: [
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_currentStep + 1}/3',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              _buildStepProgressBar(),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _buildStep1EmailAndChannel(),
                    _buildStep2OtpBoxes(),
                    _buildStep3NewPasswordWithChecklist(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepProgressBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(3, (index) {
              final isActive = index <= _currentStep;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 2 ? 8 : 0),
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.primaryGreen : AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Text(
            _currentStep == 0
                ? 'step_enter_email'.tr
                : _currentStep == 1
                    ? 'step_verify_otp'.tr
                    : 'step_reset_password'.tr,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 1: Email Address ──
  Widget _buildStep1EmailAndChannel() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('reset_account_password'.tr, style: AppTextStyles.h2),
          const SizedBox(height: 8),
          Text(
            'reset_password_instruction'.tr,
            style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 24),
          AppTextField(
            label: 'email'.tr,
            hint: 'hint_enter_email'.tr,
            icon: Icons.email_outlined,
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 28),
          AppButton(
            label: 'send_code'.tr,
            onPressed: _isLoading ? null : _requestOtp,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  // ── Step 2: OTP 6 Digit Boxes ──
  Widget _buildStep2OtpBoxes() {
    return AnimatedBuilder(
      animation: _shakeAnimation,
      builder: (context, child) {
        final double offset = _otpHasError
            ? sin(_shakeAnimation.value * 4 * pi) * 8
            : 0.0;
        return Transform.translate(
          offset: Offset(offset, 0),
          child: child,
        );
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 8),
            // Header: Light green circle badge with mail icon
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.mail_outline_rounded,
                color: AppColors.primaryGreen,
                size: 34,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'check_your_email'.tr,
              style: AppTextStyles.h2,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
                children: [
                  const TextSpan(text: 'We sent a 6-digit code to '),
                  TextSpan(
                    text: _maskedRecipient,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // 6 Separate Digit Boxes
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(6, (index) {
                final isFocused = _digitFocusNodes[index].hasFocus;
                final hasValue = _digitControllers[index].text.isNotEmpty;

                return SizedBox(
                  width: 48,
                  height: 56,
                  child: KeyboardListener(
                    focusNode: FocusNode(),
                    onKeyEvent: (event) {
                      if (event is KeyDownEvent &&
                          event.logicalKey == LogicalKeyboardKey.backspace) {
                        if (_digitControllers[index].text.isEmpty && index > 0) {
                          _digitFocusNodes[index - 1].requestFocus();
                          _digitControllers[index - 1].clear();
                        }
                      }
                    },
                    child: TextField(
                      controller: _digitControllers[index],
                      focusNode: _digitFocusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: _otpHasError ? AppColors.statRed : AppColors.primaryGreen,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: _otpHasError
                            ? AppColors.statRed.withValues(alpha: 0.05)
                            : isFocused
                                ? AppColors.primaryGreen.withValues(alpha: 0.05)
                                : Colors.white,
                        contentPadding: EdgeInsets.zero,
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: _otpHasError
                                ? AppColors.statRed
                                : hasValue
                                    ? AppColors.primaryGreen
                                    : AppColors.border,
                            width: hasValue ? 1.5 : 1.0,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: _otpHasError ? AppColors.statRed : AppColors.primaryGreen,
                            width: 2.0,
                          ),
                        ),
                      ),
                      onChanged: (value) {
                        // Support full paste in any box
                        if (value.length > 1) {
                          final digits = value.replaceAll(RegExp(r'\D'), '');
                          if (digits.length >= 6) {
                            for (int i = 0; i < 6; i++) {
                              _digitControllers[i].text = digits[i];
                            }
                            _digitFocusNodes[5].requestFocus();
                            _verifyOtp();
                            return;
                          }
                        }

                        if (value.isNotEmpty) {
                          if (index < 5) {
                            _digitFocusNodes[index + 1].requestFocus();
                          } else {
                            _digitFocusNodes[index].unfocus();
                            // Auto-verify on 6th digit
                            _verifyOtp();
                          }
                        }
                      },
                    ),
                  ),
                );
              }),
            ),

            if (_otpHasError && _otpErrorMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _otpErrorMessage,
                  style: const TextStyle(
                    color: AppColors.statRed,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),

            const SizedBox(height: 20),

            // Code Expiration countdown
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.timer_outlined,
                  size: 16,
                  color: _codeExpirySeconds <= 60
                      ? AppColors.statRed
                      : AppColors.textMuted,
                ),
                const SizedBox(width: 6),
                Text(
                  _codeExpirySeconds > 0
                      ? 'Code expires in ${_formatTimer(_codeExpirySeconds)}'
                      : 'Code expired',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _codeExpirySeconds <= 60
                        ? AppColors.statRed
                        : AppColors.textMuted,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Verify Code Button
            AppButton(
              label: 'verify_code'.tr,
              onPressed: (_currentOtp.length == 6 && !_isLoading) ? _verifyOtp : null,
              isLoading: _isLoading,
            ),

            const SizedBox(height: 16),

            // Resend code option with cooldown and channel toggle
            Center(
              child: TextButton.icon(
                icon: Icon(
                  Icons.refresh_rounded,
                  size: 16,
                  color: _resendCooldown > 0
                      ? AppColors.textMuted
                      : AppColors.primaryGreen,
                ),
                label: Text(
                  _resendCooldown > 0
                      ? 'Resend code (${_resendCooldown}s)'
                      : 'resend_code'.tr,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: _resendCooldown > 0
                        ? AppColors.textMuted
                        : AppColors.primaryGreen,
                  ),
                ),
                onPressed: (_resendCooldown > 0 || _isLoading)
                    ? null
                    : () => _resendOtp(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Step 3: New Password with Live Checklist ──
  Widget _buildStep3NewPasswordWithChecklist() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('create_new_password'.tr, style: AppTextStyles.h2),
          const SizedBox(height: 8),
          Text(
            'identity_verified'.tr,
            style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 24),

          // New password field
          TextField(
            controller: _passwordController,
            obscureText: _obscureNewPass,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'new_password'.tr,
              hintText: 'hint_new_password'.tr,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureNewPass ? Icons.visibility_off : Icons.visibility,
                  color: AppColors.textMuted,
                ),
                onPressed: () => setState(() => _obscureNewPass = !_obscureNewPass),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),

          const SizedBox(height: 12),

          // Strength Bar
          Row(
            children: List.generate(4, (index) {
              final active = index < _passwordStrengthScore;
              final Color barColor = _passwordStrengthScore <= 1
                  ? AppColors.statRed
                  : _passwordStrengthScore == 2
                      ? Colors.orange
                      : _passwordStrengthScore == 3
                          ? Colors.lightGreen
                          : AppColors.primaryGreen;

              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
                  decoration: BoxDecoration(
                    color: active ? barColor : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),

          const SizedBox(height: 16),

          // Live Rules Checklist
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                _buildRuleItem('At least 8 characters', _hasMinLength),
                const SizedBox(height: 6),
                _buildRuleItem('At least one uppercase letter (A-Z)', _hasUppercase),
                const SizedBox(height: 6),
                _buildRuleItem('At least one lowercase letter (a-z)', _hasLowercase),
                const SizedBox(height: 6),
                _buildRuleItem('At least one number (0-9)', _hasNumber),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Confirm password field
          TextField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPass,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'confirm_password'.tr,
              hintText: 'hint_confirm_password'.tr,
              prefixIcon: const Icon(Icons.lock_reset),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPass ? Icons.visibility_off : Icons.visibility,
                  color: AppColors.textMuted,
                ),
                onPressed: () => setState(() => _obscureConfirmPass = !_obscureConfirmPass),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),

          if (_confirmPasswordController.text.isNotEmpty && !_passwordsMatch)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Text(
                'passwords_dont_match'.tr,
                style: const TextStyle(color: AppColors.statRed, fontSize: 12),
              ),
            ),

          const SizedBox(height: 28),

          AppButton(
            label: 'save_password'.tr,
            onPressed: (_isPasswordValid && _passwordsMatch && !_isLoading)
                ? _resetPassword
                : null,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  Widget _buildRuleItem(String rule, bool isMet) {
    return Row(
      children: [
        Icon(
          isMet ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
          size: 16,
          color: isMet ? AppColors.primaryGreen : Colors.grey.shade400,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            rule,
            style: TextStyle(
              fontSize: 12,
              color: isMet ? AppColors.textPrimary : AppColors.textMuted,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _expiryTimer?.cancel();
    _shakeController.dispose();
    _pageController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    for (final c in _digitControllers) {
      c.dispose();
    }
    for (final f in _digitFocusNodes) {
      f.dispose();
    }
    super.dispose();
  }
}
