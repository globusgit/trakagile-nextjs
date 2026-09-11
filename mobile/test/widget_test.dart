import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trakagile_mobile/main.dart';

void main() {
  testWidgets('shows the employee login form', (tester) async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    // Native permissions are already granted for this login-screen test.
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/geolocator'),
      (call) async => call.method == 'checkPermission' ? 3 : null,
    );
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/permissions/methods'),
      (call) async => 1,
    );
    await tester.pumpWidget(const TrakAgileApp());
    await tester.pumpAndSettle();

    expect(find.text('Welcome to TrakAgile'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Employee ID'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
