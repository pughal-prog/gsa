import 'dart:convert';
import 'package:http/http.dart' as http;

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://gsa-api.pughalanarulmani.workers.dev');

class ApiError implements Exception {
  final String message; final int? status;
  ApiError(this.message, [this.status]);
  @override
  String toString() => message;
}

/// Backend client. The phone authenticates with its own random device token (obtained once with a pairing code);
/// no secret is built into this app. Admin actions use a normal GSA login (owner or staff with face.manage).
class Api {
  Api({this.deviceToken, this.adminToken});
  String? deviceToken;
  String? adminToken;
  static const _timeout = Duration(seconds: 20);

  Future<dynamic> _send(String method, String path, {Object? body, String? auth}) async {
    final uri = Uri.parse('$apiUrl$path');
    final headers = {'Content-Type': 'application/json', if (auth != null) 'Authorization': auth};
    try {
      final req = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      final res = await http.Response.fromStream(await req.send().timeout(_timeout));
      final data = res.body.isEmpty ? {} : jsonDecode(res.body);
      if (res.statusCode >= 400) throw ApiError((data is Map ? data['error'] : null) ?? 'Request failed (${res.statusCode})', res.statusCode);
      return data;
    } on ApiError { rethrow; }
    on Exception { throw ApiError('No connection to the academy server'); }
  }

  Future<dynamic> _device(String method, String path, {Object? body}) {
    if (deviceToken == null) throw ApiError('This phone is not paired');
    return _send(method, path, body: body, auth: 'Device $deviceToken');
  }
  Future<dynamic> _admin(String method, String path, {Object? body}) {
    if (adminToken == null) throw ApiError('Sign in as an administrator first', 401);
    return _send(method, path, body: body, auth: 'Bearer $adminToken');
  }

  // ---- device ----
  Future<Map> pair(String code) async => await _send('POST', '/device/face/pair', body: {'code': code}) as Map;
  Future<Map> config() async => await _device('GET', '/device/face/config') as Map;
  Future<Map> roster() async => await _device('GET', '/device/face/roster') as Map;
  Future<void> enrolled(String studentId, String modelSha) => _device('POST', '/device/face/enrolled', body: {'student_id': int.parse(studentId), 'model_sha': modelSha});
  Future<void> deleted(List<String> ids) => _device('POST', '/device/face/deleted', body: {'student_ids': ids.map(int.parse).toList()});
  Future<Map> postEvents(List<dynamic> events) async => await _device('POST', '/device/face/events', body: {'events': events}) as Map;

  // ---- admin ----
  Future<Map> login(String username, String password) async => await _send('POST', '/auth/login', body: {'username': username, 'password': password}) as Map;
  Future<List> adminStudents() async => (await _admin('GET', '/api/face/students') as Map)['students'] as List;
  Future<void> recordConsent(String studentId, {required String guardian, required String relation, int retentionDays = 365}) =>
      _admin('PUT', '/api/face/students/$studentId/consent', body: {'confirm': true, 'guardian_name': guardian, 'guardian_relation': relation, 'retention_days': retentionDays});
  Future<void> revokeFace(String studentId) => _admin('DELETE', '/api/face/students/$studentId');
  Future<List> adminDevices() async => (await _admin('GET', '/api/face/devices') as Map)['devices'] as List;
  Future<void> setDeviceMode(int deviceId, String mode) => _admin('PATCH', '/api/face/devices/$deviceId', body: {'mode': mode});
}
