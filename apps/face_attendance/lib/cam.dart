import 'dart:io';
import 'package:camera/camera.dart';
import 'native.dart';

/// One camera session. Opened only while a scan or enrolment is running and always disposed afterwards.
/// Rear camera: LED torch on. Front camera: caller shows a full-screen white panel; we raise screen brightness here.
class CamSession {
  CameraController? ctl;
  bool front = false;
  bool torchOn = false;

  Future<void> open(String which) async {
    front = which == 'front';
    final all = await availableCameras();
    final want = front ? CameraLensDirection.front : CameraLensDirection.back;
    final d = all.firstWhere((c) => c.lensDirection == want, orElse: () => all.first);
    front = d.lensDirection == CameraLensDirection.front;
    final c = CameraController(d, ResolutionPreset.high, enableAudio: false, imageFormatGroup: ImageFormatGroup.jpeg);
    await c.initialize();
    ctl = c;
    try { await c.setFocusMode(FocusMode.auto); await c.setExposureMode(ExposureMode.auto); } catch (_) {} // continuous autofocus and metering where the phone allows it
    await Native.keepScreenOn(true);
    if (front) {
      await Native.setBrightness(1.0);
    } else {
      try { await c.setFlashMode(FlashMode.torch); torchOn = true; } catch (_) { torchOn = false; } // no LED: continue without
    }
  }

  /// Captures one JPEG to the app cache. The caller must delete it with [discard].
  Future<String?> snap() async {
    final c = ctl; if (c == null || !c.value.isInitialized || c.value.isTakingPicture) return null;
    try { return (await c.takePicture()).path; } catch (_) { return null; }
  }

  static void discard(String? p) { if (p != null) { try { File(p).deleteSync(); } catch (_) {} } }

  Future<void> close() async {
    final c = ctl; ctl = null;
    try { if (torchOn) await c?.setFlashMode(FlashMode.off); } catch (_) {}
    try { await c?.dispose(); } catch (_) {}
    torchOn = false;
    await Native.setBrightness(-1.0); // back to the user's system brightness
    await Native.keepScreenOn(false);
  }
}
