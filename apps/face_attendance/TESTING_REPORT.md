# Testing report

Senior tester pass, 21 Nov 2026. "Passed" means it was executed and the output was seen. Anything marked NEEDS DEVICE was not run, because no tool here can operate the phone (no adb, no camera).

## 1. Executed and passed

| Area | What was run | Result |
|---|---|---|
| Backend, main suite | `apps/api/tests/face_api_test.py` on a fresh local D1 (migrations 0001 to 0007 plus demo seed) with `wrangler dev` | 36 of 36 passed |
| Backend, negative and security suite (new) | `apps/api/tests/face_api_extra_test.py`, same server | all passed (about 60 checks) |
| Website | `tsc --noEmit` and `vite build` in `apps/web` | no type errors, build succeeds (only the usual chunk size warning) |
| Face app CI | GitHub Actions runs 17, 18, 19: `flutter analyze`, `flutter test` (2 unit tests), Kotlin compile, APK build | green |
| Live API, read-only (production worker, via browser fetch) | device routes without token, with a fake token, bad pairing code, admin route without login | all correct 401 with the right message, `nosniff` header present |

What the new extra suite covers: every admin route refuses anonymous callers; every device route refuses no token, a fake token and a staff login token; 25 wrong pairing codes in a row never succeed and the real code still works afterwards; odd pairing input (empty, number, 500 characters, SQL text, path text, broken JSON) never gives a 5xx; hostile event batches (string, object, null, broken JSON, 200 KB field, SQL in ids, negative or fractional student id, future or very old time, lower-case type, empty event) are rejected without a 5xx and without being acked; junk scores do not break an event; 5 minutes of clock skew is accepted; EXIT without an ENTRY is stored with `applied = 0`; the same event twice in one batch is stored once; consent and revoke on missing or non-numeric students are safe; revoking twice is safe; a revoked device is locked out of everything.

## 2. Findings (none block the server side)

| # | Severity | Finding |
|---|---|---|
| F1 | Open, needs device | Real, live faces on the front camera were rejected as "Live face required" in build 18. Build 19 switched to video-mode liveness (commit 641055d). The result of build 19 on the phone has not been reported to me. The calibration screen can switch the liveness check off for supervised testing only (a printed photo would then pass). |
| F2 | Open, needs device | Matching accuracy (false reject and false accept) has never been measured. The scan screen shows `match`, `next` and `face px` numbers: those numbers are what thresholds should be tuned from. |
| F3 | Low | No rate limit on pairing. 25 wrong guesses all returned 401, none returned 429. Risk is small (10 character code, single use, short expiry) but a limit per IP would close it. |
| F4 | Medium | If the Android Keystore key is ever lost (for example after some factory or security resets), `Store` renames the unreadable queue and key-value files to `*.corrupt-<time>` and starts empty. Unsent attendance events in that file are then not uploaded. The app records `loadError` but I did not verify that anything shows it to the operator. |
| F5 | Low | Events carry the phone's clock. A phone more than 10 minutes fast gets `bad_time` rejections, which stay on the phone as "rejected" and are never retried. Keep phone time on automatic. |
| F6 | Info | Unpairing deletes token, roster, mode and last sync, but not queued events or enrolled face templates. This is intentional (no data loss), but a phone that is handed to someone else should have its app data cleared. |
| F7 | Info | Staff logins get 403 on face consent and device creation. Only accounts with `face.manage` (the owner) can do these. This matches the design. |
| F8 | Info | Production API has no health endpoint (`/public/health` is 404). Nothing depends on it. |
| F9 | Process | The earlier "EXIT with no ENTRY not acked" result was a bug in my test (guardian name too short for a minor), not in the API. Fixed in the test; the API behaves correctly. |

## 3. NOT tested (needs the phone or a person)

- Camera, torch, front white screen, autofocus, brightness gates.
- Model install through "Import models from a folder".
- Enrolment guide oval, percent display, camera switch while enrolling.
- Scan accuracy, liveness on real faces, printed photo and phone-screen replay (must NOT record), twins or look-alikes, two faces.
- Entry and exit sounds, wrong-face sound.
- Offline queue: airplane mode scans, then Wi-Fi sync uploads once and the queue empties; force-stop and reboot with a full queue.
- Keystore encryption round trips, PIN, calibration export.
- Production deploy of the face routes: the production worker answers the device routes correctly (checked above), but I did not run the full suite against production because it would create data there.

## 4. Device test plan (iQOO 12, about 20 minutes)

1. Install the newest APK (`adb uninstall in.globalsportsacademy.faceattendance` first if "package conflicts"). Pair with a fresh code. Expect "Face engine ready".
2. Enrol 3 students (one minor with guardian consent). Expect 3 of 3 photos, then listed as enrolled.
3. Scan each enrolled student on rear and on front. Write down the `match` and `next` numbers shown on screen. Pass: all three accepted within 25 seconds, `match` above 0.65 and `next` at least 0.05 lower.
4. Liveness: if "Live face required" appears, write down the `reality` and `clarity` numbers shown and send them to me. Do not turn the check off permanently.
5. Must NOT record: an unknown person, a printed photo, a phone screen showing an enrolled face, two people together.
6. Sounds: ENTRY, EXIT, duplicate within 10 minutes, wrong face all sound different.
7. Airplane mode: scan 2 students, queue shows 2 pending. Turn Wi-Fi on: queue goes to 0 and the website shows the 2 events once.
8. Force-stop the app with a pending event, reopen: the event is still pending.
9. Revoke a student on the website: after the next sync, that student is no longer recognised on the phone.
10. Re-pair and mode change: change the device from ENTRY to EXIT on the website, wait for sync, confirm the app shows EXIT.

Steps 3 and 4 only need the numbers shown on the scan screen; a photo of the screen is enough.

## 5. Verdict

Server side (API, website): good to go; tests above pass and the live worker behaves correctly. Phone side: builds and installs; whether it recognises real people reliably (F1, F2) is still unproven. Do not call the face app finished until steps 3 to 5 of the device plan pass.
