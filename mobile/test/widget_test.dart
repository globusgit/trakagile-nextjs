import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trakagile_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('stopping attendance tracking preserves the login session', () async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({'token': 'signed-in-token'});

    await AttendanceTrackingService.instance.stop();
    await AttendanceTrackingService.instance.stop();

    expect(
      await const FlutterSecureStorage().read(key: 'token'),
      'signed-in-token',
    );
  });

  for (final hasStaleUser in [false, true]) {
    testWidgets('shows login without a token (cached user: $hasStaleUser)', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        if (hasStaleUser)
          'user': '{"empId":"T1234","name":"Test employee","role":"USER"}',
      });
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
      expect((await SharedPreferences.getInstance()).getString('user'), isNull);
    });
  }
}
