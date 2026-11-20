import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../api.dart';
import '../cam.dart';
import '../native.dart';
import '../state.dart';
import '../theme.dart';

void _toast(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

/// Step 1: the admin PIN (checked on the phone, works offline). Step 2 (only for server actions): GSA website login.
class AdminGate extends StatefulWidget {
  final AppState s;
  const AdminGate({super.key, required this.s});
  @override
  State<AdminGate> createState() => _AdminGateState();
}

class _AdminGateState extends State<AdminGate> {
  final pin = TextEditingController(), pin2 = TextEditingController();
  bool? isSet; String? msg; bool unlocked = false;

  @override
  void initState() { super.initState(); Native.pinStatus().then((r) => setState(() => isSet = r['set'] == true)); }

  Future<void> submit() async {
    try {
      if (isSet == false) {
        if (pin.text != pin2.text) { setState(() => msg = 'PINs do not match'); return; }
        await Native.pinSet(pin.text); setState(() { isSet = true; unlocked = true; });
      } else {
        final r = await Native.pinVerify(pin.text);
        if (r['ok'] == true) { setState(() => unlocked = true); }
        else if ((r['locked_seconds'] ?? 0) > 0) { setState(() => msg = 'Too many tries. Wait ${r['locked_seconds']} seconds.'); }
        else { setState(() => msg = 'Wrong PIN. ${r['tries_left']} tries left.'); }
      }
    } catch (e) { setState(() => msg = e.toString()); }
    pin.clear(); pin2.clear();
  }

  @override
  Widget build(BuildContext context) {
    if (unlocked) return AdminHome(s: widget.s);
    return Scaffold(
      appBar: AppBar(title: const Text('Administrator')),
      body: isSet == null ? const Center(child: CircularProgressIndicator()) : Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text(isSet! ? 'Enter admin PIN' : 'Create an admin PIN (4 to 12 digits)', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: pin, obscureText: true, keyboardType: TextInputType.number, maxLength: 12, textAlign: TextAlign.center, decoration: const InputDecoration(counterText: '')),
          if (isSet == false) ...[const SizedBox(height: 10), TextField(controller: pin2, obscureText: true, keyboardType: TextInputType.number, maxLength: 12, textAlign: TextAlign.center, decoration: const InputDecoration(hintText: 'Repeat PIN', counterText: ''))],
          if (msg != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(msg!, style: const TextStyle(color: C.bad))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: submit, child: Text(isSet! ? 'Unlock' : 'Save PIN'))),
        ]),
      ),
    );
  }
}

class AdminHome extends StatelessWidget {
  final AppState s;
  const AdminHome({super.key, required this.s});

  Future<bool> _ensureLogin(BuildContext context) async {
    if (s.api.adminToken != null) return true;
    final u = TextEditingController(), p = TextEditingController(); String? err;
    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      title: const Text('GSA website login'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Owner or staff with Face attendance permission.', style: TextStyle(fontSize: 13)),
        const SizedBox(height: 10),
        TextField(controller: u, decoration: const InputDecoration(labelText: 'Username')),
        const SizedBox(height: 8),
        TextField(controller: p, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: const TextStyle(color: C.bad))),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          try {
            final r = await Api().login(u.text.trim(), p.text);
            s.api.adminToken = r['token'] as String; s.adminName = (r['user'] as Map)['name']?.toString() ?? u.text.trim();
            if (ctx.mounted) Navigator.pop(ctx, true);
          } catch (e) { set(() => err = e.toString()); }
        }, child: const Text('Sign in')),
      ],
    )));
    return ok == true;
  }

  Widget _tile(BuildContext c, IconData i, String t, String sub, Future<void> Function() f) => Card(
      child: ListTile(leading: Icon(i, color: C.brand), title: Text(t, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(sub), trailing: const Icon(Icons.chevron_right), onTap: f));

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Admin settings')),
        body: ListView(padding: const EdgeInsets.all(14), children: [
          _tile(context, Icons.swap_horiz, 'Entry or Exit mode', 'Now: ${s.mode}', () async {
            if (!await _ensureLogin(context)) return;
            final next = s.mode == 'ENTRY' ? 'EXIT' : 'ENTRY';
            try { await s.api.setDeviceMode(s.deviceId, next); await s.sync(); if (context.mounted) _toast(context, 'Mode is now ${s.mode}'); } catch (e) { if (context.mounted) _toast(context, '$e'); }
          }),
          _tile(context, Icons.how_to_reg, 'Enrol faces', 'Consent, then capture', () async { if (await _ensureLogin(context) && context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => EnrolList(s: s))); }),
          _tile(context, Icons.edit_note, 'Mark attendance manually', 'Non-biometric fallback', () async { if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => ManualScreen(s: s))); }),
          _tile(context, Icons.report_problem_outlined, 'Rejected records', '${s.queue['rejected'] ?? 0} kept for review', () async { if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => RejectedScreen(s: s))); }),
          _tile(context, Icons.tune, 'Calibration', 'Thresholds and test log', () async { if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => CalibrationScreen(s: s))); }),
          _tile(context, Icons.pin_outlined, 'Change admin PIN', '', () async {
            final c = TextEditingController();
            final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: const Text('New PIN'), content: TextField(controller: c, obscureText: true, keyboardType: TextInputType.number, maxLength: 12),
                actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save'))]));
            if (ok == true) { try { await Native.pinSet(c.text); if (context.mounted) _toast(context, 'PIN changed'); } catch (e) { if (context.mounted) _toast(context, '$e'); } }
          }),
          _tile(context, Icons.link_off, 'Un-pair this phone', 'Removes the device token from this phone', () async {
            final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: const Text('Un-pair?'), content: const Text('Unsent attendance records stay on the phone. Revoke the device on the website too.'),
                actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Un-pair'))]));
            if (ok == true) { await s.unpair(); if (context.mounted) Navigator.popUntil(context, (r) => r.isFirst); }
          }),
        ]),
      );
}

