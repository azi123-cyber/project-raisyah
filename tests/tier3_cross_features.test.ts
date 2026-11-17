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
  type InventoryItem,
  type LoanTransaction,
  type ScoutMember,
} from '../src/utils/inventoryLogic';
import {
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from '../src/data/seedData';

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

test('C1: Multi-item borrow across 4 categories -> return subset -> check stock restoration', () => {
  const store = new SiPrakaStateStore();

  // Pick 4 items across 4 categories
  const tongkat = store.getItems().find((i) => i.category === 'Tongkat & Pionering')!;
  const tenda = store.getItems().find((i) => i.category === 'Tenda & Kemah')!;
  const kompas = store.getItems().find((i) => i.category === 'Navigasi & Komlek')!;
  const cooking = store.getItems().find((i) => i.category === 'Dapur')!;

  const availTongkat0 = getAvailableQty(tongkat);
  const availTenda0 = getAvailableQty(tenda);
  const availKompas0 = getAvailableQty(kompas);
  const availCooking0 = getAvailableQty(cooking);

  const member = store.getMembers()[0];
  const txId = 'TRX-MULTI-CAT-1';

  // Create multi-item loan
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
    purpose: 'Latihan Gabungan 4 Sangga',
    borrowDate: '2026-11-10T08:00:00',
    dueDate: '2026-11-12T17:00:00',
    status: 'pending_borrow',
    items: [
      { itemId: tongkat.id, barcode: tongkat.barcode, name: tongkat.name, qty: 10, conditionBefore: 'Baik' },
      { itemId: tenda.id, barcode: tenda.barcode, name: tenda.name, qty: 2, conditionBefore: 'Baik' },
      { itemId: kompas.id, barcode: kompas.barcode, name: kompas.name, qty: 3, conditionBefore: 'Baik' },
      { itemId: cooking.id, barcode: cooking.barcode, name: cooking.name, qty: 2, conditionBefore: 'Baik' },
    ],
    photoConditionBefore: 'data:image/svg+xml;utf8,before',
    photoHandoverBorrow: 'data:image/svg+xml;utf8,handover',
  });

  // Approve borrow
  store.approveBorrow(txId, DEWAN_INVENTARIS_LIST[0], PRADANA_LIST[0]);

  // Check all 4 items decremented in available stock
  assert.equal(getAvailableQty(store.getItemById(tongkat.id)!), availTongkat0 - 10);
  assert.equal(getAvailableQty(store.getItemById(tenda.id)!), availTenda0 - 2);
  assert.equal(getAvailableQty(store.getItemById(kompas.id)!), availKompas0 - 3);
  assert.equal(getAvailableQty(store.getItemById(cooking.id)!), availCooking0 - 2);

  // Return the items
  store.submitReturnRequest(txId, 'Semua alat kembali dalam kondisi baik', '', '');
  store.approveReturn(txId, DEWAN_INVENTARIS_LIST[0], PRADANA_LIST[0]);

  // Check all 4 items restored in available stock
  assert.equal(getAvailableQty(store.getItemById(tongkat.id)!), availTongkat0);
  assert.equal(getAvailableQty(store.getItemById(tenda.id)!), availTenda0);
  assert.equal(getAvailableQty(store.getItemById(kompas.id)!), availKompas0);
  assert.equal(getAvailableQty(store.getItemById(cooking.id)!), availCooking0);
});

