# BRIEFING — 2026-11-10T00:52:00Z

## Mission
Investigate and formulate exact fix strategies for Cart Concurrency, Stock Boundary Clamping in Cart Controls, and Damaged Goods Accounting during return approval for Milestone 1 Remediation.

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, analysis, synthesis, remediation proposal
- Working directory: /home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_2
- Original parent: cab66b6a-fa2f-4170-85c4-0aae78691d64
- Milestone: Milestone 1 Remediation (Cart Concurrency & Quantity Controls)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code directly
- Strict evidence-based observations with exact file paths and line numbers
- Output comprehensive handoff report at `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_2/handoff.md`

## Current Parent
- Conversation ID: cab66b6a-fa2f-4170-85c4-0aae78691d64
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/components/MemberMobileApp.tsx` (lines 333-368, 426-488, 512-523, 1625-1700, 2270-2365)
  - `src/App.tsx` (lines 120-142, 160-170, 175-205)
  - `src/utils/inventoryLogic.ts` (lines 40-55, 194-200, 340-365)
  - `tests/helpers/testStorage.ts` (lines 240-300)
  - `tests/challenge_m1_2.test.ts` (CHALLENGE 3.1 & 3.2)
  - `tests/tier1_features.test.ts` (F6.1 - F6.4)
  - `tests/tier3_cross_features.test.ts` (C4)
  - `tests/tier4_real_world.test.ts` (Step 6)
- **Key findings**:
  1. In-cart controls (`MemberMobileApp.tsx:1656-1685`) hardcode `max={100}`, `+` increments unconditionally, and input does not clamp to `getAvailableQty(item)`. Furthermore, `handleBorrowSubmit` does not validate requested quantities against available stock.
  2. `handleAddScannedItem` evaluates `existing` outside `setScannedCart`, creating duplicate rows on rapid/simultaneous additions. When approved, `App.tsx:162` uses `.find(...)`, deducting only the first row and causing inventory under-deduction.
  3. Damaged goods are completely unhandled during return approval in production (`App.tsx:175-202`). When returns are approved, only `borrowedQty` is decremented; `damagedQty` is never incremented, incorrectly restoring damaged items into available loanable stock.
- **Unexplored areas**: None. All three defects thoroughly analyzed with empirical evidence and code locations.

## Key Decisions Made
- Architecture strategy:
  1. Provide pure helper `calculateReturnItemStock` in `src/utils/inventoryLogic.ts` to ensure 100% logic parity between production `App.tsx` and test helper `testStorage.ts`.
  2. Clamp both input and Plus button in cart UI strictly to `Math.min(maxAvail, ...)` and disable Plus when `qty >= maxAvail`.
  3. Add defense-in-depth cart item validation in `handleBorrowSubmit`.
  4. Use functional state updater with defensive deduplication in `setScannedCart` and sum all matching entries in `App.tsx:handleApproveBorrow` and `handleApproveReturn`.
  5. Support damaged goods tracking via `damagedCountByItemId` parameter and per-item `damagedQty` on `LoanItemEntry`.

## Artifact Index
- DISPATCH.md — Parent dispatch log
- progress.md — Liveness heartbeat and step tracker
- handoff.md — Final remediation handoff report
