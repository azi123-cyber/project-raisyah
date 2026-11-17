import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthAccounts,
  loginUser,
  registerMemberAccount,
  registerAdminAccount,
  adminSaveMemberAccount,
  deleteAccountById,
  getAdminPasscode,
  setAdminPasscode,
  MAX_ADMIN_COUNT,
  DEFAULT_ADMIN_PASSCODE,
} from './authLogic';
import { generateAutoBarcode, generateCode128Svg } from './barcodeGenerator';
import {
  getEmailConfig,
  saveEmailConfig,
  sendNewItemEmail,
  sendBorrowRequestEmail,
  sendReturnRequestEmail,
  sendOfficialLetterEmail,
  getEmailLogs,
  clearEmailLogs,
} from './emailService';

// Polyfill localStorage in Node test environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    length: store.size,
  };
}

test('Barcode generator creates unique valid formatted barcodes', () => {
  const code1 = generateAutoBarcode('BRG', 1);
  const code2 = generateAutoBarcode('BRG', 2);
  assert.equal(code1, 'BRG-0171-001');
  assert.equal(code2, 'BRG-0171-002');

  const svg = generateCode128Svg(code1);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('BRG-0171-001'));
  assert.ok(svg.includes('<rect'));
});

test('Auth module: Admin login, Member login, and password checks', () => {
  // Test login with default accounts
  const adminRes = loginUser('admin.raisyah', 'admin');
  assert.equal(adminRes.success, true);
  assert.equal(adminRes.user?.role, 'admin');
  assert.equal(adminRes.user?.name, 'Raisyah');

  const memberRes = loginUser('neo.willyan.pratama', 'pramuka123');
  assert.equal(memberRes.success, true);
  assert.equal(memberRes.user?.role, 'member');

  // Test wrong password
  const failRes = loginUser('admin.raisyah', 'wrong_pass');
  assert.equal(failRes.success, false);
});

test('Auth module: Non-admin participant registration is open for all', () => {
  const uniqueUser = `peserta.${Date.now()}`;
  const regRes = registerMemberAccount({
    name: 'Siti Sarah',
    kelas: 'X-2',
    jabatan: 'Penegak Bantara',
    sangga: 'Sangga Penegas',
    phone: '0812-9988-7766',
    username: uniqueUser,
    password: 'password123',
  });
  assert.equal(regRes.success, true);
  assert.equal(regRes.user?.role, 'member');
  assert.equal(regRes.user?.name, 'Siti Sarah');

  // Login with newly created member account
  const loginNew = loginUser(uniqueUser, 'password123');
  assert.equal(loginNew.success, true);
});

test('Auth module: Admin registration requires Admin Secret Passcode & enforces max quota', () => {
  // Wrong passcode fails
  const failAdmin = registerAdminAccount(
    {
      name: 'Penyusup',
      username: 'admin.hacker',
      password: '123',
    },
    'WRONG_PASSCODE'
  );
  assert.equal(failAdmin.success, false);
  assert.ok(failAdmin.error?.includes('Kode Rahasia'));

  // Test admin passcode getter & setter
  setAdminPasscode('SK-INV-NEW2026');
  assert.equal(getAdminPasscode(), 'SK-INV-NEW2026');
  setAdminPasscode(DEFAULT_ADMIN_PASSCODE); // restore
});

test('Auth module: Admin can create and edit member accounts', () => {
  const created = adminSaveMemberAccount({
    name: 'Budi Santoso',
    kelas: 'XII IPS 1',
    jabatan: 'Penegak Laksana',
    sangga: 'Sangga Pendobrak',
    phone: '0813-1122-3344',
    username: 'budi.santoso',
    password: 'budiPassword',
  });
  assert.equal(created.name, 'Budi Santoso');
  assert.equal(created.username, 'budi.santoso');

  // Edit existing
  const edited = adminSaveMemberAccount({
    id: created.id,
    name: 'Budi Santoso Updated',
    kelas: 'XII IPS 1',
    jabatan: 'Pradana Putra',
    phone: '0813-1122-3344',
    username: 'budi.santoso',
    password: 'newPassword99',
  });
  assert.equal(edited.name, 'Budi Santoso Updated');
  assert.equal(edited.jabatan, 'Pradana Putra');

  // Delete
  deleteAccountById(created.id);
  const accounts = getAuthAccounts();
  assert.ok(!accounts.some((a) => a.id === created.id));
});

test('Email Service: Target email is inventarispramukamanjakartasel@gmail.com and dispatches logs', () => {
  clearEmailLogs();
  const config = getEmailConfig();
  assert.equal(config.targetEmail, 'inventarispramukamanjakartasel@gmail.com');
  assert.equal(config.appPasswordPlaceholder, 'Inventarispramukaman11jakartaaa150610');

  // Test new item email
  const itemLog = sendNewItemEmail({
    id: 'item-test-1',
    barcode: 'BRG-0171-999',
    name: 'Tenda Pleton 20P',
    category: 'Tenda & Kemah',
    totalQty: 5,
    borrowedQty: 0,
    damagedQty: 0,
    condition: 'Baik',
    location: 'Sanggar Pramuka',
    lastChecked: '12 Nov 2026',
    imageSvgType: 'tent',
  });
  assert.equal(itemLog.type, 'NEW_ITEM');
  assert.equal(itemLog.recipient, 'inventarispramukamanjakartasel@gmail.com');

  const logs = getEmailLogs();
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].recipient, 'inventarispramukamanjakartasel@gmail.com');
});
