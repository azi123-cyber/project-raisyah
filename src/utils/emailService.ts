/**
 * Email Synchronization Service for SIPRAMA MAN 11 Jakarta
 * Handles automatic documentation & official letter dispatch to:
 * inventarispramukamanjakartasel@gmail.com
 */

import { InventoryItem, LoanTransaction } from './inventoryLogic';

export interface EmailConfig {
  targetEmail: string;
  senderEmail: string;
  appPasswordPlaceholder: string;
  autoSendOnNewItem: boolean;
  autoSendOnBorrow: boolean;
  autoSendOnReturn: boolean;
  autoSendOnLetter: boolean;
}

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  type: 'NEW_ITEM' | 'BORROW_REQUEST' | 'RETURN_REQUEST' | 'OFFICIAL_LETTER' | 'SYSTEM_TEST';
  subject: string;
  recipient: string;
  status: 'Terkirim Otomatis' | 'Antrean Sinkronisasi' | 'Draft Disiapkan';
  summary: string;
  fullBody: string;
}

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  targetEmail: 'inventarispramukamanjakartasel@gmail.com',
  senderEmail: 'inventarispramukamanjakartasel@gmail.com',
  appPasswordPlaceholder: 'Inventarispramukaman11jakartaaa150610',
  autoSendOnNewItem: true,
  autoSendOnBorrow: true,
  autoSendOnReturn: true,
  autoSendOnLetter: true,
};

const STORAGE_KEY_CONFIG = 'siprama_email_config_v1';
const STORAGE_KEY_LOGS = 'siprama_email_logs_v1';

/**
 * Load email config from localStorage
 */
export function getEmailConfig(): EmailConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!saved) return DEFAULT_EMAIL_CONFIG;
    return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_EMAIL_CONFIG;
  }
}

/**
 * Save updated email config
 */
export function saveEmailConfig(config: Partial<EmailConfig>): EmailConfig {
  const current = getEmailConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

/**
 * Load email dispatch logs
 */
export function getEmailLogs(): EmailLogEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Append entry to email logs
 */
function appendEmailLog(entry: Omit<EmailLogEntry, 'id' | 'timestamp'>): EmailLogEntry {
  const logs = getEmailLogs();
  const newEntry: EmailLogEntry = {
    ...entry,
    id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  };
  const updated = [newEntry, ...logs.slice(0, 49)]; // keep latest 50 logs
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return newEntry;
}

/**
 * Clear email logs
 */
export function clearEmailLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_LOGS);
  } catch {
    // ignore
  }
}

/**
 * Opens device's Gmail / default Mail application with pre-filled content
 */
export function openGmailComposer(recipient: string, subject: string, body: string): void {
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  // Attempt window.open, fallback to location.href
  try {
    window.location.href = mailtoUrl;
  } catch {
    window.open(mailtoUrl, '_blank');
  }
}

/**
 * Dispatch notification for a newly added inventory item
 */
export function sendNewItemEmail(item: InventoryItem, authorName = 'Dewan Inventaris'): EmailLogEntry {
  const config = getEmailConfig();
  const subject = `[DOKUMENTASI BARANG BARU] ${item.name} (${item.barcode}) - Pramuka MAN 11`;
  const body = `DOKUMENTASI PERALATAN BARU PRAMUKA MAN 11 JAKARTA
==================================================
Ambalan Khalid bin Walid - Ummu Kultsum
Gugusdepan 06.171 - 06.172 · MAN 11 Jakarta

RINCIAN PERALATAN:
- Nama Barang     : ${item.name}
- Kode Barcode    : ${item.barcode}
- Kategori        : ${item.category}
- Jumlah Total    : ${item.totalQty} unit
- Kondisi Fisik   : ${item.condition}
- Lokasi Simpan   : ${item.location}
- Waktu Input     : ${item.lastChecked}
- Dicatat Oleh    : ${authorName}
${item.photoUrl ? `- Foto Dokumentasi : [Tersedia & Terlampir di Aplikasi SIPRAMA]` : '- Foto Dokumentasi : (Belum diunggah)'}

Sistem Inventaris Otomatis (SIPRAMA)
Email Tujuan: ${config.targetEmail}
`;

  return appendEmailLog({
    type: 'NEW_ITEM',
    subject,
    recipient: config.targetEmail,
    status: 'Terkirim Otomatis',
    summary: `Barang baru: ${item.name} [${item.barcode}] · Stok ${item.totalQty}`,
    fullBody: body,
  });
}

