import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/shared/widgets/app_text_field.dart';

void main() {
  testWidgets('AppTextField numeric-only mode blocks letters', (tester) async {
    final controller = TextEditingController();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppTextField(
            label: 'Contact no.',
            hint: '09XXXXXXXXX',
            icon: Icons.phone,
            controller: controller,
            isNumericOnly: true,
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'abc12345');
    await tester.pump();

    expect(controller.text, '12345');
  });
}
