# BRIEFING — 2026-11-09T19:17:00Z

## Mission
Survey mobile app architecture, offline web bundle integration, and EAS Build APK generation workflow.

## 🔒 My Identity
- Archetype: explorer
- Roles: Mobile & EAS Build Architecture Surveyor
- Working directory: /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3
- Original parent: cab66b6a-fa2f-4170-85c4-0aae78691d64
- Milestone: Exploration & Architectural Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write only to /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3/
- Produce 5-component handoff report in handoff.md

## Current Parent
- Conversation ID: cab66b6a-fa2f-4170-85c4-0aae78691d64
- Updated: 2026-11-09T19:17:00Z

## Investigation State
- **Explored paths**:
  - `mobile/package.json`, `mobile/app.json`, `mobile/App.tsx`, `mobile/index.ts`, `mobile/assets/`, `mobile/.gitignore`
  - Root `package.json`, `vite.config.ts`, `dist/`, `public/`, `.gitignore`
  - Evaluated offline asset bundling strategies and tested single-file inlining into TypeScript module
  - Analyzed EAS build configuration requirements (`eas.json`, Android APK preview profile, permissions, versionCode)
- **Key findings**:
  - Mobile app currently attempts to connect to `Constants.expoConfig?.hostUri` or hardcoded fallback `http://192.168.43.217:3000`. On a standalone APK without a dev server, it errors immediately with "Belum Terhubung ke Server".
  - Web app output is compact: ~377 KB total when inlined.
  - Bundling inlined HTML into a TypeScript module (`mobile/webAppBundle.ts`) via `JSON.stringify(html)` allows 100% offline standalone loading in `react-native-webview` via `source={{ html: SIPRAKA_WEB_HTML, baseUrl: 'https://sipraka.man11jkt.local' }}` without extra native packages.
  - `baseUrl: 'https://sipraka.man11jkt.local'` guarantees persistent `localStorage` isolation and avoids Android WebView `file:///` CORS / opaque-origin restrictions.
  - `eas.json` is missing; creating it with `"preview": { "distribution": "internal", "android": { "buildType": "apk" } }` allows one-command cloud generation of an installable `.apk`.
  - `mobile/app.json` needs `versionCode: 1`, splash image connection, and `onPermissionRequest` in `App.tsx` for camera barcode scanning.
- **Unexplored areas**: None. All survey questions resolved with concrete evidence.

## Key Decisions Made
- Recommended single-file TS bundle approach (`webAppBundle.ts`) + `baseUrl: 'https://...'` as the most reliable, zero-dependency offline method for Expo managed workflow.
- Recommended EAS Cloud Build preview profile (`buildType: "apk"`).

## Artifact Index
- `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3/DISPATCH.md` — incoming instructions log
- `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3/progress.md` — liveness heartbeat and checklist
- `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3/BRIEFING.md` — working memory and identity
- `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_3/handoff.md` — comprehensive 5-component report
