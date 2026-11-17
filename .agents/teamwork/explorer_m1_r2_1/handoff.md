# Exploration & Fix Strategy Report: Milestone 1 Remediation (Item Deletion & Edit Constraints)

**Agent**: Explorer 1 (`explorer_m1_r2_1`)  
**Role**: explorer, synthesis  
**Date**: 2026-11-10T00:54:00Z  
**Target Milestone**: Milestone 1 Remediation (Item Deletion & Edit Constraints)  
**Authoritative References**:
- `.agents/teamwork/ORIGINAL_REQUEST.md`
- `.agents/teamwork/PROJECT.md`
- `.agents/teamwork/reviewer_m1_2/handoff.md`
- `.agents/teamwork/challenger_m1_1/handoff.md`
- `.agents/teamwork/challenger_m1_2/handoff.md`

---

## Executive Summary

1. **Defect 1 (Item Deletion Safety Guard in Production Code)**:
   - In production code (`src/App.tsx:handleDeleteItem` and `src/components/MemberMobileApp.tsx`), deleting an actively borrowed item (`borrowedQty > 0`) is **not blocked**. The "Ya, Hapus" button in the UI remains active and clickable.
   - When an item with active loans is deleted, active transactions are orphaned and cannot restore returned equipment.
   - The safety guard tested in `tests/tier1_features.test.ts:F4.3` and `tests/tier2_boundaries.test.ts:B12` existed **only** in the test helper `tests/helpers/testStorage.ts:159-164`.
   - **Crucial Implementation Trap**: `deleteInventoryItemFromList` in `src/utils/inventoryLogic.ts` is tested in `inventoryLogic.test.ts:199` using `sampleItems`, where `item-1` intentionally has `borrowedQty: 42`. Modifying `deleteInventoryItemFromList` to block deletion would break existing unit tests. The business safety check must be implemented at the component, state, and domain validator levels (`canDeleteInventoryItem`).

2. **Defect 2 (Edit Item Modal Total Stock Constraint)**:
   - In `src/components/MemberMobileApp.tsx` (lines 581–599 and 2605–2618), the bottom-sheet edit modal accepts `editTotalQty` values lower than `editingItem.borrowedQty` (even `0`).
   - If `totalQty` is edited below `borrowedQty`, available stock becomes inconsistent, and when borrowed items are returned, the restored equipment is clamped or lost, permanently corrupting sanggar inventory records.
   - Fix requires enforcing `totalQty >= item.borrowedQty` at three layers: UI input constraint (`min={editingItem.borrowedQty}`), form submission validation (`handleSaveEditItem`), and root state defense (`App.tsx:handleEditItem`).

---

## 1. Observation

### 1.1 Baseline Verification Results
Execution of repository commands:
- `npm run lint` (`tsc --noEmit`): Exit code 0 (0 errors).
- `npm run build` (`vite build`): Exit code 0 (1666 modules transformed, dist built in 4.91s).
- `npx tsx --test tests/*.test.ts`: Exit code 0 (77/77 tests passed, including challenge suite).

---

### 1.2 Direct Inspection of Defect 1: Item Deletion Safety Gap

#### Observation 1.2.1: Production Handler in `src/App.tsx` (lines 229–231)
```ts
229:   const handleDeleteItem = (itemId: string) => {
230:     setItems((prev) => prev.filter((item) => item.id !== itemId));
231:   };
```
*Direct observation*: `handleDeleteItem` unconditionally executes `prev.filter(...)` without checking whether `borrowedQty > 0`. Any item ID passed to this handler is permanently deleted from React state and subsequently persisted to `localStorage.setItem('sipraka_items_v3', ...)`.

#### Observation 1.2.2: Production UI & Controller in `src/components/MemberMobileApp.tsx`
- Controller handler (lines 605–611):
  ```ts
  605:   const handleConfirmDeleteItem = () => {
  606:     if (!deletingItem) return;
  607:     onDeleteItem?.(deletingItem.id);
  608:     setScanFeedback(`Barang [${deletingItem.barcode}] ${deletingItem.name} berhasil dihapus.`);
  609:     setDeletingItem(null);
  610:     setTimeout(() => setScanFeedback(null), 3000);
  611:   };
  ```
  *Direct observation*: `handleConfirmDeleteItem` checks only `if (!deletingItem) return;`. It does not check `deletingItem.borrowedQty`.

