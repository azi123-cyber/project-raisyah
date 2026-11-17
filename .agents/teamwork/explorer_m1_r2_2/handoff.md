# Milestone 1 Remediation Analysis & Fix Strategy Report
## Subsystem: Cart Concurrency, Boundary Controls & Damaged Goods Accounting

**Agent**: Explorer 2 (`explorer_m1_r2_2`)  
**Role**: explorer, specialist  
**Target Milestone**: Milestone 1 Remediation (Web Features & Storage Core)  
**Date**: 2026-11-10  
**Working Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_2`  
**Target Files Analyzed**:
- `src/components/MemberMobileApp.tsx`
- `src/App.tsx`
- `src/utils/inventoryLogic.ts`
- `tests/helpers/testStorage.ts`
- `tests/challenge_m1_2.test.ts`
- `tests/tier1_features.test.ts`
- `tests/tier3_cross_features.test.ts`
- `tests/tier4_real_world.test.ts`

---

## Executive Summary

This investigation analyzed three targeted defect areas identified in reviewer and challenger reports for Milestone 1:
1. **Defect 1 (Cart Boundary Bypass)**: The in-cart numeric `<input>` and Plus (`+`) button in `MemberMobileApp.tsx:1656–1685` fail to clamp quantities to `getAvailableQty(item)`, allowing users to request stock beyond physical inventory limits.
2. **Defect 2 (Cart Concurrency & Duplicate Items)**: In `handleAddScannedItem` (`MemberMobileApp.tsx:333–368`), `existing` cart entry lookup is executed outside the `setScannedCart` updater callback, allowing rapid clicks or consecutive barcode scans to produce duplicate cart rows. Subsequently, `App.tsx:162` uses `.find(...)`, recognizing only the first entry and causing inventory under-deduction.
3. **Defect 3 (Damaged Goods Accounting on Return)**: In `App.tsx:175–205`, `handleApproveReturn` only decrements `borrowedQty`, leaving `damagedQty` unchanged. Damaged items returned from loans are improperly restored to available loanable stock. While `tests/helpers/testStorage.ts` accepted `damagedCountByItemId`, production `App.tsx` lacked this accounting, causing a critical parity gap.

Below is the complete evidence chain, logic deduction, concrete code patches (before/after), and independent verification instructions.

---

## 1. Observation

### 1.1 Tool Execution & Baseline State
The repository baseline passed standard compilation and test runs:
- `npm run lint` (`tsc --noEmit`): Exit code `0` (0 errors).
- `npx tsx --test src/utils/inventoryLogic.test.ts`: Exit code `0` (14/14 tests pass).
- `npx tsx --test tests/*.test.ts`: Exit code `0` (77/77 tests pass, including `challenge_m1_2.test.ts` which demonstrated the defects).

---

### 1.2 Direct Code Observations

#### Observation 1: In-Cart Quantity Controls Bypass Stock Boundaries
In `src/components/MemberMobileApp.tsx` (lines 1656–1685):
```tsx
1656:                         <input
1657:                           type="number"
1658:                           min={1}
1659:                           max={100}
1660:                           aria-label={`Jumlah ${entry.name}`}
1661:                           value={entry.qty}
1662:                           onChange={(e) => {
1663:                             const val = Math.max(1, parseInt(e.target.value, 10) || 1);
1664:                             setScannedCart((prev) =>
1665:                               prev.map((item) =>
1666:                                 item.itemId === entry.itemId ? { ...item, qty: val } : item
1667:                               )
1668:                             );
1669:                           }}
1670:                           className="w-12 text-center font-mono text-xs font-extrabold bg-white border border-[#D9C3A9] rounded-lg py-1"
1671:                         />
1672:                         <button
1673:                           type="button"
1674:                           aria-label={`Tambah jumlah ${entry.name}`}
1675:                           onClick={() =>
1676:                             setScannedCart((prev) =>
1677:                               prev.map((e) =>
1678:                                 e.itemId === entry.itemId ? { ...e, qty: e.qty + 1 } : e
1679:                               )
1680:                             )
1681:                           }
1682:                           className="w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314]"
1683:                         >
1684:                           <Plus className="w-3.5 h-3.5" />
1685:                         </button>
```
**Specific Deficiencies Observed**:
- Line 1659: `max={100}` is hardcoded regardless of available inventory.
- Line 1663: `onChange` clamps only the lower bound (`Math.max(1, ...)`). An arbitrary number up to 100 or beyond can be typed directly into the field.
- Line 1678: The `Plus` button increments `e.qty + 1` unconditionally without consulting `getAvailableQty(item)`.
- Line 1682: The `Plus` button is never disabled when remaining available stock is exhausted.
- Lines 426–440 (`handleBorrowSubmit`): There is no validation check verifying `entry.qty <= getAvailableQty(item)` before submitting the transaction.
- In `src/App.tsx:166`: Loan approval runs `borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + entry.qty)`. For an item with `totalQty: 10, damagedQty: 4` (available: 6), requesting 10 sets `borrowedQty: 10`, making `borrowedQty + damagedQty = 14 > 10`, corrupting physical stock ledgers.

---

#### Observation 2: Cart Addition Concurrency & Duplicate Items
In `src/components/MemberMobileApp.tsx` (lines 333–368):
```ts
333:   const handleAddScannedItem = (item: InventoryItem, qtyToAdd = 1) => {
334:     const existing = scannedCart.find((e) => e.itemId === item.id);
335:     const existingQty = existing ? existing.qty : 0;
336:     const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);
337: 
338:     if (!result.allowed) {
339:       setScanFeedback(
340:         result.message ||
341:           `Barang [${item.barcode}] ${item.name} sedang habis (stok 0) dan tidak dapat dipinjam.`
342:       );
343:       setTimeout(() => setScanFeedback(null), 3500);
344:       return;
345:     }
346: 
347:     setScannedCart((prev) => {
348:       if (existing) {
349:         return prev.map((e) =>
350:           e.itemId === item.id ? { ...e, qty: result.newQty } : e
351:         );
352:       }
353:       return [
354:         ...prev,
355:         {
356:           itemId: item.id,
357:           barcode: item.barcode,
358:           name: item.name,
359:           qty: result.newQty,
360:           conditionBefore: item.condition,
361:         },
362:       ];
363:     });
364:     setScanFeedback(
365:       `Barcode [${item.barcode}] ${item.name} (${result.newQty} unit) ditambahkan ke daftar pinjam.`
366:     );
367:     setTimeout(() => setScanFeedback(null), 3000);
368:   };
```
And in `src/App.tsx` (lines 160–169):
```ts
160:     setItems((prevItems) =>
161:       prevItems.map((inv) => {
162:         const entry = target.items.find((i) => i.itemId === inv.id);
163:         if (!entry) return inv;
164:         return {
165:           ...inv,
166:           borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + entry.qty),
167:         };
168:       })
169:     );
```
**Specific Deficiencies Observed**:
- In `handleAddScannedItem`, `existing` is inspected on line 334 from the component state closure variable `scannedCart`.
- If two rapid clicks occur (or duplicate scan inputs arrive from hardware before React completes re-rendering), both invocations see `existing === undefined` and compute `result.newQty = 1`.
- When the state updaters execute, the second updater appends a duplicate entry to `prev` rather than updating the existing row.
- In `App.tsx:162`, `target.items.find((i) => i.itemId === inv.id)` only returns the first matching cart row. Subsequent duplicate rows are dropped during stock decrement, resulting in inventory under-deduction.

---

#### Observation 3: Damaged Goods Accounting on Return Approval
In `src/App.tsx` (lines 175–205):
```ts
175:   const handleApproveReturn = (txId: string) => {
176:     const target = transactions.find((t) => t.id === txId);
177:     if (!target) return;
178: 
179:     const updatedTx: LoanTransaction = {
...
188:     };
189: 
190:     setTransactions((prev) => prev.map((t) => (t.id === txId ? updatedTx : t)));
191: 
192:     setItems((prevItems) =>
193:       prevItems.map((inv) => {
194:         const entry = target.items.find((i) => i.itemId === inv.id);
195:         if (!entry) return inv;
196:         return {
197:           ...inv,
198:           borrowedQty: Math.max(0, inv.borrowedQty - entry.qty),
199:         };
200:       })
201:     );
202: 
203:     setLetterModalTx(updatedTx);
204:     setLetterModalType('return');
205:   };
```
In contrast, in `tests/helpers/testStorage.ts` (lines 264–296):
```ts
264:   public approveReturn(
265:     txId: string,
266:     officer: DewanInventarisOfficer = DEWAN_INVENTARIS_LIST[0],
267:     pradana = PRADANA_LIST[0],
268:     damagedCountByItemId: Record<string, number> = {}
269:   ): LoanTransaction {
...
286:     // Restore stock (decrease borrowedQty), increment damagedQty if any damage reported
287:     this.items = this.items.map((inv) => {
288:       const entry = target.items.find((i) => i.itemId === inv.id);
289:       if (!entry) return inv;
290:       const damagedToAdd = damagedCountByItemId[inv.id] || 0;
291:       return {
292:         ...inv,
293:         borrowedQty: Math.max(0, inv.borrowedQty - entry.qty),
294:         damagedQty: inv.damagedQty + damagedToAdd,
295:       };
296:     });
```
**Specific Deficiencies Observed**:
- In production `App.tsx:175-202`, `handleApproveReturn` only accepts `txId`. It never accepts `damagedCountByItemId` or inspects per-item damage.
- Line 198 restores all units to available stock by solely reducing `borrowedQty`. `inv.damagedQty` is never incremented.
- In `src/components/MemberMobileApp.tsx:2270–2365` (return modal), the return form only captures a string `returnConditionText` ("Keterangan Kondisi Barang"), without providing per-item inputs for damaged unit counts.
- `tests/tier1_features.test.ts:579 (F6.4)`, `tests/tier3_cross_features.test.ts:214 (C4)`, and `tests/tier4_real_world.test.ts:191 (Step 6)` pass only because `testStorage.ts` accepts `damagedCountByItemId`. The production app cannot perform this accounting.

---

## 2. Logic Chain

1. **Premise 1 (Stock Boundaries in Cart)**: Feature 5 and Requirement R1 require that loans never exceed available inventory. `getAvailableQty(item) = Math.max(0, item.totalQty - item.borrowedQty - item.damagedQty)`.
2. **Inference 1**: While adding an item from the catalog checks `calculateAllowedCartQty`, once an item is in `scannedCart`, user interaction with the Plus button or numeric input modifies `qty` directly without consulting `getAvailableQty`. Therefore, members can submit loans for quantities exceeding available stock, leading to invalid inventory states (`borrowedQty + damagedQty > totalQty`).
3. **Premise 2 (State Updater Atomicity)**: In React, state updates queued from rapid events cannot inspect stale closure values outside the updater callback.
4. **Inference 2**: Because `existing` in `handleAddScannedItem` is computed from `scannedCart` instead of the updater's `prev` parameter, rapid scans or button clicks produce duplicate rows for the same `itemId`. When approved, `App.tsx:162` uses `.find(...)`, mutating only the first entry and ignoring subsequent entries, leading to inventory under-deduction.
5. **Premise 3 (Damaged Equipment Accounting)**: When borrowed items are damaged during scout activities, those units are no longer borrowed, but they are NOT available for immediate re-loan until repaired or maintained.
6. **Inference 3**: In `App.tsx:198`, decrementing `borrowedQty` without incrementing `damagedQty` increases `getAvailableQty` for damaged items. Physical broken equipment is erroneously returned to the active loan pool. Furthermore, the test suite (`F6.4`, `C4`) verified this behavior only against `testStorage.ts`, creating a critical discrepancy with production.

---

## 3. Caveats

- **Read-Only Scope**: Explorer 2 performed zero source modifications. All proposals below are designed for implementation by the remediation worker.
- **UI Ergonomics**: While damaged quantities can be passed programmatically via `damagedCountByItemId`, the mobile web UI should provide an intuitive per-item stepper/input within the return modal so officers and members can record damaged items directly from the device screen.

---

## 4. Conclusion & Concrete Fix Proposals

### Proposed Fix 1: In-Cart Quantity Clamping & Validation
**Target File**: `src/components/MemberMobileApp.tsx`

#### 1A. In Cart Row Render (`src/components/MemberMobileApp.tsx:1625–1700`):
Look up `invItem` from `items`, compute `maxAvail = invItem ? getAvailableQty(invItem) : entry.qty`, clamp input changes, and disable the Plus button when `entry.qty >= maxAvail`:

```tsx
<<<< BEFORE (lines 1656–1685):
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
====
>>>> AFTER:
{(() => {
  const invItem = items.find((i) => i.id === entry.itemId);
  const maxAvail = invItem ? getAvailableQty(invItem) : entry.qty;
  const isAtMax = entry.qty >= maxAvail;
  const isAtMin = entry.qty <= 1;

  return (
    <>
      <button
        type="button"
        aria-label={`Kurangi jumlah ${entry.name}`}
        disabled={isAtMin}
        onClick={() =>
          setScannedCart((prev) =>
            prev.map((e) =>
              e.itemId === entry.itemId
                ? { ...e, qty: Math.max(1, e.qty - 1) }
                : e
            )
          )
        }
        className={`w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314] ${
          isAtMin ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EBDBC9]'
        }`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        min={1}
        max={Math.max(1, maxAvail)}
        aria-label={`Jumlah ${entry.name}`}
        value={entry.qty}
        onChange={(e) => {
          const rawVal = parseInt(e.target.value, 10);
          const parsedVal = isNaN(rawVal) ? 1 : rawVal;
          const clampedVal = Math.min(Math.max(1, maxAvail), Math.max(1, parsedVal));
          setScannedCart((prev) =>
            prev.map((item) =>
              item.itemId === entry.itemId ? { ...item, qty: clampedVal } : item
            )
          );
        }}
        className="w-12 text-center font-mono text-xs font-extrabold bg-white border border-[#D9C3A9] rounded-lg py-1 focus:ring-1 focus:ring-[#8B5A2B] outline-none"
      />
      <button
        type="button"
        aria-label={`Tambah jumlah ${entry.name}`}
        disabled={isAtMax}
        onClick={() =>
          setScannedCart((prev) =>
            prev.map((e) => {
              if (e.itemId !== entry.itemId) return e;
              const nextQty = Math.min(Math.max(1, maxAvail), e.qty + 1);
              return { ...e, qty: nextQty };
            })
          )
        }
        className={`w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314] ${
          isAtMax ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EBDBC9]'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </>
  );
})()}
<<<<
```

#### 1B. In Submission Validation (`src/components/MemberMobileApp.tsx:426–440`):
Add strict stock limit verification before creating the borrow transaction:
```tsx
    for (const entry of scannedCart) {
      const invItem = items.find((i) => i.id === entry.itemId);
      const maxAvail = invItem ? getAvailableQty(invItem) : 0;
      if (!invItem || maxAvail <= 0) {
        setFormError(
          `Barang [${entry.barcode}] ${entry.name} saat ini tidak tersedia untuk dipinjam.`
        );
        return;
      }
      if (entry.qty > maxAvail) {
        setFormError(
          `Jumlah peminjaman [${entry.barcode}] ${entry.name} (${entry.qty} unit) melebihi stok yang tersedia (${maxAvail} unit).`
        );
        return;
      }
    }
```

---

### Proposed Fix 2: Concurrency Hardening & Cart Deduplication
**Target Files**: `src/components/MemberMobileApp.tsx` and `src/App.tsx`

#### 2A. In `MemberMobileApp.tsx:handleAddScannedItem` (lines 333–368):
Compute existing item counts inside `setScannedCart((prev) => ...)` and merge duplicates:
```ts
<<<< BEFORE:
  const handleAddScannedItem = (item: InventoryItem, qtyToAdd = 1) => {
    const existing = scannedCart.find((e) => e.itemId === item.id);
    const existingQty = existing ? existing.qty : 0;
    const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);

    if (!result.allowed) {
      setScanFeedback(
        result.message ||
          `Barang [${item.barcode}] ${item.name} sedang habis (stok 0) dan tidak dapat dipinjam.`
      );
      setTimeout(() => setScanFeedback(null), 3500);
      return;
    }

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
====
>>>> AFTER:
  const handleAddScannedItem = (item: InventoryItem, qtyToAdd = 1) => {
    const currentMax = getAvailableQty(item);
    if (currentMax <= 0) {
      setScanFeedback(
        `Barang [${item.barcode}] ${item.name} sedang habis (stok 0) dan tidak dapat dipinjam.`
      );
      setTimeout(() => setScanFeedback(null), 3500);
      return;
    }

    let feedbackMessage = '';

    setScannedCart((prev) => {
      const existingEntries = prev.filter((e) => e.itemId === item.id);
      const existingQty = existingEntries.reduce((sum, e) => sum + e.qty, 0);

      const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);

      if (!result.allowed) {
        feedbackMessage =
          result.message ||
          `Barang [${item.barcode}] ${item.name} tidak mencukupi untuk dipinjam lagi.`;
        return prev;
      }

      if (existingQty >= result.maxAvail && result.newQty === existingQty) {
        feedbackMessage = `Jumlah [${item.barcode}] ${item.name} sudah mencapai batas stok maksimal (${result.maxAvail} unit).`;
      } else {
        feedbackMessage = `Barcode [${item.barcode}] ${item.name} (${result.newQty} unit) ditambahkan ke daftar pinjam.`;
      }

      const existingIdx = prev.findIndex((e) => e.itemId === item.id);
      if (existingIdx >= 0) {
        const withoutDuplicates = prev.filter(
          (e, idx) => idx === existingIdx || e.itemId !== item.id
        );
        return withoutDuplicates.map((e) =>
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

    if (feedbackMessage) {
      setScanFeedback(feedbackMessage);
      setTimeout(() => setScanFeedback(null), 3000);
    }
  };
<<<<
```

#### 2B. In `src/App.tsx:handleApproveBorrow` & `handleApproveReturn`:
Sum all entries matching `inv.id` to prevent under-deduction if duplicate rows ever appear:
```ts
// In handleApproveBorrow (src/App.tsx:160–169):
setItems((prevItems) =>
  prevItems.map((inv) => {
    const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
    if (matchingEntries.length === 0) return inv;
    const totalQtyToBorrow = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
    return {
      ...inv,
      borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + totalQtyToBorrow),
    };
  })
);
```

---

### Proposed Fix 3: Damaged Goods Accounting on Return Approval
**Target Files**: `src/utils/inventoryLogic.ts`, `src/App.tsx`, and `src/components/MemberMobileApp.tsx`

#### 3A. In `src/utils/inventoryLogic.ts`:
1. Extend `LoanItemEntry` to support optional `damagedQty?: number`:
```ts
export interface LoanItemEntry {
  itemId: string;
  barcode: string;
  name: string;
  qty: number;
  conditionBefore: string;
  conditionAfter?: string;
  damagedQty?: number;
}
```

2. Add pure stock accounting helper `calculateReturnItemStock`:
```ts
/**
 * Calculates updated inventory counts upon return approval.
 * Accurately decrements borrowedQty and increments damagedQty.
 */
