import 'dart:async';
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

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _pageController = PageController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  int _currentStep = 0; // 0 = Step 1, 1 = Step 2, 2 = Step 3
  bool _otpRequested = false;
  bool _otpVerified = false;
  bool _isLoading = false;

  Timer? _cooldownTimer;
  int _resendCooldown = 0;

  void _startCooldown() {
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
  }

  void _goToStep(int step) {
    if (step < 0 || step > 2) return;
    // Step 2 is only reachable after OTP is requested
    if (step == 1 && !_otpRequested) {
      _showMessage('enter_email_first'.tr);
      return;
    }
    // Step 3 is only reachable after OTP is verified
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
      final message = await AuthApi.forgotPassword(email: email);
      if (!mounted) return;
      setState(() => _otpRequested = true);
      _startCooldown();
      _showMessage(message);
      _goToStep(1);
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
      final message = await AuthApi.forgotPassword(email: email);
      if (!mounted) return;
      _startCooldown();
      _showMessage(message);
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final email = _emailController.text.trim();
    final otp = _otpController.text.trim();

    if (email.isEmpty) {
      _showMessage('enter_email'.tr);
      return;
    }

    if (otp.length != 6) {
      _showMessage('enter_full_otp'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.verifyOtp(email: email, otp: otp);
      if (!mounted) return;
      setState(() => _otpVerified = true);
      _showMessage('otp_verified_prompt'.tr);
      _goToStep(2);
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password.isEmpty || confirmPassword.isEmpty) {
      _showMessage('complete_password_fields'.tr);
      return;
    }

    if (password.length < 8) {
      _showMessage('password_min_length'.tr);
      return;
    }

    if (password != confirmPassword) {
      _showMessage('passwords_dont_match'.tr);
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.resetPassword(email: email, newPassword: password);
      if (!mounted) return;
      _showMessage('password_reset_success'.tr);
      Navigator.of(context).pop();
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
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
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text('forgot_pass_title'.tr),
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textPrimary,
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
                    color: AppColors.primaryGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primaryGreen.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    '${_currentStep + 1}/3',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: AppColors.primaryGreen,
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
                    _buildStep1Email(),
                    _buildStep2Otp(),
                    _buildStep3NewPassword(),
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
      color: AppColors.surface,
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

  Widget _buildStep1Email() {
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
          const SizedBox(height: 28),
          AppTextField(
            label: 'email'.tr,
            hint: 'hint_enter_email'.tr,
            icon: Icons.email_outlined,
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 24),
          AppButton(
            label: 'send_code'.tr,
            onPressed: _isLoading ? null : _requestOtp,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  Widget _buildStep2Otp() {
    final sentEmail = _emailController.text.trim();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('otp_title'.tr, style: AppTextStyles.h2),
          const SizedBox(height: 8),
          Text(
            'otp_sent_to'.tr,
            style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primaryGreen.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                const Icon(Icons.email, size: 16, color: AppColors.primaryGreen),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    sentEmail.isNotEmpty ? sentEmail : 'your email address',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.darkGreen,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          AppTextField(
            label: 'otp_label'.tr,
            hint: 'otp_hint'.tr,
            icon: Icons.pin_outlined,
            controller: _otpController,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
          ),
          const SizedBox(height: 20),
          AppButton(
            label: 'verify_code'.tr,
            onPressed: _isLoading ? null : _verifyOtp,
            isLoading: _isLoading,
          ),
          const SizedBox(height: 16),
          Center(
            child: TextButton.icon(
              icon: Icon(
                Icons.refresh_rounded,
                size: 16,
                color: _resendCooldown > 0 ? AppColors.textMuted : AppColors.primaryGreen,
              ),
              label: Text(
                _resendCooldown > 0
                    ? 'resend_code_cooldown'.trArgs({'seconds': '$_resendCooldown'})
                    : 'resend_code'.tr,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: _resendCooldown > 0 ? AppColors.textMuted : AppColors.primaryGreen,
                ),
              ),
              onPressed: (_resendCooldown > 0 || _isLoading) ? null : _resendOtp,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3NewPassword() {
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
          const SizedBox(height: 28),
          AppTextField(
            label: 'new_password'.tr,
            hint: 'hint_new_password'.tr,
            icon: Icons.lock_outline,
            isPassword: true,
            controller: _passwordController,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'confirm_password'.tr,
            hint: 'hint_confirm_password'.tr,
            icon: Icons.lock_reset,
            isPassword: true,
            controller: _confirmPasswordController,
          ),
          const SizedBox(height: 24),
          AppButton(
            label: 'save_password'.tr,
            onPressed: _isLoading ? null : _resetPassword,
            isLoading: _isLoading,
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _pageController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
}
