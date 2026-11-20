"""Wires the vendored GdFace SDK module and GSA settings into the Android project that `flutter create` generated.
Run from apps/face_attendance after the scaffold exists. Idempotent. UNTESTED against a real Gradle build in the
authoring environment (no Android toolchain there): the CI run is the first real test."""
import glob, os, re, shutil, sys

APP_ID = 'in.globalsportsacademy.faceattendance'

def rw(path, fn):
    s = open(path).read(); n = fn(s)
    if n != s: open(path, 'w').write(n)

# 1. settings: include the SDK module, raise Kotlin/AGP to what the SDK's dependencies need
for f in glob.glob('android/settings.gradle*'):
    kts = f.endswith('.kts')
    def st(s):
        if "gdface-sdk" not in s: s += "\ninclude(\":gdface-sdk\")\n" if kts else "\ninclude ':gdface-sdk'\n"
        s = re.sub(r'(org\.jetbrains\.kotlin\.android"\)? version ")[^"]+(")', r'\g<1>1.9.24\2', s)
        s = re.sub(r'(com\.android\.application"\)? version ")[^"]+(")', r'\g<1>8.3.2\2', s)
        return s
    rw(f, st)

# 2. Gradle wrapper
for f in glob.glob('android/gradle/wrapper/gradle-wrapper.properties'):
    rw(f, lambda s: re.sub(r'gradle-[0-9.]+-(all|bin)\.zip', 'gradle-8.7-all.zip', s))

# 3. app module
for f in ('android/app/build.gradle.kts', 'android/app/build.gradle'):
    if not os.path.exists(f): continue
    kts = f.endswith('.kts')
    def app(s):
        s = re.sub(r'applicationId\s*=?\s*"[^"]+"', ('applicationId = "%s"' if kts else 'applicationId "%s"') % APP_ID, s)
        s = re.sub(r'minSdk(Version)?\s*=?\s*[^\n]+', 'minSdk = 24' if kts else 'minSdkVersion 24', s, count=1)
        s = re.sub(r'compileSdk(Version)?\s*=?\s*[^\n]+', 'compileSdk = 35' if kts else 'compileSdkVersion 35', s, count=1)
        abi = ('ndk { abiFilters += listOf("arm64-v8a") }' if kts else 'ndk { abiFilters "arm64-v8a" }')
        if 'abiFilters' not in s: s = s.replace('defaultConfig {', 'defaultConfig {\n        ' + abi, 1)
        # sign release with the fixed key installed by the workflow (debug keystore) so updates keep working
        s = s.replace('signingConfigs.getByName("debug")' if kts else 'signingConfigs.debug', 'signingConfigs.getByName("debug")' if kts else 'signingConfigs.debug')
        if 'packaging' not in s:
            pk = '\n    packaging { jniLibs { useLegacyPackaging = false } }\n' if kts else '\n    packaging { jniLibs { useLegacyPackaging = false } }\n'
            s = s.replace('android {', 'android {' + pk, 1)
        if 'project(":gdface-sdk")' not in s and "project(':gdface-sdk')" not in s:
            dep = ('\ndependencies {\n    implementation(project(":gdface-sdk"))\n    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")\n}\n' if kts else
                   "\ndependencies {\n    implementation project(':gdface-sdk')\n    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1'\n}\n")
            s += dep
        return s
    rw(f, app)

# 4. R8: the SeetaFace JNI classes must never be renamed or removed. Build uses --no-shrink as well.
os.makedirs('android/app', exist_ok=True)
open('android/app/proguard-rules.pro', 'w').write('-keep class com.seeta.sdk.** { *; }\n-keep class com.ahmadarif.gdface.sdk.** { *; }\n-keepclasseswithmembernames class * { native <methods>; }\n')

# 5. launcher icons from the academy logo
for d in glob.glob('android/app/src/main/res/mipmap-*'):
    shutil.copy('assets/icon.png', os.path.join(d, 'ic_launcher.png'))
print('android patched')
