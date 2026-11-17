import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MockLocalStorage,
  SiPrakaStateStore,
} from './helpers/testStorage';
import {
  getAvailableQty,
  calculateAllowedCartQty,
  isTransactionOverdue,
  findItemByBarcode,
  escapeCsvCell,
  createProofPhotoDataUrl,
  createSignatureDataUrl,
  formatIndonesianDate,
  type InventoryItem,
  type LoanTransaction,
  type ScoutMember,
} from '../src/utils/inventoryLogic';
import { INITIAL_INVENTORY_ITEMS } from '../src/data/seedData';

// ============================================================================
// TIER 2: BOUNDARY, CORNER & ADVERSARIAL STRESS CASES
// ============================================================================

test('B1: calculateAllowedCartQty strictly prevents adding item with 0 remaining stock', () => {
  // This verifies the fix for the critical survey bug: (maxAvail || 60) evaluating to 60 when maxAvail=0
  const outOfStockItem: InventoryItem = {
    id: 'item-oos-1',
    barcode: 'BRG-OOS-001',
    name: 'Tenda Habis',
    category: 'Tenda & Kemah',
    totalQty: 5,
    borrowedQty: 5,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Lemari B',
    lastChecked: '2026-11-09',
    imageSvgType: 'tent',
  };

  assert.equal(getAvailableQty(outOfStockItem), 0);
  const result = calculateAllowedCartQty(outOfStockItem, 0, 1);
  assert.equal(result.allowed, false);
  assert.equal(result.newQty, 0);
  assert.equal(result.maxAvail, 0);
  assert.ok(result.message?.includes('sedang habis'));
});

test('B2: calculateAllowedCartQty clamps cart additions exceeding available stock', () => {
  const item: InventoryItem = {
    id: 'item-clamp-1',
    barcode: 'BRG-CLAMP-001',
    name: 'Kompas Sisa Sedikit',
    category: 'Navigasi & Komlek',
    totalQty: 10,
    borrowedQty: 8,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Laci',
    lastChecked: '2026-11-09',
    imageSvgType: 'compass',
  }; // Available = 2

  // User attempts to add 5 units into cart
  const result = calculateAllowedCartQty(item, 0, 5);
  assert.equal(result.allowed, true);
  assert.equal(result.newQty, 2); // Clamped to available stock (2)
});

test('B3: calculateAllowedCartQty handles negative or zero qty additions safely', () => {
  const item: InventoryItem = {
    id: 'item-neg-1',
    barcode: 'BRG-NEG-001',
    name: 'Tongkat Uji Negatif',
    category: 'Tongkat & Pionering',
    totalQty: 20,
    borrowedQty: 5,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Rak',
    lastChecked: '2026-11-09',
    imageSvgType: 'stick',
  };

  // Adding -5 to cart of 3 should clamp at minimum 1
  const result = calculateAllowedCartQty(item, 3, -5);
  assert.equal(result.allowed, true);
  assert.equal(result.newQty, 1);
});

test('B4: exact millisecond boundary for isTransactionOverdue', () => {
  const dueDateStr = '2026-08-08T16:00:00.000Z';
  const dueMs = new Date(dueDateStr).getTime();
  const tx: Pick<LoanTransaction, 'status' | 'dueDate'> = {
    status: 'active_borrowed',
    dueDate: dueDateStr,
  };

  // 1ms before due date -> not overdue
  assert.equal(isTransactionOverdue(tx, dueMs - 1), false);
  // Exactly at due date -> not overdue (nowMs > dueMs required)
  assert.equal(isTransactionOverdue(tx, dueMs), false);
  // 1ms after due date -> strictly overdue
  assert.equal(isTransactionOverdue(tx, dueMs + 1), true);
});

test('B5: corrupted and malformed JSON in localStorage recovers cleanly to seed data', () => {
  const storage = new MockLocalStorage();
  // Simulate corrupted JSON in storage
  storage.setItem('sipraka_items_v3', '{corrupted:json-data!!');
  storage.setItem('sipraka_members_v3', '[unclosed array');
  storage.setItem('sipraka_tx_v3', 'null undefined');

  const store = new SiPrakaStateStore(storage);
  // Must gracefully fall back to initial seed data without crashing
  assert.equal(store.getItems().length, INITIAL_INVENTORY_ITEMS.length);
  assert.equal(store.getItems()[0].barcode, 'BRG-KBU-001');
  assert.equal(store.getMembers().length, 4);
  assert.equal(store.getTransactions().length, 5);
});

test('B6: empty inputs and whitespace handling in findItemByBarcode', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();

  assert.equal(findItemByBarcode(items, ''), undefined);
  assert.equal(findItemByBarcode(items, '   '), undefined);
  assert.equal(findItemByBarcode(items, '\t\n'), undefined);
  assert.equal(findItemByBarcode(items, 'NOT-FOUND-BARCODE-999'), undefined);
});

