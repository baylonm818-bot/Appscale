import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class FormRequiredNote extends StatelessWidget {
  final EdgeInsetsGeometry padding;

  const FormRequiredNote({
    super.key,
    this.padding = const EdgeInsets.only(bottom: 12.0),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: RichText(
        text: const TextSpan(
          text: '* ',
          style: TextStyle(
            color: AppColors.requiredAsterisk,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
          children: [
            TextSpan(
              text: 'Required field',
              style: TextStyle(
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.normal,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
