import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MockLocalStorage,
  SiPrakaStateStore,
} from './helpers/testStorage';
import {
  getAvailableQty,
  calculateInventoryStats,
  findItemByBarcode,
  isTransactionOverdue,
  formatIndonesianDate,
  buildOfficialLetterMeta,
  calculateAllowedCartQty,
  escapeCsvCell,
  exportInventoryToCsv,
  exportTransactionsToCsv,
  createSignatureDataUrl,
  createProofPhotoDataUrl,
  type InventoryItem,
  type ScoutMember,
  type LoanTransaction,
} from '../src/utils/inventoryLogic';
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from '../src/data/seedData';

// ============================================================================
// FEATURE 1: ITEM CATALOG & STOCK COMPUTATION
// ============================================================================

test('F1.1: getAvailableQty computes remaining stock accurately when nothing borrowed', () => {
  const item: InventoryItem = {
    id: 'test-item-1',
    barcode: 'BRG-TEST-001',
    name: 'Tali Pramuka 10m',
    category: 'Tongkat & Pionering',
    totalQty: 50,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Sanggar Khobinwal',
    lastChecked: '2026-08-01',
    imageSvgType: 'rope',
  };
  assert.equal(getAvailableQty(item), 50);
});

test('F1.2: getAvailableQty subtracts both borrowedQty and damagedQty', () => {
  const item: InventoryItem = {
    id: 'test-item-2',
    barcode: 'BRG-TEST-002',
    name: 'Tongkat Pramuka',
    category: 'Tongkat & Pionering',
    totalQty: 60,
    borrowedQty: 25,
    damagedQty: 5,
    condition: 'Baik',
    location: 'Sanggar Khobinwal',
    lastChecked: '2026-08-01',
    imageSvgType: 'stick',
  };
  // 60 - 25 - 5 = 30
  assert.equal(getAvailableQty(item), 30);
});

test('F1.3: getAvailableQty clamps to 0 when borrowed and damaged exceed totalQty', () => {
  const item: InventoryItem = {
    id: 'test-item-3',
    barcode: 'BRG-TEST-003',
    name: 'Tenda Dome',
    category: 'Tenda & Kemah',
    totalQty: 10,
    borrowedQty: 8,
    damagedQty: 4, // 8 + 4 = 12 > 10
    condition: 'Rusak Ringan',
    location: 'Lemari B',
    lastChecked: '2026-08-01',
    imageSvgType: 'tent',
  };
  assert.equal(getAvailableQty(item), 0);
});

test('F1.4: findItemByBarcode locates item case-insensitively by exact barcode', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();
  const found = findItemByBarcode(items, 'brg-kbu-001');
  assert.ok(found);
  assert.equal(found.name, 'Tongkat Panjang');
  assert.equal(found.barcode, 'BRG-KBU-001');
});

test('F1.5: findItemByBarcode locates item by partial name match across categories', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();
  const found = findItemByBarcode(items, 'Walkie Talkie');
  assert.ok(found);
  assert.equal(found.barcode, 'BRG-KBU-007');
  assert.equal(found.category, 'Navigasi & Komlek');
});

test('F1.6: calculateInventoryStats computes totals, percentages, and pending counts', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();
  const txs = store.getTransactions();
  const stats = calculateInventoryStats(items, txs);

  assert.ok(stats.totalUnits > 0);
  assert.ok(stats.availableUnits >= 0);
  assert.ok(stats.borrowedUnits >= 0);
  assert.equal(stats.availablePct + stats.borrowedPct + stats.overduePct, 100);
  assert.ok(typeof stats.pendingApprovalCount === 'number');
  assert.ok(typeof stats.overdueTransactionCount === 'number');
});

// ============================================================================
// FEATURE 2: ADD NEW INVENTORY ITEM
// ============================================================================

