import 'package:flutter/material.dart';
import '../native.dart';
import '../state.dart';
import '../theme.dart';
import 'admin.dart';
import 'scan.dart';

class HomeScreen extends StatefulWidget {
  final AppState s;
  const HomeScreen({super.key, required this.s});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? result;
  AppState get s => widget.s;

  Future<void> scan() async {
    setState(() => result = null);
    final r = await Navigator.of(context).push<Map<String, dynamic>>(MaterialPageRoute(builder: (_) => ScanScreen(s: s), fullscreenDialog: true));
    if (!mounted) return;
    setState(() => result = r);
    s.refreshQueue();
  }

  Widget _result() {
    final r = result;
    if (r == null) return const SizedBox(height: 150, child: Center(child: Text('Ready to scan', style: TextStyle(color: Colors.black45, fontSize: 18))));
    final st = r['status'];
    Color col; String title; String sub = '';
    switch (st) {
      case 'recorded': col = C.ok; title = '${r['name']}'; sub = '${r['type'] == 'EXIT' ? 'Exit' : 'Entry'} recorded at ${_t(r['at'])}'; break;
      case 'duplicate': col = C.flame; title = '${r['name']}'; sub = 'Already recorded at ${_t(r['at'])}'; break;
      case 'timeout': col = C.flame; title = 'No match'; sub = 'Face not recognised. Try again, or ask staff to mark manually.'; break;
      case 'cancelled': col = Colors.black45; title = 'Scan cancelled'; break;
      default: col = C.bad; title = 'Scan failed'; sub = '${r['message'] ?? ''}';
    }
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border(left: BorderSide(color: col, width: 8))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: col)),
        if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(sub, style: const TextStyle(fontSize: 16))),
      ]),
    );
  }

  String _t(dynamic iso) {
    final d = DateTime.tryParse('$iso')?.toLocal(); if (d == null) return '';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: s,
        builder: (_, __) {
          final pending = s.queue['pending'] ?? 0;
          return Scaffold(
            appBar: AppBar(
              title: Row(children: [Image.asset('assets/icon.png', height: 30), const SizedBox(width: 10), const Text('GSA Face Attendance', style: TextStyle(fontWeight: FontWeight.w800))]),
              actions: [IconButton(tooltip: 'Admin', icon: const Icon(Icons.admin_panel_settings_outlined), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminGate(s: s))))],
            ),
            body: SafeArea(
              child: ListView(padding: const EdgeInsets.all(18), children: [
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10), alignment: Alignment.center,
                  decoration: BoxDecoration(color: s.mode == 'EXIT' ? C.flame : C.brand, borderRadius: BorderRadius.circular(12)),
                  child: Text(s.mode == 'EXIT' ? 'EXIT MODE' : 'ENTRY MODE', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: 1)),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 190,
                  child: FilledButton(
                    onPressed: s.engineReady ? scan : null,
                    style: FilledButton.styleFrom(backgroundColor: C.ink, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.face_retouching_natural, size: 64, color: C.volt),
                      const SizedBox(height: 8),
                      Text(s.engineReady ? 'TAP TO SCAN' : s.engineMessage, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                ),
                if (!s.engineReady) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.folder_open),
                    label: const Text('Import models from a folder'),
                    onPressed: () async {
                      final r = await Native.pickModels();
                      if (!context.mounted || r['message'] == 'cancelled') return;
                      if (r['ok'] == true) {
                        await showDialog(context: context, barrierDismissible: false, builder: (_) => AlertDialog(
                          title: const Text('Models copied'), content: const Text('The app will restart now and install them.'),
                          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Restart'))]));
                        await Native.restartApp();
                      } else {
                        await showDialog(context: context, builder: (_) => AlertDialog(title: const Text('Could not import'), content: Text('${r['message']}'),
                          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))]));
                      }
                    }),
                  if (s.engineNote.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(s.engineNote, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Colors.black45))),
                ],
                const SizedBox(height: 14),
                SegmentedButton<String>(
                  segments: const [ButtonSegment(value: 'rear', icon: Icon(Icons.flashlight_on_outlined), label: Text('Rear + torch')), ButtonSegment(value: 'front', icon: Icon(Icons.screenshot_outlined), label: Text('Front + white screen'))],
                  selected: {s.camera}, onSelectionChanged: (v) => s.setCamera(v.first),
                ),
                const SizedBox(height: 14),
                _result(),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    Icon(s.syncing ? Icons.sync : pending > 0 ? Icons.cloud_off : Icons.cloud_done, color: pending > 0 ? C.flame : C.ok),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(pending > 0 ? '$pending waiting to upload' : 'All records uploaded', style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(s.syncing ? 'Syncing...' : s.syncMessage, style: const TextStyle(color: Colors.black54, fontSize: 13)),
                      if ((s.queue['rejected'] ?? 0) > 0) Text('${s.queue['rejected']} rejected by the server, see Admin', style: const TextStyle(color: C.bad, fontSize: 13)),
                      if (s.queue['store_error'] != null) Text('Storage problem: ${s.queue['store_error']}', style: const TextStyle(color: C.bad, fontSize: 13)),
                    ])),
                    TextButton(onPressed: s.syncing ? null : s.sync, child: const Text('Sync now')),
                  ]),
                ),
                const SizedBox(height: 8),
                Text('${s.deviceName}  |  ${s.enrolledCount} faces on this phone', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black45)),
              ]),
            ),
          );
        },
      );
}
