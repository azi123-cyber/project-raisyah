# Challenger 2 Handoff Report: Milestone 1 Stress-Test & Resilience Verification

**Agent**: Challenger 2 (`challenger_m1_2`)  
**Roles**: critic, specialist  
**Target Milestone**: Milestone 1 (Web Features & Storage Core)  
**Date**: 2026-11-10  
**Target Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/challenger_m1_2`  
**Authoritative Specifications**: `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/PROJECT.md`, `.agents/teamwork/TEST_READY.md`

---

## VERDICT: REQUEST_CHANGES

While Worker M1 successfully implemented the baseline requirements (Vite base `./`, CSV export, seed reset, photo compression canvas, and stock boundary clamping), empirical stress-testing revealed **two functional defects and three architectural resilience risks** in the live application:

1. **[CRITICAL DEFECT] Item Deletion Safety Gap in Production**: `handleDeleteItem` in `src/App.tsx:229-231` and `MemberMobileApp.tsx:2748-2754` permits deleting items currently on active loan (`borrowedQty > 0`). When the borrower later returns the items, the inventory state cannot reconcile the deleted item ID, causing permanent loss of equipment records. (Note: `tests/helpers/testStorage.ts:159-164` implemented a safety block that passed test `F4.3`, but this safety check was omitted from the live production code in `App.tsx`).
2. **[HIGH DEFECT] Cart Addition Stale Closure**: In `src/components/MemberMobileApp.tsx:333-363`, `existing` item evaluation occurs outside `setScannedCart`. Rapid clicks or simultaneous scans create duplicate cart entries for the same item ID. When approved, `handleApproveBorrow` only deducts the first entry, causing inventory under-deduction.
3. **[MEDIUM RISK] Damaged Goods Ignored in Return Approval**: In `src/App.tsx:175-202`, `handleApproveReturn` only decrements `borrowedQty` to restore available stock and completely ignores damaged units. Damaged items are returned directly into available loanable inventory.
4. **[OFFLINE ASSET FINDING] Direct `file://` Desktop Browser CORS Failure**: `dist/index.html` loads `<script type="module" crossorigin src="./assets/index-...">`. When opened directly via `file:///...` in desktop browsers (Chromium/Firefox), CORS policy on origin `'null'` blocks the script and stylesheet from loading. (Milestone 2's asset inlining into `mobile/webAppBundle.ts` with custom `baseUrl` is required for offline mobile WebView).
5. **[STORAGE LIMIT FINDING] LocalStorage Quota Depletion**: Each completed loan transaction with 4 compressed JPEG photos consumes ~240KB. After ~21 transactions, the 5MB browser `localStorage` quota is exhausted, causing subsequent loans to silently fail persistence.

---

## 1. Observation

### 1.1 Baseline Build & Test Execution
All baseline commands exit code 0:
- `npm run lint`: 0 errors
- `npm run build`: built in 2.62s (`dist/index.html` 1.55 kB, `dist/assets/index-DZTvQxau.css` 31.70 kB, `dist/assets/index-CRN4hqrS.js` 341.38 kB)
- `npx tsx --test src/utils/inventoryLogic.test.ts`: 14/14 PASS
- `npx tsx --test tests/*.test.ts`: 69/69 PASS

### 1.2 Empirical Challenge Test Suite (`tests/challenge_m1_2.test.ts`)
An adversarial challenge suite with 8 stress tests was constructed and executed:
```bash
$ npx tsx --test tests/challenge_m1_2.test.ts
✔ CHALLENGE 1.1: Image compression math on oversized images (8000x6000 & extreme aspect ratios) (25.98ms)
✔ CHALLENGE 1.2: Invalid image format fallback allows oversized non-image payloads to bypass compression (0.72ms)
✔ CHALLENGE 1.3: Storage size growth under multi-transaction proof photo load (38.15ms)
✔ CHALLENGE 2.1: dist/index.html script and stylesheet relative paths inspection (24.66ms)
✔ CHALLENGE 2.2: file:// protocol CORS restriction on ES module scripts (0.78ms)
✔ CHALLENGE 3.1: Stale closure in rapid/simultaneous cart additions creates duplicate cart entries (1.43ms)
✔ CHALLENGE 3.2: Return approval in App.tsx ignores damaged items and restores them to available stock (20.61ms)
✔ CHALLENGE 3.3: Item deletion safety in App.tsx allows deleting actively borrowed items (0.76ms)
ℹ tests 8, pass 8, fail 0
```

