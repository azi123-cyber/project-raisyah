# Test Infrastructure — SiPraka Inventory System (Pramuka MAN 11 Jakarta)

## 1. Overview & Test Harness Architecture

The SiPraka test suite provides a comprehensive, requirement-driven, opaque-box test framework executing against the core business logic, persistence contracts, domain validations, and official Ambalan document generations of SiPraka.

- **Test Framework**: Native Node.js test runner (`node:test`) and strict assertion library (`node:assert/strict`).
- **Execution Engine**: `tsx` TypeScript executor (`npx tsx --test`). Zero external test dependencies required; runs natively on Node.js 22+.
- **Execution Performance**: 69 test cases executed in ~2.4 seconds with zero flakiness.

---

## 2. Directory Layout

```
tests/
├── helpers/
│   └── testStorage.ts           # MockLocalStorage & SiPrakaStateStore headless controller
├── tier1_features.test.ts       # Tier 1: Feature Coverage (51 test cases across 10 core features)
├── tier2_boundaries.test.ts     # Tier 2: Boundary, Corner & Adversarial cases (12 test cases)
├── tier3_cross_features.test.ts # Tier 3: Multi-step cross-feature integrations (5 test cases)
└── tier4_real_world.test.ts     # Tier 4: Real-world MAN 11 Kemah Pelantikan scenario (1 end-to-end scenario)
```

---

## 3. Test Runner Invocations

### Complete Test Suite
```bash
npx tsx --test tests/*.test.ts
```

### Running Individual Tiers
```bash
# Tier 1: Feature Coverage
npx tsx --test tests/tier1_features.test.ts

# Tier 2: Boundary & Corner Cases
npx tsx --test tests/tier2_boundaries.test.ts

# Tier 3: Cross-Feature Combinations
npx tsx --test tests/tier3_cross_features.test.ts

# Tier 4: Real-World MAN 11 Scenario
npx tsx --test tests/tier4_real_world.test.ts

# Domain Unit Tests
npx tsx --test src/utils/inventoryLogic.test.ts
```

---

## 4. Test Infrastructure Components

### 4.1 MockLocalStorage
Implements the HTML5 Web Storage API (`getItem`, `setItem`, `removeItem`, `clear`, `key`, `length`) in memory. It verifies data persistence, quota behavior, and graceful recovery when invalid/corrupted JSON is encountered.

### 4.2 SiPrakaStateStore
A headless state machine modeling the state transitions and storage contracts defined in `PROJECT.md`:
- `sipraka_items_v3`: `InventoryItem[]`
- `sipraka_members_v3`: `ScoutMember[]`
- `sipraka_tx_v3`: `LoanTransaction[]`

Operations supported:
- Catalog querying & stock calculation (`getAvailableQty`, `findItemByBarcode`)
- Item mutations (`addNewItem`, `editItem`, `deleteItem` with loan safety guards)
- Member mutations (`registerMember` with NIA validation, `updateMember` with transaction cascading)
- Loan lifecycle (`createBorrowRequest`, `approveBorrow`, `rejectTransaction`, `submitReturnRequest`, `approveReturn`, `triggerMemberAlarm`)
- Seed data recovery & reset (`resetToSeedData`)

---

## 5. 4-Tier Test Coverage Matrix

| Tier | Category | Test Cases | Scope / Description |
|---|---|---|---|
| **Tier 1** | **Feature Coverage** | 51 tests | >= 5 test cases per feature across 10 features:<br>1. Item Catalog & Stock Calculation (6 tests)<br>2. Add Item (5 tests)<br>3. Edit Item (5 tests)<br>4. Delete Item (5 tests)<br>5. Borrow Flow (5 tests)<br>6. Return Flow (5 tests)<br>7. Member Management (5 tests)<br>8. Overdue Detection & Alarm (5 tests)<br>9. Export CSV & Document Generation (5 tests)<br>10. Seed Persistence & Reset (5 tests) |
| **Tier 2** | **Boundary & Corner Cases** | 12 tests | Out-of-stock items (`maxAvail === 0` prevention), negative/clamped additions, exact millisecond deadline comparisons, corrupted JSON recovery, empty/whitespace inputs, single-stock unit cycles, XML/XSS escaping in SVG photos, extreme values (1M units), RFC 4180 complex escaping, active-loan deletion guards. |
| **Tier 3** | **Cross-Feature Combinations** | 5 tests | Multi-category borrowing & partial return stock verification; Member registration -> borrow -> edit profile cascading; Edit/delete safety during active loans; Overdue alarm -> return with damaged items -> stock accounting; Multiple officer & pradana approvals with distinct SVG signatures. |
| **Tier 4** | **Real-World MAN 11 Scenarios** | 1 scenario | End-to-end Pramuka MAN 11 Jakarta "Kemah Pelantikan Bantara 2026 di Buperta Cibubur":<br>5-item multi-category borrowing package (Tongkat, Tenda, Kompas, Cooking Set, Kompor), dual proof photo generation, Dewan Inventaris & Pradana approval, Hal 1 official letter generation, return with 1 damaged Tongkat, return approval & stock accounting, Hal 2 official letter generation, CSV export audit, and storage reload verification. |
| **Total** | | **69 tests** | **100% Pass Rate** |
