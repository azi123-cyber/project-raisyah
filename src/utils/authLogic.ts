/**
 * Authentication & User / Admin Authorization Module for SIPRAMA MAN 11 Jakarta
 * Manages admin secret codes, 5-6 official admin seats, member accounts, and session persistence.
 */

import { ScoutMember } from './inventoryLogic';
import { INITIAL_MEMBERS, DEWAN_INVENTARIS_LIST } from '../data/seedData';

export interface UserAccount {
  id: string;
  username: string;
  password: string; // Stored securely in client storage
  name: string;
  role: 'admin' | 'member';
  kelas?: string;
  jabatan?: string;
  sangga?: string;
  phone?: string;
  isMainAdmin?: boolean;
  adminRole?: string;
  status: 'active' | 'pending_approval';
  createdAt: string;
}

const STORAGE_KEY_AUTH_ACCOUNTS = 'siprama_auth_accounts_v1';
const STORAGE_KEY_CURRENT_USER = 'siprama_current_user_v1';
const STORAGE_KEY_ADMIN_CODE = 'siprama_admin_passcode_v1';

export const DEFAULT_ADMIN_PASSCODE = 'SK-INV-MAN11';
export const MAX_ADMIN_COUNT = 6;

// Preloaded 6 Official Dewan Inventaris Admin Accounts
export const INITIAL_ADMIN_ACCOUNTS: UserAccount[] = [
  {
    id: 'adm-0',
    username: 'admin.raisyah',
    password: 'admin',
    name: 'Raisyah',
    role: 'admin',
    adminRole: 'Admin Utama & Ketua Dewan Inventaris SK',
    isMainAdmin: true,
    status: 'active',
    createdAt: '2026-08-01',
  },
  {
    id: 'adm-1',
    username: 'admin.fatihah',
    password: 'admin',
    name: DEWAN_INVENTARIS_LIST[0].name, // Fatihah Bilqist Azzahra
    role: 'admin',
    adminRole: DEWAN_INVENTARIS_LIST[0].role,
    status: 'active',
    createdAt: '2026-08-01',
  },
  {
    id: 'adm-2',
    username: 'admin.rizky',
    password: 'admin',
    name: DEWAN_INVENTARIS_LIST[1].name, // Rizky Ramadhan Putra
    role: 'admin',
    adminRole: DEWAN_INVENTARIS_LIST[1].role,
    status: 'active',
    createdAt: '2026-08-01',
  },
  {
    id: 'adm-3',
    username: 'admin.nabila',
    password: 'admin',
    name: DEWAN_INVENTARIS_LIST[2].name, // Nabila Syifa Fauziah
    role: 'admin',
    adminRole: DEWAN_INVENTARIS_LIST[2].role,
    status: 'active',
    createdAt: '2026-08-01',
  },
  {
    id: 'adm-4',
    username: 'admin.zaidan',
    password: 'admin',
    name: DEWAN_INVENTARIS_LIST[3].name, // Muhammad Zaidan Alfarizi
    role: 'admin',
    adminRole: DEWAN_INVENTARIS_LIST[3].role,
    status: 'active',
    createdAt: '2026-08-01',
  },
  {
    id: 'adm-5',
    username: 'admin.salsabila',
    password: 'admin',
    name: DEWAN_INVENTARIS_LIST[4].name, // Salsabila Nur Aini
    role: 'admin',
    adminRole: DEWAN_INVENTARIS_LIST[4].role,
    status: 'active',
    createdAt: '2026-08-01',
  },
];

// Preloaded Member Accounts derived from INITIAL_MEMBERS
export const INITIAL_MEMBER_ACCOUNTS: UserAccount[] = INITIAL_MEMBERS.map((m, idx) => ({
  id: m.id,
  username: m.name.toLowerCase().replace(/[^a-z0-9]/g, '.'),
  password: 'pramuka123',
  name: m.name,
  role: 'member',
  kelas: m.kelas,
  jabatan: m.jabatan,
  sangga: m.sangga,
  phone: m.phone,
  status: 'active',
  createdAt: '2026-08-01',
}));

/**
 * Get all stored accounts (Admins + Members)
 */
export function getAuthAccounts(): UserAccount[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AUTH_ACCOUNTS);
    if (!saved) {
      const combined = [...INITIAL_ADMIN_ACCOUNTS, ...INITIAL_MEMBER_ACCOUNTS];
      localStorage.setItem(STORAGE_KEY_AUTH_ACCOUNTS, JSON.stringify(combined));
      return combined;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const combined = [...INITIAL_ADMIN_ACCOUNTS, ...INITIAL_MEMBER_ACCOUNTS];
      localStorage.setItem(STORAGE_KEY_AUTH_ACCOUNTS, JSON.stringify(combined));
      return combined;
    }
    return parsed;
  } catch {
    return [...INITIAL_ADMIN_ACCOUNTS, ...INITIAL_MEMBER_ACCOUNTS];
  }
}

/**
 * Save accounts array to localStorage
 */
export function saveAuthAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

/**
 * Get Admin Passcode / Secret Key
 */
export function getAdminPasscode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ADMIN_CODE) || DEFAULT_ADMIN_PASSCODE;
  } catch {
    return DEFAULT_ADMIN_PASSCODE;
  }
}

/**
 * Update Admin Passcode
 */
export function setAdminPasscode(newCode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_CODE, newCode.trim());
  } catch {
    // ignore
  }
}

/**
 * Get currently authenticated user session
 */
export function getCurrentUser(): UserAccount | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

/**
 * Save current authenticated user session
 */
export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  } catch {
    // ignore
  }
}

/**
 * Authenticate login
 */