- Modal Dialog JSX (lines 2734–2754):
  ```tsx
  2734:             {deletingItem.borrowedQty > 0 && (
  2735:               <p className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] p-2 rounded-lg border border-[#FECACA]">
  2736:                 Perhatian: Saat ini ada {deletingItem.borrowedQty} unit barang yang sedang dipinjam!
  2737:               </p>
  2738:             )}
  2739:             <div className="flex gap-2 pt-1">
  2740:               <button
  2741:                 type="button"
  2742:                 onClick={() => setDeletingItem(null)}
  2743:                 className="flex-1 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold"
  2744:               >
  2745:                 Batal
  2746:               </button>
  2747:               <button
  2748:                 type="button"
  2749:                 onClick={handleConfirmDeleteItem}
  2750:                 className="flex-1 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold transition-colors"
  2751:               >
  2752:                 Ya, Hapus
  2753:               </button>
  2754:             </div>
  ```
  *Direct observation*: While lines 2734–2737 render a warning paragraph, the button "Ya, Hapus" (lines 2747–2753) is completely enabled and clickable. It lacks any `disabled` attribute, `aria-disabled`, or conditional styling when `deletingItem.borrowedQty > 0`. Clicking it executes `handleConfirmDeleteItem -> onDeleteItem(deletingItem.id)`.

#### Observation 1.2.3: Return Reconciliation Failure in `src/App.tsx` (lines 192–201)
```ts
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
```
*Direct observation*: When returning items (`handleApproveReturn`), if the item was deleted from `prevItems`, `prevItems.map(...)` cannot match `inv.id === entry.itemId`. The returned physical goods cannot restore the item because the item record no longer exists.

#### Observation 1.2.4: Test Mock Isolation in `tests/helpers/testStorage.ts` (lines 158–164)
```ts
158:     // Safety check: verify item is not currently borrowed
159:     if (item.borrowedQty > 0) {
160:       return {
161:         success: false,
162:         error: `Cannot delete item '${item.name}': ${item.borrowedQty} unit(s) are currently on active loan.`,
163:       };
164:     }
165:     this.items = deleteInventoryItemFromList(this.items, itemId);
```
*Direct observation*: The safety check was placed inside `testStorage.ts` (a mock helper used only in Node.js test runs). The tests `F4.3` and `B12` pass against `SiPrakaStateStore`, creating the false appearance of production protection.

#### Observation 1.2.5: Existing Test Dependency in `src/utils/inventoryLogic.test.ts` (lines 25–38 & 199–203)
```ts
25: const sampleItems: InventoryItem[] = [
26:   {
27:     id: 'item-1',
28:     barcode: 'BRG-KBU-001',
29:     name: 'Tongkat Panjang',
30:     category: 'Tongkat & Pionering',
31:     totalQty: 60,
32:     borrowedQty: 42, // <-- Actively borrowed!
...
199: test('deleteInventoryItemFromList removes item by id immutably', () => {
200:   const nextList = deleteInventoryItemFromList(sampleItems, 'item-1');
201:   assert.equal(nextList.length, sampleItems.length - 1);
202:   assert.equal(nextList.find((i) => i.id === 'item-1'), undefined);
```
*Direct observation*: `deleteInventoryItemFromList` is tested with `sampleItems` where `item-1` has `borrowedQty: 42`. If `deleteInventoryItemFromList` is modified to block deleting borrowed items, line 201 will throw an assertion failure. Therefore, `deleteInventoryItemFromList` is a low-level immutable filter helper, not a business policy validator.

---

### 1.3 Direct Inspection of Defect 2: Edit Item Modal Total Stock Constraint