export function calculateReturnItemStock(
  item: InventoryItem,
  returnedQty: number,
  damagedQtyToAdd = 0
): { borrowedQty: number; damagedQty: number } {
  const newBorrowedQty = Math.max(0, item.borrowedQty - returnedQty);
  const safeDamagedToAdd = Math.max(0, Math.min(returnedQty, damagedQtyToAdd));
  const newDamagedQty = Math.min(
    item.totalQty - newBorrowedQty,
    item.damagedQty + safeDamagedToAdd
  );
  return {
    borrowedQty: newBorrowedQty,
    damagedQty: newDamagedQty,
  };
}
```

#### 3B. In `src/App.tsx:handleApproveReturn`:
Support damaged item accounting via optional parameter `damagedCountByItemId: Record<string, number> = {}` AND from `LoanItemEntry.damagedQty`:
```ts
<<<< BEFORE (src/App.tsx:175–202):
  const handleApproveReturn = (txId: string) => {
    ...
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
====
>>>> AFTER:
  const handleApproveReturn = (
    txId: string,
    damagedCountByItemId: Record<string, number> = {}
  ) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;

    const updatedTx: LoanTransaction = {
      ...target,
      status: 'returned',
      returnDate: target.returnDate || new Date().toISOString().slice(0, 16),
      officerId: activeOfficer.id,
      officerName: activeOfficer.name,
      officerSignature: activeOfficer.signatureDataUrl,
      pradanaName: activePradana.name,
      pradanaSignature: activePradana.signatureDataUrl,
    };

    setTransactions((prev) => prev.map((t) => (t.id === txId ? updatedTx : t)));

    setItems((prevItems) =>
      prevItems.map((inv) => {
        const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
        if (matchingEntries.length === 0) return inv;

        const totalReturned = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
        const fromEntries = matchingEntries.reduce((sum, i) => sum + (i.damagedQty || 0), 0);
        const explicitDamaged = damagedCountByItemId?.[inv.id];
        const damagedToAdd = explicitDamaged !== undefined ? explicitDamaged : fromEntries;

        const { borrowedQty, damagedQty } = calculateReturnItemStock(
          inv,
          totalReturned,
          damagedToAdd
        );

        return {
          ...inv,
          borrowedQty,
          damagedQty,
        };
      })
    );

    setLetterModalTx(updatedTx);
    setLetterModalType('return');
  };
