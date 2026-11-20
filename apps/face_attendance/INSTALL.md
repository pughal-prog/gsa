# Install on the iQOO 12

1. Get the APK: GitHub repo, Actions tab, "Build Face Attendance APK", download artifact `GSAFaceAttendance-apk` (or the Releases page, tag `face-apk-N`).
2. Copy it to the phone. Open it and allow "Install unknown apps" for the file manager when asked.
3. Open GSA Face Attendance. Allow Camera. Connect to Wi-Fi: the first start downloads the face models once (the SDK fetches them from its own provider, see KNOWN_LIMITATIONS).
4. Pair the phone (see CONFIGURATION.md), then create the admin PIN under the admin icon.
5. Keep the phone plugged in and mounted. Turn off battery optimisation for the app if scans must start instantly.

A build signed with a temporary key cannot update one signed with another key. Add the `ANDROID_KEYSTORE_B64` secret before the first real install so later builds update in place.
