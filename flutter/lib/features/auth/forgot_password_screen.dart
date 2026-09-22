import 'package:flutter/material.dart';

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
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _otpRequested = false;
  bool _otpVerified = false;
  bool _isLoading = false;

  Future<void> _requestOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showMessage('Please enter your email address.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.forgotPassword(email: email);
      if (!mounted) return;
      setState(() => _otpRequested = true);
      _showMessage('OTP sent to your email.');
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final email = _emailController.text.trim();
    final otp = _otpController.text.trim();

    if (email.isEmpty || otp.isEmpty) {
      _showMessage('Please enter your email and OTP.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.verifyOtp(email: email, otp: otp);
      if (!mounted) return;
      setState(() => _otpVerified = true);
      _showMessage('OTP verified. Please enter your new password.');
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

    if (email.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      _showMessage('Please complete all password fields.');
      return;
    }

    if (password.length < 8) {
      _showMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password != confirmPassword) {
      _showMessage('Passwords do not match.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthApi.resetPassword(email: email, newPassword: password);
      if (!mounted) return;
      _showMessage('Password reset successful. Please log in again.');
      Navigator.of(context).pop();
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Forgot Password'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Reset your account password', style: AppTextStyles.h2),
              const SizedBox(height: 8),
              Text(
                'Enter your email to receive an OTP, verify it, and create a new password.',
                style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 24),
              AppTextField(
                label: 'Email',
                hint: 'Enter your email address',
                icon: Icons.email_outlined,
                controller: _emailController,
              ),
              const SizedBox(height: 16),
              AppButton(
                label: _otpRequested ? 'Resend OTP' : 'Send OTP',
                onPressed: _isLoading ? null : _requestOtp,
                isLoading: _isLoading && !_otpVerified,
              ),
              const SizedBox(height: 24),
              if (_otpRequested) ...[
                const Divider(),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'OTP',
                  hint: 'Enter the 6-digit code',
                  icon: Icons.pin_outlined,
                  controller: _otpController,
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Verify OTP',
                  onPressed: _isLoading ? null : _verifyOtp,
                  isLoading: _isLoading && _otpRequested,
                ),
              ],
              if (_otpVerified) ...[
                const SizedBox(height: 24),
                AppTextField(
                  label: 'New Password',
                  hint: 'Enter a new password',
                  icon: Icons.lock_outline,
                  isPassword: true,
                  controller: _passwordController,
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'Confirm Password',
                  hint: 'Re-enter your password',
                  icon: Icons.lock_reset,
                  isPassword: true,
                  controller: _confirmPasswordController,
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Reset Password',
                  onPressed: _isLoading ? null : _resetPassword,
                  isLoading: _isLoading,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
}