test('C2: Register new member -> borrow equipment -> edit member profile -> verify transaction reflection', () => {
  const store = new SiPrakaStateStore();

  // 1. Register new member
  const newMember: ScoutMember = {
    id: 'mem-cross-1',
    name: 'Najwa Shihab Khairunnisa',
    nia: '06.172.2026.055',
    kelas: 'X-F',
    jabatan: 'Penegak Bantara',
    sangga: 'Sangga Penegas',
    phone: '081234567890',
    signatureDataUrl: 'data:image/svg+xml;utf8,sig-najwa',
  };
  store.registerMember(newMember);

  // 2. Create and approve borrow transaction
  const item = store.getItems()[0];
  const txId = 'TRX-NAJWA-01';
  store.createBorrowRequest({
    id: txId,
    memberId: newMember.id,
    memberName: newMember.name,
    memberKelas: newMember.kelas,
    memberJabatan: `${newMember.jabatan} — ${newMember.sangga}`,
    memberSignature: newMember.signatureDataUrl,
    officerId: '',
    officerName: 'Menunggu ACC',
    officerSignature: '',
    pradanaName: 'Menunggu ACC',
    pradanaSignature: '',
    purpose: 'Pionering Tiang Bendera',
    borrowDate: '2026-11-10T09:00:00',
    dueDate: '2026-11-11T16:00:00',
    status: 'pending_borrow',
    items: [{ itemId: item.id, barcode: item.barcode, name: item.name, qty: 5, conditionBefore: 'Baik' }],
    photoConditionBefore: '',
    photoHandoverBorrow: '',
  });
  store.approveBorrow(txId);

  // Verify transaction record has original member data
  let tx = store.getTransactionById(txId)!;
  assert.equal(tx.memberName, 'Najwa Shihab Khairunnisa');
  assert.equal(tx.memberKelas, 'X-F');

  // 3. Member gets promoted / updates profile
  store.updateMember({
    ...newMember,
    name: 'Najwa Shihab Khairunnisa, S.Pd',
    kelas: 'XI IPA 3',
    jabatan: 'Pradana Putri',
    sangga: 'Dewan Ambalan',
  });

  // 4. Verify transaction history cascaded the update
  tx = store.getTransactionById(txId)!;
  assert.equal(tx.memberName, 'Najwa Shihab Khairunnisa, S.Pd');
  assert.equal(tx.memberKelas, 'XI IPA 3');
  assert.equal(tx.memberJabatan, 'Pradana Putri — Dewan Ambalan');
  assert.equal(tx.id, txId);
});

test('C3: Edit and delete item safety during active loans', () => {
  const store = new SiPrakaStateStore();
  const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;
  const borrowedItemId = activeTx.items[0].itemId;
  const borrowedItem = store.getItemById(borrowedItemId)!;

  // 1. Edit the borrowed item (change location & condition notes) -> should succeed
  store.editItem({
    ...borrowedItem,
    location: 'Dipindahkan ke Sanggar Selatan',
    notes: 'Sebagian sedang dipakai LKBBT',
  });
  const edited = store.getItemById(borrowedItemId)!;
  assert.equal(edited.location, 'Dipindahkan ke Sanggar Selatan');
  assert.equal(edited.notes, 'Sebagian sedang dipakai LKBBT');
  assert.equal(edited.borrowedQty, borrowedItem.borrowedQty); // Borrowed count remains intact

  // 2. Attempt to delete borrowed item -> must be rejected
  const deleteActiveResult = store.deleteItem(borrowedItemId);
  assert.equal(deleteActiveResult.success, false);
  assert.ok(store.getItemById(borrowedItemId), 'Borrowed item must NOT be deleted');

  // 3. Add an unborrowed item and delete it -> should succeed without affecting the active loan
  const unborrowedItem: InventoryItem = {
    id: 'item-unborrowed-test',
    barcode: 'BRG-UNBORROWED-99',
    name: 'Barang Uji Unborrowed',
    category: 'Navigasi & Komlek',
    totalQty: 5,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Rak C',
    lastChecked: '2026-11-09',
    imageSvgType: 'compass',
  };
  store.addNewItem(unborrowedItem);
  const deleteUnborrowedResult = store.deleteItem('item-unborrowed-test');
  assert.equal(deleteUnborrowedResult.success, true);
  assert.equal(store.getItemById('item-unborrowed-test'), undefined);

  // Active loan remains valid
  const reloadedTx = store.getTransactionById(activeTx.id)!;
  assert.equal(reloadedTx.status, 'active_borrowed');
});

