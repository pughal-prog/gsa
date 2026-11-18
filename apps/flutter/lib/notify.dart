import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'api.dart';

const _task = 'gsa_check_alerts';

/// Runs in the background (about every 15 minutes, even when the app is closed).
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, input) async {
    try {
      final p = await SharedPreferences.getInstance();
      final token = p.getString('token');
      if (token == null) return true;
      await Notify.init();
      await Notify.checkAndShow(token: token);
    } catch (_) {}
    return true;
  });
}

/// Alerts: polled every 30s while the app is open and every ~15 min in the background.
/// (Instant push while fully closed needs Firebase, which needs a Google project.)
class Notify {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static final unread = ValueNotifier<int>(0);
  static Timer? _timer;
  static bool _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    const init = InitializationSettings(android: AndroidInitializationSettings('ic_notification'));
    await _plugin.initialize(init);
    await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(
      const AndroidNotificationChannel('gsa_alerts', 'Academy alerts', description: 'Attendance, fees and announcements', importance: Importance.high));
    _ready = true;
  }

  static Future<void> initBackground() async {
    await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);
  }

  static void _schedule() {
    Workmanager().registerPeriodicTask(_task, _task,
        frequency: const Duration(minutes: 15), existingWorkPolicy: ExistingWorkPolicy.keep,
        constraints: Constraints(networkType: NetworkType.connected));
  }

  /// Shows the system permission prompt, after a short explanation, the first time the app opens.
  static Future<void> askPermission(BuildContext context) async {
    final p = await SharedPreferences.getInstance();
    if (p.getBool('asked_notif') == true) return;
    if (!context.mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        icon: const Icon(Icons.notifications_active, size: 36),
        title: const Text('Allow notifications?'),
        content: const Text('Get alerts when a student checks in, is late or absent, fees are due, and for academy announcements.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Not now')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Allow')),
        ],
      ),
    );
    await p.setBool('asked_notif', true);
    if (ok == true) await Permission.notification.request();
  }

  static Future<void> resetAsked() async { final p = await SharedPreferences.getInstance(); await p.remove('asked_notif'); }

  static void start() {
    _timer?.cancel();
    poll();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => poll());
    try { _schedule(); } catch (_) {}
  }

  static void stop() {
    _timer?.cancel();
    unread.value = 0;
    try { Workmanager().cancelByUniqueName(_task); } catch (_) {}
  }

  static Future<void> poll() async {
    if (Api.token == null) return;
    if (Api.role == 'staff' && !Api.can('students.viewAll')) return;
    await checkAndShow(token: Api.token!, updateBadge: true);
  }

  /// Fetches unread alerts and shows one system notification per new alert (remembers the last one shown).
  static Future<void> checkAndShow({required String token, bool updateBadge = false}) async {
    final res = await http.get(Uri.parse('$apiUrl/api/notifications'), headers: {'Authorization': 'Bearer $token'}).timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return;
    final d = jsonDecode(res.body);
    final seen = (d['seenId'] ?? 0) as int;
    final me = d['notifications'] as List;
    final fresh = me.where((n) => (n['id'] as int) > seen && !(n['type'] == 'announcement' && n['recipients'] != null)).toList();
    if (updateBadge) unread.value = (d['unread'] ?? 0) as int;
    final p = await SharedPreferences.getInstance();
    final shown = p.getInt('last_shown') ?? 0;
    final newOnes = fresh.where((n) => (n['id'] as int) > shown).toList().reversed.toList();
    if (newOnes.isEmpty) return;
    if (!await Permission.notification.isGranted) { await p.setInt('last_shown', newOnes.last['id'] as int); return; }
    await init();
    for (final n in newOnes.take(5)) {
      await _plugin.show(n['id'] as int, n['title'] as String?, n['body'] as String?,
          const NotificationDetails(android: AndroidNotificationDetails('gsa_alerts', 'Academy alerts', importance: Importance.high, priority: Priority.high, icon: 'ic_notification')));
    }
    await p.setInt('last_shown', newOnes.last['id'] as int);
  }

  static Future<void> markSeen() async {
    try { await Api.post('/api/notifications/seen'); unread.value = 0; } catch (_) {}
  }
}
