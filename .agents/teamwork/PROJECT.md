# Project: SiPraka Inventory System (Pramuka MAN 11 Jakarta)

## Architecture
- **Web Layer**: React 19 + TypeScript + Vite + Tailwind CSS v4. Mobile-first Scout Inventory Application (`src/App.tsx`, `src/components/MemberMobileApp.tsx`).
- **Data Persistence**: Offline-first via browser/WebView `localStorage` (`sipraka_items_v3`, `sipraka_members_v3`, `sipraka_tx_v3`). Preloaded with rich default seed data for Gudep 06.171–06.172 MAN 11 Jakarta (`src/data/seedData.ts`).
- **Mobile Container**: Expo (SDK 58) + `react-native-webview` (`mobile/App.tsx`). Inlined offline web asset bundle (`mobile/webAppBundle.ts`) loaded with `baseUrl: 'https://sipraka.man11jkt.local'` ensuring 100% offline standalone operation and permanent `localStorage` retention.
- **Build & Distribution**: EAS Cloud Build configuration (`mobile/eas.json`, `mobile/app.json`) configured for standalone Android APK generation without local SDK requirements.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Item Catalog & Categories | View, search, and category-filter (Tongkat, Tenda, Navigasi, Dapur) equipment items with real-time stock computation | M1 | survey |
| 2 | Add New Inventory Item | Bottom sheet form to register new item with name, code, category, total qty, and location | M1 | survey |
| 3 | Edit Existing Inventory Item | Modal/form to modify item details (name, total stock, location, condition, notes) | M1 | survey (R1 gap) |
| 4 | Delete Inventory Item | Ability to remove item with confirmation and safety checks | M1 | survey (R1 gap) |
| 5 | Stock Boundary Fix | Prevent adding out-of-stock items (fix falsy `0` in `maxAvail || 60`) | M1 | survey (bug) |
| 6 | Borrowing Workflow | Barcode scanning, cart management, dual proof photos, officer approval, status tracking | M1 | survey |
| 7 | Return Workflow | Condition check, return dual proof photos, officer inspection & return approval, stock restoration | M1 | survey |
| 8 | Member Management | Switch account, register new member (auto NIA 06.171.2026.xxx), canvas digital signature, profile update | M1 | survey |
| 9 | Overdue Alert & Sound | Detect overdue items and trigger audio warning via Web Audio API oscillator | M1 | survey |
| 10 | Official Letter Generation | 1:1 Kop Ambalan Khalid bin Walid - Ummu Kultsum A4 printable letter (Hal 1 & Hal 2) with watermark | M1 | survey |
| 11 | Data Reporting & CSV Export | Export inventory catalog and borrowing transaction history to CSV/Excel format | M1 | survey (R1 gap) |
| 12 | Seed Data Reset & Photo Compression | UI button to reset to default MAN 11 sample data; canvas image compression (<100KB) | M1 | survey (R2 gap) |
| 13 | Offline Mobile Asset Bundling | Node bundling script (`bundle-mobile.mjs`) inlining `dist/` into `mobile/webAppBundle.ts` | M2 | survey (R3) |
| 14 | Standalone Offline Mobile App | Update `mobile/App.tsx` with offline `SIPRAKA_WEB_HTML`, persistent origin, camera grant | M2 | survey (R3) |
| 15 | EAS Cloud Build Setup | `mobile/eas.json` with `preview` APK profile and `mobile/app.json` updates | M3 | survey (R4) |
| 16 | Build Scripts & Documentation | Package scripts (`bundle:mobile`, `eas:build:apk`) and step-by-step APK build guide | M3 | survey (R4) |
| 17 | E2E Testing Suite & Audit | Opaque-box E2E test suite (Tiers 1–4) and Forensic Audit verification | M4 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Web Features & Storage Core | Edit/Delete items, stock boundary fix, CSV export, seed reset, photo compression, Vite base path | none | IN_PROGRESS |
| 2 | Offline Mobile Standalone Bundling | Bundling script `bundle-mobile.mjs`, update `mobile/App.tsx` for offline WebView with persistent origin | M1 | PLANNED |
| 3 | EAS Android APK Setup & Guide | `eas.json`, `app.json`, npm build scripts, step-by-step EAS Cloud Build documentation | M2 | PLANNED |
| 4 | Final Verification & Forensic Audit | E2E test suite (Tiers 1–4), full user flow verification, forensic auditor integrity veto check | M1, M2, M3 | PLANNED |

## Interface Contracts
### Web App ↔ LocalStorage State
- `sipraka_items_v3`: `InventoryItem[]`
- `sipraka_members_v3`: `ScoutMember[]`
- `sipraka_tx_v3`: `LoanTransaction[]`
- Fallback on missing keys: `INITIAL_INVENTORY_ITEMS`, `INITIAL_MEMBERS`, `INITIAL_TRANSACTIONS` from `src/data/seedData.ts`.

### Web App Build ↔ Mobile Offline Bundle
- Input: `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`
- Transform: `scripts/bundle-mobile.mjs` inlines CSS into `<style>` and JS into `<script>`, exports `const SIPRAKA_WEB_HTML: string`
- Output: `mobile/webAppBundle.ts`
- Mobile Consumer: `mobile/App.tsx` via `source={{ html: SIPRAKA_WEB_HTML, baseUrl: 'https://sipraka.man11jkt.local' }}`

### EAS Cloud Build Contract
- Profile: `preview` in `mobile/eas.json`
- Target: `android.buildType = "apk"`
- Output: Direct download link and QR code for `.apk` installation on Android devices

## Code Layout
- `src/App.tsx`: Root state container, item mutation handlers (`handleAddNewItem`, `handleEditItem`, `handleDeleteItem`), localStorage sync, seed reset.
- `src/components/MemberMobileApp.tsx`: Tab views (Dashboard, Catalog, Pinjam, Riwayat, Anggota), forms for add/edit/delete items, CSV export button, camera photo compression.
- `src/components/OfficialLetterModal.tsx`: Official printable letter modal.
- `src/data/seedData.ts`: Pramuka MAN 11 Jakarta default items, members, officers, pradana, transactions.
- `src/utils/inventoryLogic.ts`: Domain calculation functions, stock availability, search, stats.
- `scripts/bundle-mobile.mjs`: Build script for inlining web assets into mobile bundle.
- `mobile/webAppBundle.ts`: Generated offline bundle module.
- `mobile/App.tsx`: Native Expo WebView container with offline loading and developer toggle.
- `mobile/eas.json`: EAS Build configuration with `preview` APK profile.
- `mobile/app.json`: Expo application configuration with Android package and permissions.
- `README.md`: Step-by-step instructions for offline usage and EAS Cloud Build.
