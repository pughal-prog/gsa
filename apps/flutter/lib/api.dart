import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://gsa-api.pughalanarulmani.workers.dev');

class ApiError implements Exception {
  final String message;
  ApiError(this.message);
  @override
  String toString() => message;
}

class Api {
  static String? token;
  static Map<String, dynamic>? me;

  static Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    token = p.getString('token');
  }

  static Future<void> saveToken(String? t) async {
    final p = await SharedPreferences.getInstance();
    token = t;
    if (t == null) { await p.remove('token'); me = null; } else { await p.setString('token', t); }
  }

  static Map<String, String> get _h => {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};

  static Future<dynamic> _send(String m, String path, [Object? body]) async {
    final uri = Uri.parse('$apiUrl$path');
    final req = http.Request(m, uri)..headers.addAll(_h);
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 25)));
    dynamic data;
    try { data = jsonDecode(res.body); } catch (_) { data = {}; }
    if (res.statusCode == 401 && token != null && !path.startsWith('/auth/')) { await saveToken(null); }
    if (res.statusCode >= 400) throw ApiError((data is Map && data['error'] != null) ? data['error'].toString() : 'Request failed (${res.statusCode})');
    return data;
  }

  static Future<dynamic> get(String p) => _send('GET', p);
  static Future<dynamic> post(String p, [Object? b]) => _send('POST', p, b ?? {});
  static Future<dynamic> put(String p, Object b) => _send('PUT', p, b);
  static Future<dynamic> delete(String p) => _send('DELETE', p);

  static Future<bool> restore() async {
    if (token == null) return false;
    try { me = (await get('/auth/me'))['user']; return true; } catch (_) { return false; }
  }

  static Future<void> login(String u, String p) async {
    final r = await post('/auth/login', {'username': u, 'password': p});
    await saveToken(r['token']);
    me = (await get('/auth/me'))['user'];
  }

  static String get role => (me?['role'] ?? '') as String;
  static bool can(String perm) => role == 'owner' || (role == 'staff' && ((me?['perms'] ?? []) as List).contains(perm));
}
