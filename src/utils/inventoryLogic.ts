export type ItemCategory =
  | 'Semua'
  | 'Tongkat & Pionering'
  | 'Tenda & Kemah'
  | 'Navigasi & Komlek'
  | 'Dapur';

export interface InventoryItem {
  id: string;
  barcode: string;
  name: string;
  category: Exclude<ItemCategory, 'Semua'>;
  totalQty: number;
  borrowedQty: number;
  damagedQty: number;
  condition: 'Baik' | 'Perlu Perawatan' | 'Rusak Ringan';
  location: string;
  lastChecked: string;
  imageSvgType: 'stick' | 'tent' | 'compass' | 'cooking' | 'rope' | 'flag' | 'radio' | 'stove';
  photoUrl?: string;
  notes?: string;
}

export interface ScoutMember {
  id: string;
  name: string;
  nia: string;
  kelas: string;
  jabatan: string;
  sangga: string;
  phone: string;
  signatureDataUrl: string;
}

export interface DewanInventarisOfficer {
  id: string;
  name: string;
  role: string;
  ambalan: 'Khalid bin Walid' | 'Ummu Kultsum';
  signatureDataUrl: string;
}

export interface LoanItemEntry {
  itemId: string;
  barcode: string;
  name: string;
  qty: number;
  conditionBefore: string;
  conditionAfter?: string;
  damagedQty?: number;
}

export type LoanStatus =
  | 'pending_borrow'
  | 'active_borrowed'
  | 'overdue'
  | 'pending_return'
  | 'returned'
  | 'rejected';

export interface LoanTransaction {
  id: string;
  memberId: string;
  memberName: string;
  memberKelas: string;
  memberJabatan: string;
  memberSignature: string;
  officerId: string;
  officerName: string;
  officerSignature: string;
  pradanaName: string;
  pradanaSignature: string;
  purpose: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: LoanStatus;
  items: LoanItemEntry[];
  photoConditionBefore: string;
  photoHandoverBorrow: string;
  photoConditionAfter?: string;
  photoHandoverReturn?: string;
  notes?: string;
  alarmMutedUntilVerified?: boolean;
}

