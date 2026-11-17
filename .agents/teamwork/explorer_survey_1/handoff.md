# Handoff Report: Web Core & Features Survey (Explorer 1)

**Task**: Web Core & Features Survey for SiPraka Inventory System (Pramuka MAN 11 Jakarta)  
**Author**: Explorer 1  
**Date**: 2026-11-09  
**Working Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_survey_1`  
**Reference Document**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Observation

### 1.1 Project Structure & Build Tooling
- **Root Manifest (`package.json`)**:
  - Name: `sipraka-man11` version `1.0.0`, type `module`.
  - Scripts:
    - `"dev": "vite --port=3000 --host=0.0.0.0"`
    - `"build": "vite build"`
    - `"lint": "tsc --noEmit"`
    - `"preview": "vite preview"`
  - Core dependencies: React 19 (`react` 19.0.1, `react-dom` 19.0.1), `lucide-react` 0.546.0, `@tailwindcss/vite` 4.3.3, `vite` 8.3.0, `motion` 12.23.24.
- **Build Verification**:
  - Running `npm run lint` (`tsc --noEmit`): Exited with code `0`, no TypeScript compilation errors.
  - Running `npm run build` (`vite build`): Exited with code `0`, transformed 1666 modules, generated bundles:
    - `dist/index.html` (1.55 kB)
    - `dist/assets/index-c9J5ZoSt.css` (31.05 kB)
    - `dist/assets/index-DG6wjava.js` (325.17 kB)
  - Vite warning observed during build:
    ```
    (!) Your Vite config uses features that are unsupported by configLoader: 'native', which is planned to become the default in a future major version of Vite:
      - __dirname (vite.config.ts:11:27). Use import.meta.dirname instead
    ```
  - In `dist/index.html` lines 15–16:
    ```html
    <script type="module" crossorigin src="/assets/index-DG6wjava.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-c9J5ZoSt.css">
    ```
    Notice the leading slash (`/assets/...`). Because `vite.config.ts` does not specify `base: './'`, asset URLs are rooted at `/`.
- **Unit Test Execution**:
  - Command: `npx tsx --test src/utils/inventoryLogic.test.ts`
  - Output:
    ```
    ✔ getAvailableQty computes remaining stock accurately (6.312601ms)
    ✔ calculateInventoryStats aggregates totals and percentages (0.861437ms)
    ✔ findItemByBarcode locates item by exact barcode or partial name (2.870011ms)
    ✔ isTransactionOverdue detects overdue deadlines (0.788427ms)
    ✔ buildOfficialLetterMeta formats Ambalan borrow and return letter headers matching PDF (1.281459ms)
    ✔ formatIndonesianDate outputs exact PDF date format (Sabtu, 08 Agustus 2026) (0.580031ms)
    ℹ tests 6, pass 6, fail 0
    ```

---

### 1.2 Source Code Organization (`src/`)
The web application source tree consists of:
```
src/
├── main.tsx                         # Entry point (creates root and mounts App)
├── App.tsx                          # Top-level state container & persistence controller
├── index.css                        # Tailwind v4 import & print styles (@media print)
├── components/
│   ├── MemberMobileApp.tsx          # Main mobile UI (5 bottom tabs, forms, modals)
│   ├── OfficialLetterModal.tsx      # Printable A4 official letter (Hal 1 & Hal 2)
│   ├── SignaturePadCanvas.tsx       # Touch/mouse canvas & upload for digital signatures
│   └── AmbalanLogoSvg.tsx           # SVGs for shield logo and tunas kelapa silhouette
├── data/
│   └── seedData.ts                  # Preloaded initial items, members, officers, pradana, transactions
└── utils/
    ├── inventoryLogic.ts            # Domain calculations, formatting, SVG photo generators
    └── inventoryLogic.test.ts       # Native node:test suite for inventory logic