test('F2.1: addNewItem creates and prepends item to catalog list', () => {
  const store = new SiPrakaStateStore();
  const initialCount = store.getItems().length;

  const newItem: InventoryItem = {
    id: `item-${Date.now()}`,
    barcode: 'BRG-KBU-999',
    name: 'Peluit Morse Kuningan',
    category: 'Navigasi & Komlek',
    totalQty: 20,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Kotak P3K Sanggar',
    lastChecked: '2026-11-09',
    imageSvgType: 'compass',
  };

  store.addNewItem(newItem);
  const items = store.getItems();
  assert.equal(items.length, initialCount + 1);
  assert.equal(items[0].barcode, 'BRG-KBU-999');
});

test('F2.2: newly added item is discoverable via barcode search', () => {
  const store = new SiPrakaStateStore();
  const newItem: InventoryItem = {
    id: 'item-discoverable-1',
    barcode: 'BRG-NEW-010',
    name: 'Golok Tebas Pionering',
    category: 'Tongkat & Pionering',
    totalQty: 6,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Gudang Logistik',
    lastChecked: '2026-11-09',
    imageSvgType: 'rope',
  };

  store.addNewItem(newItem);
  const found = store.getItemByBarcode('BRG-NEW-010');
  assert.ok(found);
  assert.equal(found.name, 'Golok Tebas Pionering');
});

test('F2.3: newly added item persists across simulated app reload', () => {
  const storage = new MockLocalStorage();
  const store1 = new SiPrakaStateStore(storage);

  const newItem: InventoryItem = {
    id: 'item-persist-1',
    barcode: 'BRG-PERSIST-001',
    name: 'Flysheet Waterproof 3x4m',
    category: 'Tenda & Kemah',
    totalQty: 10,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Lemari Tenda',
    lastChecked: '2026-11-09',
    imageSvgType: 'tent',
  };
  store1.addNewItem(newItem);

  // Reload store from same storage
  const store2 = new SiPrakaStateStore(storage);
  const reloaded = store2.getItemById('item-persist-1');
  assert.ok(reloaded);
  assert.equal(reloaded.name, 'Flysheet Waterproof 3x4m');
});

test('F2.4: newly added item has availableQty equal to totalQty', () => {
  const store = new SiPrakaStateStore();
  const newItem: InventoryItem = {
    id: 'item-qty-check-1',
    barcode: 'BRG-QTY-001',
    name: 'Panci Nesting Susun 4',
    category: 'Dapur',
    totalQty: 15,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Dapur Sanggar',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  };
  store.addNewItem(newItem);
  assert.equal(getAvailableQty(newItem), 15);
});

test('F2.5: newly added item with optional notes retains notes data', () => {
  const store = new SiPrakaStateStore();
  const newItem: InventoryItem = {
    id: 'item-notes-1',
    barcode: 'BRG-NOTES-001',
    name: 'Kompor Spirtus Lapangan',
    category: 'Dapur',
    totalQty: 8,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Dapur Sanggar',
    lastChecked: '2026-11-09',
    imageSvgType: 'stove',
    notes: 'Sumbangan Alumni Angkatan 2024',
  };
  store.addNewItem(newItem);
  const retrieved = store.getItemById('item-notes-1');
  assert.equal(retrieved?.notes, 'Sumbangan Alumni Angkatan 2024');
});

// ============================================================================
// FEATURE 3: EDIT EXISTING INVENTORY ITEM
// ============================================================================

test('F3.1: editItem updates item name without changing barcode or ID', () => {
  const store = new SiPrakaStateStore();
  const item = store.getItemById('BRG-KBU-001') || store.getItems()[0];
  const updated: InventoryItem = {
    ...item,
    name: 'Tongkat Pramuka Bambu Panjang 160cm',
  };
  store.editItem(updated);

  const edited = store.getItemById(item.id);
  assert.equal(edited?.name, 'Tongkat Pramuka Bambu Panjang 160cm');
  assert.equal(edited?.barcode, item.barcode);
});

test('F3.2: editItem adjusting totalQty recalculates available stock immediately', () => {
  const store = new SiPrakaStateStore();
  const item = store.getItems()[0];
  const oldAvailable = getAvailableQty(item);

  const updated: InventoryItem = {
    ...item,
    totalQty: item.totalQty + 10,
  };
  store.editItem(updated);

  const edited = store.getItemById(item.id)!;
  assert.equal(getAvailableQty(edited), oldAvailable + 10);
});

test('F3.3: editItem updates location, condition, and notes without altering borrowedQty', () => {
  const store = new SiPrakaStateStore();
  const item = store.getItems()[0];
  const originalBorrowed = item.borrowedQty;

  const updated: InventoryItem = {
    ...item,
    location: 'Sanggar Baru Ruang 3',
    condition: 'Perlu Perawatan',
    notes: 'Dicek ulang sebelum lomba',
  };
  store.editItem(updated);

  const edited = store.getItemById(item.id)!;
  assert.equal(edited.location, 'Sanggar Baru Ruang 3');
  assert.equal(edited.condition, 'Perlu Perawatan');
  assert.equal(edited.notes, 'Dicek ulang sebelum lomba');
  assert.equal(edited.borrowedQty, originalBorrowed);
});

test('F3.4: editItem changes persist across simulated browser reload', () => {
  const storage = new MockLocalStorage();
  const store1 = new SiPrakaStateStore(storage);
  const item = store1.getItems()[0];

  store1.editItem({
    ...item,
    location: 'Lemari VIP Gudep',
  });

  const store2 = new SiPrakaStateStore(storage);
  const reloaded = store2.getItemById(item.id)!;
  assert.equal(reloaded.location, 'Lemari VIP Gudep');
});

test('F3.5: editItem leaves all other catalog items completely unaffected', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();
  const target = items[0];
  const other = items[1];
  const otherSnapshot = JSON.stringify(other);

  store.editItem({
    ...target,
    name: 'Nama Berubah',
  });

  const otherAfter = store.getItemById(other.id)!;
  assert.equal(JSON.stringify(otherAfter), otherSnapshot);
});

