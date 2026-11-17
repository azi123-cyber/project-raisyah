import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  FileCheck2,
  Edit3,
  Check,
  FileText,
  Plus,
  Trash2,
  Mail,
  Send,
  CheckCircle,
} from 'lucide-react';
import {
  buildOfficialLetterMeta,
  type LoanTransaction,
  type LoanItemEntry,
  type DewanInventarisOfficer,
} from '../utils/inventoryLogic';
import {
  AMBALAN_SHIELD_LOGO_BASE64,
  TUNAS_KELAPA_SILHOUETTE_BASE64,
  AMBALAN_WATERMARK_BASE64,
} from '../assets/logoAssets';
import { sendOfficialLetterEmail, openGmailComposer, getEmailConfig } from '../utils/emailService';

interface OfficialLetterModalProps {
  transaction: LoanTransaction | null;
  initialLetterType?: 'borrow' | 'return';
  officers?: DewanInventarisOfficer[];
  onUpdateTransaction?: (updated: LoanTransaction) => void;
  onClose: () => void;
}

export const OfficialLetterModal: React.FC<OfficialLetterModalProps> = ({
  transaction,
  initialLetterType = 'borrow',
  officers = [],
  onUpdateTransaction,
  onClose,
}) => {
  const [letterType, setLetterType] = useState<'borrow' | 'return'>(initialLetterType);
  const [isEditing, setIsEditing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Editable custom fields so borrower/admin can adjust the letter directly
  const [customDateStr, setCustomDateStr] = useState('');
  const [customMemberName, setCustomMemberName] = useState('');
  const [customOfficerName, setCustomOfficerName] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [customItems, setCustomItems] = useState<LoanItemEntry[]>([]);

  useEffect(() => {
    setLetterType(initialLetterType);
  }, [initialLetterType]);

  useEffect(() => {
    if (!transaction) return;
    const meta = buildOfficialLetterMeta(transaction, letterType);
    setCustomDateStr(meta.dateFormatted);
    setCustomMemberName(transaction.memberName);
    setCustomOfficerName(transaction.officerName);
    setCustomPurpose(transaction.purpose);
    setCustomItems(transaction.items.map((i) => ({ ...i })));
    setEmailStatus(null);
  }, [transaction, letterType]);

  if (!transaction) return null;

  const meta = buildOfficialLetterMeta(transaction, letterType);
  const totalTableRows = Math.max(6, customItems.length);
  const paddedRows = Array.from({ length: totalTableRows }, (_, idx) => customItems[idx] || null);

  const handleSaveCustomizations = () => {
    if (onUpdateTransaction) {
      const matchedOfficer = officers.find((o) => o.name === customOfficerName);
      onUpdateTransaction({
        ...transaction,
        memberName: customMemberName,
        officerName: customOfficerName,
        officerSignature: matchedOfficer?.signatureDataUrl || transaction.officerSignature,
        purpose: customPurpose,
        items: customItems.filter((i) => i.name.trim() !== ''),
      });
    }
    setIsEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    const config = getEmailConfig();
    const result = sendOfficialLetterEmail(transaction, letterType);
    setEmailStatus(`Salinan surat berhasil dikirim & disinkronkan ke: ${config.targetEmail}`);

    // Also offer open in Gmail app
    setTimeout(() => {
      openGmailComposer(config.targetEmail, result.subject, result.fullBody);
    }, 400);

    setTimeout(() => {
      setEmailStatus(null);
    }, 5000);
  };

  // In Page 1 (Peminjaman): Left = Yang Menyerahkan (Inventaris), Right = Yang Menerima (Peminjam)
  // In Page 2 (Pengembalian): Left = Yang Menyerahkan, (Peminjam), Right = Yang Menerima, (Inventaris)
  const isBorrow = letterType === 'borrow';
  const leftSigHeader = isBorrow ? 'Yang Menyerahkan' : 'Yang Menyerahkan,';
  const leftSigRole = isBorrow ? 'Inventaris' : 'Peminjam';
  const leftSigImg = isBorrow ? transaction.officerSignature : transaction.memberSignature;
  const leftSigName = isBorrow ? customOfficerName : customMemberName;

  const rightSigHeader = isBorrow ? 'Yang Menerima' : 'Yang Menerima,';
  const rightSigRole = isBorrow ? 'Peminjam' : 'Inventaris';
  const rightSigImg = isBorrow ? transaction.memberSignature : transaction.officerSignature;
  const rightSigName = isBorrow ? customMemberName : customOfficerName;

  const centerSigHeader = isBorrow ? 'Mengetahui' : 'Mengetahui,';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Surat Keterangan Peminjaman dan Pengembalian Barang"
    >
      <div className="relative w-full max-w-3xl bg-[#FBF8F3] rounded-2xl border border-[#D9C3A9] shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Control Bar (Non-Printed) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#3B2314] text-[#FBF8F3] border-b border-[#5C3A21]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#C89D54]" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
              Dokumen Resmi Ambalan MAN 11
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#24140B] text-[#D9C3A9] border border-[#5C3A21]">
              {transaction.id}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Toggle Switch: Peminjaman vs Pengembalian */}
            <div className="inline-flex rounded-lg bg-[#24140B] p-0.5 border border-[#5C3A21]">
              <button
                type="button"
                onClick={() => setLetterType('borrow')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  letterType === 'borrow'
                    ? 'bg-[#C89D54] text-[#2A1810] shadow-xs'
                    : 'text-[#D9C3A9] hover:text-white'
                }`}
              >
                Peminjaman
              </button>
              <button
                type="button"
                onClick={() => setLetterType('return')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  letterType === 'return'
                    ? 'bg-[#C89D54] text-[#2A1810] shadow-xs'
                    : 'text-[#D9C3A9] hover:text-white'
                }`}
              >
                Pengembalian
              </button>
            </div>

            {/* Edit / Customize Variables Button */}
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleSaveCustomizations();
                } else {
                  setIsEditing(true);
                }
              }}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#24140B] text-[#D9C3A9] hover:text-white border border-[#5C3A21] inline-flex items-center gap-1"
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  Simpan Surat
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-[#C89D54]" />
                  Sesuaikan
                </>
              )}
            </button>

            {/* Email Dispatch Button */}
            <button
              type="button"
              onClick={handleSendEmail}
              title="Kirim otomatis salinan dokumen ke inventarispramukamanjakartasel@gmail.com"
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2A4D7A] border border-[#3A5D8A] inline-flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5 text-[#C89D54]" />
              Kirim Email
            </button>

            {/* Link to Original Reference PDF */}
            <a
              href="/assets/aistudio/Surat_peminjaman_barang_ambalan_Pramuka_MAN_11_JKT_797ef236.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#24140B] text-[#D9C3A9] hover:text-white border border-[#5C3A21] items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-[#C89D54]" />
              PDF Asli
            </a>

            {/* Print / Save as PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-[11px] font-extrabold rounded-lg bg-[#C89D54] text-[#2A1810] hover:bg-[#d8ae66] transition-colors inline-flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Preview Surat"
              className="p-1.5 rounded-lg text-[#D9C3A9] hover:text-white hover:bg-[#5C3A21]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Email feedback notification */}
        {emailStatus && (
          <div className="px-4 py-2 bg-emerald-800 text-white text-xs font-semibold flex items-center justify-between border-b border-emerald-700">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              {emailStatus}
            </span>
            <button
              type="button"
              onClick={() => setEmailStatus(null)}
              className="text-white hover:underline text-[11px]"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Editable Quick Panel when "Sesuaikan Surat" is active */}
        {isEditing && (
          <div className="px-5 py-3.5 bg-[#F4EDE2] border-b border-[#D9C3A9] space-y-2.5 text-xs">
            <p className="font-extrabold text-[#3B2314]">
              Sesuaikan Variabel Surat (Otomatis Mengubah Tampilan Dokumen di Bawah):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-[#6E5039]">
                  {meta.dateLabel}
                </label>
                <input
                  type="text"
                  value={customDateStr}
                  onChange={(e) => setCustomDateStr(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#6E5039]">
                  {meta.memberLabel}
                </label>
                <input
                  type="text"
                  value={customMemberName}
                  onChange={(e) => setCustomMemberName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#6E5039]">
                  {meta.officerLabel} (Dewan Inventaris)
                </label>
                {officers.length > 0 ? (
                  <select
                    value={customOfficerName}
                    onChange={(e) => setCustomOfficerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-semibold"
                  >
                    {officers.map((off) => (
                      <option key={off.id} value={off.name}>
                        {off.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customOfficerName}
                    onChange={(e) => setCustomOfficerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-semibold"
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#6E5039]">Keperluan</label>
                <input
                  type="text"
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>
            </div>

            {/* Editable Items Table Rows */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#6E5039]">
                  Daftar Barang pada Tabel Surat:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCustomItems((prev) => [
                      ...prev,
                      {
                        itemId: `custom-${Date.now()}`,
                        barcode: 'BRG-KBU',
                        name: 'Barang Pramuka',
                        qty: 1,
                        conditionBefore: 'Baik',
                      },
                    ])
                  }
                  className="text-[11px] font-bold text-[#3B2314] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah Baris Barang
                </button>
              </div>
              {customItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, name: e.target.value } : row
                        )
                      )
                    }
                    placeholder="Nama Barang"
                    className="col-span-6 px-2 py-1 rounded bg-white border border-[#D9C3A9] text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx
                            ? { ...row, qty: Math.max(1, parseInt(e.target.value, 10) || 1) }
                            : row
                        )
                      )
                    }
                    placeholder="Qty"
                    className="col-span-2 px-2 py-1 rounded bg-white border border-[#D9C3A9] text-xs text-center"
                  />
                  <input
                    type="text"
                    value={
                      isBorrow ? it.conditionBefore : it.conditionAfter || it.conditionBefore
                    }
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx
                            ? {
                                ...row,
                                conditionBefore: e.target.value,
                                conditionAfter: e.target.value,
                              }
                            : row
                        )
                      )
                    }
                    placeholder="Keterangan"
                    className="col-span-3 px-2 py-1 rounded bg-white border border-[#D9C3A9] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                    }
                    className="col-span-1 p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== PRINTABLE OFFICIAL A4 LETTER SHEET (1:1 IDENTICAL WITH PDF) ==================== */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-[#E2D9C8] flex-1">
          <div
            id="printable-official-letter"
            style={{ fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif" }}
            className="relative mx-auto max-w-[760px] bg-white text-black px-7 py-8 sm:px-12 sm:py-10 shadow-lg border border-[#D1C7B7] overflow-hidden"
          >
            {/* CENTER WATERMARK SHIELD (Exact match to PDF background watermark) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              <img
                src={AMBALAN_WATERMARK_BASE64}
                alt="Watermark Ambalan MAN 11"
                className="w-[380px] h-[460px] object-contain opacity-20 mt-16 pointer-events-none"
              />
            </div>

            {/* CONTENT LAYER */}
            <div className="relative z-10" style={{ fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif" }}>
              {/* KOP SURAT RESMI */}
              <div className="flex items-center justify-between gap-3 pb-3">
                {/* Left Shield Logo - Authentic High-Resolution */}
                <div className="shrink-0">
                  <img
                    src={AMBALAN_SHIELD_LOGO_BASE64}
                    alt="Logo Ambalan Khalid bin Walid - Ummu Kultsum MAN 11 Jakarta"
                    className="w-20 h-24 sm:w-24 sm:h-28 object-contain"
                  />
                </div>

                {/* Center Kop Text */}
                <div className="text-center flex-1 px-1">
                  <h1 className="text-base sm:text-[21px] font-bold tracking-tight text-black leading-snug">
                    GERAKAN PRAMUKA MAN 11 JAKARTA
                  </h1>
                  <p className="text-xs sm:text-[15px] font-bold text-black leading-snug mt-0.5">
                    AMBALAN KHALID BIN WALID - UMMU KULTSUM
                  </p>
                  <p className="text-xs sm:text-[15px] text-black leading-snug">
                    GUGUSDEPAN 06.171 – 06.172
                  </p>
                  <p className="text-xs sm:text-[15px] text-black leading-snug">
                    PANGKALAN MA NEGERI 11 JAKARTA
                  </p>
                  <p className="text-[11px] sm:text-[14px] text-black leading-snug">
                    Jalan H. Gandun No. 60 Lebak Bulus, Cilandak, Jakarta Selatan
                  </p>
                  <p className="text-[11px] sm:text-[14px] text-black leading-snug">
                    Telp.: (021) 756 9754 Fax. : 765 9754
                  </p>
                </div>

                {/* Right Tunas Kelapa Silhouette - Authentic High-Resolution */}
                <div className="shrink-0">
                  <img
                    src={TUNAS_KELAPA_SILHOUETTE_BASE64}
                    alt="Siluet Tunas Kelapa Gerakan Pramuka"
                    className="w-16 h-24 sm:w-20 sm:h-28 object-contain"
                  />
                </div>
              </div>

              {/* Maroon/Brown Double Horizontal Line */}
              <div className="border-t-[3.5px] border-b-[1.5px] border-[#6B2D26] h-[6px] w-full mb-5" />

              {/* JUDUL SURAT */}
              <div className="text-center mb-5">
                <h2 className="text-xs sm:text-[16px] font-bold text-black tracking-tight uppercase">
                  {meta.title}
                </h2>
              </div>

              {/* 4 BARIS VARIABEL IDENTITAS */}
              <div className="space-y-1 text-xs sm:text-[14.5px] text-black mb-4 leading-relaxed">
                <p>
                  <span className="font-normal">{meta.dateLabel} : </span>
                  <span className="font-normal">{customDateStr}</span>
                </p>
                <p>
                  <span className="font-normal">{meta.memberLabel} : </span>
                  <span className="font-normal">{customMemberName}</span>
                </p>
                <p>
                  <span className="font-normal">{meta.officerLabel} : </span>
                  <span className="font-normal">{customOfficerName}</span>
                </p>
                <p>
                  <span className="font-normal">Keperluan : </span>
                  <span className="font-normal">{customPurpose}</span>
                </p>
              </div>

              {/* TABEL DAFTAR BARANG (BORDER KOTAK TEGAS SEPERTI PDF ASLI) */}
              <div className="mb-5">
                <table className="w-full border-collapse border border-black text-xs sm:text-[14px]">
                  <thead>
                    <tr className="font-bold text-black">
                      <th className="border border-black py-1 px-2 text-center w-12">No</th>
                      <th className="border border-black py-1 px-3 text-center">Nama Barang</th>
                      <th className="border border-black py-1 px-2 text-center w-36">Jumlah</th>
                      <th className="border border-black py-1 px-2 text-center w-36">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paddedRows.map((row, idx) => (
                      <tr key={idx} className="h-[24px]">
                        <td className="border border-black px-2 py-0.5 text-center">
                          {row ? `${idx + 1}.` : ''}
                        </td>
                        <td className="border border-black px-2.5 py-0.5 text-left">
                          {row ? row.name : ''}
                        </td>
                        <td className="border border-black px-2 py-0.5 text-center">
                          {row ? row.qty : ''}
                        </td>
                        <td className="border border-black px-2 py-0.5 text-center">
                          {row
                            ? isBorrow
                              ? row.conditionBefore || 'Baik'
                              : row.conditionAfter || row.conditionBefore || 'Baik'
                            : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* NOTE & KETENTUAN RESMI */}
              <div className="text-xs sm:text-[14px] text-black space-y-1.5 mb-6 leading-snug">
                <p className="font-bold">Note:</p>
                <p className="pl-1">
                  ● Barang yang di pinjamkan harus di kembalikan sesuai peminjaman
                </p>
                <p className="pl-1">
                  ● Bila barang ada yang rusak atau hilang maka akan mendapatkan sanksi
                </p>
                <p className="pl-1">
                  ● Barang yang di kembalikan di hitung/di paparkan oleh peminjam dengan disaksikan
                  bagian inventaris
                </p>

                <p className="font-bold pt-2 leading-snug">
                  Dengan bertanda tangannya anda di bawah ini maka telah menyetujui setiap ketentuan
                  peminjaman dan pengembalian yang telah di paparkan oleh anggota dewan Inventaris
                  MAN 11 Jakarta.
                </p>
              </div>

              {/* BLOK TANDA TANGAN (KIRI ATAS, KANAN ATAS, TENGAH BAWAH — PERSIS PDF ASLI) */}
              <div className="mt-4 text-xs sm:text-[14px] text-black">
                <div className="flex items-start justify-between px-2 sm:px-6">
                  {/* Left Signer */}
                  <div className="flex flex-col items-center text-center w-48">
                    <p className="text-xs sm:text-[14px] mb-1">{leftSigHeader}</p>
                    <div className="h-20 flex items-center justify-center">
                      <img
                        src={leftSigImg}
                        alt={leftSigRole}
                        className="max-h-20 w-auto object-contain"
                      />
                    </div>
                    <p className="text-xs sm:text-[14px] mt-1">{leftSigRole}</p>
                    <p className="text-[12px] text-black">({leftSigName})</p>
                  </div>

                  {/* Right Signer */}
                  <div className="flex flex-col items-center text-center w-48">
                    <p className="text-xs sm:text-[14px] mb-1">{rightSigHeader}</p>
                    <div className="h-20 flex items-center justify-center">
                      <img
                        src={rightSigImg}
                        alt={rightSigRole}
                        className="max-h-20 w-auto object-contain"
                      />
                    </div>
                    <p className="text-xs sm:text-[14px] mt-1">{rightSigRole}</p>
                    <p className="text-[12px] text-black">({rightSigName})</p>
                  </div>
                </div>

                {/* Bottom Center Signer: Mengetahui Pradana */}
                <div className="flex flex-col items-center text-center mt-3">
                  <p className="text-xs sm:text-[14px] mb-1">{centerSigHeader}</p>
                  <div className="h-20 flex items-center justify-center">
                    <img
                      src={transaction.pradanaSignature}
                      alt="Tanda Tangan Pradana"
                      className="max-h-20 w-auto object-contain"
                    />
                  </div>
                  <p className="text-xs sm:text-[14px] mt-1">Pradana</p>
                  <p className="text-[12px] text-black">
                    ({transaction.pradanaName})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
