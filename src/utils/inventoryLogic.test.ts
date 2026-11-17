import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableQty,
  calculateInventoryStats,
  findItemByBarcode,
  isTransactionOverdue,
  formatIndonesianDate,
  buildOfficialLetterMeta,
  calculateAllowedCartQty,
  updateInventoryItemInList,
  deleteInventoryItemFromList,
  canDeleteInventoryItem,
  canUpdateItemTotalQty,
  calculateReturnItemStock,
  escapeCsvCell,
  exportInventoryToCsv,
  exportTransactionsToCsv,
  type InventoryItem,
  type LoanTransaction,
} from './inventoryLogic';
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
} from '../data/seedData';

const sampleItems: InventoryItem[] = [
  {
    id: 'item-1',
    barcode: 'BRG-KBU-001',
    name: 'Tongkat Panjang',
    category: 'Tongkat & Pionering',
    totalQty: 60,
    borrowedQty: 42,
    damagedQty: 2,
    condition: 'Baik',
    location: 'Rak A1 Sanggar Pramuka',
    lastChecked: '2026-08-08',
    imageSvgType: 'stick',
  },
  {
    id: 'item-2',
    barcode: 'BRG-KBU-002',
    name: 'Tenda Dome Kapasitas 6 Orang',
    category: 'Tenda & Kemah',
    totalQty: 15,
    borrowedQty: 5,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Lemari B2 Sanggar Pramuka',
    lastChecked: '2026-08-08',
    imageSvgType: 'tent',
  },
];

const sampleTx: LoanTransaction = {
  id: 'TRX-2026-089',
  memberId: 'mem-1',
  memberName: 'Neo Willyan Pratama',
  memberKelas: 'XI IPA 1',
  memberJabatan: 'Sangga Perintis / Bantara',
  memberSignature: 'data:image/svg+xml;utf8,test',
  officerId: 'off-1',
  officerName: 'Fatihah Bilqist Azzahra',
  officerSignature: 'data:image/svg+xml;utf8,test',
  pradanaName: 'Ahmad Fauzan Al-Ghifari',
  pradanaSignature: 'data:image/svg+xml;utf8,test',
  purpose: 'Pengisian Materi LKBBT',
  borrowDate: '2026-08-08T08:00:00',
  dueDate: '2026-08-09T16:00:00',
  status: 'active_borrowed',
  items: [
    {
      itemId: 'item-1',
      barcode: 'BRG-KBU-001',
      name: 'Tongkat Panjang',
      qty: 42,
      conditionBefore: 'Baik',
    },
  ],
  photoConditionBefore: 'data:image/svg+xml;utf8,before',
  photoHandoverBorrow: 'data:image/svg+xml;utf8,handover',
};

test('getAvailableQty computes remaining stock accurately', () => {
  assert.equal(getAvailableQty(sampleItems[0]), 16);
  assert.equal(getAvailableQty(sampleItems[1]), 10);
});

test('calculateInventoryStats aggregates totals and percentages', () => {
  const stats = calculateInventoryStats(sampleItems, [sampleTx]);
  assert.equal(stats.totalUnits, 75);
  assert.equal(stats.borrowedUnits, 47);
  assert.equal(stats.availableUnits, 26);
  assert.equal(stats.pendingApprovalCount, 0);
});

test('findItemByBarcode locates item by exact barcode or partial name', () => {
  const byBarcode = findItemByBarcode(sampleItems, 'brg-kbu-001');
  assert.ok(byBarcode);
  assert.equal(byBarcode.name, 'Tongkat Panjang');

  const byName = findItemByBarcode(sampleItems, 'Tenda Dome');
  assert.ok(byName);
  assert.equal(byName.barcode, 'BRG-KBU-002');
});

test('isTransactionOverdue detects overdue deadlines', () => {
  const beforeDue = new Date('2026-08-08T12:00:00').getTime();
  const afterDue = new Date('2026-08-10T12:00:00').getTime();
  assert.equal(isTransactionOverdue(sampleTx, beforeDue), false);
  assert.equal(isTransactionOverdue(sampleTx, afterDue), true);
});

test('buildOfficialLetterMeta formats Ambalan borrow and return letter headers matching PDF', () => {
  const borrowMeta = buildOfficialLetterMeta(sampleTx, 'borrow');
  assert.equal(
    borrowMeta.title,
    'SURAT KETERANGAN PEMINJAMAN BARANG PRAMUKA MAN 11 JAKARTA'
  );
  assert.equal(borrowMeta.officerLabel, 'Nama Yang Menyerahkan');

  const returnMeta = buildOfficialLetterMeta(sampleTx, 'return');
  assert.equal(
    returnMeta.title,
    'SURAT KETERANGAN PENGEMBALIAN BARANG PRAMUKA MAN 11 JAKARTA'
  );
  assert.equal(returnMeta.officerLabel, 'Nama yang Menerima');
});