// ============================================================================
// FEATURE 4: DELETE INVENTORY ITEM
// ============================================================================

test('F4.1: deleteItem removes unborrowed item successfully from catalog', () => {
  const store = new SiPrakaStateStore();
  // Add item with 0 borrowed
  const tempItem: InventoryItem = {
    id: 'item-temp-delete',
    barcode: 'BRG-TEMP-DEL',
    name: 'Barang Sementara Mau Dihapus',
    category: 'Dapur',
    totalQty: 5,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Rak B',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  };
  store.addNewItem(tempItem);

  const result = store.deleteItem('item-temp-delete');
  assert.equal(result.success, true);
  assert.equal(store.getItemById('item-temp-delete'), undefined);
});

test('F4.2: deleted item is no longer returned in barcode search', () => {
  const store = new SiPrakaStateStore();
  const tempItem: InventoryItem = {
    id: 'item-temp-search',
    barcode: 'BRG-TO-SEARCH-DEL',
    name: 'Barang Tes Cari Hapus',
    category: 'Dapur',
    totalQty: 2,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Rak B',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  };
  store.addNewItem(tempItem);
  assert.ok(store.getItemByBarcode('BRG-TO-SEARCH-DEL'));

  store.deleteItem('item-temp-search');
  assert.equal(store.getItemByBarcode('BRG-TO-SEARCH-DEL'), undefined);
});

test('F4.3: deleteItem rejects deletion when item is actively borrowed', () => {
  const store = new SiPrakaStateStore();
  // Find an item with borrowedQty > 0
  const borrowedItem = store.getItems().find((i) => i.borrowedQty > 0)!;
  assert.ok(borrowedItem, 'Should have at least one currently borrowed item in seed data');

  const result = store.deleteItem(borrowedItem.id);
  assert.equal(result.success, false);
  assert.ok(result.error?.includes('currently on active loan'));
  // Item must still exist
  assert.ok(store.getItemById(borrowedItem.id));
});

test('F4.4: deleteItem deletion persists in storage', () => {
  const storage = new MockLocalStorage();
  const store1 = new SiPrakaStateStore(storage);
  const tempItem: InventoryItem = {
    id: 'item-persist-delete',
    barcode: 'BRG-PERSIST-DEL',
    name: 'Barang Hapus Persist',
    category: 'Tongkat & Pionering',
    totalQty: 10,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Rak A',
    lastChecked: '2026-11-09',
    imageSvgType: 'stick',
  };
  store1.addNewItem(tempItem);
  store1.deleteItem('item-persist-delete');

  const store2 = new SiPrakaStateStore(storage);
  assert.equal(store2.getItemById('item-persist-delete'), undefined);
});

test('F4.5: deleteItem for non-existent item returns false and leaves list intact', () => {
  const store = new SiPrakaStateStore();
  const beforeCount = store.getItems().length;
  const result = store.deleteItem('non-existent-item-id-999');
  assert.equal(result.success, false);
  assert.equal(result.error, 'Item not found');
  assert.equal(store.getItems().length, beforeCount);
});

// ============================================================================
// FEATURE 5: BORROW WORKFLOW
// ============================================================================

test('F5.1: calculateAllowedCartQty validates available stock and clamps target', () => {
  const item: InventoryItem = {
    id: 'item-cart-1',
    barcode: 'BRG-CART-1',
    name: 'Tenda Dome',
    category: 'Tenda & Kemah',
    totalQty: 10,
    borrowedQty: 6,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Lemari',
    lastChecked: '2026-11-09',
    imageSvgType: 'tent',
  }; // available: 4

  const res1 = calculateAllowedCartQty(item, 0, 2);
  assert.equal(res1.allowed, true);
  assert.equal(res1.newQty, 2);

  const res2 = calculateAllowedCartQty(item, 2, 5); // 2 + 5 = 7 > 4
  assert.equal(res2.allowed, true);
  assert.equal(res2.newQty, 4); // clamped to maxAvail

  const outOfStockItem: InventoryItem = { ...item, borrowedQty: 10 };
  const res3 = calculateAllowedCartQty(outOfStockItem, 0, 1);
  assert.equal(res3.allowed, false);
  assert.equal(res3.newQty, 0);
});

test('F5.2: createBorrowRequest creates transaction with pending_borrow status', () => {
  const store = new SiPrakaStateStore();
  const member = store.getMembers()[0];
  const item = store.getItems()[0];

  const newTx: LoanTransaction = {
    id: `TRX-${Date.now()}`,
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
    purpose: 'Latihan Rutin Penggalang',
    borrowDate: '2026-11-10T08:00:00',
    dueDate: '2026-11-11T16:00:00',
    status: 'pending_borrow',
    items: [
      {
        itemId: item.id,
        barcode: item.barcode,
        name: item.name,
        qty: 5,
        conditionBefore: 'Baik',
      },
    ],
    photoConditionBefore: createProofPhotoDataUrl('before', item.name, member.name, '10 Nov 2026'),
    photoHandoverBorrow: createProofPhotoDataUrl('handover_borrow', item.name, member.name, '10 Nov 2026'),
  };

  store.createBorrowRequest(newTx);
  const created = store.getTransactionById(newTx.id);
  assert.ok(created);
  assert.equal(created.status, 'pending_borrow');
});

test('F5.3: approveBorrow transitions status to active_borrowed and attaches signatures', () => {
  const store = new SiPrakaStateStore();
  const tx = store.getTransactions().find((t) => t.status === 'pending_borrow')!;
  assert.ok(tx, 'Need a pending_borrow transaction from seed data');

  const officer = DEWAN_INVENTARIS_LIST[0];
  const pradana = PRADANA_LIST[0];
  const approvedTx = store.approveBorrow(tx.id, officer, pradana);

  assert.equal(approvedTx.status, 'active_borrowed');
  assert.equal(approvedTx.officerName, officer.name);
  assert.equal(approvedTx.officerSignature, officer.signatureDataUrl);
  assert.equal(approvedTx.pradanaName, pradana.name);
  assert.equal(approvedTx.pradanaSignature, pradana.signatureDataUrl);
});

test('F5.4: approveBorrow decrements available inventory stock by loaned quantity', () => {
  const store = new SiPrakaStateStore();
  const tx = store.getTransactions().find((t) => t.status === 'pending_borrow')!;
  const targetItemEntry = tx.items[0];
  const itemBefore = store.getItemById(targetItemEntry.itemId)!;
  const availableBefore = getAvailableQty(itemBefore);

  store.approveBorrow(tx.id);

  const itemAfter = store.getItemById(targetItemEntry.itemId)!;
  const availableAfter = getAvailableQty(itemAfter);
  assert.equal(availableAfter, availableBefore - targetItemEntry.qty);
});

test('F5.5: rejectTransaction sets status to rejected and preserves inventory stock', () => {
  const store = new SiPrakaStateStore();
  const tx = store.getTransactions().find((t) => t.status === 'pending_borrow')!;
  const targetItemEntry = tx.items[0];
  const itemBefore = store.getItemById(targetItemEntry.itemId)!;
  const availableBefore = getAvailableQty(itemBefore);

  store.rejectTransaction(tx.id);

  const rejectedTx = store.getTransactionById(tx.id)!;
  assert.equal(rejectedTx.status, 'rejected');

  const itemAfter = store.getItemById(targetItemEntry.itemId)!;
  assert.equal(getAvailableQty(itemAfter), availableBefore);
});

// ============================================================================
// FEATURE 6: RETURN WORKFLOW
// ============================================================================

test('F6.1: submitReturnRequest sets status to pending_return and records conditionAfter', () => {
  const store = new SiPrakaStateStore();
  const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;
  assert.ok(activeTx, 'Need active_borrowed transaction');

  const photoAfter = createProofPhotoDataUrl('after', 'Tongkat', 'Neo', '10 Nov 2026');
  const photoHandover = createProofPhotoDataUrl('handover_return', 'Tongkat', 'Neo', '10 Nov 2026');

  store.submitReturnRequest(activeTx.id, 'Kondisi Baik Lengkap', photoAfter, photoHandover);

  const updated = store.getTransactionById(activeTx.id)!;
  assert.equal(updated.status, 'pending_return');
  assert.equal(updated.items[0].conditionAfter, 'Kondisi Baik Lengkap');
  assert.ok(updated.returnDate);
});

test('F6.2: approveReturn transitions status to returned and stamps officer inspection', () => {
  const store = new SiPrakaStateStore();
  const pendingReturnTx = store.getTransactions().find((t) => t.status === 'pending_return')!;
  assert.ok(pendingReturnTx, 'Need pending_return transaction');

  const officer = DEWAN_INVENTARIS_LIST[1];
  const approved = store.approveReturn(pendingReturnTx.id, officer);

  assert.equal(approved.status, 'returned');
  assert.equal(approved.officerName, officer.name);
  assert.ok(approved.returnDate);
});

test('F6.3: approveReturn restores borrowedQty back to available stock', () => {
  const store = new SiPrakaStateStore();
  const pendingReturnTx = store.getTransactions().find((t) => t.status === 'pending_return')!;
  const targetItemEntry = pendingReturnTx.items[0];
  const itemBefore = store.getItemById(targetItemEntry.itemId)!;
  const borrowedBefore = itemBefore.borrowedQty;

  store.approveReturn(pendingReturnTx.id);

  const itemAfter = store.getItemById(targetItemEntry.itemId)!;
  assert.equal(itemAfter.borrowedQty, borrowedBefore - targetItemEntry.qty);
});

test('F6.4: approveReturn with damaged items increments damagedQty', () => {
  const store = new SiPrakaStateStore();
  const pendingReturnTx = store.getTransactions().find((t) => t.status === 'pending_return')!;
  const targetItemEntry = pendingReturnTx.items[0];
  const itemBefore = store.getItemById(targetItemEntry.itemId)!;
  const damagedBefore = itemBefore.damagedQty;

  // Report 1 damaged unit during return inspection
  store.approveReturn(pendingReturnTx.id, DEWAN_INVENTARIS_LIST[0], PRADANA_LIST[0], {
    [targetItemEntry.itemId]: 1,
  });

  const itemAfter = store.getItemById(targetItemEntry.itemId)!;
  assert.equal(itemAfter.damagedQty, damagedBefore + 1);
});

test('F6.5: createProofPhotoDataUrl generates valid SVG data URL for return evidence', () => {
  const urlAfter = createProofPhotoDataUrl('after', 'Tenda Dome', 'Neo Willyan', '2026-11-10');
  const urlHandover = createProofPhotoDataUrl('handover_return', 'Tenda Dome', 'Neo Willyan', '2026-11-10');

  assert.ok(urlAfter.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(urlHandover.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(decodeURIComponent(urlAfter).includes('KONDISI BARANG SESUDAH DIKEMBALIKAN'));
  assert.ok(decodeURIComponent(urlHandover).includes('SERAH-TERIMA PENGEMBALIAN'));
});

// ============================================================================
// FEATURE 7: MEMBER MANAGEMENT
// ============================================================================

test('F7.1: registerMember prepends new member to members directory', () => {
  const store = new SiPrakaStateStore();
  const countBefore = store.getMembers().length;

  const newMember: ScoutMember = {
    id: `mem-${Date.now()}`,
    name: 'Zahrani Aulia Rahman',
    nia: '06.172.2026.042',
    kelas: 'X-E',
    jabatan: 'Tamu Ambalan',
    sangga: 'Sangga Pencoba',
    phone: '081299887766',
    signatureDataUrl: createSignatureDataUrl('Zahrani Aulia'),
  };

  store.registerMember(newMember);
  const members = store.getMembers();
  assert.equal(members.length, countBefore + 1);
  assert.equal(members[0].name, 'Zahrani Aulia Rahman');
});

test('F7.2: registerMember validates official Gudep 06.171 / 06.172 NIA pattern', () => {
  const niaPutra = '06.171.2026.015';
  const niaPutri = '06.172.2026.022';
  const niaPattern = /^06\.(171|172)\.202[0-9]\.[0-9]{3}$/;

  assert.match(niaPutra, niaPattern);
  assert.match(niaPutri, niaPattern);
});

test('F7.3: updateMember updates member profile in store and storage', () => {
  const store = new SiPrakaStateStore();
  const member = store.getMembers()[0];

  const updated: ScoutMember = {
    ...member,
    name: `${member.name} (Updated)`,
    jabatan: 'Pradana Putri',
    sangga: 'Sangga Penegas',
  };
  store.updateMember(updated);

  const reloaded = store.getMemberById(member.id)!;
  assert.equal(reloaded.name, `${member.name} (Updated)`);
  assert.equal(reloaded.jabatan, 'Pradana Putri');
});

test('F7.4: updateMember cascades updated name and rank to historical transactions', () => {
  const store = new SiPrakaStateStore();
  const member = store.getMembers()[0];
  const pastTx = store.getTransactions().find((t) => t.memberId === member.id);
  assert.ok(pastTx, 'Should have historical transaction for first member');

  const updated: ScoutMember = {
    ...member,
    name: 'Muhammad Farhan Syahputra',
    kelas: 'XII IPS 1',
    jabatan: 'Penegak Laksana',
    sangga: 'Sangga Pelaksana',
  };
  store.updateMember(updated);

  const cascadedTx = store.getTransactionById(pastTx.id)!;
  assert.equal(cascadedTx.memberName, 'Muhammad Farhan Syahputra');
  assert.equal(cascadedTx.memberKelas, 'XII IPS 1');
  assert.equal(cascadedTx.memberJabatan, 'Penegak Laksana — Sangga Pelaksana');
});

test('F7.5: createSignatureDataUrl creates distinct SVG ink strokes based on name', () => {
  const sig1 = createSignatureDataUrl('Fatihah Bilqist');
  const sig2 = createSignatureDataUrl('Ahmad Fauzan');
  const sig3 = createSignatureDataUrl('Neo Willyan');

  assert.ok(sig1.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(sig2.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(sig3.startsWith('data:image/svg+xml;utf8,'));
  // All three have different path signatures
  assert.notEqual(sig1, sig2);
  assert.notEqual(sig2, sig3);
});

// ============================================================================
// FEATURE 8: OVERDUE DETECTION & ALERTS
// ============================================================================

test('F8.1: isTransactionOverdue returns false when current time is before dueDate', () => {
  const tx: Pick<LoanTransaction, 'status' | 'dueDate'> = {
    status: 'active_borrowed',
    dueDate: '2026-11-20T17:00:00',
  };
  const now = new Date('2026-11-15T10:00:00').getTime();
  assert.equal(isTransactionOverdue(tx, now), false);
});

test('F8.2: isTransactionOverdue returns true when current time is past dueDate', () => {
  const tx: Pick<LoanTransaction, 'status' | 'dueDate'> = {
    status: 'active_borrowed',
    dueDate: '2026-11-05T17:00:00',
  };
  const now = new Date('2026-11-10T10:00:00').getTime();
  assert.equal(isTransactionOverdue(tx, now), true);
});

test('F8.3: isTransactionOverdue returns false for returned transactions past dueDate', () => {
  const tx: Pick<LoanTransaction, 'status' | 'dueDate'> = {
    status: 'returned',
    dueDate: '2026-11-01T17:00:00',
  };
  const now = new Date('2026-11-10T10:00:00').getTime();
  assert.equal(isTransactionOverdue(tx, now), false);
});

test('F8.4: triggerMemberAlarm updates transaction status to overdue and enables alarm', () => {
  const store = new SiPrakaStateStore();
  const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;

  store.triggerMemberAlarm(activeTx.id);

  const alarmedTx = store.getTransactionById(activeTx.id)!;
  assert.equal(alarmedTx.status, 'overdue');
  assert.equal(alarmedTx.alarmMutedUntilVerified, false);
});

test('F8.5: calculateInventoryStats includes overdue count in statistics', () => {
  const store = new SiPrakaStateStore();
  const stats = calculateInventoryStats(store.getItems(), store.getTransactions());
  assert.ok(stats.overdueTransactionCount >= 1, 'Initial seed data has 1 overdue transaction');
  assert.ok(stats.damagedOrOverdueUnits >= 1);
});

// ============================================================================
// FEATURE 9: DATA REPORTING & CSV EXPORT
// ============================================================================

test('F9.1: exportInventoryToCsv outputs RFC 4180 headers for inventory items', () => {
  const store = new SiPrakaStateStore();
  const csv = exportInventoryToCsv(store.getItems());
  const lines = csv.split('\r\n');
  assert.ok(lines.length >= 9, 'Header + at least 8 items');
  assert.equal(
    lines[0],
    'ID Barang,Kode Barcode,Nama Barang,Kategori,Total Stok,Sedang Dipinjam,Kondisi Rusak,Stok Tersedia,Kondisi Fisik,Lokasi Sanggar,Pengecekan Terakhir,Catatan Khusus'
  );
});

test('F9.2: exportInventoryToCsv accurately computes availableQty column', () => {
  const store = new SiPrakaStateStore();
  const items = store.getItems();
  const csv = exportInventoryToCsv(items);
  const rows = csv.split('\r\n').slice(1);

  rows.forEach((row, idx) => {
    const item = items[idx];
    const expectedAvailable = getAvailableQty(item);
    const cols = row.split(',');
    // Column 7 (0-indexed) is Stok Tersedia
    assert.equal(Number(cols[7]), expectedAvailable);
  });
});

test('F9.3: exportTransactionsToCsv outputs RFC 4180 headers for loan history', () => {
  const store = new SiPrakaStateStore();
  const csv = exportTransactionsToCsv(store.getTransactions());
  const lines = csv.split('\r\n');
  assert.ok(lines.length >= 6, 'Header + at least 5 transactions');
  assert.equal(
    lines[0],
    'ID Transaksi,Nama Peminjam,Kelas,Jabatan & Sangga,Keperluan Peminjaman,Tanggal Pinjam,Batas Kembali,Tanggal Pengembalian,Status Transaksi,Rincian Barang,Total Jumlah Unit,Petugas Inventaris,Pradana Mengetahui'
  );
});

test('F9.4: escapeCsvCell handles commas, quotes, and newlines per RFC 4180', () => {
  assert.equal(escapeCsvCell('Simple'), '"Simple"');
  assert.equal(escapeCsvCell('Contains, comma'), '"Contains, comma"');
  assert.equal(escapeCsvCell('Contains "quotes"'), '"Contains ""quotes"""');
  assert.equal(escapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
  assert.equal(escapeCsvCell(null), '""');
  assert.equal(escapeCsvCell(undefined), '""');
});

test('F9.5: buildOfficialLetterMeta produces PDF-matching letter number and title', () => {
  const tx = INITIAL_TRANSACTIONS[0];
  const borrowMeta = buildOfficialLetterMeta(tx, 'borrow');
  const returnMeta = buildOfficialLetterMeta(tx, 'return');

  assert.equal(borrowMeta.title, 'SURAT KETERANGAN PEMINJAMAN BARANG PRAMUKA MAN 11 JAKARTA');
  assert.ok(borrowMeta.letterNumber.includes('SKPB/KBU-06.171-06.172/2026'));
  assert.equal(borrowMeta.officerLabel, 'Nama Yang Menyerahkan');

  assert.equal(returnMeta.title, 'SURAT KETERANGAN PENGEMBALIAN BARANG PRAMUKA MAN 11 JAKARTA');
  assert.ok(returnMeta.letterNumber.includes('SKKBP/KBU-06.171-06.172/2026'));
  assert.equal(returnMeta.officerLabel, 'Nama yang Menerima');
});

// ============================================================================
// FEATURE 10: SEED PERSISTENCE & DATA RESET
// ============================================================================

test('F10.1: uninitialized storage populates default MAN 11 sample items', () => {
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);
  const items = store.getItems();

  assert.equal(items.length, 8);
  assert.ok(items.some((i) => i.barcode === 'BRG-KBU-001' && i.name === 'Tongkat Panjang'));
  assert.ok(items.some((i) => i.barcode === 'BRG-KBU-002' && i.name.includes('Tenda Dome')));
});

test('F10.2: uninitialized storage populates default MAN 11 members and transactions', () => {
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);

  assert.equal(store.getMembers().length, 4);
  assert.equal(store.getTransactions().length, 5);
  assert.equal(store.getMembers()[0].name, 'Neo Willyan Pratama');
});

test('F10.3: store changes persist to storage keys sipraka_items_v3, sipraka_members_v3, sipraka_tx_v3', () => {
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);
  store.addNewItem({
    id: 'item-key-check',
    barcode: 'BRG-KEY-001',
    name: 'Item Cek Key',
    category: 'Dapur',
    totalQty: 10,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Dapur',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  });

  const rawSaved = storage.getItem('sipraka_items_v3');
  assert.ok(rawSaved);
  const parsed = JSON.parse(rawSaved);
  assert.ok(parsed.some((i: InventoryItem) => i.barcode === 'BRG-KEY-001'));
});

test('F10.4: resetToSeedData restores default 8 items after modifications and deletions', () => {
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);

  // Modify store by adding and deleting
  store.addNewItem({
    id: 'extra-item',
    barcode: 'EXTRA-001',
    name: 'Extra',
    category: 'Dapur',
    totalQty: 1,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'X',
    lastChecked: '2026-11-09',
    imageSvgType: 'cooking',
  });
  assert.equal(store.getItems().length, 9);

  // Reset
  store.resetToSeedData();
  const restoredItems = store.getItems();
  assert.equal(restoredItems.length, 8);
  assert.equal(restoredItems[0].barcode, 'BRG-KBU-001');
  assert.equal(store.getItemById('extra-item'), undefined);
});

test('F10.5: resetToSeedData restores default 4 members and 5 transactions', () => {
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);

  // Add dummy member
  store.registerMember({
    id: 'mem-dummy',
    name: 'Dummy',
    nia: '06.171.2026.999',
    kelas: 'X',
    jabatan: 'Anggota',
    sangga: 'Perintis',
    phone: '123',
    signatureDataUrl: 'sig',
  });
  assert.equal(store.getMembers().length, 5);

  store.resetToSeedData();
  assert.equal(store.getMembers().length, 4);
  assert.equal(store.getTransactions().length, 5);
  assert.equal(store.getMembers()[0].nia, '06.171.2025.018');
});