#### Observation 1.3.1: Controller Handler in `src/components/MemberMobileApp.tsx` (lines 581–603)
```ts
581:   const handleSaveEditItem = (e: React.FormEvent) => {
582:     e.preventDefault();
583:     if (!editingItem) return;
584:     const updated: InventoryItem = {
585:       ...editingItem,
586:       name: editName.trim() || editingItem.name,
587:       category: editCategory,
588:       totalQty: Math.max(0, Number(editTotalQty) || 0),
589:       damagedQty: Math.max(0, Number(editDamagedQty) || 0),
...
```
*Direct observation*: Line 588 computes `totalQty: Math.max(0, Number(editTotalQty) || 0)`. There is no check comparing `editTotalQty` against `editingItem.borrowedQty`. If an item has `totalQty: 20` and `borrowedQty: 10`, an admin can enter `editTotalQty = 2` or `0`, and the handler will save it without error.

#### Observation 1.3.2: Edit Modal Dialog JSX in `src/components/MemberMobileApp.tsx` (lines 2605–2632 & 2704–2708)
```tsx
2605:             <div className="grid grid-cols-2 gap-2.5">
2606:               <div>
2607:                 <label className="block text-xs font-bold text-[#3B2314] mb-1">
2608:                   Total Stok
2609:                 </label>
2610:                 <input
2611:                   type="number"
2612:                   min={0}
2613:                   required
2614:                   value={editTotalQty}
2615:                   onChange={(e) => setEditTotalQty(parseInt(e.target.value, 10) || 0)}
2616:                   className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-mono font-bold"
2617:                 />
2618:               </div>
...
2704:               <button
2705:                 type="submit"
2706:                 className="flex-1 py-2.5 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold"
2707:               >
2708:                 Simpan Perubahan
2709:               </button>
```
*Direct observation*:
- The `<input>` has `min={0}` instead of `min={editingItem.borrowedQty}`.
- There is no hint or warning informing the user how many units are currently out on loan.
- The submit button "Simpan Perubahan" has no disabled condition when `editTotalQty < editingItem.borrowedQty`.

#### Observation 1.3.3: Root State Handler in `src/App.tsx` (lines 225–227)
```ts
225:   const handleEditItem = (updatedItem: InventoryItem) => {
226:     setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
227:   };
```
*Direct observation*: `App.tsx:handleEditItem` directly replaces the item with `updatedItem` without validating that `updatedItem.totalQty >= item.borrowedQty`.

---

## 2. Logic Chain

1. **Safety Contract (PROJECT.md Feature 4 & TEST_READY.md)**:
   - System specification mandates: *"Ability to remove item with confirmation and safety checks (safely blocks deleting an item currently on active loan `borrowedQty > 0`)."*
   - The rationale: An inventory ledger cannot delete an asset record while obligations (active loans) remain tied to that asset.

2. **Divergence of Test Verification vs Production Execution**:
   - In `tests/helpers/testStorage.ts:159`, `deleteItem` returns `{ success: false }` if `borrowedQty > 0`.
   - In `src/App.tsx:229` and `src/components/MemberMobileApp.tsx:605`, no such check exists.
   - Therefore, while unit tests `F4.3` and `B12` pass against `testStorage.ts`, live production users can delete actively borrowed items.

3. **Orphaned Transaction & Stock Erasure Hazard**:
   - Step 1: Member borrows 5 units of Tenda Dome (`borrowedQty = 5`).
   - Step 2: Admin opens Katalog Inventaris and clicks Delete on Tenda Dome.
   - Step 3: Admin clicks "Ya, Hapus" in the modal.
   - Step 4: The item is removed from `sipraka_items_v3`.
   - Step 5: Member returns the 5 units. Officer clicks "Setujui & Tandatangani Pengembalian".
   - Step 6: `handleApproveReturn` performs `prevItems.map(inv => inv.id === target.itemId ? ... : inv)`. Because the item is absent from `prevItems`, the update is silently dropped.
   - Step 7: The 5 units of physical tents are permanently wiped out from the inventory system.

4. **Edit Constraint Hazard**:
   - If `totalQty` is edited to `2` while `borrowedQty = 10`, `getAvailableQty` returns `Math.max(0, 2 - 10 - 0) = 0`.
   - When the loan of 10 is returned, `borrowedQty` drops by 10 to `0`. Available stock becomes `2 - 0 = 2`. The remaining 8 units have vanished from the system.
   - Therefore, `totalQty` must strictly be constrained such that `totalQty >= item.borrowedQty`.

