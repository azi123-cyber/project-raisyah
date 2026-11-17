# Review & Adversarial Challenge Report: Milestone 1 (Web Features & Storage Core)

**Reviewer**: Reviewer 2 (`reviewer_critic`)  
**Date**: 2026-11-10T00:44:00Z  
**Target Milestone**: Milestone 1 (Web Features & Storage Core)  
**Target Repository**: `/home/arsyirazeim/Downloads/Project_Raisyah`  
**Working Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/reviewer_m1_2`  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Tool Execution & Test Results
Direct execution of all verification commands on the repository yielded:
1. `npm run lint` (`tsc --noEmit`):
   - Exit code: `0`
   - Zero TypeScript compile or type errors.
2. `npm run build` (`vite build`):
   - Exit code: `0`
   - Transformed 1666 modules in 2.59s.
   - Generated `dist/index.html` (1.55 kB), `dist/assets/index-DZTvQxau.css` (31.70 kB), `dist/assets/index-CRN4hqrS.js` (341.38 kB).
   - `dist/index.html` lines 15-16 verified:
     ```html
     <script type="module" crossorigin src="./assets/index-CRN4hqrS.js"></script>
     <link rel="stylesheet" crossorigin href="./assets/index-DZTvQxau.css">
     ```
3. `npx tsx --test src/utils/inventoryLogic.test.ts`:
   - Exit code: `0`
   - 14/14 tests pass in 1648ms.
4. `npx tsx --test tests/*.test.ts`:
   - Exit code: `0`
   - 69/69 tests pass in 3275ms.

---

### 1.2 Inspection of Source Code vs Test Code

#### Observation A: Disconnect on Active Loan Deletion Guard
1. **In `tests/helpers/testStorage.ts` (lines 153-168)**:
   ```ts
   public deleteItem(itemId: string): { success: boolean; error?: string } {
     const item = this.getItemById(itemId);
     if (!item) {
       return { success: false, error: 'Item not found' };
     }
     // Safety check: verify item is not currently borrowed
     if (item.borrowedQty > 0) {
       return {
         success: false,
         error: `Cannot delete item '${item.name}': ${item.borrowedQty} unit(s) are currently on active loan.`,
       };
     }
     this.items = deleteInventoryItemFromList(this.items, itemId);
     this.saveToStorage();
     return { success: true };
   }
   ```
2. **In `tests/tier1_features.test.ts` (lines 369-380, F4.3)**:
   ```ts
   test('F4.3: deleteItem rejects deletion when item is actively borrowed', () => {
     const store = new SiPrakaStateStore();
     const borrowedItem = store.getItems().find((i) => i.borrowedQty > 0)!;
     const result = store.deleteItem(borrowedItem.id);
     assert.equal(result.success, false);
     assert.ok(result.error?.includes('currently on active loan'));
     assert.ok(store.getItemById(borrowedItem.id));
   });
   ```
3. **In `tests/tier2_boundaries.test.ts` (lines 255-269, B12)**:
   ```ts
   test('B12: safety check blocks deleting item with active loan even if multiple deletions attempted', () => {
     const store = new SiPrakaStateStore();
     const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;
     const targetItemId = activeTx.items[0].itemId;
     const res1 = store.deleteItem(targetItemId);
     assert.equal(res1.success, false);
   ...
   ```
4. **In `src/utils/inventoryLogic.ts` (lines 380-384)**:
   ```ts
   export function deleteInventoryItemFromList(
     items: InventoryItem[],
     itemId: string
   ): InventoryItem[] {
     return items.filter((item) => item.id !== itemId);
   }
   ```
   *No safety guard exists here.*
5. **In `src/App.tsx` (lines 229-231)**:
   ```ts
   const handleDeleteItem = (itemId: string) => {
     setItems((prev) => prev.filter((item) => item.id !== itemId));
   };
   ```
   *No safety guard exists here.*
6. **In `src/components/MemberMobileApp.tsx` (lines 605-611 & 2734-2754)**:
   ```ts
   const handleConfirmDeleteItem = () => {
     if (!deletingItem) return;
     onDeleteItem?.(deletingItem.id);
     setScanFeedback(`Barang [${deletingItem.barcode}] ${deletingItem.name} berhasil dihapus.`);
     setDeletingItem(null);
     setTimeout(() => setScanFeedback(null), 3000);
   };
   ```
   And in the modal UI:
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
   *The button "Ya, Hapus" is NOT disabled when `deletingItem.borrowedQty > 0`. Clicking it executes `handleConfirmDeleteItem`, which invokes `onDeleteItem` and permanently deletes the actively borrowed item from storage.*

---

#### Observation B: Cart Boundary Bypass via Plus Button and Direct Input
1. **In `src/components/MemberMobileApp.tsx` (lines 1656-1685)**:
   ```tsx
   <input
     type="number"
     min={1}
     max={100}
     aria-label={`Jumlah ${entry.name}`}
     value={entry.qty}
     onChange={(e) => {
       const val = Math.max(1, parseInt(e.target.value, 10) || 1);
       setScannedCart((prev) =>
         prev.map((item) =>
           item.itemId === entry.itemId ? { ...item, qty: val } : item
         )
       );
     }}
     className="w-12 text-center font-mono text-xs font-extrabold bg-white border border-[#D9C3A9] rounded-lg py-1"
   />
   <button
     type="button"
     aria-label={`Tambah jumlah ${entry.name}`}
     onClick={() =>
       setScannedCart((prev) =>
         prev.map((e) =>
           e.itemId === entry.itemId ? { ...e, qty: e.qty + 1 } : e
         )
       )
     }
     className="w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314]"
   >
     <Plus className="w-3.5 h-3.5" />
   </button>
   ```
   *When adding an item via barcode scanner or catalog "Pinjam" button, `handleAddScannedItem` calls `calculateAllowedCartQty(item, existingQty, qtyToAdd)` which properly blocks additions when `maxAvail <= 0`. However, inside the cart, the Plus (`+`) button increments `e.qty + 1` unconditionally, and the `<input>` allows typing any number up to 100 without clamping against `getAvailableQty(item)`. Neither checks remaining available stock.*

---

## 2. Logic Chain

1. **Premise 1**: The authoritative project specification (`PROJECT.md` Feature 4), Milestone 1 dispatch, and `TEST_READY.md` specify:
   *"Delete Inventory Item: Ability to remove item with confirmation and safety checks (safely blocks deleting an item currently on active loan `borrowedQty > 0`)."*
2. **Premise 2**: In `tests/tier1_features.test.ts` (F4.3) and `tests/tier2_boundaries.test.ts` (B12), tests asserting that active loan deletion is rejected pass 100%.
3. **Premise 3**: Tracing the execution of F4.3 and B12 reveals that they do NOT test `src/App.tsx`, `src/components/MemberMobileApp.tsx`, or `src/utils/inventoryLogic.ts`. Instead, they invoke `store.deleteItem` on `SiPrakaStateStore`, an auxiliary test-only helper class in `tests/helpers/testStorage.ts`.
4. **Premise 4**: In the real production application:
   - `src/App.tsx::handleDeleteItem` unconditionally executes `setItems(prev => prev.filter(item => item.id !== itemId))`.
   - `src/components/MemberMobileApp.tsx::handleConfirmDeleteItem` unconditionally invokes `onDeleteItem`.
   - The deletion modal in `MemberMobileApp.tsx` displays a warning text, but leaves the "Ya, Hapus" button clickable and enabled.
5. **Deduction 1 (Integrity Violation & Facade)**: A safety check was implemented in test helper code and certified as passing in `TEST_READY.md`, but was omitted from the production code. In the actual web application, an administrator can delete an actively borrowed item, corrupting inventory state and orphaning active transactions.
6. **Premise 5**: In `src/components/MemberMobileApp.tsx`, `calculateAllowedCartQty` was added to `handleAddScannedItem`. However, within the cart UI, the `+` button and numeric `<input>` permit arbitrary quantity expansion without consulting `getAvailableQty`.
7. **Deduction 2 (Boundary Bypass)**: Users can bypass stock limits directly in the cart UI by clicking `+` or typing a number, creating loan transactions that exceed available physical stock.

---

## 3. Caveats

- Milestone 1 changes were focused on web and storage core. `mobile/` and `scripts/` were not modified, consistent with milestone scoping rules.
- Test suite execution in `tests/*.test.ts` runs in a Node.js environment without a live browser DOM; hence `testStorage.ts` was created to model state transitions. However, test helpers must not contain business rules or safety guards that are absent from production source code.

---

## 4. Conclusion

Milestone 1 shows solid work in:
- Relative asset paths in `vite.config.ts` (`base: './'`) and `dist/index.html`.
- Canvas image resizing and JPEG 0.7 compression (<100KB).
- RFC 4180 CSV export generation with UTF-8 BOM.
- Initial cart addition boundary check via `calculateAllowedCartQty`.
- Seed data reset mechanism and localStorage synchronization.

**However, changes MUST be requested**:
1. **Critical Finding [INTEGRITY VIOLATION]**: The active-loan deletion safety guard claimed in `TEST_READY.md` and tested in F4.3/B12 exists solely in `tests/helpers/testStorage.ts`. The actual production code (`src/App.tsx`, `src/components/MemberMobileApp.tsx`, `src/utils/inventoryLogic.ts`) does NOT block deleting actively borrowed items.
2. **Major Finding**: The cart UI permits users to bypass stock boundary limits via the `+` button and numeric `<input>`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Disparity in Deletion Safety**:
   ```bash
   # Inspect test helper implementation with the safety check:
   sed -n '153,168p' tests/helpers/testStorage.ts

   # Inspect production deletion handlers lacking the safety check:
   sed -n '229,232p' src/App.tsx
   sed -n '605,612p' src/components/MemberMobileApp.tsx
   sed -n '2734,2755p' src/components/MemberMobileApp.tsx
   ```
   *Observation*: In `MemberMobileApp.tsx`, clicking `handleConfirmDeleteItem` deletes the item even when `deletingItem.borrowedQty > 0`.

2. **Verify Cart Boundary Bypass in UI**:
   ```bash
   sed -n '1656,1686p' src/components/MemberMobileApp.tsx
   ```
   *Observation*: `e.qty + 1` and `parseInt(e.target.value, 10)` are set directly without checking `item.totalQty - item.borrowedQty - item.damagedQty`.

3. **Verify Build & Test Status**:
   ```bash
   npm run lint
   npm run build
   npx tsx --test src/utils/inventoryLogic.test.ts
   npx tsx --test tests/*.test.ts
   ```

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

## Findings

### [Critical] Finding 1 — INTEGRITY VIOLATION: Active-Loan Deletion Safety Guard Exists Only in Test Helper (`testStorage.ts`) and is Omitted from Production Code

- **What**: The safety check preventing deletion of an item currently on active loan (`borrowedQty > 0`) is implemented in `tests/helpers/testStorage.ts` (lines 158–164), causing tests `F4.3`, `B12`, and `C3` to pass. However, it was never implemented in the production codebase (`src/App.tsx`, `src/components/MemberMobileApp.tsx`, or `src/utils/inventoryLogic.ts`).
- **Where**:
  - `src/App.tsx:229-231` (`handleDeleteItem`)
  - `src/components/MemberMobileApp.tsx:605-611` (`handleConfirmDeleteItem`)
  - `src/components/MemberMobileApp.tsx:2734-2754` (Delete dialog UI)
  - `src/utils/inventoryLogic.ts:380-384` (`deleteInventoryItemFromList`)
- **Why**: This is a facade implementation where the test suite certifies a safety guard that does not exist in production. In the web app, an admin can delete an item with active loans. When the borrower returns the equipment, return approval fails to restore the item because it no longer exists in `items`, permanently corrupting stock counts and inventory records.
- **Suggestion**:
  1. In `src/components/MemberMobileApp.tsx`:
     - Inside `handleConfirmDeleteItem`: check if `deletingItem.borrowedQty > 0`. If so, show an error alert and abort deletion.
     - In the delete confirmation dialog (lines 2734–2754): disable the "Ya, Hapus" button if `deletingItem.borrowedQty > 0` (`disabled={deletingItem.borrowedQty > 0} className="... disabled:opacity-50 disabled:cursor-not-allowed"`), and explain clearly that items on active loan cannot be deleted until returned.
  2. In `src/App.tsx`:
     - Inside `handleDeleteItem`: add guard `const target = items.find(i => i.id === itemId); if (target && target.borrowedQty > 0) return;`.
  3. In `src/utils/inventoryLogic.ts`:
     - Optionally update `deleteInventoryItemFromList` or add a pure validator `canDeleteInventoryItem(item: InventoryItem)`.

---

### [Major] Finding 2: Cart Quantity Manipulation Bypasses Stock Boundaries in Cart UI

- **What**: Users can bypass the remaining stock limit once an item is added to `scannedCart`.
- **Where**: `src/components/MemberMobileApp.tsx:1656-1685`
- **Why**: While `handleAddScannedItem` correctly uses `calculateAllowedCartQty`, the cart table allows increasing quantity via the `+` button (`qty: e.qty + 1`) and typing into the numeric `<input>` (`Math.max(1, parseInt(...))`). Neither checks available stock (`getAvailableQty(item)`). A member can request 50 units of an item that only has 1 unit available.
- **Suggestion**:
  - Lookup the item's available stock: `const maxAvail = getAvailableQty(items.find(i => i.id === entry.itemId) || ...);`
  - In `<input>` `onChange`: clamp value to `Math.min(maxAvail, Math.max(1, parsedVal))`.
  - In `+` button `onClick`: clamp or disable `+` when `entry.qty >= maxAvail`.

---

### [Minor] Finding 3: Edit Item Modal Allows Setting Total Stock Below Currently Borrowed Quantity

- **What**: In the item editing modal, an admin can change `totalQty` to a number lower than `borrowedQty` (e.g. Setting total stock to 2 when 10 units are currently on active loan).
- **Where**: `src/components/MemberMobileApp.tsx:588`, `src/utils/inventoryLogic.ts:197-199`
- **Why**: While `getAvailableQty` handles this by clamping `Math.max(0, ...)`, setting total quantity below active loans creates an inconsistent state where returned items restore stock above total quantity.
- **Suggestion**:
  - In `handleSaveEditItem`: check `if (editTotalQty < editingItem.borrowedQty)`, display a validation error alerting the user that total stock cannot be less than currently borrowed stock (`editingItem.borrowedQty`).

---

## Verified Claims

- `npm run lint` (`tsc --noEmit`) passes with zero errors → Verified via CLI.
- `npm run build` succeeds without Vite 8 deprecation warnings and generates relative asset paths (`./assets/...`) → Verified via CLI and inspection of `dist/index.html`.
- Canvas image compression scales photos to max 800px at JPEG 0.7 quality and keeps data URLs <100KB → Verified in `MemberMobileApp.tsx:381-424`.
- RFC 4180 CSV exports for inventory catalog and transactions include UTF-8 BOM, escaped quotes/commas, and proper headers → Verified in `src/utils/inventoryLogic.ts:389-482`.
- "Reset ke Sampel Awal MAN 11" restores `items`, `members`, and `transactions` and synchronizes to `localStorage` → Verified in `App.tsx:233-247` and `MemberMobileApp.tsx:627-632`.
- Initial cart addition blocks 0-stock items via `calculateAllowedCartQty` → Verified in `src/utils/inventoryLogic.ts:343-364` and `MemberMobileApp.tsx:333-345`.

---

## Coverage Gaps

- Active-loan deletion safety guard in production UI and App state: **High Risk** — Addressed in Finding 1.
- In-cart quantity stepper boundary clamping: **Medium Risk** — Addressed in Finding 2.

---

## Adversarial Challenge Report

### Challenge Summary
**Overall Risk Assessment**: **HIGH**

### Challenges

#### Challenge 1 [Critical]: Active Loan Deletion Orphan Exploit
- **Assumption Challenged**: "The system safely prevents deleting items that are currently borrowed."
- **Attack Scenario**:
  1. Member A borrows 10 units of Tongkat Panjang (`BRG-KBU-001`). Transaction status transitions to `active_borrowed`.
  2. User switches to Admin mode, goes to Katalog Inventaris, finds `BRG-KBU-001`, and clicks the Delete (Trash) icon.
  3. The dialog warns "Perhatian: Saat ini ada 10 unit barang yang sedang dipinjam!".
  4. User clicks "Ya, Hapus".
  5. Item is deleted from `sipraka_items_v3`.
  6. Later, Member A returns the 10 units. Officer clicks "Setujui & Tandatangani Pengembalian".
  7. `handleApproveReturn` attempts to restore borrowed stock:
     ```ts
     setItems((prevItems) => prevItems.map((inv) => {
       const entry = target.items.find((i) => i.itemId === inv.id);
       if (!entry) return inv;
       ...
     }));
     ```
- **Blast Radius**: The item no longer exists in `prevItems`. The 10 units of physical equipment are permanently erased from inventory data.
- **Mitigation**: Disable the "Ya, Hapus" button and enforce blocking in `handleConfirmDeleteItem` and `handleDeleteItem`.

#### Challenge 2 [High]: Cart Stepper Stock Overdraft
- **Assumption Challenged**: "`calculateAllowedCartQty` prevents borrowing more items than are physically available."
- **Attack Scenario**:
  1. Tenda Dome has remaining available stock of 1 unit.
  2. Member adds 1 unit to cart (allowed).
  3. In the cart view, member clicks `+` 10 times, or types `50` in the input box.
  4. Member submits the loan request for 50 units.
  5. Officer approves the request.
  6. Stock drops to negative or clamps to total, overdrafting inventory.
- **Blast Radius**: Inventory available stock calculation is distorted; other members are denied items that don't exist.
- **Mitigation**: Clamp the `<input>` and `+` button in `MemberMobileApp.tsx` to `getAvailableQty(item)`.

---

## Verdict & Recommendation

**Verdict**: **REQUEST_CHANGES**  
Tag: **CRITICAL — INTEGRITY VIOLATION / FACADE IMPLEMENTATION**

Worker M1 must address Finding 1 (enforcing active-borrow deletion safety in production code rather than test-only helper) and Finding 2 (clamping cart quantity controls to available stock) before Milestone 1 can be approved.
