## 2026-11-10T00:54:44Z
You are Worker M1 Round 2 (Remediation Implementation for Milestone 1).
Your working directory is: /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/worker_m1_r2
Authoritative Request: /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/ORIGINAL_REQUEST.md
Project Specification: /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/PROJECT.md
Remediation Investigation Reports:
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_1/handoff.md
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_2/handoff.md
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_3/handoff.md
Review & Challenger Failure Reports:
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/reviewer_m1_2/handoff.md
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/challenger_m1_1/handoff.md
- /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/challenger_m1_2/handoff.md

Write Ownership:
You have exclusive write ownership over:
- src/App.tsx
- src/components/MemberMobileApp.tsx
- src/utils/inventoryLogic.ts
- src/utils/inventoryLogic.test.ts
- tests/helpers/testStorage.ts
DO NOT modify files outside your write ownership.

Tasks to Implement:
1. Item Deletion Safety Guard in Production Code:
   - In `src/App.tsx:handleDeleteItem`, block deletion if `item.borrowedQty > 0`.
   - In `src/components/MemberMobileApp.tsx`, if `deletingItem.borrowedQty > 0`, disable the "Ya, Hapus" button and display an Indonesian warning banner: "Barang tidak dapat dihapus selama masih ada unit yang dipinjam." Also guard in `handleConfirmDeleteItem`.
2. Edit Item Modal Total Stock Constraint:
   - In `src/components/MemberMobileApp.tsx`, set `min={editingItem.borrowedQty}` on the Total Qty input in the edit bottom sheet, show an inline warning if input < borrowedQty, and disable the save button if invalid.
   - In `src/App.tsx:handleEditItem`, defensively ensure `updatedItem.totalQty >= existing.borrowedQty`.
3. In-Cart Quantity Controls Clamping & Submission Validation:
   - In `src/components/MemberMobileApp.tsx` (around lines 1656–1685), clamp numeric `<input>` and `+` button in cart strictly to `Math.max(1, maxAvail)` where `maxAvail = getAvailableQty(invItem)`. Disable the `+` button when `cartQty >= maxAvail`.
   - In `handleBorrowSubmit`, re-validate that each cart entry quantity <= available stock of that item before submitting.
4. Cart Concurrency Functional Updater:
   - In `src/components/MemberMobileApp.tsx:handleAddScannedItem`, perform the existing item lookup and quantity addition inside `setScannedCart((prev) => ...)` functional updater to eliminate stale closure bugs and prevent duplicate cart rows.
   - In `src/App.tsx:handleApproveBorrow` and `handleApproveReturn`, aggregate all entries matching `inv.id` via `.filter().reduce()`.
5. Damaged Goods Accounting on Return:
   - In `src/utils/inventoryLogic.ts`, add `calculateReturnItemStock(item, returnedQty, damagedQtyToAdd)`.
   - In `src/App.tsx:handleApproveReturn`, accept optional damaged counts and properly increment `damagedQty` when damaged items are returned instead of returning them to available stock.
6. CSV Formula Injection Prevention (CWE-1236):
   - In `src/utils/inventoryLogic.ts:escapeCsvCell`, if the string begins with `=`, `+`, `-`, or `@`, prepend `'` (single quote) before wrapping in double quotes.
7. LocalStorage Non-Array JSON Parsing Guard:
   - In `src/App.tsx`, verify with `Array.isArray(parsed)` before setting state for `items`, `members`, and `transactions`, falling back cleanly to `INITIAL_*` if parsed data is not an array.
8. Verification & Tests:
   - Run `npm run lint` (`tsc --noEmit`).
   - Run `npx tsx --test src/utils/inventoryLogic.test.ts` (expand tests for the new helpers).
   - Run `npx tsx --test tests/*.test.ts` (confirm all 69 E2E tests pass).
   - Run `npm run build` (confirm clean build with `./assets/...`).
