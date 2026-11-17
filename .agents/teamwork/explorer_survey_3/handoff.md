# Mobile Architecture, Offline Bundling & EAS Build Survey Report

**Author**: Explorer 3 (Mobile & EAS Build Architecture Surveyor)  
**Date**: 2026-11-09T19:20:00Z  
**Target Workspace**: `/home/arsyirazeim/Downloads/Project_Raisyah`  
**Handoff Type**: Hard (Investigation Complete)

---

## 1. Observation

Direct code and environment observations:

### 1.1 Mobile Directory & Dependencies
- **File**: `mobile/package.json` (lines 5–16):
  ```json
  "dependencies": {
    "expo": "~58.0.23",
    "expo-constants": "~58.0.15",
    "expo-status-bar": "~58.0.4",
    "react": "19.3.0",
    "react-native": "0.88.1",
    "react-native-webview": "14.0.1"
  },
  "devDependencies": {
    "@types/react": "~19.3.0",
    "typescript": "~6.0.3"
  }
  ```
- **File**: `mobile/app.json` (lines 1–38):
  - Application Name: `"SiPraka — Inventaris Pramuka MAN 11"`
  - Slug: `"sipraka-man11"`, Version: `"1.0.0"`
  - Package identifier: `"package": "com.man11jkt.sipraka"`
  - Permissions declared: `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
  - Missing field: `"versionCode"` is not defined under `android`.
  - Splash configuration (lines 9–12):
    ```json
    "splash": {
      "backgroundColor": "#2A1810",
      "resizeMode": "contain"
    }
    ```
    Image is omitted even though `./assets/splash-icon.png` exists.
- **File**: `mobile/assets/`:
  - Contains: `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `icon.png`, `splash-icon.png`, `favicon.png`.

### 1.2 Current Web Loading Mechanism in Mobile App
- **File**: `mobile/App.tsx` (lines 28–44, 136–165, 176–203):
  ```tsx
  // Auto-detect host IP from Expo Metro bundler
  const getAutoServerUrl = () => {
    try {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        const ip = hostUri.split(':')[0];
        if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
          return `http://${ip}:3000`;
        }
      }
    } catch {}
    return 'http://192.168.43.217:3000';
  };
  const [serverUrl, setServerUrl] = useState(getAutoServerUrl());
  ...
  <NativeWebView
    ref={webViewRef}
    source={{ uri: serverUrl }}
    ...
  />
  ```
  - **Behavior**: The mobile app is strictly configured to load from an external HTTP server (`http://${ip}:3000` or fallback `http://192.168.43.217:3000`).
  - When the app is compiled as a standalone APK or run on a phone not sharing a local Wi-Fi with an active `npm run dev` Vite server, the WebView immediately triggers `onError` and displays an error screen:
    *"Belum Terhubung ke Server: Aplikasi mencoba memuat http://192.168.43.217:3000"*.
  - **Verdict**: The mobile app currently has **zero offline capabilities** and cannot function as an independent mobile application.

### 1.3 Web Application Assets & Build Output
- **Command executed**: `npm run build`
- **Build Output**:
  - `dist/index.html` (1.55 kB)
  - `dist/assets/index-c9J5ZoSt.css` (31.05 kB)
  - `dist/assets/index-DG6wjava.js` (325.17 kB)
  - Total combined uncompressed size: **~358 kB** (compact, lightweight).
- **Inspection of JS bundle**:
  - `index-DG6wjava.js` is self-contained. It contains zero external `import` or `import.meta` statements.
  - React 19 is fully compiled with `createRoot(document.getElementById('root'))`.
  - Inlining test (`test_serialization.js`): When CSS is inlined in `<style>` and JS in `<script>`, single-file HTML total size is **386,091 bytes (377 KB)**.
  - `JSON.stringify(html)` cleanly serializes into a TypeScript module without escape errors.

### 1.4 Web App State Persistence & Offline Readiness
- **File**: `src/App.tsx` (lines 20–77):
  - State keys: `sipraka_items_v3`, `sipraka_members_v3`, `sipraka_tx_v3`.
  - Persistence: Uses standard `localStorage.getItem` / `localStorage.setItem`.
  - Fallbacks: Defaults to `INITIAL_INVENTORY_ITEMS`, `INITIAL_MEMBERS`, `INITIAL_TRANSACTIONS` when storage is empty.
  - Zero network dependencies: Search for `fetch`, `axios`, or backend REST endpoints in `src/` returns 0 results.
  - Audio: `src/components/MemberMobileApp.tsx` (lines 191–205) uses Web Audio API synthesizer (`ctx.createOscillator()`), requiring no external audio media.
  - Camera: `src/components/MemberMobileApp.tsx` (lines 219–226) uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.

### 1.5 EAS Build Configuration Status
- **Search for `eas.json`**: Result 0 files found. No `eas.json` currently exists in the root or in `mobile/`.
- **Gitignore behavior**:
  - Root `.gitignore` ignores `dist/`.
  - `mobile/.gitignore` ignores `.expo/`, `ios/`, `android/`.
  - EAS Build packaging: EAS CLI only uploads files inside `mobile/`. Any dependency on `../dist/` during cloud build will fail unless the bundle is placed directly inside `mobile/`.