test('C4: Overdue lifecycle with alarm trigger and damaged item return handling', () => {
  const store = new SiPrakaStateStore();
  const activeTx = store.getTransactions().find((t) => t.status === 'active_borrowed')!;
  const targetItem = activeTx.items[0];
  const itemBefore = store.getItemById(targetItem.itemId)!;
  const initialDamaged = itemBefore.damagedQty;
  const initialAvailable = getAvailableQty(itemBefore);

  // 1. Trigger overdue alarm
  store.triggerMemberAlarm(activeTx.id);
  const overdueTx = store.getTransactionById(activeTx.id)!;
  assert.equal(overdueTx.status, 'overdue');
  assert.equal(overdueTx.alarmMutedUntilVerified, false);

  // 2. Borrower returns items, 2 units reported damaged
  store.submitReturnRequest(activeTx.id, '2 unit patah saat kegiatan', '', '');
  store.approveReturn(activeTx.id, DEWAN_INVENTARIS_LIST[0], PRADANA_LIST[0], {
    [targetItem.itemId]: 2,
  });

  // 3. Verify stock accounting:
  // - damagedQty increased by 2
  // - availableQty restores (totalQty - newDamagedQty - remainingBorrowed)
  const itemAfter = store.getItemById(targetItem.itemId)!;
  assert.equal(itemAfter.damagedQty, initialDamaged + 2);
  // availableQty should be restored minus the newly damaged units
  assert.equal(getAvailableQty(itemAfter), initialAvailable + targetItem.qty - 2);

  // Transaction status is now returned
  const finalTx = store.getTransactionById(activeTx.id)!;
  assert.equal(finalTx.status, 'returned');
});

test('C5: Multiple approvals by different Dewan Inventaris officers and Pradanas with distinct signatures', () => {
  const store = new SiPrakaStateStore();
  const member = store.getMembers()[0];
  const item = store.getItems()[0];

  const officer1 = DEWAN_INVENTARIS_LIST[0]; // Fatihah Bilqist (Putri)
  const officer2 = DEWAN_INVENTARIS_LIST[1]; // M. Nabil Ar-Rasyid (Putra)
  const pradana1 = PRADANA_LIST[0]; // Ahmad Fauzan (Pradana Putra)
  const pradana2 = PRADANA_LIST[1]; // Kayla Putri Salsabila (Pradana Putri)

  // Transaction 1 approved by Officer 1 & Pradana 1
  const tx1Id = 'TRX-APPROVAL-1';
  store.createBorrowRequest({
    id: tx1Id,
    memberId: member.id,
    memberName: member.name,
    memberKelas: member.kelas,
    memberJabatan: member.jabatan,
    memberSignature: member.signatureDataUrl,
    officerId: '',
    officerName: '',
    officerSignature: '',
    pradanaName: '',
    pradanaSignature: '',
    purpose: 'Lomba Tingkat',
    borrowDate: '2026-11-10T08:00:00',
    dueDate: '2026-11-12T16:00:00',
    status: 'pending_borrow',
    items: [{ itemId: item.id, barcode: item.barcode, name: item.name, qty: 2, conditionBefore: 'Baik' }],
    photoConditionBefore: '',
    photoHandoverBorrow: '',
  });
  const approved1 = store.approveBorrow(tx1Id, officer1, pradana1);

  // Transaction 2 approved by Officer 2 & Pradana 2
  const tx2Id = 'TRX-APPROVAL-2';
  store.createBorrowRequest({
    id: tx2Id,
    memberId: member.id,
    memberName: member.name,
    memberKelas: member.kelas,
    memberJabatan: member.jabatan,
    memberSignature: member.signatureDataUrl,
    officerId: '',
    officerName: '',
    officerSignature: '',
    pradanaName: '',
    pradanaSignature: '',
    purpose: 'Bakti Masyarakat',
    borrowDate: '2026-11-10T08:00:00',
    dueDate: '2026-11-12T16:00:00',
    status: 'pending_borrow',
    items: [{ itemId: item.id, barcode: item.barcode, name: item.name, qty: 1, conditionBefore: 'Baik' }],
    photoConditionBefore: '',
    photoHandoverBorrow: '',
  });
  const approved2 = store.approveBorrow(tx2Id, officer2, pradana2);

  assert.equal(approved1.officerName, officer1.name);
  assert.equal(approved1.pradanaName, pradana1.name);
  assert.equal(approved2.officerName, officer2.name);
  assert.equal(approved2.pradanaName, pradana2.name);

  // Distinct signatures verified
  assert.notEqual(approved1.officerSignature, approved2.officerSignature);
  assert.notEqual(approved1.pradanaSignature, approved2.pradanaSignature);

  // Letters generated have appropriate metadata
  const letter1 = buildOfficialLetterMeta(approved1, 'borrow');
  const letter2 = buildOfficialLetterMeta(approved2, 'borrow');
  assert.ok(letter1.letterNumber.includes('SKPB'));
  assert.ok(letter2.letterNumber.includes('SKPB'));
  assert.notEqual(letter1.letterNumber, letter2.letterNumber);
});