```

---

### 1.3 Detailed Feature Survey

#### Feature 1: Item Catalog & Stock Calculation
- Located in `src/components/MemberMobileApp.tsx` (lines 1218–1315) and `src/utils/inventoryLogic.ts` (lines 194–198).
- **Categories**: `'Tongkat & Pionering' | 'Tenda & Kemah' | 'Navigasi & Komlek' | 'Dapur'`. Filtered by category pills and free text search.
- **Stock formula**: `getAvailableQty(item) = Math.max(0, item.totalQty - item.borrowedQty - item.damagedQty)`.
- Preloaded with 8 standard equipment items for Gudep 06.171–06.172.

#### Feature 2: Adding / Editing / Deleting Items
- **Adding Items**: Fully implemented. Admin/user clicks "Tambah Barang" in Catalog tab (`MemberMobileApp.tsx:2116–2216`), which opens a bottom sheet. On submit, triggers `handleAddNewItem` in `App.tsx:221–223`, appending to `items` state and persisting to `localStorage`.
- **Editing Existing Items**: **MISSING**. No edit modal, form, or callback (`onUpdateItem` / `handleEditItem`) exists in `App.tsx` or `MemberMobileApp.tsx`. Users cannot adjust total quantity, rename an item, edit condition, or update storage location of an existing item.
- **Deleting Items**: **MISSING**. No delete button or callback (`onDeleteItem` / `handleDeleteItem`) exists for inventory catalog items.

#### Feature 3: Borrowing & Return Flows
- **Borrowing Flow (`MemberMobileApp.tsx:1319–1675`)**:
  - Item selection: via camera barcode scanning (`BarcodeDetector`), manual barcode text entry, or dropdown picker.
  - Cart: `scannedCart` stores items, allows quantity adjustment via `+`/`-` or input.
  - Verification Photos: Requires/allows 2 photos (Foto 1: Kondisi Barang Sebelum Dipinjam, Foto 2: Serah-Terima Peminjaman). Defaults to generated SVG proof photos if not captured.
  - Submission creates a transaction with status `'pending_borrow'`.
  - Admin verifies photos and clicks "ACC & Terbitkan Surat PDF" (`App.tsx:144–174`), updating status to `'active_borrowed'`, deducting available stock (`inv.borrowedQty + entry.qty`), and opening the printable letter.
- **Return Flow (`MemberMobileApp.tsx:2019–2113`)**:
  - Triggered via "Kembalikan Barang" button on active or overdue transaction cards.
  - Input: description of condition upon return (`returnConditionText`).
  - Verification Photos: 2 return photos (Foto 3: Kondisi Sesudah Dikembalikan, Foto 4: Serah-Terima Pengembalian).
  - Submits with status `'pending_return'`.
  - Admin clicks "ACC Kembali & Terbitkan PDF" (`App.tsx:175–206`), updating status to `'returned'`, restoring available stock (`inv.borrowedQty - entry.qty`), and opening the return letter.
- **Overdue Detection & Alarm (`inventoryLogic.ts:267–276`, `MemberMobileApp.tsx:282–305`)**:
  - Compares `tx.dueDate` against current timestamp.
  - Header displays a red pulsing bell with overdue count.
  - Generates an audible multi-frequency warning sound using the Web Audio API (`AudioContext`).

#### Feature 4: Member Management
- Located in `src/components/MemberMobileApp.tsx:1817–1975`.
- **Account Switcher**: Dropdown allows instant switching between scout members (`currentMemberId`).
- **Registration**: "+ Anggota Baru" form creates new member with name, class, rank (Bantara/Laksana), sangga, and phone/WhatsApp number. Auto-generates official NIA format (`06.171.2026.xxx`) and signature SVG.
- **Profile Editing**: Active member can edit their own name, class, rank, and sangga. Changes propagate to past transactions (`App.tsx:87–102`).
- **Digital Signature**: `SignaturePadCanvas.tsx` supports freehand signature drawing on canvas or uploading a photo signature. Saved signatures persist directly into the member record and appear on official letters.
- **Limitation**: No full member directory view or deletion of members; only the currently selected member's profile can be updated.

#### Feature 5: Transaction Records & History
- Located in `src/components/MemberMobileApp.tsx:1679–1814`.
- Shows transaction cards filtered by status (`all`, `pending`, `active`, `returned`).
- Displays full metadata: transaction ID, borrower name, class, purpose, item breakdown with barcode and quantities, date, officer name, and current lifecycle status.
- "Bukti Foto" button opens modal displaying all 4 proof photos.
- Direct links to Hal 1 (Surat Peminjaman) and Hal 2 (Surat Pengembalian).

#### Feature 6: Reporting & Export
- Located in `src/components/OfficialLetterModal.tsx:71–73` & `src/index.css:20–36`.
- **Official Letter Print**: Matches Gudep 06.171–06.172 MAN 11 Jakarta reference PDF 1:1, including official kop surat, watermark logo, signature blocks (Yang Menyerahkan, Yang Menerima, Mengetahui Pradana).
- Triggers `window.print()` with `@media print` CSS rules isolating `#printable-official-letter`.
- **General Reporting / Export**: **MISSING**. There is no export functionality (CSV, Excel, or summary report) for the overall inventory stock list or transaction records.

