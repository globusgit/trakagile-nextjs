import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

class AttendanceTrackingService {
  AttendanceTrackingService._();
  static final instance = AttendanceTrackingService._();

  StreamSubscription<Position>? _subscription;
  Timer? _retryTimer;
  bool _sending = false;
  String? _token;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) return;
    try {
      final response = await http
          .get(
            Uri.parse('$_apiBaseUrl/api/attendance/today'),
            headers: {'authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 12));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body is Map &&
            body['attendance'] is Map &&
            body['attendance']['status'] == 'IN') {
          await start(token);
        }
      }
    } catch (_) {
      // A later app refresh retries without blocking sign-in.
    }
  }

  Future<void> start(String token) async {
    _token = token;
    if (_subscription != null) {
      await _flushQueue();
      return;
    }
    if (!await Geolocator.isLocationServiceEnabled()) return;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }

    final LocationSettings settings =
        defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 50,
            intervalDuration: const Duration(seconds: 45),
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationTitle: 'TrakAgile attendance tracking',
              notificationText:
                  'Location tracking is active until you mark out.',
              enableWakeLock: true,
            ),
          )
        : const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 50,
          );
    await _flushQueue();
    _subscription = Geolocator.getPositionStream(locationSettings: settings)
        .listen((position) => _queuePosition(position), onError: (_) {});
    _retryTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _flushQueue(),
    );
  }

  Future<void> stop() async {
    await _flushQueue();
    await _subscription?.cancel();
    _subscription = null;
    _retryTimer?.cancel();
    _retryTimer = null;
    _token = null;
  }

  Future<void> _queuePosition(Position position) async {
    if (position.accuracy > 100) return;
    final prefs = await SharedPreferences.getInstance();
    final lastRaw = prefs.getString('tracking_last_position');
    if (lastRaw != null) {
      final last = jsonDecode(lastRaw) as Map<String, dynamic>;
      final distance = Geolocator.distanceBetween(
        (last['latitude'] as num).toDouble(),
        (last['longitude'] as num).toDouble(),
        position.latitude,
        position.longitude,
      );
      final lastTime = DateTime.tryParse('${last['capturedAt']}');
      if (distance < 15 &&
          lastTime != null &&
          position.timestamp.difference(lastTime).inMinutes < 3) {
        return;
      }
    }
    final item = <String, dynamic>{
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'speed': position.speed < 0 ? null : position.speed,
      'heading': position.heading < 0 ? null : position.heading,
      'capturedAt': position.timestamp.toUtc().toIso8601String(),
      'offlineQueued': true,
    };
    final queue = (prefs.getStringList('tracking_offline_queue') ?? <String>[])
        .toList();
    queue.add(jsonEncode(item));
    if (queue.length > 500) queue.removeRange(0, queue.length - 500);
    await prefs.setStringList('tracking_offline_queue', queue);
    await prefs.setString('tracking_last_position', jsonEncode(item));
    await _flushQueue();
  }

  Future<void> _flushQueue() async {
    if (_sending || _token == null) return;
    _sending = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final queue =
          (prefs.getStringList('tracking_offline_queue') ?? <String>[])
              .toList();
      while (queue.isNotEmpty && _token != null) {
        try {
          final response = await http
              .post(
                Uri.parse('$_apiBaseUrl/api/attendance/location'),
                headers: {
                  'authorization': 'Bearer $_token',
                  'content-type': 'application/json',
                },
                body: queue.first,
              )
              .timeout(const Duration(seconds: 15));
          if (response.statusCode >= 200 && response.statusCode < 300) {
            queue.removeAt(0);
            await prefs.setStringList('tracking_offline_queue', queue);
          } else if (response.statusCode == 404 || response.statusCode == 409) {
            queue.clear();
            await prefs.setStringList('tracking_offline_queue', queue);
          } else {
            break;
          }
        } catch (_) {
          break;
        }
      }
    } finally {
      _sending = false;
    }
  }
}

void main() => runApp(const TrakAgileApp());

class TrakAgileApp extends StatefulWidget {
  const TrakAgileApp({super.key});

  @override
  State<TrakAgileApp> createState() => _TrakAgileAppState();
}

class _TrakAgileAppState extends State<TrakAgileApp> {
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final rawUser = prefs.getString('user');
    if (rawUser != null) _user = jsonDecode(rawUser) as Map<String, dynamic>;
    if (_user != null) unawaited(AttendanceTrackingService.instance.restore());
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _signedIn(Map<String, dynamic> user, String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('user', jsonEncode(user));
    setState(() => _user = user);
    unawaited(AttendanceTrackingService.instance.restore());
  }