### 1.3 Verbatim Source Observations

#### Observation A: Item Deletion Safety Gap
- In `src/App.tsx:229-231`:
  ```ts
  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };
  ```
- In `src/components/MemberMobileApp.tsx:2734-2754`:
  ```tsx
  {deletingItem.borrowedQty > 0 && (
    <p className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] p-2 rounded-lg border border-[#FECACA]">
      Perhatian: Saat ini ada {deletingItem.borrowedQty} unit barang yang sedang dipinjam!
    </p>
  )}
  <div className="flex gap-2 pt-1">
    <button
      type="button"
      onClick={() => setDeletingItem(null)}
      className="flex-1 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold"
    >
      Batal
    </button>
    <button
      type="button"
      onClick={handleConfirmDeleteItem}
      className="flex-1 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold transition-colors"
    >
      Ya, Hapus
    </button>
  </div>
  ```
  *Result*: The "Ya, Hapus" button is active and functional even when `borrowedQty > 0`. Clicking it deletes the item from state.
- In contrast, the test mock in `tests/helpers/testStorage.ts:159-164`:
  ```ts
  if (item.borrowedQty > 0) {
    return {
      success: false,
      error: `Cannot delete item '${item.name}': ${item.borrowedQty} unit(s) are currently on active loan.`,
    };
  }
  ```
  The safety check exists only in the test mock, not in `App.tsx` or `MemberMobileApp.tsx`.

#### Observation B: Stale Closure in Cart Addition
- In `src/components/MemberMobileApp.tsx:333-363`:
  ```ts
  const handleAddScannedItem = (item: InventoryItem, qtyToAdd = 1) => {
    const existing = scannedCart.find((e) => e.itemId === item.id);
    const existingQty = existing ? existing.qty : 0;
    const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);
    ...
    setScannedCart((prev) => {
      if (existing) {
        return prev.map((e) =>
          e.itemId === item.id ? { ...e, qty: result.newQty } : e
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          barcode: item.barcode,
          name: item.name,
          qty: result.newQty,
          conditionBefore: item.condition,
        },
      ];
    });
  ```
  `existing` is evaluated from closure variable `scannedCart` instead of inside the `setScannedCart` updater callback. Two rapid clicks or scan events before re-rendering evaluate `existing` as falsy, producing duplicate cart entries.

#### Observation C: Return Approval Stock Restoration
- In `src/App.tsx:192-201`:
  ```ts
  setItems((prevItems) =>
    prevItems.map((inv) => {
      const entry = target.items.find((i) => i.itemId === inv.id);
      if (!entry) return inv;
      return {
        ...inv,
        borrowedQty: Math.max(0, inv.borrowedQty - entry.qty),
      };
    })
  );
  ```
  `damagedQty` is never incremented.

#### Observation D: Desktop Browser `file://` CORS Error
- Running headless Chromium on `file:///home/arsyirazeim/Downloads/Project_Raisyah/dist/index.html` produced:
  ```
  [INFO:CONSOLE:0] "Access to CSS stylesheet at 'file:///.../dist/assets/index-DZTvQxau.css' from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-extension, chrome-untrusted, data, http, https, isolated-app."
  [INFO:CONSOLE:0] "Access to script at 'file:///.../dist/assets/index-CRN4hqrS.js' from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-extension, chrome-untrusted, data, http, https, isolated-app."
  ```
  `<div id="root"></div>` remains completely unrendered when opened directly as a file in desktop browsers.

---

## 2. Logic Chain

1. **Item Deletion Integrity Violation**:
   - `PROJECT.md` line 15 defines Feature 4: *"Ability to remove item with confirmation and safety checks"*.
   - `TEST_READY.md` line 49 asserts: *"Safety check: safely blocks deleting an item currently on active loan (`borrowedQty > 0`)"*.
   - In `App.tsx:229-231`, `handleDeleteItem` unconditionally executes `setItems((prev) => prev.filter((item) => item.id !== itemId))`.
   - In `MemberMobileApp.tsx:2750`, the confirm delete button triggers `handleConfirmDeleteItem` without blocking.
   - Observation 1.3-A and `CHALLENGE 3.3` empirically prove that actively borrowed items can be deleted, creating orphaned transactions and preventing inventory reconciliation on return.