test('formatIndonesianDate outputs exact PDF date format (Sabtu, 08 Agustus 2026)', () => {
  const formatted = formatIndonesianDate('2026-08-08T08:30:00');
  assert.equal(formatted, 'Sabtu, 08 Agustus 2026');
});

test('calculateAllowedCartQty prevents adding out-of-stock items (0 stock boundary)', () => {
  const outOfStockItem: InventoryItem = {
    ...sampleItems[1],
    totalQty: 5,
    borrowedQty: 5,
    damagedQty: 0,
  };
  assert.equal(getAvailableQty(outOfStockItem), 0);

  // Attempting to add 1 unit to cart when 0 are available
  const result = calculateAllowedCartQty(outOfStockItem, 0, 1);
  assert.equal(result.allowed, false);
  assert.equal(result.newQty, 0);
  assert.equal(result.maxAvail, 0);
  assert.match(result.message || '', /sedang habis/);

  // Attempting to add when already have 0 in cart
  const result2 = calculateAllowedCartQty(outOfStockItem, 0, 5);
  assert.equal(result2.allowed, false);
});

test('calculateAllowedCartQty clamps addition to available stock without falling back to 60 or 1', () => {
  const availableItem: InventoryItem = {
    ...sampleItems[1],
    totalQty: 10,
    borrowedQty: 7,
    damagedQty: 0,
  };
  assert.equal(getAvailableQty(availableItem), 3);

  // Add 2 units when 3 available
  const r1 = calculateAllowedCartQty(availableItem, 0, 2);
  assert.equal(r1.allowed, true);
  assert.equal(r1.newQty, 2);

  // Add 10 units when only 3 available -> clamped to 3 (not 60 or 1)
  const r2 = calculateAllowedCartQty(availableItem, 0, 10);
  assert.equal(r2.allowed, true);
  assert.equal(r2.newQty, 3);

  // Increment from existing 2 by 5 -> clamped to 3
  const r3 = calculateAllowedCartQty(availableItem, 2, 5);
  assert.equal(r3.allowed, true);
  assert.equal(r3.newQty, 3);
});

test('updateInventoryItemInList updates target item immutably', () => {
  const updatedItem: InventoryItem = {
    ...sampleItems[0],
    name: 'Tongkat Panjang Pramuka Super',
    totalQty: 70,
    location: 'Rak Utama Sanggar',
    notes: 'Kondisi telah diperiksa',
  };

  const nextList = updateInventoryItemInList(sampleItems, updatedItem);
  assert.equal(nextList.length, sampleItems.length);
  assert.equal(nextList[0].name, 'Tongkat Panjang Pramuka Super');
  assert.equal(nextList[0].totalQty, 70);
  assert.equal(nextList[0].location, 'Rak Utama Sanggar');
  assert.equal(nextList[0].notes, 'Kondisi telah diperiksa');
  // Untouched item remains unchanged
  assert.equal(nextList[1].name, sampleItems[1].name);
});

test('deleteInventoryItemFromList removes item by id immutably', () => {
  const nextList = deleteInventoryItemFromList(sampleItems, 'item-1');
  assert.equal(nextList.length, 1);
  assert.equal(nextList[0].id, 'item-2');

  const unchangedList = deleteInventoryItemFromList(sampleItems, 'non-existent-id');
  assert.equal(unchangedList.length, sampleItems.length);
});

test('canDeleteInventoryItem blocks deletion when item is actively borrowed', () => {
  const borrowedItem = sampleItems.find((i) => i.borrowedQty > 0)!;
  const result = canDeleteInventoryItem(borrowedItem);
  assert.equal(result.allowed, false);
  assert.ok(result.reason?.includes('peminjaman aktif'));

  const nullResult = canDeleteInventoryItem(null);
  assert.equal(nullResult.allowed, false);
});

test('canDeleteInventoryItem allows deletion when item has 0 active loans', () => {
  const unborrowedItem: InventoryItem = {
    ...sampleItems[0],
    id: 'item-unborrowed',
    borrowedQty: 0,
  };
  const result = canDeleteInventoryItem(unborrowedItem);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, undefined);
});

