# GSA Face Attendance

A separate Flutter Android app for one dedicated phone (target: iQOO 12) that records student ENTRY and EXIT by face.
It is NOT the Global Sports Academy app. It reuses the existing GSA Cloudflare API and website; nothing else is duplicated.

## What it does
- Home: GSA branding, ENTRY or EXIT mode badge, TAP TO SCAN, rear or front camera choice (remembered), result card, sync status.
- Scan: opens camera only during a scan. Rear camera uses the LED torch. Front camera shows a white screen at full brightness.
  A student is recorded only after 2 consecutive frames pass quality, liveness and a confident, unambiguous match to the same student.
- Admin (PIN on the phone, GSA website login for server actions): consent and enrolment, delete face data, ENTRY/EXIT mode,
  manual non-biometric entry, rejected record review, calibration and CSV export.
- Offline first: events are encrypted on the phone and uploaded on Wi-Fi. A local event is deleted only after the server acknowledges it.

## Security design
- No secret in the APK. The phone gets its own random device token by entering a 15 minute single-use pairing code. The server stores only its SHA-256.
- Face templates never leave the phone. The GdFace SDK saves its database unencrypted, so this app encrypts it with an Android Keystore AES-256-GCM key
  (StrongBox when present) and keeps the plaintext only for milliseconds in a private folder that is wiped after use and on start.
- Attendance queue and settings are encrypted the same way. Backups are disabled. Admin PIN uses PBKDF2 (120k rounds) with a 5 try lockout.
- No raw face photo is uploaded or kept: frames are deleted right after analysis.

## Layout
- `lib/` Flutter UI, sync, API client. `android/app/src/main/kotlin/com/gsa/faceattendance/` Keystore vault, encrypted store, face engine, platform channel.
- `android/gdface-sdk/` vendored GdFace SDK v0.3.0 (Apache-2.0) with SeetaFace6 (BSD-2-Clause). Licences in that folder are kept. Only its build file was changed.
- `tools/patch_android.py` wires the SDK into the Gradle project the build generates. `.github/workflows/build-face-apk.yml` builds the APK.

See INSTALL.md, CONFIGURATION.md, DEPLOYMENT.md, TESTING_REPORT.md and KNOWN_LIMITATIONS.md.
