"""Extra negative, security and edge-case checks for the face attendance API (run after face_api_test.py, same server).
   python3 tests/face_api_extra_test.py http://localhost:8787"""
import json, sys, urllib.request, urllib.error, uuid, datetime as dt

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8787'
fails, notes = [], []

def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(BASE + path, method=method, data=data, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  {extra}' if not cond else ''))
    if not cond: fails.append(name)

def note(name, value): print('NOTE ' + name + ': ' + str(value)); notes.append((name, value))
now = lambda **k: (dt.datetime.now(dt.timezone.utc) - dt.timedelta(**k)).strftime('%Y-%m-%dT%H:%M:%S.000Z')

def login(u, p='Demo@1234'):
    s, r = call('POST', '/auth/login', {'username': u, 'password': p}); return {'Authorization': 'Bearer ' + r['token']} if s == 200 else None

A = login('owner'); S = login('staff1')
check('owner login', A is not None); check('staff login', S is not None)

# ---- every admin endpoint needs a login
for m, p in [('GET', '/api/face/devices'), ('POST', '/api/face/devices'), ('GET', '/api/face/students'), ('PUT', '/api/face/students/1/consent'),
             ('DELETE', '/api/face/students/1'), ('GET', '/api/face/events'), ('POST', '/api/face/devices/1/pairing-code'), ('DELETE', '/api/face/devices/1')]:
    check(f'anonymous blocked: {m} {p}', call(m, p, {} if m != 'GET' else None)[0] == 401)
# ---- every device endpoint needs a device token
for m, p in [('GET', '/device/face/config'), ('GET', '/device/face/roster'), ('POST', '/device/face/enrolled'), ('POST', '/device/face/deleted'), ('POST', '/device/face/events')]:
    check(f'no device token blocked: {m} {p}', call(m, p, {} if m != 'GET' else None)[0] == 401)
    check(f'staff JWT is not a device token: {m} {p}', call(m, p, {} if m != 'GET' else None, S)[0] == 401)

# ---- role limits
s, r = call('POST', '/api/face/devices', {'name': 'staff try', 'mode': 'ENTRY'}, S); note('staff can create a device', s)
s, r = call('DELETE', '/api/face/devices/1', headers=S); check('staff cannot delete a device', s in (401, 403), s)
s, r = call('GET', '/api/face/students', headers=S); note('staff can list students for face consent', s)

# ---- pairing: brute force
s, r = call('POST', '/api/face/devices', {'name': 'Extra test phone', 'mode': 'ENTRY'}, A); check('create device', s == 201, r)
code = r['code']; dev = r['id']
codes = [call('POST', '/device/face/pair', {'code': 'ABCDE-%05d' % i})[0] for i in range(25)]
note('25 wrong pairing codes in a row, statuses', sorted(set(codes)))
check('wrong pairing codes never succeed', all(c != 200 for c in codes))
s, r = call('POST', '/device/face/pair', {'code': code}); note('real code still works after 25 wrong guesses', s)
tok = r.get('token', ''); D = {'Authorization': 'Device ' + tok}
for bad in ['', None, 123, 'a' * 500, "'; DROP TABLE face_devices;--", '../../etc/passwd']:
    s, _ = call('POST', '/device/face/pair', {'code': bad}); check(f'pair rejects odd code {str(bad)[:20]!r}', s in (400, 401), s)
s, _ = call('POST', '/device/face/pair', raw=b'{not json'); check('pair survives malformed JSON', s in (400, 401), s)

# ---- events: hostile and odd input must never give a 5xx or be acked wrongly
s, r = call('GET', '/api/face/students', headers=A); sid = r['students'][0]['id']
call('PUT', f'/api/face/students/{sid}/consent', {'confirm': True, 'guardian_name': 'Test Parent', 'guardian_relation': 'Father'}, A)
def ev(**k): return {'event_id': str(uuid.uuid4()), 'student_id': sid, 'event_type': 'ENTRY', 'method': 'face', 'occurred_at': now(minutes=1), 'match_score': 0.8, 'liveness_score': 0.9, **k}
def post(events, raw=None): return call('POST', '/device/face/events', None if raw is not None else {'events': events}, D, raw)
for name, payload in [('events is a string', 'x'), ('events is an object', {'a': 1}), ('events is null', None), ('events is a number', 5)]:
    s, r = call('POST', '/device/face/events', {'events': payload}, D); check(f'events: {name}', s == 200 and r.get('acked') == [], (s, r))
s, _ = post(None, raw=b'{broken'); check('events: malformed JSON is not a 5xx', s < 500, s)
s, _ = post(None, raw=b'[]'); check('events: JSON array body is not a 5xx', s < 500, s)
check('events: huge body is not a 5xx', post([ev(marked_by='x' * 200000)])[0] < 500)
for name, e in [('student id as text injection', ev(student_id="1 OR 1=1")), ('student id negative', ev(student_id=-1)), ('student id float', ev(student_id=1.5)),
                ('event id with spaces', ev(event_id='a b c')), ('event id too long', ev(event_id='a' * 200)), ('event id sql', ev(event_id="x'); DROP TABLE attendance;--")),
                ('time 11 minutes in the future', ev(occurred_at=now(minutes=-11))), ('time 401 days old', ev(occurred_at=now(days=401))),
                ('event type lower case', ev(event_type='entry')), ('missing everything', {})]:
    s, r = post([e]); check(f'rejected: {name}', s == 200 and r['acked'] == [] , (s, r))
e = ev(match_score='abc', liveness_score=None, marked_by={'a': 1}); s, r = post([e]); check('junk scores do not break an event', s == 200 and e['event_id'] in r.get('acked', []), (s, r))
e = ev(occurred_at=now(minutes=-5)); s, r = post([e]); check('5 minutes of clock skew is allowed', s == 200 and e['event_id'] in r.get('acked', []), (s, r))
# EXIT with no ENTRY that day
others = [x for x in call('GET', '/api/face/students', headers=A)[1]['students'] if x['id'] != sid]
t = others[2]['id']; cs, cr = call('PUT', f'/api/face/students/{t}/consent', {'confirm': True, 'guardian_name': 'Test Parent', 'guardian_relation': 'Mother'}, A); note('consent for EXIT test student', (cs, cr))
e = ev(student_id=t, event_type='EXIT'); s, r = post([e]); note('EXIT with no ENTRY that day, acked', e['event_id'] in r.get('acked', [])); note('EXIT with no ENTRY, rejected reason', r.get('rejected'))
ev_rows = call('GET', '/api/face/events', headers=A)[1]['events']; row = [x for x in ev_rows if x['event_id'] == e['event_id']]
note('EXIT with no ENTRY applied flag', row[0]['applied'] if row else 'not stored')
# duplicate within one batch
e = ev(); s, r = post([e, dict(e)]); check('same event twice in one batch stored once', r['acked'].count(e['event_id']) >= 1 and sum(1 for x in call('GET', '/api/face/events', headers=A)[1]['events'] if x['event_id'] == e['event_id']) == 1, r)

# ---- consent edge cases
s, r = call('PUT', '/api/face/students/99999999/consent', {'confirm': True, 'guardian_name': 'Test Parent'}, A); check('consent for a student that does not exist', s in (404, 400), s)
s, r = call('PUT', '/api/face/students/abc/consent', {'confirm': True, 'guardian_name': 'Test Parent'}, A); check('consent with a non-numeric id is not a 5xx', s < 500, s)
s, r = call('DELETE', '/api/face/students/99999999', headers=A); check('revoke for a student that does not exist', s in (404, 400, 200), s)
a1 = call('DELETE', f'/api/face/students/{t}', headers=A)[0]; a2 = call('DELETE', f'/api/face/students/{t}', headers=A)[0]; check('revoking twice is safe', a1 < 500 and a2 < 500, (a1, a2))
s, r = call('POST', '/device/face/enrolled', {'student_id': 'x'}, D); check('enrolled with bad id is not a 5xx', s < 500, s)
s, r = call('POST', '/device/face/deleted', {'student_ids': 'nope'}, D); check('deleted with bad list is not a 5xx', s < 500, s)

# ---- device lifecycle
s, r = call('POST', f'/api/face/devices/{dev}/pairing-code', headers=A); check('new pairing code for a paired device', s in (200, 201), s)
call('DELETE', f'/api/face/devices/{dev}', headers=A)
check('revoked device is locked out of every endpoint', all(call(m, p, {} if m == 'POST' else None, D)[0] == 401 for m, p in [('GET', '/device/face/config'), ('GET', '/device/face/roster'), ('POST', '/device/face/events')]))
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