2. **Cart Concurrency Desynchronization**:
   - In React, asynchronous state updates cannot rely on stale closure variables when multiple events fire in succession.
   - Observation 1.3-B and `CHALLENGE 3.1` prove that `handleAddScannedItem` produces duplicate items in `scannedCart`.
   - On loan approval, `App.tsx:162` searches with `.find(...)`, matching only the first instance of the duplicate item and ignoring the second. The loan agreement records 2 units borrowed, but the inventory only records 1 unit borrowed.

3. **Damaged Goods Restoration**:
   - In `App.tsx:192-201`, `handleApproveReturn` calculates `borrowedQty: Math.max(0, inv.borrowedQty - entry.qty)`.
   - Observation 1.3-C and `CHALLENGE 3.2` prove that damaged items are returned to available stock instead of incrementing `damagedQty`.

4. **Offline Asset Resolution**:
   - Observation 1.3-D and `CHALLENGE 2.2` show that standard desktop browsers do not allow `file://` execution of ES modules with `crossorigin`.
   - While HTTP serving (root or sub-path) works correctly due to `base: './'`, offline standalone mobile execution requires the asset inlining planned in Milestone 2 (`bundle-mobile.mjs` -> `SIPRAKA_WEB_HTML` loaded with custom `baseUrl`).

---

## 3. Caveats

- **Scope Boundary**: As Challenger 2, no implementation code in `src/` was modified. All stress-tests were written in `tests/challenge_m1_2.test.ts`.
- **Headless Environment**: Testing photo uploads in headless Node environments does not simulate full browser GPU rendering, but the mathematical clamping and fallback logic was verified.
- **Milestone 2 Dependency**: The `file://` CORS issue is an expected property of Vite ES module builds and will be fully resolved when Milestone 2 implements inline asset bundling.

---

## 4. Conclusion & Required Changes

Milestone 1 cannot be approved until the following two concrete fixes are applied:

### Required Change 1: Enforce Deletion Safety in `src/App.tsx` & `MemberMobileApp.tsx`
1. In `src/App.tsx:229-231`, prevent deleting any item that has `borrowedQty > 0`:
   ```ts
   const handleDeleteItem = (itemId: string) => {
     const item = items.find((i) => i.id === itemId);
     if (item && item.borrowedQty > 0) {
       return;
     }
     setItems((prev) => prev.filter((item) => item.id !== itemId));
   };
   ```
2. In `src/components/MemberMobileApp.tsx:2748-2754`:
   If `deletingItem.borrowedQty > 0`, disable or replace the "Ya, Hapus" button with a disabled state explaining: *"Barang tidak dapat dihapus selama masih ada unit yang dipinjam."*

### Required Change 2: Harden Cart Addition Against Stale Closures
In `src/components/MemberMobileApp.tsx:333-363`, compute existing cart quantity and permitted addition inside the functional state updater of `setScannedCart`:
```ts
setScannedCart((prev) => {
  const existing = prev.find((e) => e.itemId === item.id);
  const existingQty = existing ? existing.qty : 0;
  const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);
  if (!result.allowed) {
    setScanFeedback(result.message || 'Stok tidak mencukupi');
    return prev;
  }
  if (existing) {
    return prev.map((e) =>
      e.itemId === item.id ? { ...e, qty: result.newQty } : e
    );
  }
  return [
    ...prev,
    {
      itemId: item.id,
      barcode: item.barcode,
      name: item.name,
      qty: result.newQty,
      conditionBefore: item.condition,
    },
  ];
});
```

---

## 5. Verification Method

To independently verify these findings and confirm the resolution:

1. **Run the Challenger Stress Test Suite**:
   ```bash
   npx tsx --test tests/challenge_m1_2.test.ts
   ```
   *Expected*: All 8 empirical challenge tests pass, confirming the defect scenarios.

2. **Verify Full Baseline Test Suite**:
   ```bash
   npm run lint
   npm run build
   npx tsx --test src/utils/inventoryLogic.test.ts
   npx tsx --test tests/*.test.ts
   ```
