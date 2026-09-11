# TrakAgile Android app

Flutter mobile client for TrakAgile. The default backend is `https://trakagile.com`.

## Validate and build

Run from `mobile/` with Flutter and the Android SDK installed:

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

The universal APK is generated at `build/app/outputs/flutter-apk/app-release.apk`.
Version 1.3.16 uses Android build number 37.

To target a different backend, pass `--dart-define=API_BASE_URL=https://your-server.example` when building.
Deploy the matching backend changes before testing the new break endpoints.

## Signing and device checks

The current release build uses the existing Android debug signing key. It is an
installable test/distribution APK; configure a private release signing key before
publishing to Google Play. Keep signing credentials out of Git.

On a device, verify login, attendance mark-in, break start/end, and mark-out.
For background location tracking, allow precise location all the time and follow
the app's battery optimization prompt. Automated tests do not verify physical GPS
or background behavior on an Android device.
