import 'dart:convert';
import 'package:flutter/services.dart';

/// Thin typed wrapper over the "gsa/face" platform channel (see android/.../Bridge.kt).
/// Face templates, encryption keys and raw images never cross this channel; only small JSON results do.
class Native {
  static const _ch = MethodChannel('gsa/face');

  static Future<Map<String, dynamic>> _obj(String m, [Map<String, dynamic>? a]) async =>
      jsonDecode((await _ch.invokeMethod<String>(m, a)) ?? '{}') as Map<String, dynamic>;
  static Future<List<dynamic>> _list(String m, [Map<String, dynamic>? a]) async =>
      jsonDecode((await _ch.invokeMethod<String>(m, a)) ?? '[]') as List<dynamic>;

  /// Feedback sound: entry, exit, duplicate or wrong. Never throws, a sound must not affect attendance.
  static Future<void> playSound(String name) async { try { await _ch.invokeMethod('playSound', {'name': name}); } catch (_) {} }

  // engine
  static Future<Map<String, dynamic>> engineInit() => _obj('engineInit');
  static Future<Map<String, dynamic>> engineStatus() => _obj('engineStatus');
  static Future<Map<String, dynamic>> engineProgress() => _obj('engineProgress');
  static Future<void> scanBegin() => _ch.invokeMethod('scanBegin');
  static Future<Map<String, dynamic>> scanFrame(String path) => _obj('scanFrame', {'path': path});
  static Future<void> enrolBegin(String studentId) => _ch.invokeMethod('enrolBegin', {'studentId': studentId});
  static Future<Map<String, dynamic>> enrolFrame(String path) => _obj('enrolFrame', {'path': path});
  static Future<Map<String, dynamic>> enrolCommit() => _obj('enrolCommit');
  static Future<void> enrolCancel() => _ch.invokeMethod('enrolCancel');
  static Future<Map<String, dynamic>> deleteStudents(List<String> ids) => _obj('deleteStudents', {'ids': jsonEncode(ids)});
  static Future<Map<String, dynamic>> eraseAllFaces() => _obj('eraseAllFaces');
  static Future<Map<String, dynamic>> getConfig() => _obj('getConfig');
  static Future<Map<String, dynamic>> setConfig(Map<String, dynamic> cfg) => _obj('setConfig', {'json': jsonEncode(cfg)});
  static Future<void> setCalibrationLabel(String? label) => _ch.invokeMethod('setCalibrationLabel', {'label': label});
  static Future<String> calibrationCsv() async => (await _ch.invokeMethod<String>('calibrationCsv')) ?? '';
  static Future<void> clearCalibration() => _ch.invokeMethod('clearCalibration');

  // encrypted key/value
  static Future<String?> kvGet(String key) => _ch.invokeMethod<String>('kvGet', {'key': key});
  static Future<void> kvPut(String key, String value) => _ch.invokeMethod('kvPut', {'key': key, 'value': value});
  static Future<void> kvDelete(String key) => _ch.invokeMethod('kvDelete', {'key': key});

  // offline queue
  static Future<Map<String, dynamic>> recordEvent({
    required String studentId, required String eventType, String method = 'face',
    double? matchScore, double? liveness, String? markedBy, int cooldownSeconds = 600,
  }) => _obj('recordEvent', {
        'studentId': studentId, 'eventType': eventType, 'method': method, 'matchScore': matchScore,
        'liveness': liveness, 'markedBy': markedBy, 'cooldownSeconds': cooldownSeconds,
      });
  static Future<List<dynamic>> queuePending([int limit = 50]) => _list('queuePending', {'limit': limit});
  static Future<void> queueAck(List<String> ids) => _ch.invokeMethod('queueAck', {'ids': jsonEncode(ids)});
  static Future<void> queueReject(Map<String, String> reasons) => _ch.invokeMethod('queueReject', {'reasons': jsonEncode(reasons)});
  static Future<Map<String, dynamic>> queueCounts() => _obj('queueCounts');
  static Future<List<dynamic>> queueRejected() => _list('queueRejected');
  static Future<void> queueDiscard(String id) => _ch.invokeMethod('queueDiscard', {'id': id});

  // admin PIN
  static Future<Map<String, dynamic>> pinStatus() => _obj('pinStatus');
  static Future<void> pinSet(String pin) => _ch.invokeMethod('pinSet', {'pin': pin});
  static Future<Map<String, dynamic>> pinVerify(String pin) => _obj('pinVerify', {'pin': pin});

  // window
  static Future<void> setBrightness(double v) => _ch.invokeMethod('setBrightness', {'value': v});
  static Future<void> keepScreenOn(bool on) => _ch.invokeMethod('keepScreenOn', {'on': on});
}