  Future<void> _signOut() async {
    await AttendanceTrackingService.instance.stop();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrakAgile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        scaffoldBackgroundColor: const Color(0xFFF6F8FC),
        useMaterial3: true,
      ),
      home: _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _user == null
          ? LoginPage(onSignedIn: _signedIn)
          : HomePage(user: _user!, onSignOut: _signOut),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onSignedIn, super.key});
  final Future<void> Function(Map<String, dynamic>, String) onSignedIn;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _empId = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  String? _error;

  Future<void> _login() async {
    if (_empId.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Enter employee ID and password.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      const baseUrl = String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
      );
      const organizationCode = String.fromEnvironment('ORGANIZATION_CODE');
      final response = await http.post(
        Uri.parse('$baseUrl/api/mobile/auth/login'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({
          'organizationCode': organizationCode,
          'empId': _empId.text.trim(),
          'password': _password.text,
        }),
      );
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) {
        throw Exception(body['message'] ?? 'Sign in failed.');
      }
      await widget.onSignedIn(
        body['user'] as Map<String, dynamic>,
        body['token'] as String,
      );
    } catch (error) {
      final message = error.toString().replaceFirst('Exception: ', '');
      final connectionFailed =
          message.contains('SocketException') ||
          message.contains('ClientException') ||
          message.toLowerCase().contains('timed out') ||
          message.toLowerCase().contains('connection refused');
      setState(
        () => _error = connectionFailed
            ? 'Unable to connect to TrakAgile. Check that the phone is online and try again.'
            : message,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 0,
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(
                        Icons.track_changes_rounded,
                        size: 54,
                        color: Color(0xFF2563EB),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Welcome to TrakAgile',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Sign in with your employee account',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 28),
                      TextField(
                        controller: _empId,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Employee ID',
                          prefixIcon: Icon(Icons.badge_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        onSubmitted: (_) => _login(),
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                      const SizedBox(height: 22),
                      FilledButton(
                        onPressed: _submitting ? null : _login,
                        child: Padding(
                          padding: const EdgeInsets.all(13),
                          child: _submitting
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Sign in'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AppModule {
  const AppModule(this.icon, this.title, this.description);

  final IconData icon;
  final String title;
  final String description;
}

class ModuleScreen extends StatefulWidget {
  const ModuleScreen({required this.module, required this.user, super.key});

  final AppModule module;
  final Map<String, dynamic> user;

  @override
  State<ModuleScreen> createState() => _ModuleScreenState();
}

class _ModuleScreenState extends State<ModuleScreen> {
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _data;
  String _attendanceType = 'OFFICE';
  List<dynamic> _clientSites = const [];
  String? _selectedClientSiteId;
  final _fieldPurpose = TextEditingController();
  DateTime _expectedWorkEndAt = DateTime.now().add(const Duration(hours: 8));
  bool _overnightWork = false;

  bool get _isTeamRole => const [
    'MANAGER',
    'ADMIN',
    'DIRECTOR',
  ].contains('${widget.user['role']}'.toUpperCase());
  bool get _isAdminRole => const [
    'ADMIN',
    'DIRECTOR',
  ].contains('${widget.user['role']}'.toUpperCase());

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _fieldPurpose.dispose();
    super.dispose();
  }

  String get _endpoint {
    final orgId = Uri.encodeQueryComponent('${widget.user['orgId']}');
    final year = DateTime.now().year;
    final nextYear = year + 1;
    return switch (widget.module.title) {
      'Attendance' => '/api/attendance/today',
      'Notifications' => '/api/notifications',
      'Field Trips' => '/api/field-trips',
      'Work From Home' =>
        _isTeamRole ? '/api/wfh/requests?team=1' : '/api/wfh/requests',
      'Leaves' => '/api/leave/search?page=1&limit=50',
      'Holidays' =>
        '/api/holiday/search?year=$year&page=1&limit=50',
      'Reports' => '/api/reports/attendance',
      'Documents' => '/api/documents',
      'Live Tracking' => '/api/attendance/live',
      'Employees' => '/api/attendance/employees',
      'Audit Logs' => '/api/audit-logs',
      'Settings' =>
        '/api/holiday/search?year=$nextYear&page=1&limit=100',
      _ => '',
    };
  }

  Future<void> _load() async {
    if (_endpoint.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'This module does not expose a mobile API yet.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) {
        throw Exception('Your session has expired. Sign in again.');
      }
      const baseUrl = String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
      );
      final response = await http.get(
        Uri.parse('$baseUrl$_endpoint'),
        headers: {'authorization': 'Bearer $token'},
      );
      final decoded = jsonDecode(response.body);
      if (response.statusCode != 200) {
        final message = decoded is Map
            ? decoded['message'] ?? decoded['error']
            : null;
        throw Exception(message ?? 'Request failed (${response.statusCode}).');
      }
      if (decoded is! Map<String, dynamic>) {
        throw Exception('Unexpected server response.');
      }
      if (widget.module.title == 'Leaves') {
        final leaveInfoResponse = await http.get(
          Uri.parse('$baseUrl/api/leave/info?year=${DateTime.now().year}'),
          headers: {'authorization': 'Bearer $token'},
        );
        if (leaveInfoResponse.statusCode == 200) {
          final leaveInfoBody = jsonDecode(leaveInfoResponse.body);
          if (leaveInfoBody is Map<String, dynamic>) {
            decoded['leaveInfo'] = leaveInfoBody;
          }
        }
      }
      List<dynamic>? clientSites;
      if (widget.module.title == 'Attendance' ||
          widget.module.title == 'Field Trips') {
        final clientsResponse = await http.get(
          Uri.parse('$baseUrl/api/attendance/clients'),
          headers: {'authorization': 'Bearer $token'},
        );
        if (clientsResponse.statusCode == 200) {
          final clientsBody = jsonDecode(clientsResponse.body);
          if (clientsBody is Map && clientsBody['data'] is List) {
            clientSites = clientsBody['data'] as List;
          }
        }
      }
      if (mounted) {
        setState(() {
          _data = decoded;
          if (clientSites != null) _clientSites = clientSites;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _attendanceAction() async {
    final attendance = _data?['attendance'];
    final isMarkedIn = attendance is Map && attendance['status'] == 'IN';
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      if (!isMarkedIn && _attendanceType == 'FIELD_VISIT') {
        if (_selectedClientSiteId == null ||
            _fieldPurpose.text.trim().isEmpty) {
          throw Exception('Select a client/site and enter the visit purpose.');
        }
        if (!_expectedWorkEndAt.isAfter(DateTime.now())) {
          throw Exception('Expected completion time must be in the future.');
        }
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Turn on Location/GPS and try again.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Location permission is required for attendance.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) {
        throw Exception('Your session has expired. Sign in again.');
      }
      const baseUrl = String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
      );
      final response = await http.post(
        Uri.parse(
          '$baseUrl/api/attendance/${isMarkedIn ? 'mark-out' : 'mark-in'}',
        ),
        headers: {
          'authorization': 'Bearer $token',
          'content-type': 'application/json',
        },
        body: jsonEncode({
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'capturedAt': position.timestamp.toIso8601String(),
          if (!isMarkedIn) 'attendanceType': _attendanceType,
          if (!isMarkedIn && _attendanceType == 'FIELD_VISIT') ...{
            'clientSiteId': _selectedClientSiteId,
            'purpose': _fieldPurpose.text.trim(),
            'expectedWorkEndAt': _expectedWorkEndAt.toUtc().toIso8601String(),
            'overnightWork': _overnightWork,
          },
        }),
      );
      final decoded = jsonDecode(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = decoded is Map
            ? decoded['message'] ?? decoded['error']
            : null;
        throw Exception(message ?? 'Attendance action failed.');
      }
      if (isMarkedIn) {
        await AttendanceTrackingService.instance.stop();
      } else {
        await AttendanceTrackingService.instance.start(token);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isMarkedIn
                  ? 'Attendance marked out successfully.'
                  : 'Attendance marked in successfully.',
            ),
          ),
        );
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<Map<String, dynamic>> _sendJson(
    String path,
    Map<String, dynamic> body, {
    String method = 'POST',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      throw Exception('Your session has expired. Sign in again.');
    }
    const baseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000',
    );
    final uri = Uri.parse('$baseUrl$path');
    final headers = {
      'authorization': 'Bearer $token',
      'content-type': 'application/json',
    };
    final response = method == 'PATCH'
        ? await http.patch(uri, headers: headers, body: jsonEncode(body))
        : method == 'PUT'
        ? await http.put(uri, headers: headers, body: jsonEncode(body))
        : await http.post(uri, headers: headers, body: jsonEncode(body));
    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['message'] ?? decoded['error']
          : null;
      throw Exception(message ?? 'Request failed (${response.statusCode}).');
    }
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  String _dateKey(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<void> _showLeaveRequest() async {
    var type = 'casual';
    var start = DateTime.now();
    var end = DateTime.now();
    final reason = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New leave request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Leave type'),
                  items: const [
                    DropdownMenuItem(value: 'casual', child: Text('Casual')),
                    DropdownMenuItem(value: 'sick', child: Text('Sick')),
                    DropdownMenuItem(value: 'earned', child: Text('Earned')),
                    DropdownMenuItem(value: 'unpaid', child: Text('Unpaid')),
                    DropdownMenuItem(
                      value: 'maternity',
                      child: Text('Maternity'),
                    ),
                    DropdownMenuItem(
                      value: 'paternity',
                      child: Text('Paternity'),
                    ),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (value) {
                    if (value != null) setDialogState(() => type = value);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Start date'),
                  subtitle: Text(_dateKey(start)),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: start,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => start = picked);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('End date'),
                  subtitle: Text(_dateKey(end)),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: end.isBefore(start) ? start : end,
                      firstDate: start,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => end = picked);
                  },
                ),
                TextField(
                  controller: reason,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Reason'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true) {
      reason.dispose();
      return;
    }
    try {
      if (end.isBefore(start)) {
        throw Exception('End date must be after the start date.');
      }
      final days = end.difference(start).inDays + 1;
      await _sendJson('/api/leave', {
        'leaveType': type,
        'startDate': start.toIso8601String(),
        'endDate': end.toIso8601String(),
        'days': days,
        'reason': reason.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Leave request submitted.')),
        );
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      reason.dispose();
    }
  }

  Future<void> _showWfhRequest() async {
    var from = DateTime.now();
    var to = DateTime.now();
    var dayType = 'FULL_DAY';
    final reason = TextEditingController();
    final tasks = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Work from home request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('From'),
                  subtitle: Text(_dateKey(from)),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      initialDate: from,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (value != null) setDialogState(() => from = value);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('To'),
                  subtitle: Text(_dateKey(to)),
                  onTap: () async {
                    final value = await showDatePicker(
                      context: context,
                      initialDate: to.isBefore(from) ? from : to,
                      firstDate: from,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (value != null) setDialogState(() => to = value);
                  },
                ),
                DropdownButtonFormField<String>(
                  initialValue: dayType,
                  decoration: const InputDecoration(labelText: 'Day type'),
                  items: const [
                    DropdownMenuItem(
                      value: 'FULL_DAY',
                      child: Text('Full day'),
                    ),
                    DropdownMenuItem(
                      value: 'FIRST_HALF',
                      child: Text('First half'),
                    ),
                    DropdownMenuItem(
                      value: 'SECOND_HALF',
                      child: Text('Second half'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setDialogState(() => dayType = value);
                  },
                ),
                TextField(
                  controller: reason,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Reason'),
                ),
                TextField(
                  controller: tasks,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Planned tasks'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true) {
      reason.dispose();
      tasks.dispose();
      return;
    }
    try {
      if (reason.text.trim().isEmpty || tasks.text.trim().isEmpty) {
        throw Exception('Reason and planned tasks are required.');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Turn on Location/GPS and try again.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Location permission is required.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      await _sendJson('/api/wfh/requests', {
        'fromDate': _dateKey(from),
        'toDate': _dateKey(to),
        'dayType': dayType,
        'reason': reason.text.trim(),
        'plannedTasks': tasks.text.trim(),
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'capturedAt': position.timestamp.toIso8601String(),
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('WFH request submitted.')));
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      reason.dispose();
      tasks.dispose();
    }
  }

  Future<void> _markNotificationsRead() async {
    try {
      await _sendJson('/api/notifications', const {}, method: 'PATCH');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notifications marked as read.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _showFieldTripRequest() async {
    String? siteId;
    var travelMode = 'CAR';
    var start = DateTime.now().add(const Duration(hours: 1));
    var end = DateTime.now().add(const Duration(hours: 9));
    final purpose = TextEditingController();
    final source = TextEditingController();
    final destination = TextEditingController();
    final advance = TextEditingController(text: '0');
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New field trip'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: siteId,
                  decoration: const InputDecoration(labelText: 'Client / site'),
                  items: [
                    for (final site in _clientSites)
                      if (site is Map && site['_id'] != null)
                        DropdownMenuItem(
                          value: '${site['_id']}',
                          child: Text(
                            '${site['clientName']} - ${site['siteName']}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                  ],
                  onChanged: (value) => setDialogState(() => siteId = value),
                ),
                TextField(
                  controller: purpose,
                  decoration: const InputDecoration(labelText: 'Purpose'),
                ),
                TextField(
                  controller: source,
                  decoration: const InputDecoration(labelText: 'Source'),
                ),
                TextField(
                  controller: destination,
                  decoration: const InputDecoration(labelText: 'Destination'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: travelMode,
                  decoration: const InputDecoration(labelText: 'Travel mode'),
                  items: const [
                    DropdownMenuItem(value: 'CAR', child: Text('Car')),
                    DropdownMenuItem(value: 'BIKE', child: Text('Bike')),
                    DropdownMenuItem(
                      value: 'PUBLIC_TRANSPORT',
                      child: Text('Public transport'),
                    ),
                    DropdownMenuItem(value: 'FLIGHT', child: Text('Flight')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                  ],
                  onChanged: (value) {
                    if (value != null) setDialogState(() => travelMode = value);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Expected start'),
                  subtitle: Text(_formatTimestamp(start.toIso8601String())),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: start,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date == null || !context.mounted) return;
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(start),
                    );
                    if (time != null) {
                      setDialogState(
                        () => start = DateTime(
                          date.year,
                          date.month,
                          date.day,
                          time.hour,
                          time.minute,
                        ),
                      );
                    }
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Expected return'),
                  subtitle: Text(_formatTimestamp(end.toIso8601String())),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: end,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date == null || !context.mounted) return;
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(end),
                    );
                    if (time != null) {
                      setDialogState(
                        () => end = DateTime(
                          date.year,
                          date.month,
                          date.day,
                          time.hour,
                          time.minute,
                        ),
                      );
                    }
                  },
                ),
                TextField(
                  controller: advance,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Advance amount',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true) {
      purpose.dispose();
      source.dispose();
      destination.dispose();
      advance.dispose();
      return;
    }
    try {
      if (siteId == null ||
          purpose.text.trim().isEmpty ||
          source.text.trim().isEmpty ||
          destination.text.trim().isEmpty) {
        throw Exception(
          'Client/site, purpose, source and destination are required.',
        );
      }
      if (!end.isAfter(start)) {
        throw Exception('Expected return must be after the start time.');
      }
      await _sendJson('/api/field-trips', {
        'clientSiteId': siteId,
        'purpose': purpose.text.trim(),
        'source': source.text.trim(),
        'destination': destination.text.trim(),
        'travelMode': travelMode,
        'expectedStartAt': start.toUtc().toIso8601String(),
        'expectedReturnAt': end.toUtc().toIso8601String(),
        'advanceAmount': double.tryParse(advance.text) ?? 0,
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Field trip created.')));
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      purpose.dispose();
      source.dispose();
      destination.dispose();
      advance.dispose();
    }
  }

  Future<void> _uploadDocument() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
    );
    final file = picked?.files.single;
    if (file?.path == null || !mounted) return;
    final title = TextEditingController(
      text: file!.name.replaceFirst(RegExp(r'\.[^.]+$'), ''),
    );
    var category = 'OTHER';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Upload document'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              DropdownButtonFormField<String>(
                initialValue: category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: const [
                  DropdownMenuItem(value: 'IDENTITY', child: Text('Identity')),
                  DropdownMenuItem(
                    value: 'CERTIFICATE',
                    child: Text('Certificate'),
                  ),
                  DropdownMenuItem(value: 'TRAVEL', child: Text('Travel')),
                  DropdownMenuItem(value: 'HOTEL', child: Text('Hotel')),
                  DropdownMenuItem(value: 'CLIENT', child: Text('Client')),
                  DropdownMenuItem(value: 'MEDICAL', child: Text('Medical')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                ],
                onChanged: (value) {
                  if (value != null) setDialogState(() => category = value);
                },
              ),
              const SizedBox(height: 8),
              Text(file.name, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Upload'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) {
      title.dispose();
      return;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      if (token == null) {
        throw Exception('Your session has expired. Sign in again.');
      }
      const baseUrl = String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
      );
      final request =
          http.MultipartRequest('POST', Uri.parse('$baseUrl/api/documents'))
            ..headers['authorization'] = 'Bearer $token'
            ..fields['title'] = title.text.trim()
            ..fields['category'] = category
            ..fields['employeeId'] = '${widget.user['empId']}'
            ..files.add(
              await http.MultipartFile.fromPath(
                'file',
                file.path!,
                filename: file.name,
              ),
            );
      final response = await request.send();
      final body = jsonDecode(await response.stream.bytesToString());
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(
          body is Map
              ? body['message'] ?? body['error'] ?? 'Upload failed.'
              : 'Upload failed.',
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Document uploaded.')));
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      title.dispose();
    }
  }

  (String, String)? get _nextTripAction {
    final active = _data?['active'];
    if (active is! Map) return null;
    return switch (active['status']) {
      'PLANNED' => ('START_TRAVEL', 'Start Travel'),
      'TRAVELLING' => ('ARRIVE_CLIENT', 'Arrive at Client'),
      'AT_CLIENT' => ('START_WORK', 'Start Work'),
      'WORKING' => ('END_SITE', 'Complete Site Work'),
      'SITE_COMPLETED' => ('START_RETURN', 'Start Return'),
      'RETURNING' => ('COMPLETE_TRIP', 'Complete Trip'),
      'STAYING' => ('STAY_CHECK_OUT', 'Check Out of Stay'),
      _ => null,
    };
  }

  Future<void> _runTripAction() async {
    final active = _data?['active'];
    final action = _nextTripAction;
    if (active is! Map || action == null) return;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Turn on Location/GPS and try again.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Location permission is required.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      await _sendJson('/api/field-trips/${active['_id']}/action', {
        'action': action.$1,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'capturedAt': position.timestamp.toIso8601String(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${action.$2} completed.')));
      }
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _reviewWfh(Map request) async {
    final decision = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review WFH request'),
        content: Text(
          '${request['employeeId']} · ${request['fromDate']} to ${request['toDate']}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, 'REJECTED'),
            child: const Text('Reject'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'APPROVED'),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    if (decision == null) return;
    try {
      await _sendJson('/api/wfh/requests/${request['_id']}/review', {
        'status': decision,
        'remarks': 'Reviewed from mobile',
      }, method: 'PATCH');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('WFH request ${decision.toLowerCase()}.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _reviewLeave(Map request) async {
    final reason = TextEditingController();
    final decision = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review leave request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${request['employeeName'] ?? request['userId']} · ${request['leaveType']} · ${request['days']} day(s)',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              decoration: const InputDecoration(
                labelText: 'Rejection reason (optional)',
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, 'reject'),
            child: const Text('Reject'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'approve'),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    final rejectionReason = reason.text.trim();
    reason.dispose();
    if (decision == null) return;
    try {
      await _sendJson('/api/leave/${request['_id']}', {
        'action': decision,
        if (decision == 'reject') 'rejectionReason': rejectionReason,
      }, method: 'PUT');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Leave request ${decision}d.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _requestLeaveCancellation(Map request) async {
    final status = '${request['status']}'.toLowerCase();
    final isPending = status == 'pending';
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          isPending ? 'Cancel leave request' : 'Request cancellation',
        ),
        content: TextField(
          controller: reason,
          decoration: const InputDecoration(labelText: 'Reason (optional)'),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(isPending ? 'Cancel Leave' : 'Submit Request'),
          ),
        ],
      ),
    );
    final cancellationReason = reason.text.trim();
    reason.dispose();
    if (confirmed != true) return;
    try {
      await _sendJson('/api/leave/${request['_id']}', {
        'action': isPending ? 'cancel_pending' : 'request_cancellation',
        'cancellationReason': cancellationReason,
      }, method: 'PUT');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isPending
                  ? 'Leave request cancelled.'
                  : 'Leave cancellation requested.',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _reviewLeaveCancellation(Map request) async {
    final note = TextEditingController();
    final decision = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review cancellation request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${request['employeeName'] ?? request['userId']} | ${request['leaveType']} | ${request['days']} day(s)',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: note,
              decoration: const InputDecoration(labelText: 'Note (optional)'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Back'),
          ),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, 'reject_cancellation'),
            child: const Text('Reject Cancellation'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'approve_cancellation'),
            child: const Text('Approve Cancellation'),
          ),
        ],
      ),
    );
    final decisionReason = note.text.trim();
    note.dispose();
    if (decision == null) return;
    try {
      await _sendJson('/api/leave/${request['_id']}', {
        'action': decision,
        if (decision == 'reject_cancellation')
          'cancellationDecisionReason': decisionReason,
      }, method: 'PUT');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cancellation request updated.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _showHolidayForm() async {
    var date = DateTime(DateTime.now().year + 1);
    var recurring = false;
    final name = TextEditingController();
    final note = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add future holiday'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Holiday name'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Date'),
                subtitle: Text(_dateKey(date)),
                onTap: () async {
                  final value = await showDatePicker(
                    context: context,
                    initialDate: date,
                    firstDate: DateTime(DateTime.now().year + 1),
                    lastDate: DateTime(DateTime.now().year + 2, 12, 31),
                  );
                  if (value != null) setDialogState(() => date = value);
                },
              ),
              TextField(
                controller: note,
                decoration: const InputDecoration(labelText: 'Note'),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: recurring,
                title: const Text('Recurring holiday'),
                onChanged: (value) =>
                    setDialogState(() => recurring = value ?? false),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true) {
      name.dispose();
      note.dispose();
      return;
    }
    try {
      if (name.text.trim().isEmpty) {
        throw Exception('Holiday name is required.');
      }
      await _sendJson('/api/holiday', {
        'name': name.text.trim(),
        'date': date.toIso8601String(),
        'year': date.year,
        'note': note.text.trim(),
        'orgId': widget.user['orgId'],
        'isRecurring': recurring,
        'isOptional': false,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Holiday added.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      name.dispose();
      note.dispose();
    }
  }

  Future<void> _showClientSiteForm() async {
    final client = TextEditingController();
    final site = TextEditingController();
    final address = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add client / site'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: client,
              decoration: const InputDecoration(labelText: 'Client name'),
            ),
            TextField(
              controller: site,
              decoration: const InputDecoration(labelText: 'Site name'),
            ),
            TextField(
              controller: address,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Address'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (submitted != true) {
      client.dispose();
      site.dispose();
      address.dispose();
      return;
    }
    try {
      if (client.text.trim().isEmpty || site.text.trim().isEmpty) {
        throw Exception('Client and site names are required.');
      }
      final response = await _sendJson('/api/attendance/clients', {
        'clientName': client.text.trim(),
        'siteName': site.text.trim(),
        'address': address.text.trim(),
      });
      final created = response['data'];
      await _load();
      if (created is Map && created['_id'] != null && mounted) {
        setState(() => _selectedClientSiteId = '${created['_id']}');
      }
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Client/site added.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      client.dispose();
      site.dispose();
      address.dispose();
    }
  }

  String _formatTimestamp(dynamic value) {
    final date = DateTime.tryParse('$value')?.toLocal();
    if (date == null) return '-';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
    final minute = date.minute.toString().padLeft(2, '0');
    final period = date.hour < 12 ? 'AM' : 'PM';
    return '${date.day.toString().padLeft(2, '0')} ${months[date.month - 1]} ${date.year}, $hour:$minute $period';
  }

  Future<void> _pickExpectedEnd() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _expectedWorkEndAt,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 2)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_expectedWorkEndAt),
    );
    if (time == null) return;
    setState(() {
      _expectedWorkEndAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  String _attendanceDetails(dynamic entry) {
    if (entry is! Map) return '-';
    final lines = <String>[_formatTimestamp(entry['time'])];
    final location = entry['location'];
    if (location is Map) {
      final name = '${location['locationName'] ?? ''}'.trim();
      if (name.isNotEmpty) {
        lines.add(name);
      } else if (location['latitude'] != null &&
          location['longitude'] != null) {
        lines.add('${location['latitude']}, ${location['longitude']}');
      }
    }
    return lines.join('\n');
  }

  Widget _attendanceView(BuildContext context) {
    final attendance = _data?['attendance'];
    final hasAttendance = attendance is Map;
    final isMarkedIn = hasAttendance && attendance['status'] == 'IN';
    final isCompleted = hasAttendance && attendance['status'] == 'OUT';
    final markIn = hasAttendance ? attendance['markIn'] : null;
    final markOut = hasAttendance ? attendance['markOut'] : null;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(
                    isMarkedIn ? Icons.location_on : Icons.fingerprint,
                    size: 58,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isMarkedIn
                        ? 'You are marked in'
                        : isCompleted
                        ? 'Workday completed'
                        : 'Ready to start your workday',
                    style: Theme.of(context).textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    hasAttendance
                        ? '${attendance['attendanceDate']} · ${attendance['attendanceType'] ?? 'OFFICE'}'
                        : 'Your GPS location will be captured securely.',
                    textAlign: TextAlign.center,
                  ),
                  if (!hasAttendance && !isCompleted) ...[
                    const SizedBox(height: 22),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Work type',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: _attendanceType,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'OFFICE',
                          child: Text('Office / normal shift'),
                        ),
                        DropdownMenuItem(
                          value: 'FIELD_VISIT',
                          child: Text('Field visit / early travel'),
                        ),
                        DropdownMenuItem(
                          value: 'WORK_FROM_HOME',
                          child: Text('Work from home'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _attendanceType = value);
                        }
                      },
                    ),
                    if (_attendanceType == 'FIELD_VISIT') ...[
                      const SizedBox(height: 16),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Client / site',
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedClientSiteId,
                        decoration: const InputDecoration(
                          hintText: 'Select client / site',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          for (final site in _clientSites)
                            if (site is Map && site['_id'] != null)
                              DropdownMenuItem(
                                value: '${site['_id']}',
                                child: Text(
                                  '${site['clientName'] ?? 'Client'} - ${site['siteName'] ?? 'Site'}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                        ],
                        onChanged: (value) =>
                            setState(() => _selectedClientSiteId = value),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: _showClientSiteForm,
                          icon: const Icon(Icons.add_business_outlined),
                          label: const Text('Add client / site'),
                        ),
                      ),
                      if (_clientSites.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'No active client/sites found. Add one to continue.',
                            style: TextStyle(color: Colors.orange),
                          ),
                        ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _fieldPurpose,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Purpose',
                          hintText:
                              'Installation, inspection, client support...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.schedule),
                        title: const Text('Expected completion'),
                        subtitle: Text(
                          _formatTimestamp(
                            _expectedWorkEndAt.toIso8601String(),
                          ),
                        ),
                        trailing: const Icon(Icons.edit_calendar_outlined),
                        onTap: _pickExpectedEnd,
                      ),
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _overnightWork,
                        title: const Text('Work may continue overnight'),
                        onChanged: (value) =>
                            setState(() => _overnightWork = value ?? false),
                      ),
                    ],
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _submitting || isCompleted
                          ? null
                          : _attendanceAction,
                      icon: _submitting
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(isMarkedIn ? Icons.logout : Icons.login),
                      label: Text(
                        _submitting
                            ? 'Getting location...'
                            : isMarkedIn
                            ? 'Mark Out'
                            : isCompleted
                            ? 'Completed Today'
                            : 'Mark In',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.business_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Client / Sites',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      IconButton(
                        onPressed: _showClientSiteForm,
                        icon: const Icon(Icons.add),
                        tooltip: 'Add client / site',
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  if (_clientSites.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'No active client/sites. Tap + to add one.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  else
                    for (final site in _clientSites)
                      if (site is Map)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.location_city_outlined),
                          title: Text('${site['clientName'] ?? 'Client'}'),
                          subtitle: Text(
                            [
                              '${site['siteName'] ?? 'Site'}',
                              if ('${site['address'] ?? ''}'.trim().isNotEmpty)
                                '${site['address']}',
                            ].join('\n'),
                          ),
                        ),
                ],
              ),
            ),
          ),
          if (hasAttendance) ...[
            const SizedBox(height: 12),
            Card(
              elevation: 0,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.login),
                    title: const Text('Mark In'),
                    subtitle: Text(_attendanceDetails(markIn)),
                  ),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Mark Out'),
                    subtitle: Text(_attendanceDetails(markOut)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<dynamic> get _items {
    if (_data == null) return const [];
    const keys = [
      'notifications',
      'trips',
      'requests',
      'leaves',
      'holidays',
      'rows',
      'documents',
      'employees',
      'logs',
      'data',
    ];
    for (final key in keys) {
      final value = _data![key];
      if (value is List) return value;
    }
    final attendance = _data!['attendance'];
    return attendance is Map ? [attendance] : const [];
  }

  String _itemTitle(dynamic item, int index) {
    if (item is! Map) return '${widget.module.title} ${index + 1}';
    final nestedEmployee = item['employee'];
    if (nestedEmployee is Map) {
      return '${nestedEmployee['name'] ?? nestedEmployee['empId'] ?? 'Employee'}';
    }
    for (final key in [
      'title',
      'name',
      'employeeName',
      'employeeId',
      'leaveType',
      'purpose',
      'date',
      'attendanceDate',
      'category',
      'action',
    ]) {
      final value = item[key];
      if (value != null && '$value'.trim().isNotEmpty) return '$value';
    }
    return '${widget.module.title} ${index + 1}';
  }

  String _itemDetails(dynamic item) {
    if (item is! Map) return '$item';
    final nestedEmployee = item['employee'];
    if (nestedEmployee is Map) {
      final workStatus = item['workStatus'];
      final location = item['location'];
      return [
        'Employee ID: ${nestedEmployee['empId'] ?? '-'}',
        if (workStatus is Map)
          'Status: ${workStatus['label'] ?? workStatus['status'] ?? '-'}',
        if (location is Map)
          'Location: ${location['locationName'] ?? '${location['latitude']}, ${location['longitude']}'}',
      ].join('\n');
    }
    const preferred = [
      'message',
      'status',
      'fromDate',
      'toDate',
      'startDate',
      'endDate',
      'date',
      'attendanceDate',
      'markIn',
      'markOut',
      'description',
      'originalName',
      'timestamp',
      'entityType',
    ];
    final lines = <String>[];
    for (final key in preferred) {
      final value = item[key];
      if (value != null &&
          value is! Map &&
          value is! List &&
          '$value'.isNotEmpty) {
        lines.add('${_label(key)}: $value');
      }
      if (lines.length == 3) break;
    }
    return lines.isEmpty
        ? 'Tap refresh to load the latest information.'
        : lines.join('\n');
  }

  String _label(String value) => value
      .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
      .trim()
      .replaceFirstMapped(
        RegExp(r'^.'),
        (match) => match.group(0)!.toUpperCase(),
      );

  num _leaveNumber(Map<String, dynamic> info, String key) {
    final value = info[key];
    return value is num ? value : num.tryParse('$value') ?? 0;
  }

  Widget _leaveDashboard(BuildContext context) {
    final info = _data?['leaveInfo'] is Map
        ? Map<String, dynamic>.from(_data!['leaveInfo'] as Map)
        : <String, dynamic>{};
    final casual = _leaveNumber(info, 'casual');
    final sick = _leaveNumber(info, 'sick');
    final earned = _leaveNumber(info, 'earned');
    final maternity = _leaveNumber(info, 'maternity');
    final paternity = _leaveNumber(info, 'paternity');
    final usedCasual = _leaveNumber(info, 'usedCasual');
    final usedSick = _leaveNumber(info, 'usedSick');
    final usedEarned = _leaveNumber(info, 'usedEarned');
    final usedMaternity = _leaveNumber(info, 'usedMaternity');
    final usedPaternity = _leaveNumber(info, 'usedPaternity');
    final stats = <(String, num, num)>[
      ('Available', casual + sick + earned, usedCasual + usedSick + usedEarned),
      ('Earned', earned, usedEarned),
      ('Casual', casual, usedCasual),
      ('Sick', sick, usedSick),
      (
        'Maternity / Paternity',
        maternity + paternity,
        usedMaternity + usedPaternity,
      ),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemCount: stats.length,
      itemBuilder: (context, index) {
        final stat = stats[index];
        final balance = stat.$2 - stat.$3;
        return Card(
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stat.$1,
                  maxLines: 2,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                Text('Allocated: ${stat.$2}'),
                Text(
                  'Balance: $balance',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text('Availed: ${stat.$3}'),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (widget.module.title == 'Attendance') {
      return _attendanceView(context);
    }
    final items = _items;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 0,
            child: ListTile(
              leading: Icon(
                widget.module.icon,
                color: Theme.of(context).colorScheme.primary,
              ),
              title: Text(widget.module.description),
              subtitle: Text(
                '${items.length} record${items.length == 1 ? '' : 's'}',
              ),
              trailing: IconButton(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh',
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (widget.module.title == 'Leaves') ...[
            _leaveDashboard(context),
            const SizedBox(height: 12),
          ],
          if (widget.module.title == 'Leaves' &&
              '${widget.user['role']}'.toUpperCase() != 'DIRECTOR')
            FilledButton.icon(
              onPressed: _showLeaveRequest,
              icon: const Icon(Icons.add),
              label: const Text('New Leave Request'),
            ),
          if (widget.module.title == 'Work From Home')
            FilledButton.icon(
              onPressed: _showWfhRequest,
              icon: const Icon(Icons.add_home_work_outlined),
              label: const Text('New WFH Request'),
            ),
          if (widget.module.title == 'Field Trips')
            FilledButton.icon(
              onPressed: _showFieldTripRequest,
              icon: const Icon(Icons.add_road),
              label: const Text('New Field Trip'),
            ),
          if (widget.module.title == 'Field Trips' && _nextTripAction != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: _runTripAction,
                icon: const Icon(Icons.navigation_outlined),
                label: Text(_nextTripAction!.$2),
              ),
            ),
          if (widget.module.title == 'Documents')
            FilledButton.icon(
              onPressed: _uploadDocument,
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload Document'),
            ),
          if (widget.module.title == 'Settings' && _isAdminRole)
            FilledButton.icon(
              onPressed: _showHolidayForm,
              icon: const Icon(Icons.calendar_month_outlined),
              label: const Text('Add Future Holiday'),
            ),
          if (widget.module.title == 'Notifications' && items.isNotEmpty)
            OutlinedButton.icon(
              onPressed: _markNotificationsRead,
              icon: const Icon(Icons.done_all),
              label: const Text('Mark All Read'),
            ),
          if (widget.module.title == 'Leaves' ||
              widget.module.title == 'Work From Home' ||
              widget.module.title == 'Field Trips' ||
              widget.module.title == 'Documents' ||
              (widget.module.title == 'Settings' && _isAdminRole) ||
              (widget.module.title == 'Notifications' && items.isNotEmpty))
            const SizedBox(height: 8),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Column(
                children: [
                  Icon(Icons.inbox_outlined, size: 52),
                  SizedBox(height: 12),
                  Text('No records found.'),
                ],
              ),
            )
          else
            for (final entry in items.indexed)
              Card(
                elevation: 0,
                child: ListTile(
                  title: Text(_itemTitle(entry.$2, entry.$1)),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(_itemDetails(entry.$2)),
                  ),
                  trailing:
                      ((widget.module.title == 'Work From Home' &&
                              _isTeamRole &&
                              entry.$2 is Map &&
                              entry.$2['status'] == 'PENDING') ||
                          (widget.module.title == 'Leaves' &&
                              _isTeamRole &&
                              entry.$2 is Map &&
                              const [
                                'pending',
                                'cancellation_pending',
                              ].contains(
                                '${entry.$2['status']}'.toLowerCase(),
                              ) &&
                              '${entry.$2['userId']}' !=
                                  '${widget.user['id']}'))
                      ? const Icon(Icons.rate_review_outlined)
                      : widget.module.title == 'Leaves' &&
                            entry.$2 is Map &&
                            '${entry.$2['userId']}' == '${widget.user['id']}' &&
                            const [
                              'pending',
                              'approved',
                            ].contains('${entry.$2['status']}'.toLowerCase())
                      ? const Icon(Icons.cancel_outlined)
                      : null,
                  onTap:
                      widget.module.title == 'Work From Home' &&
                          _isTeamRole &&
                          entry.$2 is Map &&
                          entry.$2['status'] == 'PENDING'
                      ? () => _reviewWfh(entry.$2 as Map)
                      : widget.module.title == 'Leaves' &&
                            _isTeamRole &&
                            entry.$2 is Map &&
                            '${entry.$2['status']}'.toLowerCase() ==
                                'pending' &&
                            '${entry.$2['userId']}' != '${widget.user['id']}'
                      ? () => _reviewLeave(entry.$2 as Map)
                      : widget.module.title == 'Leaves' &&
                            _isTeamRole &&
                            entry.$2 is Map &&
                            '${entry.$2['status']}'.toLowerCase() ==
                                'cancellation_pending' &&
                            '${entry.$2['userId']}' != '${widget.user['id']}'
                      ? () => _reviewLeaveCancellation(entry.$2 as Map)
                      : widget.module.title == 'Leaves' &&
                            entry.$2 is Map &&
                            '${entry.$2['userId']}' == '${widget.user['id']}' &&
                            const [
                              'pending',
                              'approved',
                            ].contains('${entry.$2['status']}'.toLowerCase())
                      ? () => _requestLeaveCancellation(entry.$2 as Map)
                      : null,
                ),
              ),
        ],
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({required this.user, required this.onSignOut, super.key});
  final Map<String, dynamic> user;
  final Future<void> Function() onSignOut;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;
  static const destinations = [
    (Icons.dashboard_outlined, 'Dashboard'),
    (Icons.fingerprint, 'Attendance'),
    (Icons.event_note_outlined, 'Leaves'),
    (Icons.more_horiz, 'More'),
  ];

  List<AppModule> get _modules {
    const employeeModules = [
      AppModule(Icons.fingerprint, 'Attendance', 'Mark in and track workday'),
      AppModule(
        Icons.notifications_outlined,
        'Notifications',
        'Your latest updates',
      ),
      AppModule(
        Icons.route_outlined,
        'Field Trips',
        'Trips, location and expenses',
      ),
      AppModule(
        Icons.home_work_outlined,
        'Work From Home',
        'Requests and approvals',
      ),
      AppModule(Icons.event_note, 'Leaves', 'Apply and view requests'),
      AppModule(
        Icons.calendar_month_outlined,
        'Holidays',
        'Company holiday calendar',
      ),
      AppModule(
        Icons.bar_chart_outlined,
        'Reports',
        'Attendance and work reports',
      ),
      AppModule(Icons.description_outlined, 'Documents', 'Employee documents'),
    ];
    const teamModules = [
      AppModule(
        Icons.location_on_outlined,
        'Live Tracking',
        'View active team locations',
      ),
      AppModule(Icons.people_outline, 'Employees', 'View and manage employees'),
    ];
    const adminModules = [
      AppModule(Icons.history_outlined, 'Audit Logs', 'Review system activity'),
      AppModule(
        Icons.settings_outlined,
        'Settings',
        'Organization configuration',
      ),
    ];
    final role = '${widget.user['role']}'.toUpperCase();
    final isTeamRole =
        role == 'MANAGER' || role == 'ADMIN' || role == 'DIRECTOR';
    final isAdminRole = role == 'ADMIN' || role == 'DIRECTOR';
    return [
      ...employeeModules.take(1),
      if (isTeamRole) teamModules.first,
      ...employeeModules.skip(1).take(3),
      if (isTeamRole) teamModules.last,
      ...employeeModules.skip(4),
      if (isAdminRole) ...adminModules,
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(destinations[_index].$2),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: widget.onSignOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: switch (_index) {
        0 => _dashboard(context),
        1 => _moduleBody(context, _modules.first),
        2 => _moduleBody(
          context,
          _modules.firstWhere((module) => module.title == 'Leaves'),
        ),
        _ => _more(context),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          for (final item in destinations)
            NavigationDestination(icon: Icon(item.$1), label: item.$2),
        ],
      ),
    );
  }

  Widget _dashboard(BuildContext context) {
    final name = widget.user['name'] ?? widget.user['empId'];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          elevation: 0,
          color: Theme.of(context).colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${widget.user['role']} workspace',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Hello, $name',
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  '${widget.user['empId']} | Choose a module to continue your work.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 22),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: MediaQuery.sizeOf(context).width > 600 ? 3 : 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.05,
          children: [
            for (final module in _modules)
              Card(
                elevation: 0,
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => _openModule(module),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .primaryContainer,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Icon(
                              module.icon,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          module.title,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          module.description,
                          maxLines: 2,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  void _openModule(AppModule module) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          appBar: AppBar(title: Text(module.title)),
          body: _moduleBody(context, module),
        ),
      ),
    );
  }

  Widget _more(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: _modules.length,
    separatorBuilder: (_, _) => const SizedBox(height: 8),
    itemBuilder: (context, index) {
      final module = _modules[index];
      return Card(
        elevation: 0,
        child: ListTile(
          leading: Icon(
            module.icon,
            color: Theme.of(context).colorScheme.primary,
          ),
          title: Text(module.title),
          subtitle: Text(module.description),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _openModule(module),
        ),
      );
    },
  );

  Widget _moduleBody(BuildContext context, AppModule module) =>
      ModuleScreen(module: module, user: widget.user);
}
