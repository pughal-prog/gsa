import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'native.dart';

/// App-wide state: pairing, ENTRY/EXIT mode, camera choice, roster cache and background sync.
/// All persisted values live in the encrypted native store (Native.kv*), never in plain preferences.
class AppState extends ChangeNotifier {
  final api = Api();
  bool loaded = false;
  bool paired = false;
  String deviceName = '';
  int deviceId = 0;
  String mode = 'ENTRY'; // ENTRY or EXIT, set by an administrator
  String camera = 'rear'; // rear or front, remembered
  int cooldown = 600;
  Map<String, dynamic> roster = {}; // studentId -> {name, admission_no}
  Map<String, dynamic> queue = {'pending': 0, 'rejected': 0};
  String syncMessage = 'Not synced yet';
  DateTime? lastSync;
  bool syncing = false;
  bool engineReady = false;
  String engineMessage = 'Preparing face engine';
  int enrolledCount = 0;
  bool adminUnlocked = false;
  String? adminName;
  StreamSubscription? _net;
  Timer? _timer;

  Future<void> load() async {
    api.deviceToken = await Native.kvGet('device_token');
    paired = api.deviceToken != null;
    deviceName = await Native.kvGet('device_name') ?? '';
    mode = await Native.kvGet('mode') ?? 'ENTRY';
    camera = await Native.kvGet('camera') ?? 'rear';
    final r = await Native.kvGet('roster');
    if (r != null) roster = jsonDecode(r) as Map<String, dynamic>;
    final ls = await Native.kvGet('last_sync');
    if (ls != null) lastSync = DateTime.tryParse(ls);
    queue = await Native.queueCounts();
    loaded = true;
    notifyListeners();
    _net = Connectivity().onConnectivityChanged.listen((r) {
      if (r.any((x) => x == ConnectivityResult.wifi || x == ConnectivityResult.ethernet)) sync();
    });
    _timer = Timer.periodic(const Duration(minutes: 5), (_) => sync());
    initEngine();
    sync();
  }

  Future<void> initEngine() async {
    engineMessage = 'Preparing face engine (first start downloads models)';
    notifyListeners();
    final poll = Timer.periodic(const Duration(milliseconds: 700), (_) async {
      try {
        final p = await Native.engineProgress();
        if (p['phase'] == 'models') { engineMessage = 'Downloading face models ${p['percent'] ?? 0}%'; notifyListeners(); }
      } catch (_) {}
    });
    try {
      final s = await Native.engineInit();
      engineReady = s['ready'] == true;
      enrolledCount = (s['enrolled'] as List).length;
      engineMessage = engineReady ? 'Face engine ready' : 'Face engine not ready';
    } catch (e) {
      engineReady = false;
      engineMessage = 'Face engine failed: $e. Connect to Wi-Fi and restart.';
    } finally { poll.cancel(); }
    notifyListeners();
  }

  Future<void> setCamera(String c) async { camera = c; await Native.kvPut('camera', c); notifyListeners(); }

  Future<void> pair(String code) async {
    final r = await Api().pair(code.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), ''));
    api.deviceToken = r['token'] as String;
    await Native.kvPut('device_token', api.deviceToken!);
    deviceName = (r['device'] as Map)['name'] as String;
    await Native.kvPut('device_name', deviceName);
    paired = true;
    notifyListeners();
    await sync();
  }

  Future<void> unpair() async {
    for (final k in ['device_token', 'device_name', 'roster', 'mode', 'last_sync']) { await Native.kvDelete(k); }
    api.deviceToken = null; paired = false; roster = {}; notifyListeners();
  }

  Future<void> refreshQueue() async { queue = await Native.queueCounts(); notifyListeners(); }

  /// Uploads queued events, then pulls config + roster. Local events are deleted only after the server's explicit ack.
  Future<void> sync() async {
    if (syncing || !paired) return;
    syncing = true; notifyListeners();
    try {
      while (true) {
        final batch = await Native.queuePending(4);
        if (batch.isEmpty) break;
        final res = await api.postEvents(batch);
        final acked = (res['acked'] as List).map((e) => e.toString()).toList();
        final rejected = <String, String>{};
        for (final r in (res['rejected'] as List? ?? [])) { rejected[r['event_id'].toString()] = r['reason'].toString(); }
        if (acked.isEmpty && rejected.isEmpty) throw ApiError('Server did not acknowledge events');
        if (acked.isNotEmpty) await Native.queueAck(acked);
        if (rejected.isNotEmpty) await Native.queueReject(rejected);
        if (batch.length < 4) break;
      }
      final cfg = await api.config();
      deviceId = ((cfg['device'] as Map)['id'] as num).toInt();
      mode = cfg['mode'] as String; await Native.kvPut('mode', mode);
      cooldown = (cfg['cooldown_seconds'] as num?)?.toInt() ?? 600;
      final ro = await api.roster();
      final m = <String, dynamic>{};
      for (final s in (ro['students'] as List)) { m[s['id'].toString()] = {'name': s['name'], 'admission_no': s['admission_no']}; }
      roster = m; await Native.kvPut('roster', jsonEncode(m));
      final del = (ro['delete_ids'] as List).map((e) => e.toString()).toList();
      if (del.isNotEmpty && engineReady) {
        await Native.deleteStudents(del);
        await api.deleted(del); // server confirms deletion only after the phone did it
      }
      if (engineReady) enrolledCount = ((await Native.engineStatus())['enrolled'] as List).length;
      lastSync = DateTime.now(); await Native.kvPut('last_sync', lastSync!.toIso8601String());
      syncMessage = 'Synced';
    } on ApiError catch (e) {
      syncMessage = e.status == 401 ? 'Device not authorised. Re-pair this phone.' : 'Offline, will retry. ${e.message}';
    } catch (e) {
      syncMessage = 'Sync problem: $e';
    } finally {
      syncing = false; queue = await Native.queueCounts(); notifyListeners();
    }
  }

  @override
  void dispose() { _net?.cancel(); _timer?.cancel(); super.dispose(); }
}
