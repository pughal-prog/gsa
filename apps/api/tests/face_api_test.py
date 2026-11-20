"""Integration test for the face attendance API. Run against `wrangler dev` with the demo seed:
   python3 tests/face_api_test.py http://localhost:8787
Uses only the standard library."""
import json, sys, urllib.request, urllib.error, uuid, datetime as dt

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8787'
fails = []

def call(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  {extra}' if not cond else ''))
    if not cond: fails.append(name)

now = lambda **k: (dt.datetime.now(dt.timezone.utc) - dt.timedelta(**k)).strftime('%Y-%m-%dT%H:%M:%S.000Z')

s, r = call('POST', '/auth/login', {'username': 'owner', 'password': 'Demo@1234'}); A = {'Authorization': 'Bearer ' + r['token']}
# --- admin: device + pairing
s, r = call('POST', '/api/face/devices', {'name': 'iQOO 12 test', 'mode': 'ENTRY'}, A); check('create device returns code', s == 201 and len(r.get('code', '')) == 11, r)
dev_id, code = r['id'], r['code']
check('anonymous cannot create device', call('POST', '/api/face/devices', {'name': 'x'})[0] == 401)
s, r = call('POST', '/device/face/pair', {'code': 'AAAAA-AAAAA'}); check('wrong pairing code rejected', s == 401)
s, r = call('POST', '/device/face/pair', {'code': code.lower()}); check('pairing works (case-insensitive)', s == 200 and r['token'].startswith('gsad_'), r)
tok = r['token']; D = {'Authorization': 'Device ' + tok}
s, r = call('POST', '/device/face/pair', {'code': code}); check('pairing code is single use', s == 401)
check('no token rejected', call('GET', '/device/face/config')[0] == 401)
check('bad token rejected', call('GET', '/device/face/config', headers={'Authorization': 'Device nope'})[0] == 401)
check('user JWT is not a device token', call('GET', '/device/face/config', headers=A)[0] == 401)
s, r = call('GET', '/device/face/config', headers=D); check('config returns mode', s == 200 and r['mode'] == 'ENTRY', r)

# --- consent
s, r = call('GET', '/api/face/students', headers=A); students = r['students']; check('student list', s == 200 and len(students) > 3)
minors = [x for x in students if x['is_minor']]
st = minors[0]; sid = st['id']
others = [x for x in students if x['id'] != sid]
s, r = call('PUT', f'/api/face/students/{sid}/consent', {'confirm': False, 'guardian_name': 'Parent'}, A); check('consent needs explicit confirm', s == 400)
s, r = call('PUT', f'/api/face/students/{sid}/consent', {'confirm': True}, A); check('minor needs guardian name', s == 400, r)
s, r = call('PUT', f'/api/face/students/{sid}/consent', {'confirm': True, 'guardian_name': 'Test Parent', 'guardian_relation': 'Father'}, A); check('consent recorded', s == 200 and r['status'] == 'consented', r)
s, r = call('GET', '/device/face/roster', headers=D); check('roster lists consented student', s == 200 and any(x['id'] == sid for x in r['students']), r)
s, r = call('POST', '/device/face/enrolled', {'student_id': sid, 'model_sha': 'abc'}, D); check('device marks enrolled', s == 200)
s, r = call('POST', '/device/face/enrolled', {'student_id': others[0]['id']}, D); check('cannot enrol without consent', s == 409)

# --- events
def ev(**k): return {'event_id': str(uuid.uuid4()), 'student_id': sid, 'event_type': 'ENTRY', 'method': 'face', 'occurred_at': now(minutes=1), 'match_score': 0.81, 'liveness_score': 0.93, **k}
e1 = ev(); s, r = call('POST', '/device/face/events', {'events': [e1]}, D); check('ENTRY acked', s == 200 and r['acked'] == [e1['event_id']], r)
s, r = call('POST', '/device/face/events', {'events': [e1]}, D); check('retry of same event is acked, not duplicated', r['acked'] == [e1['event_id']])
s, r = call('GET', '/api/face/events', headers=A); mine = [x for x in r['events'] if x['event_id'] == e1['event_id']]; check('event stored exactly once', len(mine) == 1 and mine[0]['applied'] == 1, r)
s, r = call('GET', '/api/notifications', headers=A) if False else (0, {})
e2 = ev(event_type='ENTRY', occurred_at=now(seconds=30)); s, r = call('POST', '/device/face/events', {'events': [e2]}, D); check('second ENTRY same day acked but not applied', e2['event_id'] in r['acked'])
s, r = call('GET', '/api/face/events', headers=A); x = [y for y in r['events'] if y['event_id'] == e2['event_id']][0]; check('second ENTRY not applied to daily row', x['applied'] == 0)
e3 = ev(event_type='EXIT', occurred_at=now(seconds=5)); s, r = call('POST', '/device/face/events', {'events': [e3]}, D); check('EXIT acked', e3['event_id'] in r['acked'], r)
s, r = call('GET', '/api/attendance', headers=A)
row = [x for x in r['attendance'] if x['student_id'] == sid]; check('daily attendance row exists (existing endpoint still works)', s == 200 and row and row[0]['status'] in ('present', 'late'), r if s != 200 else row)
bad = [ev(event_id='x'), ev(event_type='SIDEWAYS'), ev(occurred_at='not a date'), ev(occurred_at=now(days=-1)), ev(student_id=999999), ev(student_id=others[0]['id'])]
s, r = call('POST', '/device/face/events', {'events': bad}, D)
reasons = {x['reason'] for x in r['rejected']}
check('invalid events rejected, not acked', r['acked'] == [] and {'bad_event_id', 'bad_event_type', 'bad_time', 'unknown_student', 'no_consent'} <= reasons, r)
m = ev(student_id=others[0]['id'], method='manual', marked_by='Coach A'); s, r = call('POST', '/device/face/events', {'events': [m]}, D); check('manual fallback event accepted without face consent', m['event_id'] in r['acked'], r)
old = ev(student_id=others[1]['id'], method='manual', occurred_at=now(hours=9)); s, r = call('POST', '/device/face/events', {'events': [old]}, D); check('old offline event acked', old['event_id'] in r['acked'], r)

# --- revoke + delete propagation
s, r = call('DELETE', f'/api/face/students/{sid}', headers=A); check('revoke face data', s == 200)
s, r = call('GET', '/device/face/roster', headers=D); check('roster tells device to delete', sid in r['delete_ids'] and all(x['id'] != sid for x in r['students']), r)
e4 = ev(); s, r = call('POST', '/device/face/events', {'events': [e4]}, D); check('face event for revoked student rejected', r['rejected'] and r['rejected'][0]['reason'] == 'no_consent', r)
s, r = call('POST', '/device/face/deleted', {'student_ids': [sid]}, D); s, r = call('GET', '/device/face/roster', headers=D); check('after confirmation it is no longer listed for deletion', sid not in r['delete_ids'], r)

# --- admin controls
s, r = call('PATCH', f'/api/face/devices/{dev_id}', {'mode': 'EXIT'}, A); s, r = call('GET', '/device/face/config', headers=D); check('mode change reaches the device', r['mode'] == 'EXIT')
s, r = call('DELETE', f'/api/face/devices/{dev_id}', headers=A); check('revoke device', s == 200)
check('revoked device token stops working', call('GET', '/device/face/config', headers=D)[0] == 401)

# --- existing endpoints untouched
s, r = call('GET', '/api/students', headers=A); check('existing /api/students still works', s == 200)
s, r = call('POST', '/device/biometric', {'biometric_id': 'zzz'}, {'X-Device-Key': 'wrong'}); check('legacy biometric endpoint still guarded', s == 401)
print('\nFAILED: %d' % len(fails) if fails else '\nALL PASSED'); sys.exit(1 if fails else 0)