---

### 1.4 State Management & Data Persistence
- **Storage mechanism**: Browser `localStorage` (or WebView `localStorage` on mobile).
- **Keys**:
  - `sipraka_items_v3`: array of `InventoryItem`
  - `sipraka_members_v3`: array of `ScoutMember`
  - `sipraka_tx_v3`: array of `LoanTransaction`
- **Fallback on first run / cleared storage**:
  `App.tsx` initializes state via initializer functions:
  ```ts
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('sipraka_items_v3');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY_ITEMS;
    } catch {
      return INITIAL_INVENTORY_ITEMS;
    }
  });
  ```
- **Syncing**: Synchronized via three `useEffect` hooks in `App.tsx` that write to `localStorage` on any state update.
- **Prop Drilling**: All state is held in `App.tsx` and passed directly as props to `MemberMobileApp` and `OfficialLetterModal`. No external state library or Context is used.

---

### 1.5 Identified Bugs & Edge Cases

1. **Falsy 0 Stock Calculation Bug in Cart Addition (`MemberMobileApp.tsx:314, 324`)**:
   ```ts
   // Line 314:
   qty: Math.min(maxAvail || 60, e.qty + qtyToAdd)
   // Line 324:
   qty: Math.min(maxAvail || 1, qtyToAdd)
   ```
   When `maxAvail` is `0` (item out of stock), `0 || 60` evaluates to `60`, and `0 || 1` evaluates to `1`. Consequently, users are able to add items that have 0 remaining stock into the borrow cart.
2. **Missing `base: './'` in `vite.config.ts`**:
   `vite.config.ts` does not specify `base: './'`. As a result, `npm run build` produces absolute asset links (`/assets/...`). When bundled into mobile WebView offline assets or served from `file:///`, relative paths fail to resolve.
3. **Date Customization Discarded in `OfficialLetterModal.tsx:56–69`**:
   Users can edit `customDateStr` in the "Sesuaikan Surat" panel, but `handleSaveCustomizations()` does not persist the modified date back into `transaction.borrowDate` or `transaction.returnDate`.
4. **`window.print()` in Mobile WebView**:
   In mobile WebView environments, `window.print()` is typically ignored unless native bridges or export fallbacks (such as file download/HTML print) are handled.
5. **Vite Deprecation Warning**:
   Use of `__dirname` in `vite.config.ts:11` triggers a deprecation warning in Vite 8 (`Use import.meta.dirname instead`).

---

## 2. Logic Chain

1. **Observation 1.1 & 1.3 (Feature 2)** shows that while `showAddItemSheet` exists, there is no code or UI for updating an item's details or deleting an item.
   - *Inference*: Requirement R1 explicitly specifies: *"Verify that all core features of the SiPraka inventory system (item catalog, adding/editing/deleting items, borrowing and return flows, member management, transaction records, and reporting/export) work correctly..."*
   - *Deduction*: Item editing and item deletion must be implemented to satisfy R1.