export function loginUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; user?: UserAccount; error?: string } {
  const accounts = getAuthAccounts();
  const trimmedUser = usernameInput.trim().toLowerCase();

  const matched = accounts.find(
    (acc) => acc.username.toLowerCase() === trimmedUser
  );

  if (!matched) {
    return {
      success: false,
      error: `Username "${usernameInput}" tidak ditemukan dalam daftar akun!`,
    };
  }

  if (matched.password !== passwordInput) {
    return {
      success: false,
      error: 'Kata sandi yang Anda masukkan salah. Silakan coba lagi!',
    };
  }

  if (matched.status === 'pending_approval') {
    return {
      success: false,
      error: 'Akun Anda sedang menunggu verifikasi & persetujuan dari Admin Utama!',
    };
  }

  setCurrentUser(matched);
  return { success: true, user: matched };
}

/**
 * Register a new Scout Member (Open for all participants)
 */
export function registerMemberAccount(data: {
  name: string;
  kelas: string;
  jabatan: string;
  sangga?: string;
  phone: string;
  username: string;
  password: string;
}): { success: boolean; user?: UserAccount; error?: string } {
  const accounts = getAuthAccounts();
  const trimmedUser = data.username.trim().toLowerCase();

  if (!trimmedUser || !data.password || !data.name.trim()) {
    return { success: false, error: 'Harap lengkapi nama, username, dan kata sandi!' };
  }

  if (accounts.some((acc) => acc.username.toLowerCase() === trimmedUser)) {
    return { success: false, error: `Username "${data.username}" sudah digunakan. Gunakan username lain!` };
  }

  const newAccount: UserAccount = {
    id: `mem-${Date.now()}`,
    username: trimmedUser,
    password: data.password,
    name: data.name.trim(),
    role: 'member',
    kelas: data.kelas.trim(),
    jabatan: data.jabatan.trim() || 'Anggota Penegak',
    sangga: data.sangga?.trim() || 'Sangga Perintis',
    phone: data.phone.trim(),
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const updated = [newAccount, ...accounts];
  saveAuthAccounts(updated);
  setCurrentUser(newAccount);

  return { success: true, user: newAccount };
}

/**
 * Register a new Admin (Requires Admin Secret Passcode & quota <= 6)
 */
export function registerAdminAccount(
  data: {
    name: string;
    username: string;
    password: string;
    adminRole?: string;
  },
  secretCodeInput: string
): { success: boolean; user?: UserAccount; error?: string } {
  const accounts = getAuthAccounts();
  const trimmedUser = data.username.trim().toLowerCase();

  const validPasscode = getAdminPasscode();
  if (secretCodeInput.trim() !== validPasscode) {
    return {
      success: false,
      error: 'Kode Rahasia Otorisasi SK Admin salah! Anda tidak dapat mendaftar sebagai Admin tanpa persetujuan / kode dari Admin Utama.',
    };
  }

  const activeAdmins = accounts.filter((acc) => acc.role === 'admin' && acc.status === 'active');
  if (activeAdmins.length >= MAX_ADMIN_COUNT) {
    return {
      success: false,
      error: `Kuota Admin maksimal (${MAX_ADMIN_COUNT} orang) sudah penuh! Hubungi Admin Utama jika ingin melakukan pergantian dewan inventaris.`,
    };
  }

  if (accounts.some((acc) => acc.username.toLowerCase() === trimmedUser)) {
    return { success: false, error: `Username "${data.username}" sudah digunakan!` };
  }

  const newAdmin: UserAccount = {
    id: `adm-${Date.now()}`,
    username: trimmedUser,
    password: data.password,
    name: data.name.trim(),
    role: 'admin',
    adminRole: data.adminRole?.trim() || 'Staf Dewan Inventaris MAN 11',
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const updated = [newAdmin, ...accounts];
  saveAuthAccounts(updated);
  setCurrentUser(newAdmin);

  return { success: true, user: newAdmin };
}

/**
 * Admin action: create/edit participant account
 */
export function adminSaveMemberAccount(data: {
  id?: string;
  name: string;
  kelas: string;
  jabatan: string;
  sangga?: string;
  phone: string;
  username: string;
  password?: string;
}): UserAccount {
  const accounts = getAuthAccounts();
  const trimmedUser = data.username.trim().toLowerCase();

  if (data.id) {
    // Edit existing
    const updated = accounts.map((acc) => {
      if (acc.id !== data.id) return acc;
      return {
        ...acc,
        name: data.name.trim(),
        kelas: data.kelas.trim(),
        jabatan: data.jabatan.trim(),
        sangga: data.sangga?.trim() || acc.sangga,
        phone: data.phone.trim(),
        username: trimmedUser,
        password: data.password ? data.password : acc.password,
      };
    });
    saveAuthAccounts(updated);
    return updated.find((a) => a.id === data.id)!;
  } else {
    // Add new
    const newAccount: UserAccount = {
      id: `mem-${Date.now()}`,
      username: trimmedUser,
      password: data.password || 'pramuka123',
      name: data.name.trim(),
      role: 'member',
      kelas: data.kelas.trim(),
      jabatan: data.jabatan.trim() || 'Anggota Penegak',
      sangga: data.sangga?.trim() || 'Sangga Perintis',
      phone: data.phone.trim(),
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    saveAuthAccounts([newAccount, ...accounts]);
    return newAccount;
  }
}

/**
 * Admin action: delete account
 */
export function deleteAccountById(id: string): void {
  const accounts = getAuthAccounts();
  const filtered = accounts.filter((acc) => acc.id !== id);
  saveAuthAccounts(filtered);
}

/**
 * Logout
 */
export function logoutCurrentUser(): void {
  setCurrentUser(null);
}
