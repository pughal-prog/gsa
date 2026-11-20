import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:gsa_face_attendance/api.dart';
import 'package:gsa_face_attendance/screens/pair.dart';

void main() {
  test('ApiError carries message and status', () {
    final e = ApiError('x', 401);
    expect(e.toString(), 'x');
    expect(e.status, 401);
  });

  test('pairing code box accepts all 10 characters, with or without the hyphen', () {
    final f = PairCodeFormatter();
    String run(String typed) => f.formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: typed)).text;
    expect(run('abcde-fghij'), 'ABCDE-FGHIJ');
    expect(run('ABCDEFGHIJ'), 'ABCDE-FGHIJ');
    expect(run(' abcde fghij9'), 'ABCDE-FGHIJ');
    expect(cleanPairCode('ABCDE-FGHIJ'), 'ABCDEFGHIJ');
  });
}