test('B7: single stock unit lifecycle: 1 -> 0 available -> 1 restored', () => {
  const store = new SiPrakaStateStore();
  const singleItem: InventoryItem = {
    id: 'item-single-stock',
    barcode: 'BRG-SINGLE-1',
    name: 'GPS Handheld Garmin (Hanya 1 Unit)',
    category: 'Navigasi & Komlek',
    totalQty: 1,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Brankas',
    lastChecked: '2026-11-09',
    imageSvgType: 'radio',
  };
  store.addNewItem(singleItem);
  assert.equal(getAvailableQty(singleItem), 1);

  // Borrow the only unit
  const member = store.getMembers()[0];
  const txId = 'TRX-SINGLE-1';
  store.createBorrowRequest({
    id: txId,
    memberId: member.id,
    memberName: member.name,
    memberKelas: member.kelas,
    memberJabatan: member.jabatan,
    memberSignature: member.signatureDataUrl,
    officerId: '',
    officerName: 'Menunggu ACC',
    officerSignature: '',
    pradanaName: 'Menunggu ACC',
    pradanaSignature: '',
    purpose: 'Navigasi Darat',
    borrowDate: '2026-11-10T08:00:00',
    dueDate: '2026-11-10T18:00:00',
    status: 'pending_borrow',
    items: [{ itemId: singleItem.id, barcode: singleItem.barcode, name: singleItem.name, qty: 1, conditionBefore: 'Baik' }],
    photoConditionBefore: '',
    photoHandoverBorrow: '',
  });

  store.approveBorrow(txId);
  const borrowedItem = store.getItemById(singleItem.id)!;
  assert.equal(getAvailableQty(borrowedItem), 0);

  // Return the unit
  store.submitReturnRequest(txId, 'Baik', '', '');
  store.approveReturn(txId);

  const returnedItem = store.getItemById(singleItem.id)!;
  assert.equal(getAvailableQty(returnedItem), 1);
  assert.equal(returnedItem.borrowedQty, 0);
});

test('B8: adversarial input: XML/XSS special characters in item and member names are safely escaped in SVG proof photos', () => {
  const maliciousName = '<script>alert("xss")</script> & "quotes" \'apostrophe\'';
  const maliciousItem = 'Tongkat <img src=x onerror=alert(1)>';
  const photoUrl = createProofPhotoDataUrl('before', maliciousItem, maliciousName, '2026-11-10');

  assert.ok(photoUrl.startsWith('data:image/svg+xml;utf8,'));
  const decoded = decodeURIComponent(photoUrl);

  // Ensure raw unescaped script tag does NOT exist in SVG text nodes
  assert.ok(!decoded.includes('<script>'));
  assert.ok(!decoded.includes('<img src=x'));
  // Ensure escaped XML entities are present
  assert.ok(decoded.includes('&lt;script&gt;'));
  assert.ok(decoded.includes('&amp;'));
  assert.ok(decoded.includes('&quot;quotes&quot;'));
});

test('B9: extreme stock values (large numbers, 0 totalQty) handled without NaN or overflow', () => {
  const hugeItem: InventoryItem = {
    id: 'item-huge',
    barcode: 'BRG-HUGE-1',
    name: 'Paku Tenda Massal',
    category: 'Tenda & Kemah',
    totalQty: 1_000_000,
    borrowedQty: 350_000,
    damagedQty: 50_000,
    condition: 'Baik',
    location: 'Gudang Utama',
    lastChecked: '2026-11-09',
    imageSvgType: 'tent',
  };
  assert.equal(getAvailableQty(hugeItem), 600_000);

  const zeroItem: InventoryItem = {
    id: 'item-zero-total',
    barcode: 'BRG-ZERO-1',
    name: 'Barang Kosong Total',
    category: 'Dapur',
    totalQty: 0,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'N/A',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  };
  assert.equal(getAvailableQty(zeroItem), 0);
});

test('B10: escapeCsvCell handles extreme complex payloads (quotes, tabs, CRLF, unicode)', () => {
  const complexPayload = 'Barang "Pramuka",\tModel Baru;\nCatatan: \r\n"Aman & Siap Pakai"';
  const escaped = escapeCsvCell(complexPayload);

  // Must start and end with quotes
  assert.ok(escaped.startsWith('"'));
  assert.ok(escaped.endsWith('"'));
  // All inner quotes must be doubled
  assert.ok(escaped.includes('""Pramuka""'));
  assert.ok(escaped.includes('""Aman & Siap Pakai""'));
});

test('B11: formatIndonesianDate handles invalid date inputs gracefully', () => {
  // If dateInput is invalid date string, it should return string fallback without crashing
  const result = formatIndonesianDate('invalid-date-string');
  assert.equal(result, 'invalid-date-string');
});

test('B12: safety check blocks deleting item with active loan even if multiple deletions attempted', () => {
  const store = new SiPrakaStateStore();
  const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;
  const targetItemId = activeTx.items[0].itemId;

  // First delete attempt should fail
  const res1 = store.deleteItem(targetItemId);
  assert.equal(res1.success, false);
  assert.ok(res1.error?.includes('currently on active loan'));

  // Second delete attempt should still fail and item remains intact
  const res2 = store.deleteItem(targetItemId);
  assert.equal(res2.success, false);
  assert.ok(store.getItemById(targetItemId));
});
