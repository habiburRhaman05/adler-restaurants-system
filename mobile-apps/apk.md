# Building APK for Adler Mobile App

This guide covers building a **release APK** locally using **Android Studio** and **Expo prebuild**.

## Prerequisites

1. **Android Studio** installed with the following:
   - Android SDK (API 34 or 35)
   - Android SDK Platform-Tools
   - Android SDK Build-Tools
   - AVD (optional, for emulator)
2. **Java JDK 17** (bundled with Android Studio, or installed separately)
3. Set environment variables:

   ```powershell
   # PowerShell – add to your $PROFILE or run per session
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
   ```

4. Node packages installed:

   ```powershell
   npm install
   ```

---

## Build Release APK (Step-by-Step)

### 1. Create production `.env.production`

Create `.env.production` in the project root:

```
EXPO_PUBLIC_API_URL=https://your-production-api.com
EXPO_PUBLIC_APP_ENV=production
```

> **IMPORTANT**: This app reads `EXPO_PUBLIC_*` env vars at **build time**. For releases, set `EXPO_PUBLIC_APP_ENV=production` and use your real API URL.

### 2. Prebuild (generate native `android/` folder)

```powershell
npx expo prebuild --clean
```

This generates the `android/` directory with native Android project files.

> The `android/` folder is generated once. If you modify `app.json`, `package.json`, or add a new native module, re-run `npx expo prebuild --clean`.

### 3. Build release APK

```powershell
cd android
./gradlew assembleRelease
```

Or use the **Android Studio** method:

```powershell
npx expo run:android --variant release
```

> `npx expo run:android` internally calls `./gradlew assembleRelease`.

### 4. Locate the APK

```
android\app\build\outputs\apk\release\app-release.apk
```

---

## Build Using EAS Build (Cloud, Optional)

If you prefer **cloud builds** (no Android Studio required):

```powershell
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

The `preview` profile in `eas.json` is already configured to output **APK** (not AAB).

---

## Important Notes

### App Package Name

Current package: `com.habib05.navigation` (defined in `app.json`)

To change it, update `app.json` → `expo.android.package`, then re-run `npx expo prebuild --clean`.

### Env Variables at Build Time

Expo SDK 55 bundles `EXPO_PUBLIC_*` variables at build time. Ensure `.env.production` (or whichever env file you use) is present before running `prebuild` or `eas build`.

### Android SDK Location

If `gradle` cannot find your Android SDK, create `android\local.properties`:

```
sdk.dir=C:\\Users\\<YOUR_USERNAME>\\AppData\\Local\\Android\\Sdk
```

### Keystore & Signing

For **development builds**, a debug keystore is used automatically.

For **production release** (Play Store), generate a keystore:

```powershell
keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
```

Then configure signing in `android\app\build.gradle` under `android.signingConfigs`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `SDK location not found` | Create `android\local.properties` with `sdk.dir=C:\\Users\\...\\AppData\\Local\\Android\\Sdk` |
| `FAILURE: Build failed with exception` | Run `cd android && ./gradlew clean`, then retry |
| `EXPO_PUBLIC_*` not applied | These are bundled at **prebuild time**. Re-run `npx expo prebuild --clean` |
| `Java not found` | Install JDK 17 and set `JAVA_HOME` env var |
| `Could not resolve all files for configuration` | Ensure you have internet; try `cd android && ./gradlew --refresh-dependencies` |