test('canUpdateItemTotalQty enforces totalQty >= borrowedQty', () => {
  const invalid = canUpdateItemTotalQty(10, 5);
  assert.equal(invalid.allowed, false);
  assert.ok(invalid.reason?.includes('tidak boleh lebih kecil'));

  const exact = canUpdateItemTotalQty(10, 10);
  assert.equal(exact.allowed, true);

  const greater = canUpdateItemTotalQty(10, 15);
  assert.equal(greater.allowed, true);
});

test('calculateReturnItemStock calculates returns and damaged goods accurately', () => {
  const item: InventoryItem = {
    ...sampleItems[0],
    totalQty: 20,
    borrowedQty: 10,
    damagedQty: 1,
  };

  // Normal return: 5 units returned, 0 damaged
  const r1 = calculateReturnItemStock(item, 5, 0);
  assert.equal(r1.borrowedQty, 5);
  assert.equal(r1.damagedQty, 1);

  // Return with damaged items: 5 returned, 2 damaged
  const r2 = calculateReturnItemStock(item, 5, 2);
  assert.equal(r2.borrowedQty, 5);
  assert.equal(r2.damagedQty, 3); // 1 existing + 2 new

  // Return exceeding borrowedQty: clamped safely
  const r3 = calculateReturnItemStock(item, 15, 0);
  assert.equal(r3.borrowedQty, 0);
  assert.equal(r3.damagedQty, 1);
});

test('escapeCsvCell escapes double quotes, commas, and handles nulls', () => {
  assert.equal(escapeCsvCell('Hello'), '"Hello"');
  assert.equal(escapeCsvCell('Hello, World'), '"Hello, World"');
  assert.equal(escapeCsvCell('He said "Hi"'), '"He said ""Hi"""');
  assert.equal(escapeCsvCell(123), '"123"');
  assert.equal(escapeCsvCell(undefined), '""');
  assert.equal(escapeCsvCell(null), '""');
});

test('escapeCsvCell sanitizes formula injection triggers (=, +, -, @) per CWE-1236', () => {
  assert.equal(escapeCsvCell('=1+1'), '"\'=1+1"');
  assert.equal(escapeCsvCell('+SUM(A1:A10)'), '"\'+SUM(A1:A10)"');
  assert.equal(escapeCsvCell('-15'), '"\'-15"');
  assert.equal(escapeCsvCell('@admin'), '"\'@admin"');
  assert.equal(escapeCsvCell("=cmd|' /C calc'!A0"), '"\'=cmd|\' /C calc\'!A0"');
  assert.equal(escapeCsvCell('=cmd|" /C calc"!A0'), '"\'=cmd|"" /C calc""!A0"');
  // Safe string without triggers is not prepended with single quote
  assert.equal(escapeCsvCell('Tongkat Pramuka'), '"Tongkat Pramuka"');
});

test('exportInventoryToCsv produces valid CSV string with all items and calculations', () => {
  const csv = exportInventoryToCsv(sampleItems);
  assert.ok(csv.includes('ID Barang,Kode Barcode,Nama Barang,Kategori'));
  assert.ok(csv.includes('BRG-KBU-001'));
  assert.ok(csv.includes('Tongkat Panjang'));
  assert.ok(csv.includes('BRG-KBU-002'));
  // Calculated available units should be in the CSV
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3); // 1 header + 2 items
});

test('exportTransactionsToCsv produces valid CSV string for transactions', () => {
  const csv = exportTransactionsToCsv([sampleTx]);
  assert.ok(csv.includes('ID Transaksi,Nama Peminjam,Kelas,Jabatan & Sangga'));
  assert.ok(csv.includes('TRX-2026-089'));
  assert.ok(csv.includes('Neo Willyan Pratama'));
  assert.ok(csv.includes('Pengisian Materi LKBBT'));
  assert.ok(csv.includes('Fatihah Bilqist Azzahra'));
});

test('seedData constants have valid structure and preloaded values', () => {
  assert.ok(Array.isArray(INITIAL_INVENTORY_ITEMS));
  assert.equal(INITIAL_INVENTORY_ITEMS.length, 8);
  for (const item of INITIAL_INVENTORY_ITEMS) {
    assert.ok(item.barcode.startsWith('BRG-KBU-'));
    assert.ok(item.totalQty > 0);
    assert.ok(getAvailableQty(item) >= 0);
  }

  assert.ok(Array.isArray(INITIAL_MEMBERS));
  assert.ok(INITIAL_MEMBERS.length >= 4);
  for (const member of INITIAL_MEMBERS) {
    assert.ok(member.nia.length > 0);
    assert.ok(member.name.length > 0);
  }

  assert.ok(Array.isArray(INITIAL_TRANSACTIONS));
  assert.ok(INITIAL_TRANSACTIONS.length >= 5);
});

