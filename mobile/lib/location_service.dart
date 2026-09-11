import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  Stream<Position> getPositionStream({LocationSettings? settings}) {
    try {
      return Geolocator.getPositionStream(locationSettings: settings);
    } catch (error, stackTrace) {
      _logError('getPositionStream', error, stackTrace);
      rethrow;
    }
  }

  Future<void> openAppSettings() async {
    try {
      await Geolocator.openAppSettings();
    } catch (error, stackTrace) {
      _logError('openAppSettings', error, stackTrace);
    }
  }

  Future<bool> isLocationEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (error, stackTrace) {
      _logError('isLocationEnabled', error, stackTrace);
      return false;
    }
  }

  Future<LocationPermission> checkPermission() async {
    try {
      return await Geolocator.checkPermission();
    } catch (error, stackTrace) {
      _logError('checkPermission', error, stackTrace);
      return LocationPermission.denied;
    }
  }

  Future<LocationPermission> requestPermission() async {
    try {
      return await Geolocator.requestPermission();
    } catch (error, stackTrace) {
      _logError('requestPermission', error, stackTrace);
      return LocationPermission.denied;
    }
  }

  Future<Position> getCurrentPosition({
    LocationAccuracy accuracy = LocationAccuracy.high,
    Duration? timeLimit,
  }) async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: accuracy,
          timeLimit: timeLimit,
        ),
      );
    } catch (error, stackTrace) {
      _logError('getCurrentPosition', error, stackTrace);
      rethrow;
    }
  }

  void _logError(String method, Object error, StackTrace stackTrace) {
    if (kDebugMode) {
      developer.log('LocationService.$method failed: $error', stackTrace: stackTrace);
    }
  }
}
