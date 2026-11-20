# Known limitations

- Not compiled or device tested yet (see TESTING_REPORT.md). Thresholds are defaults, not calibrated. Liveness is SeetaFace FAS only and is not proof against good spoofs; re-test on the real phone.
- The GdFace SDK downloads its models at first start from a third-party service using a shared public API key. The phone needs internet once, the service is outside GSA control, and its terms should be reviewed before production. Models are cached afterwards.
- The SDK's own face database file is unencrypted; this app encrypts it at rest, but plaintext exists briefly in app-private storage during load and save. A rooted phone or memory inspection could still reach it.
- One face engine thread; scans take a moment on each frame. arm64 only.
- Manual in-app entry works only for students on the face roster (consented). Others are marked on the website.
- Front camera preview mirroring and torch-while-capturing behaviour may differ on the iQOO 12 camera stack.
- Templates are tied to the recognizer model version; if the model changes, they are wiped and students must be re-enrolled.
- Debug keystore signing is used for release builds; use a proper release key before wider distribution.
- Slow networks: if the phone's own model download is too slow, run `tools/get-models.ps1` on the PC. It downloads and verifies the models there and copies them to the app's `models-import` folder on the phone, and the app installs them offline on the next start. This path was written without being compiled or run on a phone.
