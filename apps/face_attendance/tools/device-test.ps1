# Guided end-to-end test with evidence capture. Phone connected by USB, app installed and paired, one student enrolled.
# Run:  powershell -ExecutionPolicy Bypass -File D:\gsa\apps\face_attendance\tools\device-test.ps1
$ErrorActionPreference = 'Continue'
$pkg = 'in.globalsportsacademy.faceattendance'
$out = "D:\gsa\apk\testlog\$(Get-Date -Format yyyyMMdd-HHmm)"
New-Item -ItemType Directory -Force $out | Out-Null
$steps = @(
 @('01-enrolled-student-rear',   'ENROLLED student scans with REAR camera + torch (Rear + torch selected). Press Enter here right after the result shows on the phone.'),
 @('02-enrolled-student-front',  'Select FRONT + white screen, enrolled student scans again (wait for the 10 minute cooldown message or use EXIT mode). Enter after the result shows.'),
 @('03-unknown-person',          'A person who is NOT enrolled scans. Expected: Not recognised / no record. Enter after the result shows.'),
 @('04-printed-photo',           'Hold a PRINTED photo of the enrolled student in front of the camera. Expected: NO attendance. Enter after the result shows.'),
 @('05-screen-replay',           'Show the enrolled student photo or video on ANOTHER phone screen to the camera. Expected: NO attendance. Enter after the result shows.'),
 @('06-two-faces',               'Two people in frame together. Expected: One person at a time / no record. Enter after the result shows.'),
 @('07-offline-scan',            'Turn on AIRPLANE MODE, scan the enrolled student (use EXIT mode if cooldown applies). Expected: recorded, "1 waiting to upload". Enter after the result shows.'),
 @('08-back-online-synced',      'Turn airplane mode OFF, wait 30 seconds or tap Sync now. Expected: "All records uploaded". Enter when it shows.')
)
adb logcat -c
foreach ($s in $steps) {
  Write-Host "`n[$($s[0])] $($s[1])" -ForegroundColor Cyan
  Read-Host 'Press Enter when done'
  adb exec-out screencap -p | Set-Content -Encoding Byte "$out\$($s[0]).png"
  adb logcat -d -v time | Select-String -Pattern 'FaceEngine|GdFace|gsa|AndroidRuntime|FATAL|flutter' | Select-Object -Last 120 | ForEach-Object { $_.Line } | Set-Content "$out\$($s[0]).log"
}
adb shell getprop ro.product.model | Set-Content "$out\device.txt"
adb shell dumpsys package $pkg | Select-String 'versionName|firstInstallTime' | ForEach-Object { $_.Line } | Add-Content "$out\device.txt"
adb logcat -d -v time *:E | Select-String -Pattern 'AndroidRuntime|FATAL|gsa' | Set-Content "$out\errors.log"
Write-Host "`nDone. Evidence saved in $out. Tell Claude the folder name." -ForegroundColor Green