// ------------------------------------------------------------------ enrolment
class EnrolList extends StatefulWidget {
  final AppState s;
  const EnrolList({super.key, required this.s});
  @override
  State<EnrolList> createState() => _EnrolListState();
}

class _EnrolListState extends State<EnrolList> {
  List students = []; String? err; String q = '';

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final l = await widget.s.api.adminStudents(); setState(() => students = l); } catch (e) { setState(() => err = e.toString()); } }

  static bool _minor(String? dob) { final d = DateTime.tryParse(dob ?? ''); if (d == null) return true; final n = DateTime.now(); var a = n.year - d.year; if (n.month < d.month || (n.month == d.month && n.day < d.day)) a--; return a < 18; }

  Future<bool> _consent(Map st) async {
    final minor = _minor(st['dob'] as String?);
    final g = TextEditingController(text: st['guardian_name']?.toString() ?? ''), r = TextEditingController(text: st['guardian_relation']?.toString() ?? ''); bool ok = false;
    final res = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      title: Text('Consent: ${st['name']}'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(minor ? 'This student is under 18. A parent or guardian must consent.' : 'The student must consent.', style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        const Text('Face data is stored only on this phone, encrypted, and used only for attendance. It is deleted on request or after the retention period. No face photo is uploaded.', style: TextStyle(fontSize: 13)),
        if (minor) ...[const SizedBox(height: 8), TextField(controller: g, decoration: const InputDecoration(labelText: 'Guardian name')), const SizedBox(height: 8), TextField(controller: r, decoration: const InputDecoration(labelText: 'Relationship'))],
        CheckboxListTile(value: ok, onChanged: (v) => set(() => ok = v == true), title: const Text('Consent has been given and recorded'), contentPadding: EdgeInsets.zero),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(onPressed: ok && (!minor || (g.text.trim().isNotEmpty && r.text.trim().isNotEmpty)) ? () => Navigator.pop(ctx, true) : null, child: const Text('Save consent'))],
    )));
    if (res != true) return false;
    try { await widget.s.api.recordConsent(st['id'].toString(), guardian: g.text.trim(), relation: r.text.trim()); return true; } catch (e) { if (mounted) _toast(context, '$e'); return false; }
  }

  Future<void> _open(Map st) async {
    var status = st['status'] as String?;
    if (status == null || status == 'revoked') { if (!await _consent(st)) return; status = 'consented'; }
    if (!mounted) return;
    final done = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => EnrolCapture(s: widget.s, student: st)));
    if (done == true) { await widget.s.sync(); _load(); }
  }

  Future<void> _delete(Map st) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text('Delete face data: ${st['name']}?'), content: const Text('The face template is removed from the phone at the next sync. Attendance records are kept.'),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(style: FilledButton.styleFrom(backgroundColor: C.bad), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete'))]));
    if (ok != true) return;
    try {
      await widget.s.api.revokeFace(st['id'].toString());
      await Native.deleteStudents([st['id'].toString()]); // delete on this phone right away
      await widget.s.api.deleted([st['id'].toString()]);
      await widget.s.sync(); _load();
    } catch (e) { if (mounted) _toast(context, '$e'); }
  }

  @override
  Widget build(BuildContext context) {
    final list = students.where((x) => '${x['name']} ${x['admission_no']}'.toLowerCase().contains(q.toLowerCase())).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Enrol faces')),
      body: err != null ? Center(child: Text(err!)) : Column(children: [
        Padding(padding: const EdgeInsets.all(12), child: TextField(onChanged: (v) => setState(() => q = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search student'))),
        Expanded(child: ListView.builder(itemCount: list.length, itemBuilder: (_, i) {
          final st = list[i] as Map; final status = st['status'] as String?;
          return ListTile(
            title: Text('${st['name']}'), subtitle: Text('${st['admission_no'] ?? ''}  ${status == 'enrolled' ? 'Face enrolled' : status == 'consented' ? 'Consent saved, not enrolled' : status == 'revoked' ? 'Deleted' : 'No consent'}'),
            trailing: status == 'enrolled' || status == 'consented' ? IconButton(icon: const Icon(Icons.delete_outline, color: C.bad), onPressed: () => _delete(st)) : null,
            onTap: () => _open(st),
          );
        })),
      ]),
    );
  }
}

class EnrolCapture extends StatefulWidget {
  final AppState s; final Map student;
  const EnrolCapture({super.key, required this.s, required this.student});
  @override
  State<EnrolCapture> createState() => _EnrolCaptureState();
}

class _EnrolCaptureState extends State<EnrolCapture> {
  final cam = CamSession(); String hint = 'Starting camera'; int count = 0; int needed = 3; bool running = true; String? err;

  @override
  void initState() { super.initState(); _run(); }

  Future<void> _run() async {
    try {
      if (!widget.s.engineReady) throw 'Face engine not ready';
      needed = (await Native.getConfig())['enrolFrames'] as int? ?? 3;
      await cam.open(widget.s.camera);
      await Native.enrolBegin(widget.student['id'].toString());
      setState(() => hint = 'Look at the camera');
      final end = DateTime.now().add(const Duration(seconds: 60));
            while (running && mounted && count < needed && DateTime.now().isBefore(end)) {
        final p = await cam.snap(); if (p == null) { await Future.delayed(const Duration(milliseconds: 150)); continue; }
        Map<String, dynamic> r; try { r = await Native.enrolFrame(p); } finally { CamSession.discard(p); }
        if (!mounted) return;
        switch (r['status']) {
          case 'captured': setState(() { count = r['count'] as int; hint = count < needed ? 'Good. Turn slightly and hold still' : 'Saving'; }); await Future.delayed(const Duration(milliseconds: 900)); break;
          case 'duplicate': throw 'This face already matches another student (id ${r['other_student_id']}). Enrolment stopped.';
          case 'no_face': setState(() => hint = 'Look at the camera'); break;
          case 'multiple': setState(() => hint = 'One person only'); break;
          default: setState(() => hint = 'Adjust: ${r['reason'] ?? 'position'}');
        }
      }
      if (count < needed) throw 'Could not capture enough good frames. Try again in better light.';
      final c = await Native.enrolCommit();
      if (c['ok'] != true) throw 'Could not save: ${c['reason']}';
      await widget.s.api.enrolled(widget.student['id'].toString(), c['model_sha'].toString());
      if (mounted) { _toast(context, 'Enrolled ${widget.student['name']}'); Navigator.pop(context, true); }
    } catch (e) {
      await Native.enrolCancel();
      if (mounted) setState(() => err = '$e');
    }
  }

  @override
  void dispose() { running = false; cam.close(); Native.enrolCancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text('Enrol ${widget.student['name']}')),
        body: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (cam.ctl != null && err == null) const Icon(Icons.face, size: 72, color: C.brand),
          const SizedBox(height: 12),
          Text(err ?? hint, textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: err != null ? C.bad : C.ink)),
          const SizedBox(height: 16),
          if (err == null) LinearProgressIndicator(value: needed == 0 ? 0 : count / needed),
          const SizedBox(height: 20),
          FilledButton(onPressed: () => Navigator.pop(context, false), child: Text(err != null ? 'Close' : 'Cancel')),
        ])),
      );
}

