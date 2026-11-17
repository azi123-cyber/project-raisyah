import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MockLocalStorage,
  SiPrakaStateStore,
} from './helpers/testStorage';
import {
  getAvailableQty,
  calculateInventoryStats,
  buildOfficialLetterMeta,
  formatIndonesianDate,
  calculateAllowedCartQty,
  exportInventoryToCsv,
  exportTransactionsToCsv,
  createProofPhotoDataUrl,
  type InventoryItem,
  type LoanTransaction,
} from '../src/utils/inventoryLogic';
import {
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from '../src/data/seedData';

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// PRAMUKA MAN 11 JAKARTA — KEMAH PELANTIKAN BANTARA 2026
// ============================================================================

test('Scenario 4.1: End-to-end Kemah Pelantikan Bantara camp preparation, loan, damaged return, official letters & CSV audit', () => {
  // --------------------------------------------------------------------------
  // STEP 1: Fresh Storage Initialization with MAN 11 Preloaded Seed Data
  // --------------------------------------------------------------------------
  const storage = new MockLocalStorage();
  const store = new SiPrakaStateStore(storage);

  const initialItems = store.getItems();
  assert.equal(initialItems.length, 8, 'Must initialize with 8 MAN 11 items');
  const initialMembers = store.getMembers();
  assert.equal(initialMembers.length, 4, 'Must initialize with 4 scout members');

  // Identify Borrower (Neo Willyan Pratama - Penegak Bantara)
  const borrower = initialMembers.find((m) => m.name.includes('Neo Willyan'))!;
  assert.ok(borrower);
  assert.equal(borrower.nia, '06.171.2025.018');

  // Identify Approving Officers
  const officer = DEWAN_INVENTARIS_LIST.find((o) => o.name.includes('Fatihah Bilqist'))!;
  const pradana = PRADANA_LIST.find((p) => p.name.includes('Ahmad Fauzan'))!;
  assert.ok(officer);
  assert.ok(pradana);

  // Identify Equipment Items to Borrow
  const tongkat = store.getItemByBarcode('BRG-KBU-001')!; // Tongkat Panjang
  const tenda = store.getItemByBarcode('BRG-KBU-002')!; // Tenda Dome
  const kompas = store.getItemByBarcode('BRG-KBU-003')!; // Kompas Bidik
  const cooking = store.getItemByBarcode('BRG-KBU-004')!; // Cooking Set
  const kompor = store.getItemByBarcode('BRG-KBU-008')!; // Kompor Lapangan

  const initAvailTongkat = getAvailableQty(tongkat);
  const initAvailTenda = getAvailableQty(tenda);
  const initAvailKompas = getAvailableQty(kompas);
  const initAvailCooking = getAvailableQty(cooking);
  const initAvailKompor = getAvailableQty(kompor);

  // --------------------------------------------------------------------------
  // STEP 2: Stock Boundary Validation before Adding to Borrow Cart
  // --------------------------------------------------------------------------
  // We need: 20 Tongkat, 3 Tenda, 4 Kompas, 3 Cooking Set, 2 Kompor
  const checkTongkat = calculateAllowedCartQty(tongkat, 0, 20);
  assert.equal(checkTongkat.allowed, true);
  assert.equal(checkTongkat.newQty, 20);

  const checkTenda = calculateAllowedCartQty(tenda, 0, 3);
  assert.equal(checkTenda.allowed, true);
  assert.equal(checkTenda.newQty, 3);

  const checkKompas = calculateAllowedCartQty(kompas, 0, 4);
  assert.equal(checkKompas.allowed, true);
  assert.equal(checkKompas.newQty, 4);

  const checkCooking = calculateAllowedCartQty(cooking, 0, 3);
  assert.equal(checkCooking.allowed, true);
  assert.equal(checkCooking.newQty, 3);

  const checkKompor = calculateAllowedCartQty(kompor, 0, 2);
  assert.equal(checkKompor.allowed, true);
  assert.equal(checkKompor.newQty, 2);

  // --------------------------------------------------------------------------
  // STEP 3: Create Borrow Request with Dual Proof Photos
  // --------------------------------------------------------------------------
  const txId = 'TRX-2026-PELANTIKAN-01';
  const borrowDate = '2026-08-14T07:30:00';
  const dueDate = '2026-08-16T17:00:00';
  const purpose = 'Kemah Pelantikan Penegak Bantara 2026 di Buperta Cibubur';

  const photoBefore = createProofPhotoDataUrl(
    'before',
    'Paket Kemah 5 Item (Tongkat, Tenda, Kompas, Cooking, Kompor)',
    borrower.name,
    'Jumat, 14 Agustus 2026'
  );
  const photoHandoverBorrow = createProofPhotoDataUrl(
    'handover_borrow',
    'Serah Terima Logistik Kemah',
    `${borrower.name} & ${officer.name}`,
    'Jumat, 14 Agustus 2026'
  );

  const newTx: LoanTransaction = {
    id: txId,
    memberId: borrower.id,
    memberName: borrower.name,
    memberKelas: borrower.kelas,
    memberJabatan: `${borrower.jabatan} — ${borrower.sangga}`,
    memberSignature: borrower.signatureDataUrl,
    officerId: '',
    officerName: 'Menunggu ACC',
    officerSignature: '',
    pradanaName: 'Menunggu ACC',
    pradanaSignature: '',
    purpose,
    borrowDate,
    dueDate,
    status: 'pending_borrow',
    items: [
      { itemId: tongkat.id, barcode: tongkat.barcode, name: tongkat.name, qty: 20, conditionBefore: 'Baik' },
      { itemId: tenda.id, barcode: tenda.barcode, name: tenda.name, qty: 3, conditionBefore: 'Baik' },
      { itemId: kompas.id, barcode: kompas.barcode, name: kompas.name, qty: 4, conditionBefore: 'Baik' },
      { itemId: cooking.id, barcode: cooking.barcode, name: cooking.name, qty: 3, conditionBefore: 'Baik' },
      { itemId: kompor.id, barcode: kompor.barcode, name: kompor.name, qty: 2, conditionBefore: 'Baik' },
    ],
    photoConditionBefore: photoBefore,
    photoHandoverBorrow: photoHandoverBorrow,
  };

  store.createBorrowRequest(newTx);
  assert.equal(store.getTransactionById(txId)?.status, 'pending_borrow');

  // --------------------------------------------------------------------------
  // STEP 4: Dewan Inventaris & Pradana ACC Approval
  // --------------------------------------------------------------------------
  const approvedBorrowTx = store.approveBorrow(txId, officer, pradana);
  assert.equal(approvedBorrowTx.status, 'active_borrowed');
  assert.equal(approvedBorrowTx.officerName, officer.name);
  assert.equal(approvedBorrowTx.pradanaName, pradana.name);

  // Verify stock decrements across all 5 items
  assert.equal(getAvailableQty(store.getItemById(tongkat.id)!), initAvailTongkat - 20);
  assert.equal(getAvailableQty(store.getItemById(tenda.id)!), initAvailTenda - 3);
  assert.equal(getAvailableQty(store.getItemById(kompas.id)!), initAvailKompas - 4);
  assert.equal(getAvailableQty(store.getItemById(cooking.id)!), initAvailCooking - 3);
  assert.equal(getAvailableQty(store.getItemById(kompor.id)!), initAvailKompor - 2);

  // --------------------------------------------------------------------------
  // STEP 5: Generate Official Ambalan Letter Hal 1 (Surat Peminjaman)
  // --------------------------------------------------------------------------
  const letter1Meta = buildOfficialLetterMeta(approvedBorrowTx, 'borrow');
  assert.equal(letter1Meta.title, 'SURAT KETERANGAN PEMINJAMAN BARANG PRAMUKA MAN 11 JAKARTA');
  assert.ok(letter1Meta.letterNumber.endsWith('/SKPB/KBU-06.171-06.172/2026'));
  assert.equal(letter1Meta.officerLabel, 'Nama Yang Menyerahkan');
  assert.equal(letter1Meta.memberLabel, 'Nama Peminjam');
  assert.equal(letter1Meta.dateFormatted, formatIndonesianDate(borrowDate));

  // --------------------------------------------------------------------------
  // STEP 6: Return Flow with Damaged Item Handling
  // 1 Tongkat broke during camp; all other equipment in good condition
  // --------------------------------------------------------------------------
  const photoAfter = createProofPhotoDataUrl(
    'after',
    'Pemeriksaan Pasca Kemah: 19 Tongkat Baik, 1 Patah, Tenda & Lainnya Lengkap',
    borrower.name,
    'Minggu, 16 Agustus 2026'
  );
  const photoHandoverReturn = createProofPhotoDataUrl(
    'handover_return',
    'Serah Terima Pengembalian Logistik',
    `${borrower.name} & ${officer.name}`,
    'Minggu, 16 Agustus 2026'
  );

  store.submitReturnRequest(
    txId,
    '19 Tongkat baik, 1 Tongkat patah; Tenda, Kompas, Cooking Set, Kompor baik lengkap',
    photoAfter,
    photoHandoverReturn
  );
  assert.equal(store.getTransactionById(txId)?.status, 'pending_return');

  // Officer inspects and approves return, recording 1 damaged Tongkat
  const approvedReturnTx = store.approveReturn(txId, officer, pradana, {
    [tongkat.id]: 1,
  });
  assert.equal(approvedReturnTx.status, 'returned');
  assert.ok(approvedReturnTx.returnDate);

  // Verify stock accounting:
  // - Tongkat: available restored by 19, damagedQty increased by 1
  assert.equal(getAvailableQty(store.getItemById(tongkat.id)!), initAvailTongkat - 1);
  assert.equal(store.getItemById(tongkat.id)!.damagedQty, tongkat.damagedQty + 1);

  // - All other items: fully restored to original availability
  assert.equal(getAvailableQty(store.getItemById(tenda.id)!), initAvailTenda);
  assert.equal(getAvailableQty(store.getItemById(kompas.id)!), initAvailKompas);
  assert.equal(getAvailableQty(store.getItemById(cooking.id)!), initAvailCooking);
  assert.equal(getAvailableQty(store.getItemById(kompor.id)!), initAvailKompor);

  // --------------------------------------------------------------------------
  // STEP 7: Generate Official Ambalan Letter Hal 2 (Surat Pengembalian)
  // --------------------------------------------------------------------------
  const letter2Meta = buildOfficialLetterMeta(approvedReturnTx, 'return');
  assert.equal(letter2Meta.title, 'SURAT KETERANGAN PENGEMBALIAN BARANG PRAMUKA MAN 11 JAKARTA');
  assert.ok(letter2Meta.letterNumber.endsWith('/SKKBP/KBU-06.171-06.172/2026'));
  assert.equal(letter2Meta.officerLabel, 'Nama yang Menerima');

  // --------------------------------------------------------------------------
  // STEP 8: CSV Data Export Audit
  // --------------------------------------------------------------------------
  const inventoryCsv = exportInventoryToCsv(store.getItems());
  assert.ok(inventoryCsv.includes('Tongkat Panjang'), 'Inventory CSV contains Tongkat Panjang');
  assert.ok(inventoryCsv.includes(String(tongkat.damagedQty + 1)), 'CSV reflects updated damaged count');

  const transactionsCsv = exportTransactionsToCsv(store.getTransactions());
  assert.ok(transactionsCsv.includes(txId), 'Transactions CSV contains Pelantikan transaction');
  assert.ok(transactionsCsv.includes('returned'), 'Transactions CSV records returned status');
  assert.ok(transactionsCsv.includes('Neo Willyan Pratama'), 'Transactions CSV records borrower');

  // --------------------------------------------------------------------------
  // STEP 9: Rehydration & Persistence across App Restart
  // --------------------------------------------------------------------------
  const reloadedStore = new SiPrakaStateStore(storage);
  const reloadedTx = reloadedStore.getTransactionById(txId)!;
  assert.equal(reloadedTx.status, 'returned');
  assert.equal(reloadedTx.items.length, 5);

  const reloadedTongkat = reloadedStore.getItemById(tongkat.id)!;
  assert.equal(reloadedTongkat.damagedQty, tongkat.damagedQty + 1);
  assert.equal(getAvailableQty(reloadedTongkat), initAvailTongkat - 1);
});