---

## 2. Logic Chain

From the observations above, the logical deductions and architectural decisions are derived as follows:

```
[Observation 1.2: App loads http://<ip>:3000] 
  + [Observation 1.5: EAS ignores dist/ and only packages mobile/]
  + [Requirement R3: 100% offline standalone mobile operation]
  ─────────────────────────────────────────────────────────────────►
  Deduction: The built web application must be packaged directly inside
             the mobile/ directory prior to native build/EAS packaging.
```

### 2.1 Comparison of Offline Bundling Strategies in Expo

| Strategy | Mechanism | Pros | Cons / Blockers | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A. Inlined TS Module (`webAppBundle.ts`)** | Script inlines CSS/JS into single HTML string; exports `const SIPRAKA_WEB_HTML` | • Zero native dependencies<br>• Works in Expo Go, Dev Client, & EAS APK<br>• Zero startup I/O delay<br>• 100% reliable cross-platform | Minor build step script | **Recommended (Best Choice)** |
| **B. Native Android Assets (`file:///android_asset`)** | Copy `dist/` to `android/app/src/main/assets/` via Expo config plugin | Native asset path | • Fails in Expo Go<br>• Android WebView blocks ES modules on `file:///`<br>• `localStorage` unstable on `file:///` | ❌ Rejected |
| **C. `expo-file-system` / `expo-asset`** | Load `dist/index.html` as raw asset and read via `FileSystem.readAsStringAsync` | Uses Expo asset APIs | • Adds native dependencies<br>• Requires custom Metro assetExts<br>• Async disk read delays startup | ❌ Overcomplicated |
| **D. Local Embedded HTTP Server** | `react-native-static-server` or `expo-static-server` | Standard HTTP URLs | • Incompatible with React Native 0.88 New Architecture<br>• Fails in Expo Go<br>• Port binding failures & battery drain | ❌ Incompatible |

### 2.2 Preserving LocalStorage Persistence in WebView
- When loading raw HTML into `react-native-webview` via `source={{ html: SIPRAKA_WEB_HTML }}`:
  - If `baseUrl` is omitted or set to `about:blank`, Android WebView treats the origin as opaque (`null`), which disables or clears `window.localStorage` on restart.
  - By providing `baseUrl: 'https://sipraka.man11jkt.local'`, Android WebView assigns a persistent, secure origin. `window.localStorage` persists permanently across application launches and device reboots.

### 2.3 Camera Barcode Scanning in WebView
- In `mobile/App.tsx`, `NativeWebView` currently lacks the `onPermissionRequest` prop.
- When `MemberMobileApp.tsx` calls `navigator.mediaDevices.getUserMedia`, Android WebView fires an `onPermissionRequest` event to the host activity.
- Supplying `onPermissionRequest={(event) => event.grant(event.resources)}` in `NativeWebView` automatically approves camera access for the internal `https://sipraka.man11jkt.local` origin.

### 2.4 EAS Build Architecture for Standalone APK
- EAS Build defaults to `"buildType": "app-bundle"` (`.aab`), designed exclusively for Google Play Store submission. Users cannot install `.aab` directly onto their phones.
- Configuring a `"preview"` profile with `"android": { "buildType": "apk" }` instructs EAS Cloud workers to execute `assembleRelease` and emit a standalone, sideloadable `.apk` file.
- Cloud builds run on Expo-managed Linux workers with pre-installed Android SDK, OpenJDK, and Gradle. The developer does NOT need Android Studio or Java installed locally.

---

## 3. Caveats

1. **Google Web Fonts Offline Fallback**:
   `dist/index.html` references Google Fonts (`JetBrains Mono` and `Plus Jakarta Sans`) via external `<link>` tags. When the device is completely disconnected (airplane mode), the browser cannot fetch the external stylesheet and smoothly falls back to system fonts (`ui-sans-serif, system-ui, sans-serif` and `monospace`). The UI remains 100% functional and readable.
2. **Camera Hardware on Android Emulators**:
   Real camera barcode scanning requires physical camera hardware. On generic Android emulators, camera permissions work, but `getUserMedia` will display a simulated moving camera pattern unless a webcam is forwarded.
3. **App Data Reset Boundary**:
   Because state is stored in Android WebView's `localStorage` under `https://sipraka.man11jkt.local`, clearing the mobile app's storage from Android Settings (`Apps > SiPraka > Clear Data`) will reset the inventory back to the preloaded sample dataset.

---

## 4. Conclusion

To achieve a 100% offline standalone mobile app and a hassle-free EAS Android APK build, the implementer should execute the following 6 actions:

### Action 1: Create Bundling Script (`scripts/bundle-mobile.mjs`)
Create a fast build script at root that inlines built CSS and JS into a TypeScript file inside `mobile/`:
```javascript
// scripts/bundle-mobile.mjs
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const htmlFile = path.join(distDir, 'index.html');
const outputFile = path.join(rootDir, 'mobile', 'webAppBundle.ts');

if (!fs.existsSync(htmlFile)) {
  console.error('Error: dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlFile, 'utf8');

// Inline CSS
const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="\/assets\/([^"]+)"/);
if (cssMatch) {
  const cssPath = path.join(distDir, 'assets', cssMatch[1]);
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    html = html.replace(cssMatch[0], `<style>\n${cssContent}\n</style>`);
  }
}

// Inline JS
const jsMatch = html.match(/<script type="module"[^>]*src="\/assets\/([^"]+)"[^>]*><\/script>/);
if (jsMatch) {
  const jsPath = path.join(distDir, 'assets', jsMatch[1]);
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    html = html.replace(jsMatch[0], `<script>\n${jsContent}\n</script>`);
  }
}

const tsContent = `// Auto-generated offline bundle for SiPraka Mobile\nexport const SIPRAKA_WEB_HTML: string = ${JSON.stringify(html)};\n`;
fs.writeFileSync(outputFile, tsContent, 'utf8');
console.log(`✓ Generated mobile/webAppBundle.ts (${(tsContent.length / 1024).toFixed(1)} KB)`);
```

### Action 2: Update `mobile/App.tsx`
Update `mobile/App.tsx` to:
1. Import `SIPRAKA_WEB_HTML` from `./webAppBundle`.
2. Set default mode to offline bundled HTML:
   ```tsx
   <NativeWebView
     ref={webViewRef}
     source={
       useLiveServer
         ? { uri: serverUrl }
         : { html: SIPRAKA_WEB_HTML, baseUrl: 'https://sipraka.man11jkt.local' }
     }
     style={styles.webView}
     javaScriptEnabled={true}
     domStorageEnabled={true}
     allowFileAccess={true}
     allowFileAccessFromFileURLs={true}
     allowUniversalAccessFromFileURLs={true}
     allowsInlineMediaPlayback={true}
     mediaPlaybackRequiresUserAction={false}
     originWhitelist={['*']}
     onPermissionRequest={(request: any) => {
       request.grant(request.resources);
     }}
     ...
   />
   ```
3. Keep the ⚙ settings drawer so developers can toggle "Mode Server Live (Vite)" if they want live HMR during development, while standard users and standalone APK default to 100% offline bundle.

### Action 3: Create `mobile/eas.json`
Create `mobile/eas.json` with the `preview` profile targeting `apk`:
```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Action 4: Update `mobile/app.json`
- Add `"versionCode": 1` under `"android"`.
- Add `"image": "./assets/splash-icon.png"` under `"splash"`.

### Action 5: Add Convenient Package Scripts
In root `package.json`:
```json
"bundle:mobile": "vite build && node scripts/bundle-mobile.mjs",
"eas:build:apk": "npm run bundle:mobile && cd mobile && npx eas-cli build -p android --profile preview"
```
In `mobile/package.json`:
```json
"build:apk": "npx eas-cli build -p android --profile preview"
```

### Action 6: Provide EAS Cloud Build Step-by-Step Instructions
Provide crystal-clear instructions in documentation:
```bash
# 1. Pastikan bundle offline terbaru telah dibuat
npm run bundle:mobile

# 2. Masuk ke folder mobile
cd mobile

# 3. Login ke akun Expo (jika belum, daftar gratis di expo.dev)
npx eas-cli login

# 4. Inisialisasi proyek EAS (jika pertama kali)
npx eas-cli project:init

# 5. Jalankan Cloud Build untuk membuat file APK
npx eas-cli build --platform android --profile preview
```
- EAS Cloud akan membangun APK dalam 3–5 menit.
- Setelah selesai, terminal akan menampilkan tautan unduhan langsung (URL) dan QR Code.
- Pengguna cukup memindai QR Code menggunakan HP Android dan menginstal file `.apk` secara langsung.

---

## 5. Verification Method

To independently verify these conclusions and configurations:

1. **Verify Web Build and Inlining**:
   ```bash
   npm run build
   node scripts/bundle-mobile.mjs
   ```
   *Expected outcome*: `mobile/webAppBundle.ts` is created (~380 KB) and contains valid TypeScript exporting `SIPRAKA_WEB_HTML`.

2. **Verify Mobile Typecheck**:
   ```bash
   cd mobile && npx tsc --noEmit
   ```
   *Expected outcome*: Exits with code 0 without type errors.

3. **Verify Expo App Configuration**:
   ```bash
   cd mobile && npx expo config --type public
   ```
   *Expected outcome*: Outputs parsed configuration showing `android.package: "com.man11jkt.sipraka"`, `versionCode: 1`, and correct asset paths.

4. **Verify EAS Configuration Validity**:
   ```bash
   cd mobile && npx eas-cli config
   ```
   *Expected outcome*: Confirms valid `eas.json` parsing with `preview` profile mapped to `buildType: "apk"`.

5. **Runtime Offline Verification**:
   - Launch the mobile app in an environment without an active Vite dev server (or in airplane mode).
   - Verify that SiPraka renders immediately with Gudep 06.171–06.172 branding.
   - Add a transaction or modify an item, restart the app, and verify that all data persists via `localStorage`.