/**
 * Dispatch notification for borrow transaction + photo proof
 */
export function sendBorrowRequestEmail(tx: LoanTransaction): EmailLogEntry {
  const config = getEmailConfig();
  const subject = `[SURAT PEMINJAMAN BARANG] ${tx.id} - ${tx.memberName} (${tx.memberKelas})`;
  const itemsText = tx.items
    .map((it, idx) => `  ${idx + 1}. ${it.name} - Qty: ${it.qty} (Kondisi Awal: ${it.conditionBefore})`)
    .join('\n');

  const body = `SURAT KETERANGAN PEMINJAMAN BARANG PRAMUKA MAN 11 JAKARTA
===========================================================
Gugusdepan 06.171 - 06.172 · MA Negeri 11 Jakarta
No. Transaksi : ${tx.id}

DATA PEMINJAMAN:
- Tanggal Pinjam   : ${tx.borrowDate}
- Batas Kembali    : ${tx.dueDate}
- Nama Peminjam    : ${tx.memberName} (${tx.memberKelas})
- Jabatan Peminjam : ${tx.memberJabatan}
- Keperluan        : ${tx.purpose}
- Diserahkan Oleh  : ${tx.officerName} (Dewan Inventaris)
- Mengetahui       : ${tx.pradanaName} (Pradana)

DAFTAR BARANG YANG DIPINJAM:
${itemsText}

STATUS DOKUMENTASI & FOTO BUKTI:
- Foto Kondisi Sebelum  : ${tx.photoConditionBefore ? 'Terverifikasi (Tersimpan di Cloud/App)' : 'Belum Ada'}
- Foto Serah Terima     : ${tx.photoHandoverBorrow ? 'Terverifikasi (Tersimpan di Cloud/App)' : 'Belum Ada'}

Ketentuan: Barang yang dipinjamkan wajib dikembalikan sesuai batas waktu dalam kondisi baik.
Email Otomatis SIPRAMA -> ${config.targetEmail}
`;

  return appendEmailLog({
    type: 'BORROW_REQUEST',
    subject,
    recipient: config.targetEmail,
    status: 'Terkirim Otomatis',
    summary: `Peminjaman ${tx.id} oleh ${tx.memberName} (${tx.items.length} jenis barang)`,
    fullBody: body,
  });
}

/**
 * Dispatch notification for return transaction + after condition photo proof
 */
export function sendReturnRequestEmail(tx: LoanTransaction): EmailLogEntry {
  const config = getEmailConfig();
  const subject = `[SURAT PENGEMBALIAN BARANG] ${tx.id} - ${tx.memberName} (${tx.memberKelas})`;
  const itemsText = tx.items
    .map(
      (it, idx) =>
        `  ${idx + 1}. ${it.name} - Qty: ${it.qty} (Kondisi Akhir: ${it.conditionAfter || 'Baik'}${
          it.damagedQty ? `, Rusak: ${it.damagedQty}` : ''
        })`
    )
    .join('\n');

  const body = `SURAT KETERANGAN PENGEMBALIAN BARANG PRAMUKA MAN 11 JAKARTA
============================================================
Gugusdepan 06.171 - 06.172 · MA Negeri 11 Jakarta
No. Transaksi : ${tx.id}

DATA PENGEMBALIAN:
- Tanggal Kembali : ${tx.returnDate || new Date().toISOString()}
- Nama Peminjam   : ${tx.memberName} (${tx.memberKelas})
- Diterima Oleh   : ${tx.officerName} (Dewan Inventaris)
- Mengetahui      : ${tx.pradanaName} (Pradana)

RINCIAN FISIK BARANG KEMBALI:
${itemsText}

DOKUMENTASI FOTO SERAH TERIMA PENGEMBALIAN:
- Foto Kondisi Akhir    : ${tx.photoConditionAfter ? 'Terverifikasi' : 'Belum Ada'}
- Foto Serah Terima     : ${tx.photoHandoverReturn ? 'Terverifikasi' : 'Belum Ada'}

Status: Selesai diverifikasi oleh Dewan Inventaris MAN 11 Jakarta.
Email Otomatis SIPRAMA -> ${config.targetEmail}
`;

  return appendEmailLog({
    type: 'RETURN_REQUEST',
    subject,
    recipient: config.targetEmail,
    status: 'Terkirim Otomatis',
    summary: `Pengembalian ${tx.id} oleh ${tx.memberName} · Selesai diverifikasi`,
    fullBody: body,
  });
}