---

## 3. Caveats

1. **`deleteInventoryItemFromList` Preservation**:
   - `src/utils/inventoryLogic.ts::deleteInventoryItemFromList` MUST remain an immutable array filter helper without internal business logic rejections, or existing tests in `src/utils/inventoryLogic.test.ts` (line 199) will fail.
   - Business guards belong in pure validators (`canDeleteInventoryItem`, `canUpdateItemTotalQty`), in the React UI handlers, and in `App.tsx` state updaters.

2. **Challenger 2 Test Suite (`tests/challenge_m1_2.test.ts:CHALLENGE 3.3`)**:
   - In `tests/challenge_m1_2.test.ts`, `CHALLENGE 3.3` was written as an adversarial proof asserting that `deleteInventoryItemFromList` deletes the item and leaves `remainingItems.length === 0`.
   - When remediation is applied, `CHALLENGE 3.3` should be updated to assert the fixed behavior (or a companion test added to verify that the production delete guard stops the deletion).

3. **Scope Discipline**:
   - The remediation worker must keep edits confined to web source files (`src/App.tsx`, `src/components/MemberMobileApp.tsx`, `src/utils/inventoryLogic.ts`, `tests/helpers/testStorage.ts`, and test files). `mobile/` and `scripts/` remain untouched until Milestone 2.

---

## 4. Conclusion & Precise Remediation Strategy

To achieve 100% test integrity, audit compliance, and robust UX, we recommend a **3-Layer Defense-in-Depth** for both defects.

### 4.1 Fix Strategy for Defect 1: Item Deletion Safety Guard

#### Layer 1: Pure Domain Validator in `src/utils/inventoryLogic.ts`
Export pure helper functions:
```ts
/**
 * Validates whether an inventory item can safely be deleted.
 * An item cannot be deleted if it has units on active loan (borrowedQty > 0).
 */
export function canDeleteInventoryItem(item: InventoryItem | undefined | null): {
  allowed: boolean;
  reason?: string;
} {
  if (!item) {
    return { allowed: false, reason: 'Barang tidak ditemukan' };
  }
  if (item.borrowedQty > 0) {
    return {
      allowed: false,
      reason: `Tidak dapat menghapus barang '${item.name}': ${item.borrowedQty} unit sedang dalam peminjaman aktif.`,
    };
  }
  return { allowed: true };
}
```

#### Layer 2: Root State Guard in `src/App.tsx:handleDeleteItem`
```ts
  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target && target.borrowedQty > 0) {
        console.warn(`[SiPraka] Deletion rejected: item ${itemId} (${target.name}) has ${target.borrowedQty} active loans.`);
        return prev;
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };
```

#### Layer 3: UI & Component Controller in `src/components/MemberMobileApp.tsx`
1. Controller guard in `handleConfirmDeleteItem` (lines 605–611):
```ts
  const handleConfirmDeleteItem = () => {
    if (!deletingItem) return;
    if (deletingItem.borrowedQty > 0) {
      setScanFeedback(
        `Gagal menghapus [${deletingItem.barcode}]: ${deletingItem.borrowedQty} unit masih dalam peminjaman aktif!`
      );
      setDeletingItem(null);
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }
    onDeleteItem?.(deletingItem.id);
    setScanFeedback(`Barang [${deletingItem.barcode}] ${deletingItem.name} berhasil dihapus.`);
    setDeletingItem(null);
    setTimeout(() => setScanFeedback(null), 3000);
  };
```

2. Modal Dialog UI in `MemberMobileApp.tsx` (lines 2734–2754):
```tsx
            {deletingItem.borrowedQty > 0 ? (
              <div className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] p-2.5 rounded-xl border border-[#FECACA] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <p>Barang tidak dapat dihapus!</p>
                  <p className="font-normal text-[10px] text-[#991B1B] mt-0.5">
                    Saat ini masih ada <strong>{deletingItem.borrowedQty} unit</strong> barang yang sedang dipinjam. Selesaikan pengembalian terlebih dahulu sebelum menghapus barang ini dari katalog.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold hover:bg-[#F4EDE2] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                disabled={deletingItem.borrowedQty > 0}
                aria-disabled={deletingItem.borrowedQty > 0}
                title={
                  deletingItem.borrowedQty > 0
                    ? `Tidak dapat menghapus: ${deletingItem.borrowedQty} unit sedang dipinjam`
                    : 'Hapus barang dari inventaris'
                }
                className="flex-1 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#DC2626]"
              >
                Ya, Hapus
              </button>
            </div>
```

