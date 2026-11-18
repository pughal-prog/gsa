import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

/// Local notifications driven by polling while the app is open. (Real background push needs Firebase.)
class Notify {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static final unread = ValueNotifier<int>(0);
  static Timer? _timer;
  static int _lastId = 0;

  static Future<void> init() async {
    const init = InitializationSettings(android: AndroidInitializationSettings('ic_notification'));
    await _plugin.initialize(init);
    await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(
      const AndroidNotificationChannel('gsa_alerts', 'Academy alerts', description: 'Attendance, fees and announcements', importance: Importance.high));
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
    _timer = Timer.periodic(const Duration(seconds: 45), (_) => poll());
  }

  static void stop() { _timer?.cancel(); unread.value = 0; }

  static Future<void> poll() async {
    if (Api.token == null) return;
    final role = Api.role;
    if (role == 'staff' && !Api.can('students.viewAll')) return;
    try {
      final r = await Api.get('/api/notifications/unread');
      unread.value = (r['unread'] ?? 0) as int;
      final latest = r['latest'];
      if (latest != null && latest['id'] != _lastId) {
        if (_lastId != 0 && await Permission.notification.isGranted) {
          await _plugin.show(latest['id'] as int, latest['title'] as String?, latest['body'] as String?,
              const NotificationDetails(android: AndroidNotificationDetails('gsa_alerts', 'Academy alerts',
                  importance: Importance.high, priority: Priority.high, icon: 'ic_notification')));
        }
        _lastId = latest['id'] as int;
      }
    } catch (_) {}
  }

  static Future<void> markSeen() async {
    try { await Api.post('/api/notifications/seen'); unread.value = 0; } catch (_) {}
  }
}
