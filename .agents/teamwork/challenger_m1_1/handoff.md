# Adversarial Challenge Report: Milestone 1 (Web Features & Storage Core)

**Agent**: Challenger 1 (`challenger_m1_1`)  
**Role**: critic, specialist  
**Target Milestone**: Milestone 1 (Web Features & Storage Core)  
**Date**: 2026-11-10  
**Working Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/challenger_m1_1`  

---

## VERDICT: REQUEST_CHANGES

The Milestone 1 implementation succeeds on surface unit/E2E test suites and production asset bundling, but adversarial stress testing and code inspection uncovered **5 confirmed vulnerabilities** (2 Critical, 1 High, 2 Medium) in boundary validation, data deletion safeguards, CSV security, and storage error recovery that must be resolved before proceeding to Milestone 2.

---

## 1. Observation

### 1.1 Baseline Verification Results
Standard build and test verification passed with exit code 0:
- `npm run lint` (`tsc --noEmit`): Exited 0 with 0 errors.
- `npx tsx --test src/utils/inventoryLogic.test.ts`: 14/14 tests pass.
- `npx tsx --test tests/*.test.ts`: 69/69 tests pass.
- `npm run build`: Vite bundled production assets with relative paths (`./assets/...`) and zero warnings.

### 1.2 Observation A: Cart Quantity UI Controls Bypass Stock Limits (High Risk)
In `src/components/MemberMobileApp.tsx` (lines 1656–1685):
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
- In the borrow cart, the number input allows any value up to `100`, and the Plus button unconditionally increments `e.qty + 1` without consulting `getAvailableQty(item)` or `calculateAllowedCartQty`.
- In `MemberMobileApp.tsx` (lines 426–440), `handleBorrowSubmit` does not validate requested item quantities against remaining available inventory stock.
- In `src/App.tsx` (lines 160–170):
```tsx
setItems((prevItems) =>
  prevItems.map((inv) => {
    const entry = target.items.find((i) => i.itemId === inv.id);
    if (!entry) return inv;
    return {
      ...inv,
      borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + entry.qty),
    };
  })
);
```
Empirical execution: For an item with `totalQty: 10, damagedQty: 4` (available: 6), adding the item and modifying cart quantity to 10 creates and approves a loan for 10 units. Result:
```
item.totalQty: 10
item.borrowedQty: 10
item.damagedQty: 4
Sum (borrowed + damaged): 14 (Exceeds totalQty: true)
```
Stock is illegally over-committed.

### 1.3 Observation B: Actively Borrowed Items Can Be Deleted in UI and App State (Critical Risk)
In `src/App.tsx` (lines 229–231):
```tsx
const handleDeleteItem = (itemId: string) => {
  setItems((prev) => prev.filter((item) => item.id !== itemId));
};
```
In `src/components/MemberMobileApp.tsx` (lines 2734–2754):
```tsx
{deletingItem.borrowedQty > 0 && (
  <p className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] p-2 rounded-lg border border-[#FECACA]">
    Perhatian: Saat ini ada {deletingItem.borrowedQty} unit barang yang sedang dipinjam!
  </p>
)}
<div className="flex gap-2 pt-1">
  <button type="button" onClick={() => setDeletingItem(null)} ...>Batal</button>
  <button
    type="button"
    onClick={handleConfirmDeleteItem}
    className="flex-1 py-2 rounded-xl bg-[#DC2626] ... font-extrabold"
  >
    Ya, Hapus
  </button>
</div>
```
- The delete confirmation modal renders a red warning text when `borrowedQty > 0`, but the "Ya, Hapus" button remains enabled and calls `handleConfirmDeleteItem -> onDeleteItem(deletingItem.id)`.
- `App.tsx:handleDeleteItem` unconditionally filters out the item from state and writes it to `sipraka_items_v3`.
- `tests/tier1_features.test.ts` (test F4.3) passed only because the test harness author wrote a guard `if (item.borrowedQty > 0) return { success: false }` inside `tests/helpers/testStorage.ts` (lines 159–164). That guard does NOT exist in `src/App.tsx` or `src/components/MemberMobileApp.tsx`.
- Empirical test: Deleting an item with active loan removes it. When the borrower returns the loan, `handleApproveReturn` cannot find the item in `items`, resulting in permanent inventory loss of all remaining unborrowed stock and returned equipment.

### 1.4 Observation C: Editing Item totalQty Below Currently Borrowed Stock Causes Stock Destruction (Medium Risk)
In `src/components/MemberMobileApp.tsx` (lines 581–599):
```tsx
const handleSaveEditItem = (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingItem) return;
  const updated: InventoryItem = {
    ...editingItem,
    name: editName.trim() || editingItem.name,
    category: editCategory,
    totalQty: Math.max(0, Number(editTotalQty) || 0),
    damagedQty: Math.max(0, Number(editDamagedQty) || 0),
    ...
  };
  onEditItem?.(updated);
  ...
};
```
- No constraint enforces `editTotalQty >= editingItem.borrowedQty + editingItem.damagedQty`.
- Empirical test: An item has `totalQty: 20` and `borrowedQty: 10`. Admin edits `totalQty` to `2`. When the borrower returns the 10 units, `borrowedQty` is decremented to 0, but `totalQty` remains 2. 18 units of equipment are permanently wiped out from the inventory system without audit trail.

### 1.5 Observation D: CSV Formula Injection Vulnerability / CWE-1236 (Medium Risk)
In `src/utils/inventoryLogic.ts` (lines 389–396):
```ts
export function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}
```
- RFC 4180 double-quote escaping does NOT prevent spreadsheet formula execution in Microsoft Excel, Google Sheets, or LibreOffice Calc.
- Cells starting with `=`, `+`, `-`, or `@` (such as `=cmd|'/C calc'!A0`, `=SUM(A1:A10)`, `@admin`, or `=HYPERLINK(...)`) are output as `"=..."`, which Excel executes upon opening.
- Empirical test: Payloads starting with `=`, `+`, `-`, and `@` were all returned with dangerous formula prefixes intact.

### 1.6 Observation E: LocalStorage Non-Array Corruption Causes White-Screen Crash (Critical Risk)
In `src/App.tsx` (lines 20–47):
```tsx
const [items, setItems] = useState<InventoryItem[]>(() => {
  try {
    const saved = localStorage.getItem('sipraka_items_v3');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY_ITEMS;
  } catch {
    return INITIAL_INVENTORY_ITEMS;
  }
});
```
- If `localStorage.getItem('sipraka_items_v3')` contains valid JSON that is NOT an array (e.g., `"null"`, `"{}"`, `"123"`, `"\"corrupted\""`):
  - `JSON.parse(saved)` does not throw a `SyntaxError`.
  - `saved ? JSON.parse(saved) : ...` returns `null`, `{}`, `123`, or `"corrupted"`.
  - State `items` is initialized to a non-array value.
  - When `MemberMobileApp.tsx` renders, expressions such as `items.map(...)`, `items.filter(...)`, and `items[0]` throw unhandled `TypeError` exceptions (`Cannot read properties of null (reading '0')`, `items.filter is not a function`), causing a total application crash (white screen).
  - The same bug exists for `members` and `transactions` states.
- Empirical test:
  - `saved = "null"` -> `isArray: false, canFilter: false, runtime TypeError`
  - `saved = "{}"` -> `isArray: false, canFilter: false, runtime TypeError`
  - `saved = "123"` -> `isArray: false, canFilter: false, runtime TypeError`

---

## 2. Logic Chain

1. **Cart Boundary Integrity (Observation 1.2)**:
   - Worker implemented `calculateAllowedCartQty` in `inventoryLogic.ts` and called it during `handleAddScannedItem`.
   - However, once an item is inside `scannedCart`, user interaction in the cart UI (the number input and Plus button) operates directly on `scannedCart` state without passing through `calculateAllowedCartQty` or clamping to available stock.
   - Because `handleBorrowSubmit` also omits validation, transactions with quantities far exceeding available stock can be submitted and approved, causing total allocated stock (`borrowedQty + damagedQty`) to exceed `totalQty`.
   - This invalidates the core stock boundary guarantee of Feature 5.

2. **Item Deletion Safety (Observation 1.3)**:
   - Requirement R1 and PROJECT.md mandate safe item deletion.
   - The test harness (`tests/helpers/testStorage.ts`) implemented a delete guard checking `if (item.borrowedQty > 0) return { success: false }`.
   - However, that guard was never ported to production code in `App.tsx` (`handleDeleteItem`) or `MemberMobileApp.tsx` (`handleConfirmDeleteItem`).
   - Consequently, users can delete items that have outstanding borrowings. When those items are later returned, the return approval cannot locate the inventory item, orphaning both unborrowed and returned stock.

3. **Item Editing Safeguards (Observation 1.4)**:
   - In `MemberMobileApp.tsx`, editing `totalQty` accepts any number >= 0.
   - Allowing `totalQty < borrowedQty` creates an inconsistent ledger where more items are out on loan than exist in the sanggar inventory.
   - Upon return, the returned stock does not restore the original inventory count, permanently destroying inventory records.

4. **CSV Export Security (Observation 1.5)**:
   - Requirement R1 includes CSV export. CSV export functions must protect users from formula injection (CWE-1236) when opening exported files in desktop spreadsheet tools.
   - Current escaping only wraps strings in double quotes. Double quotes are ignored by Excel when parsing formula cells (`="=1+1"` evaluates `=1+1`).
   - Leading characters in `['=', '+', '-', '@']` must be neutralized with a leading single quote (`'`).

5. **Storage Recovery Resilience (Observation 1.6)**:
   - Requirement R2 mandates robust offline local storage.
   - While syntax-error JSON triggers the `catch` fallback, non-array JSON (`"null"`, `"{}"`, `"123"`) successfully parses and bypasses the `catch` block.
   - Without `Array.isArray(parsed)`, state becomes non-iterable and crashes React rendering.

---

## 3. Caveats

- **Scope Boundary**: As Challenger, code modifications were strictly prohibited. All findings were demonstrated via code analysis and empirical reproduction harnesses.
- **Headless Environment**: Web Audio API oscillator calls in tests are mock-safe and do not impede functionality.
- **Pramuka MAN 11 Data Fidelity**: Initial sample data constants (`INITIAL_INVENTORY_ITEMS`, `INITIAL_MEMBERS`, `DEWAN_INVENTARIS_LIST`, `PRADANA_LIST`) are well-formed and accurate to Gudep 06.171–06.172.

---

## 4. Conclusion

Milestone 1 has solid foundations in layout, styling, Vite bundling, and basic happy-path unit tests. However, it cannot be approved in its current state due to critical boundary and resilience flaws:
1. Borrow cart UI allows bypassing available stock limits via Plus button and number input.
2. Actively borrowed items can be deleted in the UI and state, leading to permanent equipment orphaning.
3. Editing `totalQty` below `borrowedQty` is unconstrained and corrupts inventory counts upon return.
4. Exported CSV files lack formula injection protection (CWE-1236).
5. Non-array JSON in `localStorage` causes immediate application white-screen crash.

**Verdict: REQUEST_CHANGES**. The worker must implement the fixes detailed below before Milestone 1 sign-off.

### Required Changes for Worker:
1. **Fix Cart UI Stock Clamping (`src/components/MemberMobileApp.tsx`)**:
   - In the cart item quantity input and Plus button, look up the target item from `items` and clamp `qty` to `Math.min(getAvailableQty(item), targetVal)`.
   - In `handleBorrowSubmit`, verify that for every entry in `scannedCart`, `entry.qty <= getAvailableQty(item)`. If not, display `setFormError` and abort submission.
2. **Prevent Deletion of Actively Borrowed Items (`src/App.tsx` & `src/components/MemberMobileApp.tsx`)**:
   - In `src/App.tsx:handleDeleteItem`, verify `targetItem.borrowedQty === 0`. If `borrowedQty > 0`, reject the deletion (no-op or error alert).
   - In `MemberMobileApp.tsx`, when `deletingItem.borrowedQty > 0`, disable the "Ya, Hapus" button (e.g. `disabled`, opacity 50, cursor not-allowed) and display a clear message that items on loan cannot be deleted until returned.
3. **Constrain Item Edit totalQty (`src/components/MemberMobileApp.tsx`)**:
   - In `handleSaveEditItem`, enforce `editTotalQty >= editingItem.borrowedQty + editingItem.damagedQty`. If less, alert the user or clamp to `borrowedQty + damagedQty`.
4. **Sanitize Formula Injection in CSV Export (`src/utils/inventoryLogic.ts`)**:
   - In `escapeCsvCell`, if `str` begins with `=`, `+`, `-`, or `@`, prepend `'` (single quote) before escaping double quotes:
     `const sanitized = /^[=+\-@]/.test(str) ? "'" + str : str;`
5. **Harden LocalStorage Recovery (`src/App.tsx`)**:
   - In the state initializers for `items`, `members`, and `transactions`, validate `Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_*`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Cart Boundary Over-allocation**:
   ```bash
   npx tsx -e '
   import { getAvailableQty, type InventoryItem } from "./src/utils/inventoryLogic.ts";
   const item: InventoryItem = { id: "1", barcode: "BRG-1", name: "Tenda", category: "Tenda & Kemah", totalQty: 10, borrowedQty: 0, damagedQty: 4, condition: "Baik", location: "Rak", lastChecked: "2026-11-09", imageSvgType: "tent" };
   const cartQty = 10; // set via Plus button or input
   const updated = { ...item, borrowedQty: Math.min(item.totalQty, item.borrowedQty + cartQty) };
   console.log("Exceeds totalQty:", (updated.borrowedQty + updated.damagedQty) > updated.totalQty);
   '
   ```
   *Expected output*: `Exceeds totalQty: true`.

2. **Verify Borrowed Item Deletion via UI / App**:
   Inspect `src/components/MemberMobileApp.tsx:2748` and `src/App.tsx:229`. Notice that "Ya, Hapus" button is not disabled and `handleDeleteItem` executes unconditionally.

3. **Verify Formula Injection**:
   ```bash
   npx tsx -e '
   import { escapeCsvCell } from "./src/utils/inventoryLogic.ts";
   console.log(escapeCsvCell("=SUM(1,2)"));
   '
   ```
   *Expected output*: `"=SUM(1,2)"` (formula intact, unneutralized).

4. **Verify Storage Crash on "null" / "{}"**:
   ```bash
   node -e '
   const saved = "null";
   const items = saved ? JSON.parse(saved) : ["default"];
   console.log("Is array:", Array.isArray(items));
   try { items.filter(Boolean); } catch(e) { console.log("Crash:", e.message); }
   '
   ```
   *Expected output*: `Is array: false`, `Crash: Cannot read properties of null (reading "filter")`.