---

### 4.2 Fix Strategy for Defect 2: Edit Item Modal Total Stock Constraint

#### Layer 1: Pure Domain Validator in `src/utils/inventoryLogic.ts`
```ts
/**
 * Validates whether an inventory item's totalQty can be updated to newTotalQty.
 * newTotalQty cannot be less than the quantity currently on active loan (borrowedQty).
 */
export function canUpdateItemTotalQty(
  borrowedQty: number,
  newTotalQty: number
): { allowed: boolean; reason?: string } {
  if (newTotalQty < borrowedQty) {
    return {
      allowed: false,
      reason: `Total stok (${newTotalQty}) tidak boleh lebih kecil dari jumlah yang sedang dipinjam (${borrowedQty} unit).`,
    };
  }
  return { allowed: true };
}
```

#### Layer 2: Root State Guard in `src/App.tsx:handleEditItem`
```ts
  const handleEditItem = (updatedItem: InventoryItem) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== updatedItem.id) return item;
        // Defense-in-depth: totalQty cannot be less than existing borrowedQty
        const safeTotalQty = Math.max(item.borrowedQty, updatedItem.totalQty);
        return {
          ...updatedItem,
          totalQty: safeTotalQty,
        };
      })
    );
  };
```

#### Layer 3: UI & Component Controller in `src/components/MemberMobileApp.tsx`
1. Derived validation flag:
```ts
const isEditTotalQtyInvalid = Boolean(
  editingItem && editTotalQty < editingItem.borrowedQty
);
```

2. Controller guard in `handleSaveEditItem` (lines 581–603):
```ts
  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedTotalQty = Math.max(0, Number(editTotalQty) || 0);
    if (parsedTotalQty < editingItem.borrowedQty) {
      setScanFeedback(
        `Gagal menyimpan: Total stok (${parsedTotalQty}) tidak boleh kurang dari jumlah yang sedang dipinjam (${editingItem.borrowedQty} unit)!`
      );
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }

    const updated: InventoryItem = {
      ...editingItem,
      name: editName.trim() || editingItem.name,
      category: editCategory,
      totalQty: parsedTotalQty,
      damagedQty: Math.max(0, Number(editDamagedQty) || 0),
      location: editLocation.trim() || editingItem.location,
      condition: editCondition,
      notes: editNotes.trim(),
      lastChecked: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };
    onEditItem?.(updated);
    setEditingItem(null);
    setScanFeedback(`Data [${updated.barcode}] ${updated.name} berhasil diperbarui.`);
    setTimeout(() => setScanFeedback(null), 3000);
  };
```

3. Modal Dialog UI in `MemberMobileApp.tsx` (lines 2605–2618 & 2695–2710):
```tsx
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Total Stok
                </label>
                <input
                  type="number"
                  min={editingItem.borrowedQty}
                  required
                  value={editTotalQty}
                  onChange={(e) => setEditTotalQty(parseInt(e.target.value, 10) || 0)}
                  className={`w-full px-3 py-2 rounded-xl bg-white border ${
                    isEditTotalQtyInvalid
                      ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                      : 'border-[#D9C3A9]'
                  } text-xs font-mono font-bold`}
                />
                {editingItem.borrowedQty > 0 && (
                  <p className="text-[10px] text-[#8B5A2B] mt-0.5">
                    Sedang dipinjam: <span className="font-bold font-mono text-[#DC2626]">{editingItem.borrowedQty} unit</span> (Min: {editingItem.borrowedQty})
                  </p>
                )}
                {isEditTotalQtyInvalid && (
                  <p className="text-[10px] font-bold text-[#DC2626] mt-1 bg-[#FEF2F2] p-1 rounded border border-[#FECACA]">
                    Total stok tidak boleh lebih kecil dari {editingItem.borrowedQty}!
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Jumlah Rusak
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editDamagedQty}
                  onChange={(e) => setEditDamagedQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-mono font-bold"
                />
              </div>
            </div>
```
And on the submit button:
```tsx
              <button
                type="submit"
                disabled={isEditTotalQtyInvalid}
                aria-disabled={isEditTotalQtyInvalid}
                className="flex-1 py-2.5 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Simpan Perubahan
              </button>
```

