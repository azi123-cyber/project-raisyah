# Original User Request

## Approved Task Prompt — 2026-11-09T18:58:45Z

Verify all features of the SiPraka inventory system, ensure the application operates completely offline with preloaded local sample data, bundle web assets into the mobile app, and provide an EAS Cloud Build setup and instructions to build a standalone Android APK without hassle.

Working directory: /home/arsyirazeim/Downloads/Project_Raisyah
Integrity mode: development

## Requirements

### R1. Feature Verification & Audit
Verify that all core features of the SiPraka inventory system (item catalog, adding/editing/deleting items, borrowing and return flows, member management, transaction records, and reporting/export) work correctly without runtime errors or broken UI states.

### R2. Local Data Storage & Preloaded Sample Data
Configure the application to store and persist all state strictly using local storage (browser localStorage / on-device storage) without requiring an external database or server. Preload default sample data (Pramuka MAN 11 Jakarta inventory items, categories, and member records) so that first-time users can immediately view and interact with inventory items upon opening the app.

### R3. Offline Mobile Standalone Bundling
Bundle the web application assets directly into the mobile Expo project so that the mobile app operates 100% offline and standalone upon installation, without requiring a computer running a local Vite development server.

### R4. Hassle-Free Android APK Build Setup & Instructions
Provide configuration and step-by-step instructions for building a standalone, installable Android APK file using Expo Application Services (EAS Cloud Build) so that users can generate the APK directly in the cloud without needing local Android Studio or Java SDK installations.

## Acceptance Criteria

### Feature Verification
- [ ] All primary user flows (viewing inventory, adding a new item, editing an existing item, recording a borrow transaction, processing a return, and generating reports) execute without console errors or UI breakages.
- [ ] The web application builds successfully with `npm run build` without TypeScript or bundler errors.

### Local Data Persistence & Offline Standalone
- [ ] All inventory items, transactions, and member changes persist in local storage and remain intact across page refreshes and app restarts.
- [ ] When launching the app with cleared storage, preloaded sample data for Pramuka MAN 11 Jakarta is automatically populated.
- [ ] The mobile app in `mobile/` loads and runs the web interface offline from bundled local assets without attempting network requests to a local development server IP.

### Android APK Build
- [ ] The Expo mobile configuration (`app.json`, `eas.json` or build scripts) is configured to build an Android APK (preview/standalone profile).
- [ ] Complete, step-by-step documentation is provided explaining how to trigger the cloud build via EAS and download the resulting `.apk` file.