// ------------------------------------------------------------------ manual fallback
class ManualScreen extends StatefulWidget {
  final AppState s;
  const ManualScreen({super.key, required this.s});
  @override
  State<ManualScreen> createState() => _ManualScreenState();
}

class _ManualScreenState extends State<ManualScreen> {
  String q = '';
  @override
  Widget build(BuildContext context) {
    final items = widget.s.roster.entries.where((e) => '${e.value['name']} ${e.value['admission_no']}'.toLowerCase().contains(q.toLowerCase())).toList();
    return Scaffold(
      appBar: AppBar(title: Text('Manual ${widget.s.mode == 'EXIT' ? 'exit' : 'entry'}')),
      body: Column(children: [
        const Padding(padding: EdgeInsets.fromLTRB(14, 12, 14, 0), child: Text('Use only when face scan is not possible. Recorded as manual. Students without face consent are marked on the website instead.', style: TextStyle(fontSize: 13, color: Colors.black54))),
        Padding(padding: const EdgeInsets.all(12), child: TextField(onChanged: (v) => setState(() => q = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search student'))),
        Expanded(child: ListView(children: [for (final e in items) ListTile(
          title: Text('${e.value['name']}'), subtitle: Text('${e.value['admission_no'] ?? ''}'),
          onTap: () async {
            final r = await Native.recordEvent(studentId: e.key, eventType: widget.s.mode, method: 'manual', markedBy: widget.s.adminName ?? 'device admin', cooldownSeconds: widget.s.cooldown);
            if (!context.mounted) return;
            _toast(context, r['status'] == 'recorded' ? 'Recorded ${e.value['name']}' : 'Already recorded recently');
            widget.s.refreshQueue(); widget.s.sync();
          })])),
      ]),
    );
  }
}

// ------------------------------------------------------------------ rejected records
class RejectedScreen extends StatefulWidget {
  final AppState s;
  const RejectedScreen({super.key, required this.s});
  @override
  State<RejectedScreen> createState() => _RejectedScreenState();
}

class _RejectedScreenState extends State<RejectedScreen> {
  List items = [];
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async { final l = await Native.queueRejected(); setState(() => items = l); }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Rejected records')),
        body: items.isEmpty ? const Center(child: Text('Nothing rejected')) : ListView(children: [for (final e in items) ListTile(
          title: Text('Student ${e['student_id']}  ${e['event_type']}'), subtitle: Text('${e['occurred_at']}\n${e['reject_reason']}'), isThreeLine: true,
          trailing: IconButton(icon: const Icon(Icons.delete_outline), tooltip: 'Discard after review', onPressed: () async { await Native.queueDiscard('${e['event_id']}'); await widget.s.refreshQueue(); _load(); }),
        )]),
      );
}

// ------------------------------------------------------------------ calibration
class CalibrationScreen extends StatefulWidget {
  final AppState s;
  const CalibrationScreen({super.key, required this.s});
  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  Map<String, dynamic> cfg = {}; final label = TextEditingController();
  static const keys = ['matchThreshold', 'minMargin', 'livenessReality', 'hitsRequired', 'minFacePx', 'maxRollDeg', 'maxYaw', 'minBright', 'maxBright', 'minSharp', 'enrolFrames'];
  final ctl = <String, TextEditingController>{};

  @override
  void initState() { super.initState(); Native.getConfig().then((c) { setState(() { cfg = c; for (final k in keys) { ctl[k] = TextEditingController(text: '${c[k]}'); } }); }); }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Calibration')),
        body: ListView(padding: const EdgeInsets.all(14), children: [
          const Text('Defaults are NOT production-calibrated. Collect consented test scans (same person, different people, printed photo, screen replay), export the CSV, then tune.', style: TextStyle(fontSize: 13)),
          const SizedBox(height: 10),
          for (final k in keys) Padding(padding: const EdgeInsets.only(bottom: 8), child: TextField(controller: ctl[k], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: k))),
          FilledButton(onPressed: () async {
            final m = <String, dynamic>{}; for (final k in keys) { final v = num.tryParse(ctl[k]!.text); if (v != null) m[k] = v; }
            await Native.setConfig(m); if (context.mounted) _toast(context, 'Saved');
          }, child: const Text('Save thresholds')),
          const Divider(height: 32),
          TextField(controller: label, decoration: const InputDecoration(labelText: 'Test label for the log (e.g. genuine-student12, photo-print, screen-replay). Empty = logging off')),
          const SizedBox(height: 8),
          FilledButton(onPressed: () async { await Native.setCalibrationLabel(label.text.trim().isEmpty ? null : label.text.trim()); if (context.mounted) _toast(context, label.text.trim().isEmpty ? 'Logging off' : 'Logging scans as ${label.text.trim()}'); }, child: const Text('Apply log label')),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () async {
            final csv = await Native.calibrationCsv(); if (csv.isEmpty) { if (context.mounted) _toast(context, 'No log yet'); return; }
            final f = File('${(await getTemporaryDirectory()).path}/gsa_calibration.csv'); await f.writeAsString(csv);
            await Share.shareXFiles([XFile(f.path)], text: 'GSA calibration log (contains scores only, no images)');
          }, child: const Text('Export calibration CSV')),
          OutlinedButton(onPressed: () async { await Native.clearCalibration(); if (context.mounted) _toast(context, 'Log cleared'); }, child: const Text('Clear log')),
        ]),
      );
}