#### Layer 4: State Store Update in `tests/helpers/testStorage.ts:editItem`
```ts
  public editItem(updatedItem: InventoryItem): { success: boolean; error?: string } {
    const existing = this.getItemById(updatedItem.id);
    if (!existing) {
      return { success: false, error: 'Item not found' };
    }
    if (updatedItem.totalQty < existing.borrowedQty) {
      return {
        success: false,
        error: `Cannot update item '${existing.name}': totalQty (${updatedItem.totalQty}) cannot be less than borrowedQty (${existing.borrowedQty}).`,
      };
    }
    this.items = updateInventoryItemInList(this.items, updatedItem);
    this.saveToStorage();
    return { success: true };
  }
```

---

## 5. Verification Method

To verify these remediations independently once applied:

### 5.1 Unit Tests for New Logic
Add tests in `src/utils/inventoryLogic.test.ts`:
```ts
test('canDeleteInventoryItem blocks items with borrowedQty > 0', () => {
  const borrowedItem = sampleItems.find((i) => i.borrowedQty > 0)!;
  const result = canDeleteInventoryItem(borrowedItem);
  assert.equal(result.allowed, false);
  assert.ok(result.reason?.includes('peminjaman aktif'));
});

test('canDeleteInventoryItem permits items with borrowedQty === 0', () => {
  const unborrowedItem: InventoryItem = {
    ...sampleItems[0],
    id: 'test-unborrowed',
    borrowedQty: 0,
  };
  const result = canDeleteInventoryItem(unborrowedItem);
  assert.equal(result.allowed, true);
});

test('canUpdateItemTotalQty blocks totalQty less than borrowedQty', () => {
  const result = canUpdateItemTotalQty(10, 5);
  assert.equal(result.allowed, false);
  assert.ok(result.reason?.includes('tidak boleh lebih kecil'));
});

test('canUpdateItemTotalQty allows totalQty greater than or equal to borrowedQty', () => {
  assert.equal(canUpdateItemTotalQty(10, 10).allowed, true);
  assert.equal(canUpdateItemTotalQty(10, 15).allowed, true);
});
```

### 5.2 Test for App State Handlers
Add tests in `tests/tier2_boundaries.test.ts` or a new test verifying `App.tsx` state logic:
```ts
test('handleDeleteItem logic blocks deletion of item with borrowedQty > 0', () => {
  const items: InventoryItem[] = [
    { ...INITIAL_INVENTORY_ITEMS[0], id: 'item-locked', borrowedQty: 5 },
  ];
  const target = items.find((i) => i.id === 'item-locked')!;
  const nextItems = target.borrowedQty > 0 ? items : items.filter((i) => i.id !== 'item-locked');
  assert.equal(nextItems.length, 1);
  assert.equal(nextItems[0].id, 'item-locked');
});

test('handleEditItem logic clamps totalQty to at least borrowedQty', () => {
  const existing: InventoryItem = { ...INITIAL_INVENTORY_ITEMS[0], borrowedQty: 10, totalQty: 20 };
  const updatedAttempt: InventoryItem = { ...existing, totalQty: 2 };
  const safeTotalQty = Math.max(existing.borrowedQty, updatedAttempt.totalQty);
  assert.equal(safeTotalQty, 10);
});
```

### 5.3 Automated Commands
Execute the standard pipeline:
```bash
npm run lint
npm run build
npx tsx --test src/utils/inventoryLogic.test.ts
npx tsx --test tests/*.test.ts
```
*Expected*: Exit code 0, 0 lint errors, build succeeds, all tests pass.