export interface InventoryStatsSummary {
  totalUnits: number;
  availableUnits: number;
  borrowedUnits: number;
  damagedOrOverdueUnits: number;
  availablePct: number;
  borrowedPct: number;
  overduePct: number;
  pendingApprovalCount: number;
  overdueTransactionCount: number;
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an authentic black-ink handwritten pen signature SVG matching the official PDF style
 */
export function createSignatureDataUrl(name: string, strokeColor = '#111111'): string {
  const cleanName = name.trim().toLowerCase();
  let pathData = '';

  if (cleanName.includes('fatihah') || cleanName.includes('nabila') || cleanName.includes('salsabila')) {
    // Vertical looping signature like Inventaris in PDF
    pathData = `
      <path d="M95,12 C75,35 78,68 92,62 C104,56 88,38 78,52 C68,66 84,78 112,58 C122,50 116,74 128,62 M98,42 L102,86 M72,74 L132,64" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  } else if (cleanName.includes('ahmad') || cleanName.includes('pradana') || cleanName.includes('kayla')) {
    // Wide slanted Pradana signature like bottom of PDF
    pathData = `
      <path d="M35,84 L85,18 C78,42 72,58 96,34 C105,25 95,48 115,32 C122,26 118,45 135,34 C144,28 142,44 158,36 M48,58 L195,42" fill="none" stroke="${strokeColor}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  } else {
    // Oval flourish signature like Peminjam (Neo Willyan Pratama) in PDF
    pathData = `
      <path d="M135,28 C78,24 38,54 52,72 C66,88 142,68 178,34 C162,54 154,68 164,66 C176,64 192,42 198,32 C188,52 182,66 186,68 M84,56 C96,46 112,58 128,44" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="92" viewBox="0 0 230 92">${pathData}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates an SVG illustration for photographic evidence (Condition Before/After & Handover with Dewan Inventaris)
 */
export function createProofPhotoDataUrl(
  type: 'before' | 'handover_borrow' | 'after' | 'handover_return',
  itemLabel: string,
  personLabel: string,
  timestampLabel: string
): string {
  const bgMap = {
    before: '#3B2314',
    handover_borrow: '#4A2E1B',
    after: '#1F3A2E',
    handover_return: '#2B3A4A',
  };
  const badgeMap = {
    before: 'DOKUMENTASI 1 • KONDISI BARANG SEBELUM DIPINJAM',
    handover_borrow: 'DOKUMENTASI 2 • SERAH-TERIMA PEMINJAMAN',
    after: 'DOKUMENTASI 3 • KONDISI BARANG SESUDAH DIKEMBALIKAN',
    handover_return: 'DOKUMENTASI 4 • SERAH-TERIMA PENGEMBALIAN',
  };
  const bg = bgMap[type];
  const badge = escapeXml(badgeMap[type]);
  const safeItem = escapeXml(itemLabel);
  const safePerson = escapeXml(personLabel);
  const safeTime = escapeXml(timestampLabel);
  const isHandover = type === 'handover_borrow' || type === 'handover_return';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320" viewBox="0 0 520 320">
    <rect width="520" height="320" rx="16" fill="${bg}"/>
    <rect x="14" y="14" width="492" height="292" rx="12" fill="none" stroke="#C89D54" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>
    <rect x="26" y="24" width="380" height="26" rx="6" fill="#C89D54"/>
    <text x="36" y="41" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700" fill="#2A1810">${badge}</text>
    ${
      isHandover
        ? `<g transform="translate(130, 82)">
            <circle cx="70" cy="42" r="24" fill="#F4EDE2" opacity="0.9"/>
            <path d="M32,122 C32,85 108,85 108,122" fill="#C89D54"/>
            <circle cx="190" cy="42" r="24" fill="#F4EDE2" opacity="0.9"/>
            <path d="M152,122 C152,85 228,85 228,122" fill="#8B5A2B"/>
            <rect x="95" y="68" width="70" height="44" rx="8" fill="#FBF8F3" stroke="#C89D54" stroke-width="2"/>
            <text x="130" y="94" font-family="Plus Jakarta Sans, sans-serif" font-size="10" font-weight="700" fill="#2A1810" text-anchor="middle">BARANG</text>
          </g>`
        : `<g transform="translate(150, 82)">
            <rect x="20" y="14" width="180" height="110" rx="12" fill="#FBF8F3" opacity="0.12" stroke="#C89D54" stroke-width="2"/>
            <line x1="45" y1="45" x2="175" y2="45" stroke="#F4EDE2" stroke-width="6" stroke-linecap="round"/>
            <line x1="45" y1="68" x2="175" y2="68" stroke="#C89D54" stroke-width="6" stroke-linecap="round"/>
            <line x1="45" y1="91" x2="145" y2="91" stroke="#F4EDE2" stroke-width="6" stroke-linecap="round"/>
            <circle cx="170" cy="95" r="16" fill="#16A34A"/>
            <path d="M163,95 L168,100 L178,89" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
          </g>`
    }
    <rect x="26" y="226" width="468" height="66" rx="10" fill="#1A0F0A" opacity="0.78"/>
    <text x="40" y="248" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" fill="#FBF8F3">${safeItem}</text>
    <text x="40" y="267" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#D9C3A9">${safePerson}</text>
    <text x="40" y="283" font-family="JetBrains Mono, monospace" font-size="10" fill="#C89D54">GUDEP 06.171-06.172 MAN 11 JKT • ${safeTime}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Calculates available quantity for a given inventory item
 */
export function getAvailableQty(item: InventoryItem): number {
  return Math.max(0, item.totalQty - item.borrowedQty - item.damagedQty);
}

/**
 * Computes aggregate inventory analytics for the Admin Dashboard
 */
export function calculateInventoryStats(
  items: InventoryItem[],
  transactions: LoanTransaction[]
): InventoryStatsSummary {
  let totalUnits = 0;
  let borrowedUnits = 0;
  let damagedUnits = 0;

  for (const item of items) {
    totalUnits += item.totalQty;
    borrowedUnits += item.borrowedQty;
    damagedUnits += item.damagedQty;
  }

  const overdueTransactions = transactions.filter((t) => t.status === 'overdue');
  const overdueUnitsFromTx = overdueTransactions.reduce(
    (sum, t) => sum + t.items.reduce((s, i) => s + i.qty, 0),
    0
  );

  const damagedOrOverdueUnits = damagedUnits + overdueUnitsFromTx;
  const availableUnits = Math.max(0, totalUnits - borrowedUnits - damagedUnits);

  const safeTotal = totalUnits > 0 ? totalUnits : 1;
  const availablePct = Math.round((availableUnits / safeTotal) * 100);
  const borrowedPct = Math.round((borrowedUnits / safeTotal) * 100);
  const overduePct = Math.max(0, 100 - availablePct - borrowedPct);

  const pendingApprovalCount = transactions.filter(
    (t) => t.status === 'pending_borrow' || t.status === 'pending_return'
  ).length;

  return {
    totalUnits,
    availableUnits,
    borrowedUnits,
    damagedOrOverdueUnits,
    availablePct,
    borrowedPct,
    overduePct,
    pendingApprovalCount,
    overdueTransactionCount: overdueTransactions.length,
  };
}

/**
 * Finds an inventory item by exact barcode or partial code/name
 */
export function findItemByBarcode(
  items: InventoryItem[],
  query: string
): InventoryItem | undefined {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return undefined;
  return (
    items.find((item) => item.barcode.toUpperCase() === normalized) ||
    items.find((item) => item.id.toUpperCase() === normalized) ||
    items.find((item) => item.name.toUpperCase().includes(normalized))
  );
}

/**
 * Checks whether a transaction is overdue relative to reference time
 */
export function isTransactionOverdue(
  tx: Pick<LoanTransaction, 'status' | 'dueDate'>,
  nowMs: number = Date.now()
): boolean {
  if (tx.status === 'overdue') return true;
  if (tx.status !== 'active_borrowed') return false;
  const dueMs = new Date(tx.dueDate).getTime();
  if (Number.isNaN(dueMs)) return false;
  return nowMs > dueMs;
}

/**
 * Formats an Indonesian official date string matching the PDF ("Sabtu, 08 Agustus 2026")
 */
export function formatIndonesianDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return String(dateInput);
  }
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

/**
 * Formats official Ambalan letter number and title based on document type (matching reference PDF)
 */
export function buildOfficialLetterMeta(
  tx: LoanTransaction,
  letterType: 'borrow' | 'return'
): {
  title: string;
  letterNumber: string;
  dateLabel: string;
  memberLabel: string;
  officerLabel: string;
  dateFormatted: string;
} {
  const shortNum = tx.id.replace(/[^0-9]/g, '').slice(-3) || '001';
  const isBorrow = letterType === 'borrow';
  return {
    title: isBorrow
      ? 'SURAT KETERANGAN PEMINJAMAN BARANG PRAMUKA MAN 11 JAKARTA'
      : 'SURAT KETERANGAN PENGEMBALIAN BARANG PRAMUKA MAN 11 JAKARTA',
    letterNumber: `${shortNum}/${isBorrow ? 'SKPB' : 'SKKBP'}/KBU-06.171-06.172/2026`,
    dateLabel: isBorrow ? 'Hari / Tanggal Peminjaman' : 'Hari / Tanggal pengembalian',
    memberLabel: isBorrow ? 'Nama Peminjam' : 'Nama peminjam',
    officerLabel: isBorrow ? 'Nama Yang Menyerahkan' : 'Nama yang Menerima',
    dateFormatted: formatIndonesianDate(
      isBorrow ? tx.borrowDate : tx.returnDate || tx.dueDate
    ),
  };
}

/**
 * Computes allowable cart addition with strict stock boundary validation.
 * Prevents adding items when remaining available stock is <= 0.
 */
export function calculateAllowedCartQty(
  item: InventoryItem,
  existingCartQty: number,
  qtyToAdd: number
): { allowed: boolean; newQty: number; maxAvail: number; message?: string } {
  const maxAvail = getAvailableQty(item);
  if (maxAvail <= 0) {
    return {
      allowed: false,
      newQty: existingCartQty,
      maxAvail: 0,
      message: `Barang [${item.barcode}] ${item.name} sedang habis / tidak tersedia.`,
    };
  }
  const targetQty = existingCartQty + qtyToAdd;
  const clampedQty = Math.min(maxAvail, Math.max(1, targetQty));
  return {
    allowed: true,
    newQty: clampedQty,
    maxAvail,
  };
}

/**
 * Updates an inventory item in an item list immutably.
 */
export function updateInventoryItemInList(
  items: InventoryItem[],
  updatedItem: InventoryItem
): InventoryItem[] {
  return items.map((item) => (item.id === updatedItem.id ? updatedItem : item));
}

/**
 * Removes an inventory item from an item list by ID immutably.
 */
export function deleteInventoryItemFromList(
  items: InventoryItem[],
  itemId: string
): InventoryItem[] {
  return items.filter((item) => item.id !== itemId);
}

/**
 * Validates whether an inventory item can safely be deleted.
 * An item cannot be deleted if it has units on active loan (borrowedQty > 0).
 */
export function canDeleteInventoryItem(item: InventoryItem | undefined | null): {
  allowed: boolean;
  reason?: string;
} {
  if (!item) {
    return { allowed: false, reason: 'Barang tidak ditemukan' };
  }
  if (item.borrowedQty > 0) {
    return {
      allowed: false,
      reason: `Tidak dapat menghapus barang '${item.name}': ${item.borrowedQty} unit sedang dalam peminjaman aktif.`,
    };
  }
  return { allowed: true };
}

/**
 * Validates whether an inventory item's totalQty can be updated to newTotalQty.
 * newTotalQty cannot be less than the quantity currently on active loan (borrowedQty).
 */
export function canUpdateItemTotalQty(
  borrowedQty: number,
  newTotalQty: number
): { allowed: boolean; reason?: string } {
  if (newTotalQty < borrowedQty) {
    return {
      allowed: false,
      reason: `Total stok (${newTotalQty}) tidak boleh lebih kecil dari jumlah yang sedang dipinjam (${borrowedQty} unit).`,
    };
  }
  return { allowed: true };
}

/**
 * Calculates updated inventory counts upon return approval.
 * Accurately decrements borrowedQty and increments damagedQty.
 */
export function calculateReturnItemStock(
  item: InventoryItem,
  returnedQty: number,
  damagedQtyToAdd = 0
): { borrowedQty: number; damagedQty: number } {
  const newBorrowedQty = Math.max(0, item.borrowedQty - returnedQty);
  const safeDamagedToAdd = Math.max(0, Math.min(returnedQty, damagedQtyToAdd));
  const newDamagedQty = Math.min(
    item.totalQty - newBorrowedQty,
    item.damagedQty + safeDamagedToAdd
  );
  return {
    borrowedQty: newBorrowedQty,
    damagedQty: newDamagedQty,
  };
}

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

/**
 * Generates RFC 4180 compliant CSV string for inventory items
 */
export function exportInventoryToCsv(items: InventoryItem[]): string {
  const headers = [
    'ID Barang',
    'Kode Barcode',
    'Nama Barang',
    'Kategori',
    'Total Stok',
    'Sedang Dipinjam',
    'Kondisi Rusak',
    'Stok Tersedia',
    'Kondisi Fisik',
    'Lokasi Sanggar',
    'Pengecekan Terakhir',
    'Catatan Khusus',
  ];

  const rows = items.map((item) => {
    const available = getAvailableQty(item);
    return [
      escapeCsvCell(item.id),
      escapeCsvCell(item.barcode),
      escapeCsvCell(item.name),
      escapeCsvCell(item.category),
      item.totalQty,
      item.borrowedQty,
      item.damagedQty,
      available,
      escapeCsvCell(item.condition),
      escapeCsvCell(item.location),
      escapeCsvCell(item.lastChecked),
      escapeCsvCell(item.notes || '-'),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates RFC 4180 compliant CSV string for loan transaction history
 */
export function exportTransactionsToCsv(transactions: LoanTransaction[]): string {
  const headers = [
    'ID Transaksi',
    'Nama Peminjam',
    'Kelas',
    'Jabatan & Sangga',
    'Keperluan Peminjaman',
    'Tanggal Pinjam',
    'Batas Kembali',
    'Tanggal Pengembalian',
    'Status Transaksi',
    'Rincian Barang',
    'Total Jumlah Unit',
    'Petugas Inventaris',
    'Pradana Mengetahui',
  ];

  const rows = transactions.map((tx) => {
    const itemsSummary = tx.items
      .map((i) => `${i.name} (${i.qty} unit - ${i.conditionBefore})`)
      .join('; ');
    const totalUnits = tx.items.reduce((sum, i) => sum + i.qty, 0);

    return [
      escapeCsvCell(tx.id),
      escapeCsvCell(tx.memberName),
      escapeCsvCell(tx.memberKelas),
      escapeCsvCell(tx.memberJabatan),
      escapeCsvCell(tx.purpose),
      escapeCsvCell(tx.borrowDate),
      escapeCsvCell(tx.dueDate),
      escapeCsvCell(tx.returnDate || '-'),
      escapeCsvCell(tx.status),
      escapeCsvCell(itemsSummary),
      totalUnits,
      escapeCsvCell(tx.officerName),
      escapeCsvCell(tx.pradanaName),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers a client-side file download of CSV content with UTF-8 BOM
 */
export function downloadCsvFile(csvContent: string, fileName: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

