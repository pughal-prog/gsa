# Downloads the face models on this PC and copies them to the phone (use when the phone's own download is too slow).
# Run from PowerShell on the PC with the phone connected by USB:  powershell -ExecutionPolicy Bypass -File D:\gsa\apps\face_attendance\tools\get-models.ps1
$ErrorActionPreference = 'Stop'
$pkg = 'in.globalsportsacademy.faceattendance'
$out = 'D:\gsa\apk\models'
New-Item -ItemType Directory -Force $out | Out-Null

# Same request the app's SDK (GdFace 0.3.0) makes. The key below is the SDK's published shared key.
$body = @{ packageId = $pkg; sdkVersion = '0.3.0'; modelVariant = 'full' } | ConvertTo-Json -Compress
$r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://gdsupport.greatdayhr.com/api/sdk/gdface/authorize' `
     -Headers @{ 'X-API-Key' = 'gdsdk_durcZZkpXmcU-v9jaCXmhOD7JGxar4uZ' } -ContentType 'application/json' -Body $body
$r.Content | Set-Content -Encoding UTF8 "$out\authorize.json"
$auth = $r.Content | ConvertFrom-Json
if (-not $auth.authorized) { throw 'The server did not authorise this app.' }

foreach ($m in $auth.models) {
  $f = Join-Path $out $m.name
  if ((Test-Path $f) -and ((Get-Item $f).Length -eq $m.sizeBytes) -and ((Get-FileHash $f -Algorithm SHA256).Hash -ieq $m.sha256)) { Write-Host "have $($m.name)"; continue }
  Write-Host "downloading $($m.name) ($([math]::Round($m.sizeBytes/1MB,1)) MB)"
  curl.exe -L --fail --retry 5 --retry-delay 3 -C - -o $f $m.url
  if ((Get-FileHash $f -Algorithm SHA256).Hash -ine $m.sha256) { throw "$($m.name) failed the checksum. Run the script again." }
}
Write-Host 'All models downloaded and verified.' -ForegroundColor Green

# Copy to the app's own folder on the phone (the app must have been opened once so the folder exists).
$dst = "/sdcard/Android/data/$pkg/files/models-import"
adb shell am force-stop $pkg
adb shell mkdir -p $dst
adb push "$out\." $dst
Write-Host "Copied to the phone. Open GSA Face Attendance now: it installs the models by itself." -ForegroundColor Green