<<<<
```

#### 3C. In `MemberMobileApp.tsx` (Return Modal UI):
In the return modal (`returningTx`), allow specifying damaged units per item:
```tsx
{returningTx.items.map((item) => (
  <div key={item.itemId} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#D9C3A9]">
    <div className="text-xs">
      <p className="font-extrabold text-[#2A1810]">{item.name}</p>
      <p className="text-[10px] text-[#8B5A2B]">Dipinjam: {item.qty} unit</p>
    </div>
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] font-bold text-[#DC2626]">Rusak:</label>
      <input
        type="number"
        min={0}
        max={item.qty}
        value={returnDamagedCounts[item.itemId] || 0}
        onChange={(e) => {
          const val = Math.max(0, Math.min(item.qty, parseInt(e.target.value, 10) || 0));
          setReturnDamagedCounts((prev) => ({ ...prev, [item.itemId]: val }));
        }}
        className="w-12 text-center text-xs font-mono font-bold border border-[#D9C3A9] rounded py-0.5"
      />
    </div>
  </div>
))}
```
When submitting:
```ts
onSubmitReturnRequest(
  returningTx.id,
  returnConditionText,
  returnPhotoAfter,
  returnPhotoHandover,
  returnDamagedCounts
);
```
And update `handleSubmitReturnRequest` in `App.tsx`:
```ts
const handleSubmitReturnRequest = (
  txId: string,
  conditionAfter: string,
  photoAfter: string,
  photoHandoverReturn: string,
  damagedCounts: Record<string, number> = {}
) => {
  setTransactions((prev) =>
    prev.map((tx) => {
      if (tx.id !== txId) return tx;
      return {
        ...tx,
        status: 'pending_return',
        returnDate: new Date().toISOString().slice(0, 16),
        photoConditionAfter: photoAfter,
        photoHandoverReturn,
        items: tx.items.map((item) => ({
          ...item,
          conditionAfter,
          damagedQty: damagedCounts[item.itemId] || 0,
        })),
      };
    })
  );
};
```

---

## 5. Verification Method

To independently verify all three remediations:

1. **Verify In-Cart Stock Boundary Clamping**:
   ```bash
   npx tsx -e '
   import { getAvailableQty, type InventoryItem } from "./src/utils/inventoryLogic.ts";
   const item: InventoryItem = { id: "1", barcode: "BRG-1", name: "Tenda", category: "Tenda & Kemah", totalQty: 10, borrowedQty: 2, damagedQty: 4, condition: "Baik", location: "Rak", lastChecked: "2026-11-09" };
   const maxAvail = getAvailableQty(item); // 10 - 2 - 4 = 4
   console.log("Calculated maxAvail:", maxAvail);
   // Simulated input: user attempts to type 50
   const typedVal = 50;
   const clampedInput = Math.min(maxAvail, Math.max(1, typedVal));
   console.log("Clamped Input value:", clampedInput);
   // Simulated Plus button:
   const currentQty = 4;
   const nextQty = Math.min(maxAvail, currentQty + 1);
   console.log("Plus click at max:", nextQty === maxAvail);
   '
   ```
   *Expected output*: `Calculated maxAvail: 4`, `Clamped Input value: 4`, `Plus click at max: true`.

2. **Verify Concurrency Functional Updater Deduplication**:
   ```bash
   npx tsx -e '
   import { calculateAllowedCartQty, type InventoryItem } from "./src/utils/inventoryLogic.ts";
   const item: InventoryItem = { id: "item-1", barcode: "BRG-1", name: "Tongkat", category: "Tongkat & Pionering", totalQty: 10, borrowedQty: 0, damagedQty: 0, condition: "Baik", location: "Rak", lastChecked: "2026-11-09" };
   let cart: any[] = [];
   function addItem(prev: any[], qtyToAdd: number) {
     const existingQty = prev.filter(e => e.itemId === item.id).reduce((s, e) => s + e.qty, 0);
     const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);
     const without = prev.filter(e => e.itemId !== item.id);
     return [...without, { itemId: item.id, qty: result.newQty }];
   }
   // Two rapid concurrent additions:
   cart = addItem(cart, 1);
   cart = addItem(cart, 1);
   console.log("Cart length:", cart.length);
   console.log("Aggregated qty:", cart[0].qty);
   '
   ```
   *Expected output*: `Cart length: 1`, `Aggregated qty: 2`.

3. **Verify Damaged Goods Return Accounting**:
   ```bash
   npx tsx -e '
   import { calculateReturnItemStock, getAvailableQty, type InventoryItem } from "./src/utils/inventoryLogic.ts";
   const item: InventoryItem = { id: "item-1", barcode: "BRG-1", name: "Kompas", category: "Navigasi & Komlek", totalQty: 5, borrowedQty: 2, damagedQty: 0, condition: "Baik", location: "Rak", lastChecked: "2026-11-09" };
   // Borrower returns 2 units, 1 unit is damaged:
   const res = calculateReturnItemStock(item, 2, 1);
   const updated = { ...item, ...res };
   console.log("borrowedQty after return:", updated.borrowedQty); // 0
   console.log("damagedQty after return:", updated.damagedQty);   // 1
   console.log("availableQty after return:", getAvailableQty(updated)); // 5 - 0 - 1 = 4
   '
   ```
   *Expected output*: `borrowedQty after return: 0`, `damagedQty after return: 1`, `availableQty after return: 4`.

4. **Run Full Test Suites**:
   ```bash
   npm run lint
   npm run build
   npx tsx --test src/utils/inventoryLogic.test.ts
   npx tsx --test tests/*.test.ts
   ```
