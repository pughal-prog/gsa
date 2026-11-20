# Testing report

Honest status. "Run" means it was executed in the authoring environment. Everything else is NOT tested.

## Run and passed
- Backend: migration 0007 applied to a LOCAL D1; `apps/api/tests/face_api_test.py` against local `wrangler dev`: 36 checks passed (pairing code single use and expiry, device token auth, revoked device, consent rules incl. guardian for minors, roster and delete list, event ingest, idempotent re-send, ENTRY and EXIT summary, rejection reasons, duplicate prevention, legacy `/api/students` and legacy biometric endpoint unchanged).
- Website: `npm run build` succeeds; Face attendance page rendered and checked with screenshots against local API.
- Bracket balance check of all Dart and Kotlin files (syntax sanity only, not a compile).

## NOT run (no Flutter, Android SDK or device here; Maven, Google and Gradle hosts are blocked)
- Dart compile, `flutter analyze`, `flutter test` (one trivial unit test exists).
- Kotlin compile. The Kotlin was checked by hand against the vendored SDK's real method signatures only.
- Gradle patching (`tools/patch_android.py`), the APK build, installation and anything on the iQOO 12.
- First-run model download, camera, torch, front white screen, brightness, Keystore/StrongBox, encryption round trips, offline queue and sync on device.
- Accuracy: no false accept or false reject rate was measured. Liveness against printed photo and screen replay was NOT validated.

## APK
No APK was produced here. The workflow `.github/workflows/build-face-apk.yml` builds it on GitHub; the first run may need small fixes (most likely Gradle/Kotlin version patching or a Kotlin compile error). Do not treat the app as working until that run is green and the device checklist below passes.

## Device checklist (iQOO 12)
1. Install, pair, create PIN. 2. Models download. 3. Enrol 3 students incl. 1 minor with guardian. 4. Scan each in rear+torch and front+white. 5. Unknown face, twin or similar face, two faces, printed photo, phone screen replay must NOT record. 6. Airplane mode scans, then Wi-Fi: records upload once, queue empties. 7. Kill app mid-scan, reboot: queue intact. 8. Delete a student: template gone, scan fails. 9. Export calibration CSV and tune thresholds.
