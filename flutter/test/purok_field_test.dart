import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:appscalev3/shared/widgets/purok_autocomplete_field.dart';

void main() {
  testWidgets('PurokAutocompleteField renders text input with required label, hint, and accepts typing', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);

    String? errorText;
    final suggestions = ['Purok 1', 'Purok 2', 'Purok 7', 'Purok Mabuhay'];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return PurokAutocompleteField(
                controller: controller,
                suggestions: suggestions,
                errorText: errorText,
                onChanged: (val) {
                  if (errorText != null && val.trim().isNotEmpty) {
                    setState(() => errorText = null);
                  }
                },
              );
            },
          ),
        ),
      ),
    );

    // Initial state: blank, placeholder visible
    expect(controller.text, equals(''));
    expect(find.text('Enter purok (e.g. Purok 7, Purok Mabuhay)'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);

    // Typing shows autocomplete suggestions matching query
    await tester.enterText(find.byType(TextField), 'mab');
    await tester.pumpAndSettle();

    expect(find.text('Purok Mabuhay'), findsOneWidget);

    // Tap suggestion to select
    await tester.tap(find.text('Purok Mabuhay'));
    await tester.pumpAndSettle();

    expect(controller.text, equals('Purok Mabuhay'));
  });

  testWidgets('PurokAutocompleteField displays validation error "Purok is required"', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PurokAutocompleteField(
            controller: controller,
            errorText: 'Purok is required',
            suggestions: const ['Purok 1'],
          ),
        ),
      ),
    );

    expect(find.text('Purok is required'), findsOneWidget);
  });
}