2. **Observation 1.3 (Feature 6)** shows that only single-transaction official letter printing is available.
   - *Inference*: Requirement R1 and Acceptance Criteria specify: *"generating reports execute without console errors or UI breakages."*
   - *Deduction*: An export/reporting feature (such as exporting current inventory and borrowing logs to CSV or printable summary tables) is missing and must be added.

3. **Observation 1.5 (Bug 1)** shows that `maxAvail || 60` evaluates to `60` when `maxAvail === 0`.
   - *Inference*: This allows members to borrow items with zero available stock, violating inventory constraints.
   - *Deduction*: The stock check must use `Math.max(0, maxAvail)` and block addition when available stock is 0.

4. **Observation 1.1 & 1.5 (Bug 2) and `mobile/App.tsx:28–44`** show:
   - `dist/index.html` references `/assets/index-...` with an absolute path.
   - `mobile/App.tsx` loads an external HTTP URL (`http://192.168.43.217:3000`).
   - *Inference*: Requirement R3 requires: *"Bundle the web application assets directly into the mobile Expo project so that the mobile app operates 100% offline and standalone upon installation, without requiring a computer running a local Vite development server."*
   - *Deduction*: Setting `base: './'` in `vite.config.ts` is required so `dist/` can be loaded offline via `react-native-webview` local asset bundling.

---

## 3. Caveats

- **Scope boundary**: This investigation is read-only. No code modifications were performed in `src/`, `mobile/`, or configuration files during this survey.
- **Mobile Native Testing**: Local execution was tested in a Linux headless environment; physical Android device testing with EAS Cloud Build requires EAS credentials and network configuration, which will be verified in subsequent phases.
- **Browser Print Dialog**: `window.print()` behavior depends on the host browser/device; in desktop browsers it opens the system print dialog, while on Android WebView it requires WebView-compatible print handlers or direct PDF export.

---

## 4. Conclusion

The SiPraka web application is built on a solid foundation:
- TypeScript compilation (`tsc --noEmit`) and Vite bundling (`vite build`) succeed cleanly with zero errors.
- Domain unit tests (`inventoryLogic.test.ts`) achieve 100% pass rate (6/6 tests).
- Local data persistence via `localStorage` with Pramuka MAN 11 Jakarta preloaded sample data (`INITIAL_INVENTORY_ITEMS`, `INITIAL_MEMBERS`, `INITIAL_TRANSACTIONS`) is fully implemented.
- Core workflows (barcode scanning with hardware/software fallbacks, dual proof photo documentation, multi-step approval, digital pen signature pad, and official A4 PDF letter generation matching the reference document) are operational.

However, to fully satisfy the authoritative requirements in `ORIGINAL_REQUEST.md`, the following gaps must be addressed:
1. **Catalog Management**: Add UI and handlers for editing and deleting inventory items.
2. **Reporting & Data Export**: Add a report/export utility for inventory status and transaction history (e.g. CSV/Excel export and printable summary).
3. **Stock Boundary Bug**: Correct the falsy `0` handling in cart item addition (`maxAvail || 60`).
4. **Offline Mobile Bundling**: Set `base: './'` in `vite.config.ts` and update `mobile/App.tsx` to serve bundled local assets rather than an external dev server IP.

---

## 5. Verification Method

To independently reproduce and verify all observations and conclusions:

1. **Type Checking & Build**:
   ```bash
   cd /home/arsyirazeim/Downloads/Project_Raisyah
   npm run lint
   npm run build
   ```
   *Expected Result*: Exits with code `0`. Observe the output in `dist/index.html` noting `/assets/...` absolute paths.

2. **Unit Tests**:
   ```bash
   npx tsx --test src/utils/inventoryLogic.test.ts
   ```
   *Expected Result*: 6 tests pass.

3. **Verify Absence of Edit / Delete Items**:
   ```bash
   grep -rn "onUpdateItem\|handleEditItem\|onDeleteItem\|handleDeleteItem" src/
   ```
   *Expected Result*: No matches found.

4. **Verify Stock Check Logic Bug**:
   Inspect `src/components/MemberMobileApp.tsx` lines 310–330. Observe `Math.min(maxAvail || 60, e.qty + qtyToAdd)` when `maxAvail === 0`.
