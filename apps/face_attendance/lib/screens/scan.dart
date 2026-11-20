import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../cam.dart';
import '../native.dart';
import '../state.dart';
import '../theme.dart';

const _hints = {
  'too_far': 'Move closer', 'not_centered': 'Centre your face', 'tilted': 'Keep your head straight', 'turned': 'Look at the camera',
  'too_dark': 'Too dark', 'too_bright': 'Too bright', 'blurry': 'Hold still', 'multiple_faces': 'One person at a time',
  'liveness_unclear': 'Look at the camera, hold still', 'spoof': 'Live face required', 'changed_person': 'One person at a time',
};

/// Full-screen scan. Opens the camera and lighting, analyses frames until a student is accepted, the
/// operator cancels, or 25 seconds pass, then closes everything. Pops a result map.
class ScanScreen extends StatefulWidget {
  final AppState s;
  const ScanScreen({super.key, required this.s});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final cam = CamSession();
  String hint = 'Starting camera';
  bool done = false; bool ready = false;
  String? err;
  DateTime _lastWrong = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() { super.initState(); _run(); }

  Future<void> _run() async {
    final s = widget.s;
    try {
      if (!s.engineReady) { await s.initEngine(); if (!s.engineReady) throw 'Face engine not ready. Connect to Wi-Fi once to download the models.'; }
      await cam.open(s.camera);
      if (!mounted) return;
      setState(() { ready = true; hint = 'Look at the camera'; });
      await Native.scanBegin();
      final end = DateTime.now().add(const Duration(seconds: 25));
      while (!done && mounted && DateTime.now().isBefore(end)) {
        final path = await cam.snap();
        if (path == null) { await Future.delayed(const Duration(milliseconds: 150)); continue; }
        Map<String, dynamic> r;
        try { r = await Native.scanFrame(path); } finally { CamSession.discard(path); }
        if (!mounted || done) break;
        final st = r['status'];
        if (st == 'accepted') { await _accept(r); return; }
        // wrong-face buzz, at most once every 3 seconds so a face held in front of the camera does not buzz non-stop
        if ((st == 'unknown' || st == 'spoof' || st == 'ambiguous') && DateTime.now().difference(_lastWrong).inSeconds >= 3) {
          _lastWrong = DateTime.now();
          Native.playSound('wrong');
        }
        setState(() {
          hint = st == 'pending' ? 'Hold still' : st == 'no_face' ? 'Look at the camera' : st == 'unknown' ? 'Not recognised' :
              st == 'ambiguous' ? 'Cannot be sure, try again' : st == 'spoof' ? 'Live face required' : (_hints[r['reason']] ?? 'Adjust position');
          if (r['reason'] == 'spoof' || r['reason'] == 'liveness_unclear') {
            final l = r['liveness'], c = r['clarity'];
            if (l is num && c is num) hint = '$hint\n(reality ${l.toStringAsFixed(2)}, clarity ${c.toStringAsFixed(2)})';
          }
        });
      }
      if (!done && mounted) _finish({'status': 'timeout'});
    } catch (e) {
      if (mounted) setState(() => err = e.toString());
    }
  }

  Future<void> _accept(Map<String, dynamic> r) async {
    final sid = r['student_id'].toString();
    final rec = await Native.recordEvent(studentId: sid, eventType: widget.s.mode, matchScore: (r['score'] as num?)?.toDouble(),
        liveness: (r['liveness'] as num?)?.toDouble(), cooldownSeconds: widget.s.cooldown);
    Native.playSound(rec['status'] == 'duplicate' ? 'duplicate' : (widget.s.mode == 'EXIT' ? 'exit' : 'entry'));
    final name = (widget.s.roster[sid] as Map?)?['name'] ?? 'Student $sid';
    _finish({'status': rec['status'], 'name': name, 'student_id': sid, 'type': widget.s.mode, 'at': rec['occurred_at'] ?? rec['last_at']});
    widget.s.sync();
  }

  void _finish(Map<String, dynamic> r) { if (done) return; done = true; Navigator.of(context).pop(r); }

  @override
  void dispose() { done = true; cam.close(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final front = widget.s.camera == 'front';
    return Scaffold(
      backgroundColor: front ? Colors.white : Colors.black,
      body: SafeArea(
        child: err != null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(err!, textAlign: TextAlign.center, style: TextStyle(color: front ? Colors.black : Colors.white)),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => Navigator.pop(context, {'status': 'error', 'message': err}), child: const Text('Close')),
              ])))
            : Stack(children: [
                // front camera: the white screen itself is the light, so the preview is a small window
                if (ready && cam.ctl != null)
                  Align(
                    alignment: front ? const Alignment(0, -0.35) : Alignment.center,
                    child: front
                        ? ClipOval(child: SizedBox(width: 280, height: 360, child: FittedBox(fit: BoxFit.cover, child: SizedBox(width: cam.ctl!.value.previewSize!.height, height: cam.ctl!.value.previewSize!.width, child: CameraPreview(cam.ctl!)))))
                        : SizedBox.expand(child: FittedBox(fit: BoxFit.cover, child: SizedBox(width: cam.ctl!.value.previewSize!.height, height: cam.ctl!.value.previewSize!.width, child: CameraPreview(cam.ctl!)))),
                  ),
                Positioned(left: 16, right: 16, bottom: 110, child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
                  decoration: BoxDecoration(color: C.ink.withOpacity(.88), borderRadius: BorderRadius.circular(14)),
                  child: Text(hint, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                )),
                Positioned(left: 16, right: 16, bottom: 24, child: OutlinedButton(
                  onPressed: () => _finish({'status': 'cancelled'}),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52), backgroundColor: Colors.white),
                  child: const Text('Cancel'))),
              ]),
      ),
    );
  }
}
