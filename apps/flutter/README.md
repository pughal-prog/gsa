# Global Sports Academy, Flutter app

The Android app. It talks to the same Cloudflare Workers API as the website, so there is no second backend.

## Get the APK (free, no tools on your PC)
1. Push this repo to GitHub (the workflow lives in `.github/workflows/build-apk.yml`).
2. GitHub > Actions > "Build Android APK" runs automatically on push (or press Run workflow).
3. After about 6 minutes, open the repo's Releases page and download `GlobalSportsAcademy.apk`, or download the artifact from the finished run.
4. Open the file on the phone and allow "install unknown apps" once.

## Notes
- The API address is set in the workflow with `--dart-define=API_URL=...`. Change it there when the custom domain is live.
- Notifications: the app asks for permission on first launch and shows alerts while it is open or running in the background. True push while the app is fully closed needs a Firebase project (free); ask if you want it added.
- CCTV needs an https stream link from the academy's recorder (HLS `.m3u8`, MJPEG or a snapshot URL).
