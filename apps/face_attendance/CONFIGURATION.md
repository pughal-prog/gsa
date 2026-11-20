# Configuration

Website (owner, or staff with the new Face attendance permission): menu Face attendance.
1. Devices: Add device (name, ENTRY or EXIT), then Pairing code. Enter the 10 character code on the phone within 15 minutes. A code works once.
2. Consent: record consent per student (guardian name and relationship are mandatory for under 18). Retention is 30 to 1095 days (default 365).
3. Enrol: on the phone, Admin, Enrol faces, pick the student, capture 3 frames. The phone tells the server the student is enrolled (no image or template is sent).
4. Entry or Exit: change on the website device list, or on the phone under Admin. The phone applies it at its next sync.
5. Delete: website or phone. The template is wiped on the phone and the server marks deletion confirmed.

Thresholds (Admin, Calibration): matchThreshold 0.65, minMargin 0.05, livenessReality 0.80, hitsRequired 2 and the quality limits. These are starting values, NOT production calibrated.
Cooldown against double scans is 600 seconds per student and mode (server config).
Build-time API address: `--dart-define=API_URL=...` (default is the production API).