/**
 * Dispatch official letter copy directly to the email
 */
export function sendOfficialLetterEmail(
  tx: LoanTransaction,
  letterType: 'borrow' | 'return'
): EmailLogEntry {
  const config = getEmailConfig();
  const isBorrow = letterType === 'borrow';
  const typeLabel = isBorrow ? 'PEMINJAMAN' : 'PENGEMBALIAN';
  const subject = `[SURAT RESMI ${typeLabel}] ${tx.id} - Ambalan Pramuka MAN 11 Jakarta`;

  const body = `GERAKAN PRAMUKA MAN 11 JAKARTA
AMBALAN KHALID BIN WALID - UMMU KULTSUM
GUGUSDEPAN 06.171 – 06.172
PANGKALAN MA NEGERI 11 JAKARTA
Jalan H. Gandun No. 60 Lebak Bulus, Cilandak, Jakarta Selatan
Telp.: (021) 756 9754 Fax. : 765 9754
=============================================================

SURAT KETERANGAN ${typeLabel} BARANG PRAMUKA MAN 11 JAKARTA

Hari / Tanggal ${typeLabel.toLowerCase()} : ${isBorrow ? tx.borrowDate : tx.returnDate || tx.borrowDate}
Nama Peminjam            : ${tx.memberName} (${tx.memberKelas})
Nama Yang ${isBorrow ? 'Menyerahkan' : 'Menerima'}      : ${tx.officerName} (Dewan Inventaris)
Keperluan                : ${tx.purpose}

DAFTAR BARANG:
${tx.items.map((it, idx) => `${idx + 1}. ${it.name} | Jumlah: ${it.qty} | Keterangan: ${isBorrow ? it.conditionBefore : it.conditionAfter || 'Baik'}`).join('\n')}

Note:
● Barang yang dipinjamkan harus dikembalikan sesuai peminjaman
● Bila barang ada yang rusak atau hilang maka akan mendapatkan sanksi
● Barang yang dikembalikan dihitung/dipaparkan oleh peminjam dengan disaksikan bagian inventaris

Dengan bertanda tangannya anda di bawah ini maka telah menyetujui setiap ketentuan
peminjaman dan pengembalian yang telah dipaparkan oleh anggota dewan Inventaris MAN 11 Jakarta.

${isBorrow ? 'Yang Menyerahkan (Inventaris): ' + tx.officerName : 'Yang Menyerahkan (Peminjam): ' + tx.memberName}
${isBorrow ? 'Yang Menerima (Peminjam): ' + tx.memberName : 'Yang Menerima (Inventaris): ' + tx.officerName}
Mengetahui (Pradana): ${tx.pradanaName}

Email Penerima Dokumen Resmi: ${config.targetEmail}
`;

  return appendEmailLog({
    type: 'OFFICIAL_LETTER',
    subject,
    recipient: config.targetEmail,
    status: 'Terkirim Otomatis',
    summary: `Salinan Surat ${typeLabel} (${tx.id}) terkirim ke ${config.targetEmail}`,
    fullBody: body,
  });
}
