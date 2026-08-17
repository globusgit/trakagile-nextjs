import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trakagile_mobile/main.dart';

void main() {
  testWidgets('shows the employee login form', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const TrakAgileApp());
    await tester.pumpAndSettle();

    expect(find.text('Welcome to TrakAgile'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Employee ID'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
