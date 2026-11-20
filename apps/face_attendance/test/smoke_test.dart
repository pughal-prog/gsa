import 'package:flutter_test/flutter_test.dart';
import 'package:gsa_face_attendance/api.dart';

void main() {
  test('ApiError carries message and status', () {
    final e = ApiError('x', 401);
    expect(e.toString(), 'x');
    expect(e.status, 401);
  });
}
