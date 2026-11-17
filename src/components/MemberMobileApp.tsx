import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Briefcase,
  ScanLine,
  FileText,
  User,
  Bell,
  BellRing,
  Search,
  Plus,
  Minus,
  Trash2,
  Camera,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RotateCcw,
  QrCode,
  Shield,
  UserPlus,
  ShieldCheck,
  TrendingUp,
  Check,
  X,
  Eye,
  UserCheck,
  Edit2,
  Download,
  RefreshCw,
  LogOut,
  Barcode,
  Image as ImageIcon,
  Mail,
  KeyRound,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  getAvailableQty,
  findItemByBarcode,
  calculateInventoryStats,
  createProofPhotoDataUrl,
  createSignatureDataUrl,
  formatIndonesianDate,
  calculateAllowedCartQty,
  exportInventoryToCsv,
  exportTransactionsToCsv,
  downloadCsvFile,
  type InventoryItem,
  type ItemCategory,
  type ScoutMember,
  type DewanInventarisOfficer,
  type LoanTransaction,
  type LoanItemEntry,
} from '../utils/inventoryLogic';
import { MONTHLY_TREND_DATA } from '../data/seedData';
import { SignaturePadCanvas } from './SignaturePadCanvas';
import { KhobinwalShieldLogo } from './AmbalanLogoSvg';
import {
  generateAutoBarcode,
  generateCode128Svg,
  printBarcodeSticker,
  downloadBarcodeSvgFile,
} from '../utils/barcodeGenerator';
import {
  getEmailConfig,
  saveEmailConfig,
  getEmailLogs,
  clearEmailLogs,
  openGmailComposer,
  sendNewItemEmail,
  type EmailConfig,
  type EmailLogEntry,
} from '../utils/emailService';
import {
  getAuthAccounts,
  saveAuthAccounts,
  adminSaveMemberAccount,
  deleteAccountById,
  getAdminPasscode,
  setAdminPasscode,
  MAX_ADMIN_COUNT,
  type UserAccount,
} from '../utils/authLogic';
import { AMBALAN_SHIELD_LOGO_BASE64 } from '../assets/logoAssets';

export type MobileTab = 'home' | 'catalog' | 'scan' | 'history' | 'profile';

interface MobileScoutAppProps {
  role: 'member' | 'admin';
  onChangeRole: (role: 'member' | 'admin') => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  currentMember: ScoutMember;
  allMembers: ScoutMember[];
  onSelectMember: (memberId: string) => void;
  onUpdateMember: (updated: ScoutMember) => void;
  onRegisterMember: (newMember: ScoutMember) => void;
  items: InventoryItem[];
  onAddNewItem: (newItem: InventoryItem) => void;
  onEditItem?: (updatedItem: InventoryItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onResetSeedData?: () => void;
  officers: DewanInventarisOfficer[];
  activeOfficerId: string;
  onChangeActiveOfficer: (officerId: string) => void;
  pradanaList: { id: string; name: string; role: string; signatureDataUrl: string }[];
  activePradanaId: string;
  onChangeActivePradana: (pradanaId: string) => void;
  transactions: LoanTransaction[];
  onCreateBorrowRequest: (tx: LoanTransaction) => void;
  onSubmitReturnRequest: (
    txId: string,
    conditionAfter: string,
    photoAfter: string,
    photoHandoverReturn: string,
    damagedCounts?: Record<string, number>
  ) => void;
  onApproveBorrow: (txId: string) => void;
  onApproveReturn: (txId: string, damagedCountByItemId?: Record<string, number>) => void;
  onRejectTransaction: (txId: string) => void;
  onTriggerMemberAlarm: (txId: string) => void;
  onOpenLetterModal: (tx: LoanTransaction, type: 'borrow' | 'return') => void;
}

export const MemberMobileApp: React.FC<MobileScoutAppProps> = ({
  role,
  onChangeRole,
  currentUser,
  onLogout,
  currentMember,
  allMembers,
  onSelectMember,
  onUpdateMember,
  onRegisterMember,
  items,
  onAddNewItem,
  onEditItem,
  onDeleteItem,
  onResetSeedData,
  officers,
  activeOfficerId,
  onChangeActiveOfficer,
  pradanaList,
  activePradanaId,
  onChangeActivePradana,
  transactions,
  onCreateBorrowRequest,
  onSubmitReturnRequest,
  onApproveBorrow,
  onApproveReturn,
  onRejectTransaction,
  onTriggerMemberAlarm,
  onOpenLetterModal,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  // Catalog & Admin Item Creator state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>('Semua');
  const [showAddItemSheet, setShowAddItemSheet] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBarcode, setNewItemBarcode] = useState(`BRG-KBU-00${items.length + 1}`);
  const [newItemCategory, setNewItemCategory] =
    useState<Exclude<ItemCategory, 'Semua'>>('Tongkat & Pionering');
  const [newItemQty, setNewItemQty] = useState(25);
  const [newItemLocation, setNewItemLocation] = useState('Rak B-03 Sanggar Khobinwal-Umkul');
  const [newItemCondition, setNewItemCondition] =
    useState<'Baik' | 'Perlu Perawatan' | 'Rusak Ringan'>('Baik');
  const [newItemPhoto, setNewItemPhoto] = useState<string | null>(null);
  const [selectedBarcodeItem, setSelectedBarcodeItem] = useState<InventoryItem | null>(null);

  // Admin Member Account Management Modal State
  const [authAccountsList, setAuthAccountsList] = useState<UserAccount[]>(() => getAuthAccounts());
  const [showMemberAccountModal, setShowMemberAccountModal] = useState(false);
  const [adminEditingAccount, setAdminEditingAccount] = useState<UserAccount | null>(null);
  const [accountFormName, setAccountFormName] = useState('');
  const [accountFormKelas, setAccountFormKelas] = useState('XI IPA 1');
  const [accountFormJabatan, setAccountFormJabatan] = useState('Penegak Bantara');
  const [accountFormSangga, setAccountFormSangga] = useState('Sangga Perintis');
  const [accountFormPhone, setAccountFormPhone] = useState('');
  const [accountFormUsername, setAccountFormUsername] = useState('');
  const [accountFormPassword, setAccountFormPassword] = useState('');

  // Admin Passcode & Quota State
  const [adminPasscodeVal, setAdminPasscodeVal] = useState(() => getAdminPasscode());
  const [isEditingPasscode, setIsEditingPasscode] = useState(false);
  const [tempPasscode, setTempPasscode] = useState(adminPasscodeVal);

  // Email Config & Logs State
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => getEmailConfig());
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>(() => getEmailLogs());
  const [emailPasswordInput, setEmailPasswordInput] = useState(
    () => getEmailConfig().appPasswordPlaceholder
  );
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  // Edit & Delete Inventory Item state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<Exclude<ItemCategory, 'Semua'>>('Tongkat & Pionering');
  const [editTotalQty, setEditTotalQty] = useState(1);
  const [editDamagedQty, setEditDamagedQty] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editCondition, setEditCondition] = useState<'Baik' | 'Perlu Perawatan' | 'Rusak Ringan'>('Baik');
  const [editNotes, setEditNotes] = useState('');

  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Helpers for dynamic real timestamps
  const getInitialBorrowDate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getInitialDueDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    return tomorrow.toISOString().slice(0, 16);
  };

  // Real Camera & Barcode Input state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState(items[0]?.id || 'item-1');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  // Real App: cart starts empty (no dummy simulation items)
  const [scannedCart, setScannedCart] = useState<LoanItemEntry[]>([]);

  // Borrow Form state
  const [purpose, setPurpose] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState(officers[0]?.id || 'inv-1');
  const [borrowDate, setBorrowDate] = useState(getInitialBorrowDate());
  const [dueDate, setDueDate] = useState(getInitialDueDate());
  const [photoBefore, setPhotoBefore] = useState<string>('');
  const [photoHandover, setPhotoHandover] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Return Bottom Sheet state
  const [returningTx, setReturningTx] = useState<LoanTransaction | null>(null);
  const [returnConditionText, setReturnConditionText] = useState('Baik');
  const [returnPhotoAfter, setReturnPhotoAfter] = useState<string>('');
  const [returnPhotoHandover, setReturnPhotoHandover] = useState<string>('');
  const [returnDamagedCounts, setReturnDamagedCounts] = useState<Record<string, number>>({});

  // Admin Verification Sheet state
  const [inspectingTx, setInspectingTx] = useState<LoanTransaction | null>(null);
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'pending' | 'active' | 'returned'>(
    'all'
  );
  const [alarmSentBanner, setAlarmSentBanner] = useState<string | null>(null);

  // New Member Registration state in Profile
  const [showNewMemberForm, setShowNewMemberForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberKelas, setNewMemberKelas] = useState('XI IPA 1');
  const [newMemberJabatan, setNewMemberJabatan] = useState('Penegak Bantara');
  const [newMemberSangga, setNewMemberSangga] = useState('Sangga Perintis');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  const activeOfficer = officers.find((o) => o.id === activeOfficerId) || officers[0];
  const activePradana = pradanaList.find((p) => p.id === activePradanaId) || pradanaList[0];

  const memberTransactions = transactions.filter((t) => t.memberId === currentMember.id);
  const overdueMemberTx = memberTransactions.filter((t) => t.status === 'overdue');
  const activeCheckouts = memberTransactions.filter(
    (t) =>
      t.status === 'active_borrowed' ||
      t.status === 'overdue' ||
      t.status === 'pending_borrow' ||
      t.status === 'pending_return'
  );

  const stats = calculateInventoryStats(items, transactions);
  const sortedByUsage = [...items].sort((a, b) => b.borrowedQty - a.borrowedQty).slice(0, 5);
  const maxBorrowedItem = Math.max(...sortedByUsage.map((i) => i.borrowedQty), 1);

  const triggerBeepSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6 note
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Ignore audio error
    }
  };

  // Manage real camera stream & real-time barcode detector
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let isDetecting = false;

    if (activeTab === 'scan' && cameraActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
          setCameraError(null);

          // Real continuous Barcode / QR detection if supported by browser/webview
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
              });

              const detectFrame = async () => {
                if (videoRef.current && videoRef.current.readyState >= 2 && !isDetecting) {
                  isDetecting = true;
                  try {
                    const detected = await detector.detect(videoRef.current);
                    if (detected && detected.length > 0) {
                      const raw = detected[0].rawValue?.trim();
                      if (raw) {
                        const found = findItemByBarcode(items, raw);
                        if (found) {
                          handleAddScannedItem(found, 1);
                          triggerBeepSound();
                          // pause 2 seconds before scanning same/next item
                          await new Promise((r) => setTimeout(r, 2000));
                        }
                      }
                    }
                  } catch {
                    // Frame scan skip
                  } finally {
                    isDetecting = false;
                  }
                }
                animId = requestAnimationFrame(detectFrame);
              };
              animId = requestAnimationFrame(detectFrame);
            } catch {
              // Barcode detector fallback
            }
          }
        })
        .catch(() => {
          setCameraError(
            'Akses kamera tidak tersedia di perangkat ini. Gunakan input kode barcode atau pilih barang di bawah.'
          );
          setCameraActive(false);
        });
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeTab, cameraActive, items]);

  // Web Audio API Synthesizer for Overdue Reminder Alarm
  const triggerAlarmSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [0, 0.25, 0.5, 0.75].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx % 2 === 0 ? 880 : 660, now + offset);
        gain.gain.setValueAtTime(0.18, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
    } catch {
      // Ignore audio errors
    }
  };

  const handleAddScannedItem = (item: InventoryItem, qtyToAdd = 1) => {
    const currentMax = getAvailableQty(item);
    if (currentMax <= 0) {
      setScanFeedback(
        `Barang [${item.barcode}] ${item.name} sedang habis (stok 0) dan tidak dapat dipinjam.`
      );
      setTimeout(() => setScanFeedback(null), 3500);
      return;
    }

    let feedbackMessage = '';

    setScannedCart((prev) => {
      const existingEntries = prev.filter((e) => e.itemId === item.id);
      const existingQty = existingEntries.reduce((sum, e) => sum + e.qty, 0);

      const result = calculateAllowedCartQty(item, existingQty, qtyToAdd);

      if (!result.allowed) {
        feedbackMessage =
          result.message ||
          `Barang [${item.barcode}] ${item.name} tidak mencukupi untuk dipinjam lagi.`;
        return prev;
      }

      if (existingQty >= result.maxAvail && result.newQty === existingQty) {
        feedbackMessage = `Jumlah [${item.barcode}] ${item.name} sudah mencapai batas stok maksimal (${result.maxAvail} unit).`;
      } else {
        feedbackMessage = `Barcode [${item.barcode}] ${item.name} (${result.newQty} unit) ditambahkan ke daftar pinjam.`;
      }

      const existingIdx = prev.findIndex((e) => e.itemId === item.id);
      if (existingIdx >= 0) {
        const withoutDuplicates = prev.filter(
          (e, idx) => idx === existingIdx || e.itemId !== item.id
        );
        return withoutDuplicates.map((e) =>
          e.itemId === item.id ? { ...e, qty: result.newQty } : e
        );
      }

      return [
        ...prev,
        {
          itemId: item.id,
          barcode: item.barcode,
          name: item.name,
          qty: result.newQty,
          conditionBefore: item.condition,
        },
      ];
    });

    if (feedbackMessage) {
      setScanFeedback(feedbackMessage);
      setTimeout(() => setScanFeedback(null), 3000);
    }
  };

  const handleManualBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const found = findItemByBarcode(items, barcodeInput);
    if (!found) {
      setScanFeedback(`Kode "${barcodeInput}" tidak ditemukan. Contoh kode: BRG-KBU-001.`);
      return;
    }
    handleAddScannedItem(found, 1);
    setBarcodeInput('');
  };

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setter(compressedDataUrl);
        } else {
          setter(rawDataUrl);
        }
      };
      img.onerror = () => {
        setter(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (scannedCart.length === 0) {
      setFormError('Tambahkan minimal 1 barang yang ingin dipinjam.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('Kolom Keperluan Peminjaman wajib diisi.');
      return;
    }

    for (const entry of scannedCart) {
      const invItem = items.find((i) => i.id === entry.itemId);
      const maxAvail = invItem ? getAvailableQty(invItem) : 0;
      if (!invItem || maxAvail <= 0) {
        setFormError(
          `Barang [${entry.barcode}] ${entry.name} saat ini tidak tersedia untuk dipinjam.`
        );
        return;
      }
      if (entry.qty > maxAvail) {
        setFormError(
          `Jumlah peminjaman [${entry.barcode}] ${entry.name} (${entry.qty} unit) melebihi stok yang tersedia (${maxAvail} unit).`
        );
        return;
      }
    }

    const officer = officers.find((o) => o.id === selectedOfficerId) || officers[0];
    const summaryLabel = scannedCart.map((i) => `${i.qty} ${i.name}`).join(', ');

    const finalPhotoBefore =
      photoBefore ||
      createProofPhotoDataUrl(
        'before',
        `${summaryLabel} — Kondisi Baik`,
        `Peminjam: ${currentMember.name} (${currentMember.kelas})`,
        formatIndonesianDate(borrowDate)
      );

    const finalPhotoHandover =
      photoHandover ||
      createProofPhotoDataUrl(
        'handover_borrow',
        `Serah-Terima ${summaryLabel}`,
        `${currentMember.name} & ${officer.name}`,
        formatIndonesianDate(borrowDate)
      );

    const newTx: LoanTransaction = {
      id: `TRX-2026-${Math.floor(100 + Math.random() * 899)}`,
      memberId: currentMember.id,
      memberName: currentMember.name,
      memberKelas: currentMember.kelas,
      memberJabatan: `${currentMember.jabatan} — ${currentMember.sangga}`,
      memberSignature: currentMember.signatureDataUrl,
      officerId: officer.id,
      officerName: officer.name,
      officerSignature: officer.signatureDataUrl,
      pradanaName: activePradana.name,
      pradanaSignature: activePradana.signatureDataUrl,
      purpose: purpose.trim(),
      borrowDate,
      dueDate,
      status: 'pending_borrow',
      items: scannedCart,
      photoConditionBefore: finalPhotoBefore,
      photoHandoverBorrow: finalPhotoHandover,
    };

    onCreateBorrowRequest(newTx);
    setSubmitSuccessMsg(`Pengajuan berhasil dibuat. Membuka Surat Keterangan Peminjaman PDF...`);
    setTimeout(() => {
      setSubmitSuccessMsg(null);
      setActiveTab('history');
      onOpenLetterModal(newTx, 'borrow');
    }, 600);
  };

  const openReturnModal = (tx: LoanTransaction) => {
    const summaryLabel = tx.items.map((i) => `${i.qty} ${i.name}`).join(', ');
    setReturningTx(tx);
    setReturnConditionText('Baik');
    setReturnPhotoAfter(
      createProofPhotoDataUrl(
        'after',
        `${summaryLabel} — Kondisi Baik`,
        `Pengembali: ${tx.memberName} (${tx.memberKelas})`,
        formatIndonesianDate(new Date())
      )
    );
    setReturnPhotoHandover(
      createProofPhotoDataUrl(
        'handover_return',
        `Pengembalian ${summaryLabel}`,
        `${tx.memberName} & ${tx.officerName}`,
        formatIndonesianDate(new Date())
      )
    );
    setReturnDamagedCounts({});
  };

  const confirmReturnSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningTx) return;
    onSubmitReturnRequest(
      returningTx.id,
      returnConditionText,
      returnPhotoAfter,
      returnPhotoHandover,
      returnDamagedCounts
    );
    setReturningTx(null);
    setReturnDamagedCounts({});
    setActiveTab('history');
  };

  const handleCreateNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const created: ScoutMember = {
      id: `mem-${Date.now()}`,
      name: newMemberName.trim(),
      nia: `06.171.2026.${Math.floor(100 + Math.random() * 899)}`,
      kelas: newMemberKelas.trim() || 'XI IPA 1',
      jabatan: newMemberJabatan.trim() || 'Penegak Bantara',
      sangga: newMemberSangga.trim() || 'Sangga Perintis',
      phone: newMemberPhone.trim() || '0812-3456-7890',
      signatureDataUrl: createSignatureDataUrl(newMemberName.trim(), '#111111'),
    };
    onRegisterMember(created);
    setNewMemberName('');
    setNewMemberPhone('');
    setShowNewMemberForm(false);
  };

  const handleItemPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewItemPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const finalBarcode = newItemBarcode.trim() || generateAutoBarcode('BRG', items.length + 1);
    const created: InventoryItem = {
      id: `item-${Date.now()}`,
      barcode: finalBarcode,
      name: newItemName.trim(),
      category: newItemCategory,
      totalQty: Math.max(1, Number(newItemQty) || 10),
      borrowedQty: 0,
      damagedQty: 0,
      condition: newItemCondition,
      location: newItemLocation.trim() || 'Sanggar Pramuka MAN 11',
      lastChecked: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      imageSvgType: 'stick',
      photoUrl: newItemPhoto || undefined,
    };
    onAddNewItem(created);
    setNewItemName('');
    setNewItemPhoto(null);
    setNewItemCondition('Baik');
    setNewItemBarcode(generateAutoBarcode('BRG', items.length + 2));
    setShowAddItemSheet(false);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditTotalQty(item.totalQty);
    setEditDamagedQty(item.damagedQty);
    setEditLocation(item.location);
    setEditCondition(item.condition);
    setEditNotes(item.notes || '');
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedTotalQty = Math.max(0, Number(editTotalQty) || 0);
    if (parsedTotalQty < editingItem.borrowedQty) {
      setScanFeedback(
        `Gagal menyimpan: Total stok (${parsedTotalQty}) tidak boleh kurang dari jumlah yang sedang dipinjam (${editingItem.borrowedQty} unit)!`
      );
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }

    const updated: InventoryItem = {
      ...editingItem,
      name: editName.trim() || editingItem.name,
      category: editCategory,
      totalQty: parsedTotalQty,
      damagedQty: Math.max(0, Number(editDamagedQty) || 0),
      location: editLocation.trim() || editingItem.location,
      condition: editCondition,
      notes: editNotes.trim(),
      lastChecked: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };
    onEditItem?.(updated);
    setEditingItem(null);
    setScanFeedback(`Data [${updated.barcode}] ${updated.name} berhasil diperbarui.`);
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const handleConfirmDeleteItem = () => {
    if (!deletingItem) return;
    if (deletingItem.borrowedQty > 0) {
      setScanFeedback(
        `Gagal menghapus [${deletingItem.barcode}]: ${deletingItem.borrowedQty} unit masih dalam peminjaman aktif!`
      );
      setDeletingItem(null);
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }
    onDeleteItem?.(deletingItem.id);
    setScanFeedback(`Barang [${deletingItem.barcode}] ${deletingItem.name} berhasil dihapus.`);
    setDeletingItem(null);
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const handleExportInventoryCsv = () => {
    const csv = exportInventoryToCsv(items);
    downloadCsvFile(csv, 'rekap_inventaris_man11.csv');
    setScanFeedback('File rekap_inventaris_man11.csv berhasil diunduh.');
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const handleExportTransactionsCsv = () => {
    const csv = exportTransactionsToCsv(transactions);
    downloadCsvFile(csv, 'riwayat_peminjaman_man11.csv');
    setScanFeedback('File riwayat_peminjaman_man11.csv berhasil diunduh.');
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const handleConfirmResetData = () => {
    onResetSeedData?.();
    setShowResetConfirm(false);
    setScanFeedback('Data sistem berhasil direset ke sampel awal MAN 11 Jakarta.');
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCategory === 'Semua' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const displayedTransactions =
    role === 'admin'
      ? transactions.filter((tx) => {
          if (txStatusFilter === 'pending')
            return tx.status === 'pending_borrow' || tx.status === 'pending_return';
          if (txStatusFilter === 'active')
            return tx.status === 'active_borrowed' || tx.status === 'overdue';
          if (txStatusFilter === 'returned') return tx.status === 'returned';
          return true;
        })
      : memberTransactions;

  const statusLabelMap: Record<LoanTransaction['status'], { text: string; color: string }> = {
    pending_borrow: { text: 'Menunggu ACC Inventaris', color: 'text-[#B45309]' },
    active_borrowed: { text: 'Dipinjam · Surat Peminjaman Terbit', color: 'text-[#15803D]' },
    overdue: { text: 'Melewati Batas Waktu Kembali', color: 'text-[#DC2626]' },
    pending_return: { text: 'Menunggu Verifikasi Pengembalian', color: 'text-[#0369A1]' },
    returned: { text: 'Selesai · Surat Pengembalian Terbit', color: 'text-[#3B2314]' },
    rejected: { text: 'Ditolak Admin', color: 'text-[#DC2626]' },
  };

  // SVG Smooth Curve Path for Monthly Checkout Trends (Admin Mode)
  const chartWidth = 360;
  const chartHeight = 130;
  const maxTrendVal = 200;
  const trendPoints = MONTHLY_TREND_DATA.map((d, idx) => {
    const x = 28 + (idx * (chartWidth - 44)) / (MONTHLY_TREND_DATA.length - 1);
    const y = chartHeight - 22 - (d.loans / maxTrendVal) * (chartHeight - 38);
    return { x, y, ...d };
  });

  const buildSmoothSvgPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpx1 = p0.x + (p1.x - p0.x) / 2;
      const cpy1 = p0.y;
      const cpx2 = p0.x + (p1.x - p0.x) / 2;
      const cpy2 = p1.y;
      d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = buildSmoothSvgPath(trendPoints);
  const areaPath = `${linePath} L ${trendPoints[trendPoints.length - 1].x} ${
    chartHeight - 22
  } L ${trendPoints[0].x} ${chartHeight - 22} Z`;

  const ringRadius = 32;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const borrowedStroke = (stats.borrowedPct / 100) * ringCircumference;
  const availableStroke = (stats.availablePct / 100) * ringCircumference;

  return (
    <div className="min-h-screen w-full max-w-md mx-auto bg-[#FBF8F3] text-[#2A1810] flex flex-col justify-between shadow-xl border-x border-[#E5D7C3] relative">
      {/* ==================== REFINED MOBILE APP HEADER ==================== */}
      <header className="relative bg-gradient-to-b from-[#452815] to-[#2E1A0D] text-[#FBF8F3] px-5 pt-5 pb-4 overflow-hidden shrink-0 border-b border-[#5C3A21]">
        {/* Top Row: Emblem + Identity + Notification + Logout */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-12 shrink-0 flex items-center justify-center">
              <img
                src={AMBALAN_SHIELD_LOGO_BASE64}
                alt="Logo Ambalan MAN 11 Jakarta"
                className="w-10 h-12 object-contain drop-shadow-md"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono tracking-wider text-[#C89D54] block">
                GUDEP 06.171–06.172 • MAN 11 JKT
              </span>
              <h1 className="text-base font-extrabold tracking-tight text-white truncate">
                SIPRAMA • Khobinwal - Umkul
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={triggerAlarmSound}
              aria-label="Pengingat Pengembalian"
              className={`relative min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                overdueMemberTx.length > 0
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#5C3A21]/70 text-[#F4EDE2]'
              }`}
            >
              {overdueMemberTx.length > 0 ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              {overdueMemberTx.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[#DC2626] text-[10px] font-extrabold flex items-center justify-center">
                  {overdueMemberTx.length}
                </span>
              )}
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Keluar / Logout Akun"
                className="min-h-[38px] px-2.5 rounded-xl bg-[#24140B] hover:bg-[#3B2314] text-[#D9C3A9] hover:text-white border border-[#5C3A21] flex items-center justify-center gap-1 text-xs font-bold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-[#C89D54]" />
                <span className="text-[11px]">Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Active User Card */}
        <div className="relative z-10 mt-3.5 px-3.5 py-2.5 rounded-xl bg-[#221209]/80 border border-[#5C3A21] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-[#D9C3A9]">
              {role === 'admin' ? 'Petugas Dewan Inventaris (Admin SK):' : 'Akun Anggota Peminjam:'}
            </p>
            <p className="text-sm font-extrabold text-white truncate">
              {currentUser?.name || (role === 'admin' ? activeOfficer.name : currentMember.name)}
            </p>
            <p className="text-[11px] text-[#C89D54] truncate">
              {role === 'admin'
                ? (currentUser?.adminRole || activeOfficer.role)
                : `${currentMember.kelas} · ${currentMember.jabatan}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenLetterModal(transactions[0], 'borrow')}
            className="px-3 py-1.5 rounded-lg bg-[#C89D54] text-[#2A1810] text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1 shadow-xs hover:bg-[#d8ae66]"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Surat PDF
          </button>
        </div>

        {/* Clean Role Switcher (Mode Anggota vs Mode Admin Inventaris) */}
        <div className="relative z-10 mt-3 grid grid-cols-2 gap-1.5 bg-[#1F1008] p-1 rounded-xl border border-[#5C3A21]">
          <button
            type="button"
            onClick={() => onChangeRole('member')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              role === 'member'
                ? 'bg-[#C89D54] text-[#2A1810]'
                : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Anggota Pramuka
          </button>
          <button
            type="button"
            onClick={() => onChangeRole('admin')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              role === 'admin'
                ? 'bg-[#C89D54] text-[#2A1810]'
                : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin ({stats.pendingApprovalCount} ACC)
          </button>
        </div>
      </header>

      {/* ==================== MAIN MOBILE APP BODY ==================== */}
      <main className="flex-1 px-4 pt-4 pb-28 space-y-4">
        {alarmSentBanner && (
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-bold flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>{alarmSentBanner}</span>
          </div>
        )}

        {/* ==================== TAB 1: BERANDA (ANGGOTA) ==================== */}
        {activeTab === 'home' && role === 'member' && (
          <div className="space-y-4">
            {/* Overdue Reminder Banner */}
            {overdueMemberTx.length > 0 && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#7F1D1D]">
                      Pengingat Batas Waktu Pengembalian
                    </p>
                    <p className="text-[11px] text-[#991B1B] leading-snug mt-0.5">
                      Peminjaman{' '}
                      <strong>
                        {overdueMemberTx[0].items.map((i) => `${i.qty} ${i.name}`).join(', ')}
                      </strong>{' '}
                      telah melewati jadwal pengembalian.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openReturnModal(overdueMemberTx[0])}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#991B1B] text-white text-xs font-bold hover:bg-[#7F1D1D] transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Proses Pengembalian Barang Sekarang
                </button>
              </div>
            )}

            {/* Primary Scan QR/Barcode CTA */}
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#3B2314] hover:bg-[#4E301C] text-[#FBF8F3] font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2.5"
            >
              <ScanLine className="w-5 h-5 text-[#C89D54]" />
              <span>Scan Barcode & Buat Surat Peminjaman</span>
            </button>

            {/* Quick Member Summary Strip */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-white border border-[#E5D7C3]">
                <p className="text-[11px] text-[#6E5039]">Pinjaman Aktif</p>
                <p className="text-lg font-extrabold font-mono text-[#3B2314] tabular-nums mt-0.5">
                  {activeCheckouts.length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E5D7C3]">
                <p className="text-[11px] text-[#6E5039]">Surat Resmi PDF</p>
                <p className="text-lg font-extrabold font-mono text-[#15803D] tabular-nums mt-0.5">
                  {memberTransactions.length}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E5D7C3]">
                <p className="text-[11px] text-[#6E5039]">TTD Digital</p>
                <p className="text-xs font-extrabold text-[#8B5A2B] mt-1.5">Siap Pakai</p>
              </div>
            </div>

            {/* Daftar Surat & Peminjaman Saya */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Peminjaman & Surat Keterangan Saya
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-bold text-[#8B5A2B] hover:underline"
                >
                  Lihat Semua
                </button>
              </div>

              {memberTransactions.map((tx) => {
                const statusMeta = statusLabelMap[tx.status];
                const totalItemsQty = tx.items.reduce((acc, i) => acc + i.qty, 0);

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#F4EDE2] border border-[#D9C3A9] flex items-center justify-center shrink-0 text-[#3B2314] mt-0.5">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#2A1810]">
                            {tx.items.map((i) => `${i.name} (${i.qty})`).join(', ')}
                          </p>
                          <p className="text-[11px] text-[#6E5039] mt-0.5">
                            Keperluan: <strong>{tx.purpose}</strong> · ({totalItemsQty} unit)
                          </p>
                          <p className="text-[11px] text-[#6E5039]">
                            Inventaris: {tx.officerName} · {formatIndonesianDate(tx.borrowDate)}
                          </p>
                          <p className={`text-[11px] font-bold mt-1 ${statusMeta.color}`}>
                            {statusMeta.text}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F4EDE2]">
                      <button
                        type="button"
                        onClick={() => onOpenLetterModal(tx, 'borrow')}
                        className="py-2 px-3 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] text-[11px] font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-[#8B5A2B]" />
                        Surat Peminjaman PDF
                      </button>

                      {tx.status === 'returned' || tx.status === 'pending_return' ? (
                        <button
                          type="button"
                          onClick={() => onOpenLetterModal(tx, 'return')}
                          className="py-2 px-3 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#166534] text-[11px] font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Surat Pengembalian PDF
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReturnModal(tx)}
                          className="py-2 px-3 rounded-xl bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-[11px] font-bold inline-flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#C89D54]" />
                          Kembalikan Barang
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info Ketentuan Resmi Ambalan */}
            <div className="p-3.5 rounded-2xl bg-[#F4EDE2] border border-[#D9C3A9] text-xs space-y-1">
              <p className="font-extrabold text-[#3B2314] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#8B5A2B]" />
                Aturan Peminjaman Ambalan MAN 11 Jakarta
              </p>
              <p className="text-[11px] text-[#5C3A21] leading-relaxed">
                1. Barang dikembalikan sesuai peminjaman dan dihitung bersama bagian inventaris.
                <br />
                2. Surat Peminjaman & Pengembalian PDF otomatis terisi dari data profil dan siap
                disesuaikan atau dicetak kapan saja.
              </p>
            </div>
          </div>
        )}

        {/* ==================== TAB 1 (ADMIN MODE): DASHBOARD ANALITIK, KURVA & ACC ==================== */}
        {activeTab === 'home' && role === 'admin' && (
          <div className="space-y-4">
            {/* Active Dewan Inventaris Picker */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-[#8B5A2B] flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  DEWAN INVENTARIS BERTUGAS (5 PENGURUS):
                </span>
                <span className="text-[10px] font-mono text-[#15803D] font-bold">
                  TTD Surat Aktif
                </span>
              </div>
              <select
                value={activeOfficerId}
                onChange={(e) => onChangeActiveOfficer(e.target.value)}
                aria-label="Pilih Dewan Inventaris Bertugas"
                className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-extrabold text-[#2A1810]"
              >
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {o.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Donut Rings: Borrowed vs Available */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Diagram Lingkar Status Stok Barang
                </h2>
                <p className="text-[11px] text-[#6E5039]">
                  Total {stats.totalUnits} Unit Peralatan Sanggar MAN 11 Jakarta
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-3 rounded-xl bg-[#FBF8F3] border border-[#E5D7C3]">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r={ringRadius}
                        fill="none"
                        stroke="#E5D7C3"
                        strokeWidth="8"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={ringRadius}
                        fill="none"
                        stroke="#3B2314"
                        strokeWidth="8"
                        strokeDasharray={`${borrowedStroke} ${ringCircumference}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-extrabold font-mono text-[#2A1810]">
                        {stats.borrowedUnits}
                      </span>
                      <span className="text-[9px] text-[#6E5039] font-bold">
                        {stats.borrowedPct}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#3B2314] mt-1">Sedang Dipinjam</span>
                </div>

                <div className="flex flex-col items-center p-3 rounded-xl bg-[#FBF8F3] border border-[#E5D7C3]">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r={ringRadius}
                        fill="none"
                        stroke="#E5D7C3"
                        strokeWidth="8"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={ringRadius}
                        fill="none"
                        stroke="#C89D54"
                        strokeWidth="8"
                        strokeDasharray={`${availableStroke} ${ringCircumference}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-extrabold font-mono text-[#2A1810]">
                        {stats.availableUnits}
                      </span>
                      <span className="text-[9px] text-[#6E5039] font-bold">
                        {stats.availablePct}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#8B5A2B] mt-1">Stok Tersedia</span>
                </div>
              </div>
            </div>

            {/* Quick CSV Export Bar for Admin */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-[#2A1810]">
                  Ekspor Rekap Data (.CSV)
                </h3>
                <p className="text-[10px] text-[#6E5039]">
                  Download file inventaris & riwayat peminjaman
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportInventoryCsv}
                  className="px-2.5 py-1.5 rounded-lg bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] text-[11px] font-bold border border-[#D9C3A9] inline-flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3 text-[#8B5A2B]" />
                  Inventaris
                </button>
                <button
                  type="button"
                  onClick={handleExportTransactionsCsv}
                  className="px-2.5 py-1.5 rounded-lg bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] text-[11px] font-bold border border-[#D9C3A9] inline-flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3 text-[#8B5A2B]" />
                  Riwayat
                </button>
              </div>
            </div>

            {/* Line Graph: Kurva Tren Peminjaman Bulanan */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#2A1810] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#8B5A2B]" />
                    Kurva Tren Peminjaman Bulanan
                  </h2>
                  <p className="text-[11px] text-[#6E5039]">
                    Grafik peminjaman alat jelang LKBBT & Kemah Blok
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#F4EDE2] text-[#3B2314] px-2 py-1 rounded-lg">
                  Puncak: 186 Unit
                </span>
              </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-36 overflow-visible"
              >
                <defs>
                  <linearGradient id="mobileScoutTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5A2B" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#C89D54" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0, 50, 100, 150, 200].map((val) => {
                  const y = chartHeight - 22 - (val / maxTrendVal) * (chartHeight - 38);
                  return (
                    <g key={val}>
                      <line
                        x1="24"
                        y1={y}
                        x2={chartWidth - 8}
                        y2={y}
                        stroke="#E5D7C3"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x="2"
                        y={y + 3}
                        fontSize="8"
                        fontFamily="JetBrains Mono, monospace"
                        fill="#8B5A2B"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                <path d={areaPath} fill="url(#mobileScoutTrend)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#3B2314"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {trendPoints.map((pt) => (
                  <g key={pt.month}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="#FBF8F3"
                      stroke="#3B2314"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 6}
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                      fill="#3B2314"
                      textAnchor="middle"
                    >
                      {pt.loans}
                    </text>
                    <text
                      x={pt.x}
                      y={chartHeight - 5}
                      fontSize="9"
                      fontWeight="600"
                      fill="#6E5039"
                      textAnchor="middle"
                    >
                      {pt.month}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Bar Chart: Equipment Most Used */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-2.5">
              <div>
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Diagram Barang Paling Sering Dipinjam
                </h2>
                <p className="text-[11px] text-[#6E5039]">Distribusi unit yang sedang digunakan</p>
              </div>
              <div className="space-y-2">
                {sortedByUsage.map((item, idx) => {
                  const widthPct = Math.round((item.borrowedQty / maxBorrowedItem) * 100);
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2A1810] truncate">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-mono font-extrabold text-[#3B2314]">
                          {item.borrowedQty} / {item.totalQty} unit
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#F4EDE2] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#3B2314]"
                          style={{ width: `${Math.max(12, widthPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Approvals & Dual Photo Verification List */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Persetujuan Admin & Penerbitan Surat PDF
                </h2>
                <p className="text-[11px] text-[#6E5039]">
                  Verifikasi bukti foto sebelum/sesudah dan cetak Surat Resmi Ambalan
                </p>
              </div>

              <div className="space-y-3">
                {transactions.map((tx) => {
                  const statusMeta = statusLabelMap[tx.status];
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl bg-[#FBF8F3] border border-[#E5D7C3] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#8B5A2B]">
                            {tx.id} · {formatIndonesianDate(tx.borrowDate)}
                          </span>
                          <p className="text-xs font-extrabold text-[#2A1810]">
                            {tx.memberName} ({tx.memberKelas})
                          </p>
                          <p className="text-[11px] font-semibold text-[#3B2314]">
                            {tx.items.map((i) => `${i.name} (${i.qty})`).join(', ')}
                          </p>
                          <p className="text-[11px] text-[#6E5039]">Keperluan: {tx.purpose}</p>
                          <p className={`text-[11px] font-extrabold mt-0.5 ${statusMeta.color}`}>
                            {statusMeta.text}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setInspectingTx(tx)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-[#3B2314] text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
                        >
                          <Eye className="w-3 h-3 text-[#8B5A2B]" />
                          Bukti Foto
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-[#6E5039] block mb-0.5">
                            Foto Kondisi Barang:
                          </span>
                          <img
                            src={tx.photoConditionAfter || tx.photoConditionBefore}
                            alt="Bukti Kondisi"
                            className="w-full h-16 object-cover rounded-lg border border-[#D9C3A9]"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-[#6E5039] block mb-0.5">
                            Foto Serah-Terima:
                          </span>
                          <img
                            src={tx.photoHandoverReturn || tx.photoHandoverBorrow}
                            alt="Bukti Serah Terima"
                            className="w-full h-16 object-cover rounded-lg border border-[#D9C3A9]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tx.status === 'pending_borrow' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onApproveBorrow(tx.id)}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold inline-flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                              ACC & Terbitkan Surat PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectTransaction(tx.id)}
                              className="py-2 px-3 rounded-xl bg-[#991B1B] text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              Tolak
                            </button>
                          </>
                        )}

                        {tx.status === 'pending_return' && (
                          <button
                            type="button"
                            onClick={() => onApproveReturn(tx.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#15803D] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            ACC Kembali & Terbitkan PDF
                          </button>
                        )}

                        {tx.status === 'overdue' && (
                          <button
                            type="button"
                            onClick={() => {
                              onTriggerMemberAlarm(tx.id);
                              triggerAlarmSound();
                              setAlarmSentBanner(
                                `Pengingat keterlambatan telah dikirimkan ke akun ${tx.memberName}.`
                              );
                              setTimeout(() => setAlarmSentBanner(null), 3000);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#DC2626] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1"
                          >
                            <BellRing className="w-3.5 h-3.5" />
                            Kirim Alarm Pengingat
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onOpenLetterModal(
                              tx,
                              tx.status === 'returned' ? 'return' : 'borrow'
                            )
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-[#F4EDE2] border border-[#D9C3A9] text-[#3B2314] text-xs font-bold inline-flex items-center justify-center gap-1"
                        >
                          <FileCheck2 className="w-3.5 h-3.5 text-[#8B5A2B]" />
                          Lihat / Sesuaikan Surat PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: KATALOG BARANG ==================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Katalog Peralatan & Kode Barcode
                </h2>
                <p className="text-[11px] text-[#6E5039]">
                  Daftar inventaris Ambalan Khalid bin Walid - Ummu Kultsum
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportInventoryCsv}
                  title="Unduh Rekap Inventaris CSV"
                  className="px-2.5 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#3B2314] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#F4EDE2] transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#8B5A2B]" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItemSheet(true)}
                  className="px-3 py-2 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-bold inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C89D54]" />
                  Tambah
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#8B5A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang atau kode barcode..."
                aria-label="Cari barang inventaris"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#D9C3A9] text-xs text-[#2A1810] focus:outline-none focus:border-[#3B2314]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  'Semua',
                  'Tongkat & Pionering',
                  'Tenda & Kemah',
                  'Navigasi & Komlek',
                  'Dapur',
                ] as ItemCategory[]
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#3B2314] text-[#FBF8F3]'
                      : 'bg-white border border-[#E5D7C3] text-[#5C3A21] hover:bg-[#F4EDE2]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const avail = getAvailableQty(item);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] flex items-center justify-between gap-3 shadow-xs"
                  >
                    {/* Item Photo / Icon */}
                    {item.photoUrl ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#D9C3A9] shrink-0 bg-[#F4EDE2]">
                        <img
                          src={item.photoUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-[#E5D7C3] shrink-0 bg-[#F8F4EE] flex items-center justify-center text-[#8B6B4A]">
                        <ImageIcon className="w-6 h-6 opacity-60" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedBarcodeItem(item)}
                          title="Klik untuk Cetak / Unduh Stiker Barcode"
                          className="px-2 py-0.5 rounded-md bg-[#F4EDE2] hover:bg-[#EAE0D0] border border-[#D9C3A9] text-[10px] font-mono font-bold text-[#8B5A2B] inline-flex items-center gap-1"
                        >
                          <Barcode className="w-3 h-3 text-[#C89D54]" />
                          <span>{item.barcode}</span>
                        </button>
                        <span className="text-[10px] font-medium text-[#8B5A2B]">
                          · {item.category}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold text-[#2A1810] leading-tight">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-[#6E5039]">
                        Tersedia:{' '}
                        <strong className="font-mono text-[#15803D]">{avail} unit</strong> ·
                        Dipinjam: <span className="font-mono">{item.borrowedQty}</span> · Kondisi:{' '}
                        <span
                          className={`font-semibold ${
                            item.condition === 'Baik'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {item.condition}
                        </span>
                      </p>
                      <p className="text-[10px] text-[#8B5A2B]">📍 {item.location}</p>
                      {item.notes && (
                        <p className="text-[10px] text-[#6E5039] italic">Catatan: {item.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedBarcodeItem(item)}
                        title="Cetak & Unduh Barcode"
                        className="p-2 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] border border-[#D9C3A9] transition-colors inline-flex items-center justify-center"
                      >
                        <Barcode className="w-3.5 h-3.5 text-[#8B5A2B]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleAddScannedItem(item, 1);
                          setActiveTab('scan');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-xs font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#C89D54]" />
                        Pinjam
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditItemModal(item)}
                        aria-label={`Edit ${item.name}`}
                        title="Edit Data Barang"
                        className="p-2 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] border border-[#D9C3A9] transition-colors inline-flex items-center justify-center"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#8B5A2B]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        aria-label={`Hapus ${item.name}`}
                        title="Hapus Barang"
                        className="p-2 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] transition-colors inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: SCAN BARCODE & FORM PEMINJAMAN ==================== */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Real Camera Barcode Scanner & Barcode Input */}
            <div className="p-4 rounded-2xl bg-[#2A1810] text-[#FBF8F3] border border-[#5C3A21] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-[#C89D54]" />
                  <h2 className="text-xs font-extrabold tracking-wide">
                    PEMINDAI BARCODE PERALATAN
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraActive((v) => !v)}
                  className="px-2.5 py-1 rounded-lg bg-[#5C3A21] text-[11px] font-bold text-[#FBF8F3] hover:bg-[#70482A] inline-flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5 text-[#C89D54]" />
                  {cameraActive ? 'Matikan Kamera' : 'Aktifkan Kamera'}
                </button>
              </div>

              {cameraActive && (
                <div className="relative h-40 rounded-xl bg-black border border-[#C89D54] overflow-hidden flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-6 top-1/2 h-0.5 bg-[#C89D54] shadow-[0_0_8px_#C89D54]" />
                </div>
              )}

              {cameraError && (
                <p className="text-[11px] text-[#FDE68A] bg-[#451A03] px-3 py-2 rounded-lg">
                  {cameraError}
                </p>
              )}

              {/* Input Kode Barcode Langsung */}
              <form onSubmit={handleManualBarcodeScan} className="flex gap-2">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Ketik kode barcode (BRG-KBU-001)..."
                  aria-label="Input kode barcode"
                  className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-[#1A0F0A] border border-[#5C3A21] text-xs text-white focus:outline-none focus:border-[#C89D54]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#C89D54] text-[#2A1810] text-xs font-extrabold hover:bg-[#d8ae66] shrink-0"
                >
                  Tambah
                </button>
              </form>

              {/* Pilih Barang dari Katalog */}
              <div className="pt-1 border-t border-[#5C3A21]/60">
                <label className="block text-[11px] text-[#D9C3A9] mb-1.5">
                  Atau pilih barang dari daftar inventaris:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCatalogItemId}
                    onChange={(e) => setSelectedCatalogItemId(e.target.value)}
                    aria-label="Pilih barang dari inventaris"
                    className="min-w-0 flex-1 px-2.5 py-2 rounded-xl bg-[#1A0F0A] border border-[#5C3A21] text-xs text-white truncate"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.barcode}] {item.name} ({getAvailableQty(item)} unit)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const found = items.find((i) => i.id === selectedCatalogItemId);
                      if (found) handleAddScannedItem(found, 1);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#5C3A21] hover:bg-[#70482A] text-white text-xs font-bold shrink-0"
                  >
                    + Pilih
                  </button>
                </div>
              </div>

              {scanFeedback && (
                <p className="text-xs font-bold text-[#4ADE80] bg-[#14532D]/60 px-3 py-1.5 rounded-lg">
                  {scanFeedback}
                </p>
              )}
            </div>

            {/* Daftar Barang yang Dipilih */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#2A1810]">
                  Tabel Barang yang Akan Dipinjam ({scannedCart.length} baris)
                </h3>
                <span className="text-[10px] text-[#6E5039]">Otomatis masuk ke Tabel Surat</span>
              </div>

              {scannedCart.length === 0 ? (
                <p className="text-xs text-[#6E5039] py-3 text-center">
                  Belum ada barang dipilih. Scan barcode atau pilih barang di atas.
                </p>
              ) : (
                <div className="space-y-2">
                  {scannedCart.map((entry) => (
                    <div
                      key={entry.itemId}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FBF8F3] border border-[#E5D7C3]"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono font-bold text-[#8B5A2B]">
                          {entry.barcode} · Kondisi: {entry.conditionBefore}
                        </p>
                        <p className="text-xs font-extrabold text-[#2A1810] truncate">
                          {entry.name}
                        </p>
                      </div>

                      {(() => {
                        const invItem = items.find((i) => i.id === entry.itemId);
                        const maxAvail = invItem ? getAvailableQty(invItem) : entry.qty;
                        const isAtMax = entry.qty >= maxAvail;
                        const isAtMin = entry.qty <= 1;

                        return (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              aria-label={`Kurangi jumlah ${entry.name}`}
                              disabled={isAtMin}
                              onClick={() =>
                                setScannedCart((prev) =>
                                  prev.map((e) =>
                                    e.itemId === entry.itemId
                                      ? { ...e, qty: Math.max(1, e.qty - 1) }
                                      : e
                                  )
                                )
                              }
                              className={`w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314] ${
                                isAtMin ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EBDBC9]'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, maxAvail)}
                              aria-label={`Jumlah ${entry.name}`}
                              value={entry.qty}
                              onChange={(e) => {
                                const rawVal = parseInt(e.target.value, 10);
                                const parsedVal = isNaN(rawVal) ? 1 : rawVal;
                                const clampedVal = Math.min(
                                  Math.max(1, maxAvail),
                                  Math.max(1, parsedVal)
                                );
                                setScannedCart((prev) =>
                                  prev.map((item) =>
                                    item.itemId === entry.itemId ? { ...item, qty: clampedVal } : item
                                  )
                                );
                              }}
                              className="w-12 text-center font-mono text-xs font-extrabold bg-white border border-[#D9C3A9] rounded-lg py-1 focus:ring-1 focus:ring-[#8B5A2B] outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Tambah jumlah ${entry.name}`}
                              disabled={isAtMax}
                              onClick={() =>
                                setScannedCart((prev) =>
                                  prev.map((e) => {
                                    if (e.itemId !== entry.itemId) return e;
                                    const nextQty = Math.min(Math.max(1, maxAvail), e.qty + 1);
                                    return { ...e, qty: nextQty };
                                  })
                                )
                              }
                              className={`w-7 h-7 rounded-lg bg-white border border-[#D9C3A9] flex items-center justify-center text-[#3B2314] ${
                                isAtMax ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EBDBC9]'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${entry.name}`}
                              onClick={() =>
                                setScannedCart((prev) =>
                                  prev.filter((e) => e.itemId !== entry.itemId)
                                )
                              }
                              className="w-7 h-7 rounded-lg bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center ml-1 hover:bg-[#FECACA]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Pengajuan & Dokumentasi Kondisi Barang */}
            <form
              onSubmit={handleBorrowSubmit}
              className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-3.5"
            >
              <h3 className="text-xs font-extrabold text-[#2A1810] border-b border-[#F4EDE2] pb-2">
                Data Surat Keterangan Peminjaman Barang
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-[#3B2314] mb-1">
                  Keperluan Peminjaman *
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Contoh: Pengisian Materi LKBBT"
                  className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-medium text-[#2A1810]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#3B2314] mb-1">
                  Nama Yang Menyerahkan (Dewan Inventaris) *
                </label>
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  aria-label="Pilih Dewan Inventaris Bertugas"
                  className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                >
                  {officers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} — ({off.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-1">
                    Hari / Tanggal Pinjam
                  </label>
                  <input
                    type="datetime-local"
                    value={borrowDate}
                    onChange={(e) => setBorrowDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-[11px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-1">
                    Jadwal Pengembalian
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-[11px] font-mono"
                  />
                </div>
              </div>

              {/* Dokumentasi Foto Bukti Ganda */}
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-extrabold text-[#3B2314]">
                  Dokumentasi Kondisi Barang & Serah-Terima:
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] flex flex-col justify-between space-y-2">
                    <div>
                      <p className="text-[10px] font-extrabold text-[#3B2314]">
                        1. Foto Kondisi Sebelum
                      </p>
                      <p className="text-[10px] text-[#6E5039]">Kondisi awal barang</p>
                    </div>
                    {photoBefore && (
                      <img
                        src={photoBefore}
                        alt="Preview Sebelum"
                        className="w-full h-16 object-cover rounded-lg border border-[#D9C3A9]"
                      />
                    )}
                    <label className="w-full py-2 px-2 rounded-lg bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-[10px] font-bold text-center cursor-pointer inline-flex items-center justify-center gap-1">
                      <Camera className="w-3 h-3 text-[#C89D54]" />
                      <span>{photoBefore ? 'Ganti Foto' : 'Unggah / Ambil Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleImageFileUpload(e, setPhotoBefore)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] flex flex-col justify-between space-y-2">
                    <div>
                      <p className="text-[10px] font-extrabold text-[#3B2314]">
                        2. Foto Serah-Terima
                      </p>
                      <p className="text-[10px] text-[#6E5039]">Bersama pengurus</p>
                    </div>
                    {photoHandover && (
                      <img
                        src={photoHandover}
                        alt="Preview Serah Terima"
                        className="w-full h-16 object-cover rounded-lg border border-[#D9C3A9]"
                      />
                    )}
                    <label className="w-full py-2 px-2 rounded-lg bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-[10px] font-bold text-center cursor-pointer inline-flex items-center justify-center gap-1">
                      <Camera className="w-3 h-3 text-[#C89D54]" />
                      <span>{photoHandover ? 'Ganti Foto' : 'Unggah / Ambil Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleImageFileUpload(e, setPhotoHandover)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4EDE2] border border-[#D9C3A9] flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold text-[#3B2314]">
                    TTD Peminjam ({currentMember.name})
                  </p>
                  <p className="text-[10px] text-[#6E5039]">
                    Otomatis terpasang di Surat Keterangan PDF
                  </p>
                </div>
                <img
                  src={currentMember.signatureDataUrl}
                  alt="TTD Peminjam"
                  className="h-9 w-auto bg-white px-2 py-0.5 rounded border border-[#D9C3A9]"
                />
              </div>

              {formError && (
                <p className="text-xs font-bold text-[#DC2626] bg-[#FEF2F2] p-2.5 rounded-xl border border-[#FECACA]">
                  {formError}
                </p>
              )}

              {submitSuccessMsg && (
                <p className="text-xs font-bold text-[#15803D] bg-[#DCFCE7] p-2.5 rounded-xl border border-[#BBF7D0]">
                  {submitSuccessMsg}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-xs font-extrabold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#C89D54]" />
                Buat Surat Keterangan Peminjaman PDF
              </button>
            </form>
          </div>
        )}

        {/* ==================== TAB 4: RIWAYAT & SURAT PDF ==================== */}
        {activeTab === 'history' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-[#2A1810]">
                  Riwayat & Dokumen Surat Resmi PDF
                </h2>
                <p className="text-[11px] text-[#6E5039]">
                  Klik tombol Surat PDF untuk menyesuaikan isi surat atau mencetak dokumen
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportTransactionsCsv}
                title="Unduh Riwayat Peminjaman CSV"
                className="px-2.5 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#3B2314] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#F4EDE2] transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#8B5A2B]" />
                <span>CSV</span>
              </button>
            </div>

            {role === 'admin' && (
              <div className="flex items-center gap-1 bg-[#F4EDE2] p-1 rounded-xl">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'pending', label: `Perlu ACC (${stats.pendingApprovalCount})` },
                  { id: 'active', label: 'Dipinjam' },
                  { id: 'returned', label: 'Selesai' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setTxStatusFilter(tab.id as 'all' | 'pending' | 'active' | 'returned')
                    }
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      txStatusFilter === tab.id
                        ? 'bg-[#3B2314] text-[#FBF8F3]'
                        : 'text-[#5C3A21]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {displayedTransactions.map((tx) => {
                const statusMeta = statusLabelMap[tx.status];
                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl bg-white border border-[#E5D7C3] space-y-3"
                  >
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#8B5A2B]">
                        {tx.id} · {formatIndonesianDate(tx.borrowDate)} · Inventaris:{' '}
                        {tx.officerName}
                      </span>
                      <h3 className="text-xs font-extrabold text-[#2A1810] mt-0.5">
                        {tx.memberName} ({tx.memberKelas}) — {tx.purpose}
                      </h3>
                      <p className={`text-[11px] font-bold mt-0.5 ${statusMeta.color}`}>
                        {statusMeta.text}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FBF8F3] border border-[#E5D7C3] space-y-1">
                      {tx.items.map((item, i) => (
                        <div
                          key={`${item.itemId}-${i}`}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-[#2A1810]">
                            {i + 1}. {item.name}{' '}
                            <span className="font-mono text-[10px] text-[#8B5A2B]">
                              ({item.barcode})
                            </span>
                          </span>
                          <span className="font-mono font-bold text-[#3B2314]">
                            {item.qty} unit ({item.conditionBefore})
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenLetterModal(tx, 'borrow')}
                        className="py-2 px-3 rounded-xl bg-[#3B2314] hover:bg-[#5C3A21] text-[#FBF8F3] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-[#C89D54]" />
                        Surat Peminjaman PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenLetterModal(tx, 'return')}
                        className="py-2 px-3 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] border border-[#D9C3A9] text-[#3B2314] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-[#15803D]" />
                        Surat Pengembalian PDF
                      </button>
                    </div>

                    {role === 'member' &&
                      (tx.status === 'active_borrowed' || tx.status === 'overdue') && (
                        <button
                          type="button"
                          onClick={() => openReturnModal(tx)}
                          className="w-full py-2 px-3 rounded-xl bg-[#C89D54] hover:bg-[#d8ae66] text-[#2A1810] text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Unggah Dokumentasi Sesudah & Kembalikan Barang
                        </button>
                      )}

                    {role === 'admin' && tx.status === 'pending_borrow' && (
                      <button
                        type="button"
                        onClick={() => onApproveBorrow(tx.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#15803D] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Setujui (ACC) Peminjaman
                      </button>
                    )}

                    {role === 'admin' && tx.status === 'pending_return' && (
                      <button
                        type="button"
                        onClick={() => onApproveReturn(tx.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#15803D] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Setujui (ACC) Pengembalian
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 5: PROFIL & SETUP TTD DIGITAL ==================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-[#2A1810]">
                  Pilih Akun Anggota Pramuka:
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewMemberForm((v) => !v)}
                  className="text-[11px] font-bold text-[#8B5A2B] hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showNewMemberForm ? 'Batal' : '+ Anggota Baru'}
                </button>
              </div>

              <select
                value={currentMember.id}
                onChange={(e) => onSelectMember(e.target.value)}
                aria-label="Pilih akun anggota Pramuka"
                className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — ({m.kelas} · {m.sangga})
                  </option>
                ))}
              </select>

              {showNewMemberForm && (
                <form
                  onSubmit={handleCreateNewMember}
                  className="p-3 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] space-y-2 mt-2"
                >
                  <p className="text-xs font-bold text-[#3B2314]">
                    Registrasi Akun Anggota Baru
                  </p>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nama Lengkap Anggota..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newMemberKelas}
                      onChange={(e) => setNewMemberKelas(e.target.value)}
                      placeholder="Kelas (misal: XI IPA 1)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs"
                    />
                    <input
                      type="text"
                      value={newMemberJabatan}
                      onChange={(e) => setNewMemberJabatan(e.target.value)}
                      placeholder="Tingkatan (Bantara/Laksana)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={newMemberSangga}
                    onChange={(e) => setNewMemberSangga(e.target.value)}
                    placeholder="Sangga (misal: Sangga Perintis)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs"
                  />
                  <input
                    type="tel"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="No. WhatsApp / HP (misal: 0812-XXXX-XXXX)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-[#3B2314] text-white text-xs font-bold"
                  >
                    Simpan & Gunakan Akun Ini
                  </button>
                </form>
              )}
            </div>

            {/* Biodata Editor */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
              <h3 className="text-xs font-extrabold text-[#2A1810]">
                Biodata Anggota (Otomatis Mengisi Surat Resmi)
              </h3>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E5039]">
                    Nama Lengkap Peminjam
                  </label>
                  <input
                    type="text"
                    value={currentMember.name}
                    onChange={(e) =>
                      onUpdateMember({ ...currentMember, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E5039]">
                      Kelas
                    </label>
                    <input
                      type="text"
                      value={currentMember.kelas}
                      onChange={(e) =>
                        onUpdateMember({ ...currentMember, kelas: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E5039]">
                      Tingkatan / Jabatan
                    </label>
                    <input
                      type="text"
                      value={currentMember.jabatan}
                      onChange={(e) =>
                        onUpdateMember({ ...currentMember, jabatan: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E5039]">
                    Sangga / Ambalan
                  </label>
                  <input
                    type="text"
                    value={currentMember.sangga}
                    onChange={(e) =>
                      onUpdateMember({ ...currentMember, sangga: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                  />
                </div>
              </div>
            </div>

            {/* One-Time Setup TTD Digital */}
            <SignaturePadCanvas
              currentSignature={currentMember.signatureDataUrl}
              signerName={currentMember.name}
              onSaveSignature={(sigUrl) =>
                onUpdateMember({ ...currentMember, signatureDataUrl: sigUrl })
              }
            />

            {/* Pengaturan Pengurus Dewan Inventaris & Pradana */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-2.5">
              <h3 className="text-xs font-extrabold text-[#2A1810]">
                Pengaturan Dewan Inventaris & Pradana pada Surat
              </h3>
              <div>
                <label className="block text-[11px] font-semibold text-[#6E5039] mb-1">
                  Dewan Inventaris Bertugas (5 Pengurus)
                </label>
                <select
                  value={activeOfficerId}
                  onChange={(e) => onChangeActiveOfficer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold"
                >
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#6E5039] mb-1">
                  Pradana Mengetahui
                </label>
                <select
                  value={activePradanaId}
                  onChange={(e) => onChangeActivePradana(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-bold"
                >
                  {pradanaList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Manajemen Data & Reset Cadangan MAN 11 Jakarta */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
              <div>
                <h3 className="text-xs font-extrabold text-[#2A1810]">
                  Penyimpanan Data & Cadangan MAN 11 Jakarta
                </h3>
                <p className="text-[11px] text-[#6E5039]">
                  Seluruh data tersimpan secara lokal dan beroperasi 100% offline.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportInventoryCsv}
                  className="py-2 px-2.5 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] text-[11px] font-bold border border-[#D9C3A9] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#8B5A2B]" />
                  <span>Ekspor Inventaris</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportTransactionsCsv}
                  className="py-2 px-2.5 rounded-xl bg-[#F4EDE2] hover:bg-[#E5D7C3] text-[#3B2314] text-[11px] font-bold border border-[#D9C3A9] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#8B5A2B]" />
                  <span>Ekspor Riwayat</span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#E5D7C3]">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] text-xs font-bold border border-[#FECACA] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#DC2626]" />
                  <span>Reset ke Sampel Awal MAN 11</span>
                </button>
                <p className="text-[10px] text-[#6E5039] text-center mt-1">
                  Mengembalikan data inventaris, anggota, & peminjaman ke setelan awal gudep.
                </p>
              </div>
            </div>

            {/* ==================== FITUR ADMIN: KELOLA AKUN PESERTA ==================== */}
            {role === 'admin' && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#2A1810] flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#8B2500]" />
                      <span>Kelola Akun Anggota & Peserta Pramuka</span>
                    </h3>
                    <p className="text-[11px] text-[#6E5039]">
                      Buat username & password untuk peserta login ke aplikasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEditingAccount(null);
                      setAccountFormName('');
                      setAccountFormKelas('XI IPA 1');
                      setAccountFormJabatan('Penegak Bantara');
                      setAccountFormSangga('Sangga Perintis');
                      setAccountFormPhone('');
                      setAccountFormUsername('');
                      setAccountFormPassword('pramuka123');
                      setShowMemberAccountModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#3B2314] hover:bg-[#25150a] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#C89D54]" />
                    <span>+ Buat Akun</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {authAccountsList
                    .filter((acc) => acc.role === 'member')
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className="p-2.5 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#2A1810] truncate">{acc.name}</p>
                          <p className="text-[10px] text-[#6E5039]">
                            {acc.kelas} · {acc.jabatan}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-[#8B2500]">
                            <span>User: {acc.username}</span>
                            <span>•</span>
                            <span>Pass: {acc.password}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminEditingAccount(acc);
                              setAccountFormName(acc.name);
                              setAccountFormKelas(acc.kelas || 'XI IPA 1');
                              setAccountFormJabatan(acc.jabatan || 'Penegak Bantara');
                              setAccountFormSangga(acc.sangga || 'Sangga Perintis');
                              setAccountFormPhone(acc.phone || '');
                              setAccountFormUsername(acc.username);
                              setAccountFormPassword(acc.password);
                              setShowMemberAccountModal(true);
                            }}
                            title="Edit Akun Peserta"
                            className="p-1.5 rounded-lg bg-white border border-[#D9C3A9] text-[#3B2314] hover:bg-[#F4EDE2]"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus akun peserta ${acc.name}?`)) {
                                deleteAccountById(acc.id);
                                setAuthAccountsList(getAuthAccounts());
                              }
                            }}
                            title="Hapus Akun Peserta"
                            className="p-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ==================== FITUR ADMIN: MANAJEMEN DEWAN INVENTARIS (MAKS 6 ORANG) ==================== */}
            {role === 'admin' && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#2A1810] flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#8B2500]" />
                      <span>Dewan Inventaris (Admin SK · Kuota 5-6 Orang)</span>
                    </h3>
                    <p className="text-[11px] text-[#6E5039]">
                      Hanya pengurus ber-SK dengan Kode Rahasia yang dapat menjadi Admin.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4EDE2] text-[#8B2500] font-bold border border-[#D9C3A9]">
                    {authAccountsList.filter((a) => a.role === 'admin').length} / {MAX_ADMIN_COUNT}{' '}
                    Kursi
                  </span>
                </div>

                {/* Secret Passcode Box */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#8B2500]" />
                      Kode Rahasia SK Admin Utama:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPasscode((v) => !v)}
                      className="text-[11px] font-bold text-[#8B2500] hover:underline"
                    >
                      {isEditingPasscode ? 'Batal' : 'Ubah Kode'}
                    </button>
                  </div>

                  {isEditingPasscode ? (
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        value={tempPasscode}
                        onChange={(e) => setTempPasscode(e.target.value)}
                        className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-[#D9C3A9] text-xs font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAdminPasscode(tempPasscode);
                          setAdminPasscodeVal(tempPasscode.trim());
                          setIsEditingPasscode(false);
                        }}
                        className="px-3 py-1 rounded-lg bg-[#8B2500] text-white text-xs font-bold"
                      >
                        Simpan
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-300">
                      <span className="font-mono font-bold text-xs text-[#8B2500] tracking-wider">
                        {adminPasscodeVal}
                      </span>
                      <span className="text-[10px] text-amber-700">Rahasia Dewan</span>
                    </div>
                  )}
                </div>

                {/* 6 Official Admins List */}
                <div className="space-y-1.5">
                  {authAccountsList
                    .filter((a) => a.role === 'admin')
                    .map((adm) => (
                      <div
                        key={adm.id}
                        className="p-2 rounded-xl bg-[#FBF8F3] border border-[#D9C3A9] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#2A1810]">
                            {adm.name} {adm.isMainAdmin && '👑 (Admin Utama)'}
                          </p>
                          <p className="text-[10px] text-[#6E5039]">
                            {adm.adminRole || 'Staf Dewan Inventaris'} · User: {adm.username}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Aktif (SK)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ==================== SINKRONISASI EMAIL OTOMATIS ==================== */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5D7C3] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-[#2A1810] flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#1E3A5F]" />
                    <span>Sinkronisasi Otomatis Email Inventaris</span>
                  </h3>
                  <p className="text-[11px] text-[#6E5039]">
                    Dokumentasi barang dan surat otomatis dikirim ke email ambalan.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Aktif
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4EDE2] border border-[#D9C3A9] space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#6E5039] block">
                    Alamat Email Penerima:
                  </span>
                  <span className="font-mono font-bold text-xs text-[#1E3A5F] break-all select-all">
                    {emailConfig.targetEmail}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#6E5039] block mb-0.5">
                    Kata Sandi / Sandi Aplikasi Gmail:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={emailPasswordInput}
                      onChange={(e) => setEmailPasswordInput(e.target.value)}
                      placeholder="Masukkan kata sandi..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = saveEmailConfig({
                          appPasswordPlaceholder: emailPasswordInput,
                        });
                        setEmailConfig(updated);
                        setEmailStatusMsg('Kata sandi email inventaris berhasil disimpan!');
                        setTimeout(() => setEmailStatusMsg(null), 3000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-xs font-bold shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                  <p className="text-[10px] text-[#6E5039] mt-1">
                    * Kata sandi dapat diperbarui manual kapan saja bila menggunakan App Password
                    asli.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9C3A9]">
                  <button
                    type="button"
                    onClick={() => {
                      const testSubject =
                        '[TEST KONEKSI EMAIL] Sistem Inventaris Pramuka MAN 11 Jakarta';
                      const testBody = `Halo Dewan Inventaris MAN 11 Jakarta,\n\nPengujian koneksi email otomatis SIPRAMA berhasil dilakukan.\nDokumentasi barang dan surat resmi otomatis masuk ke email: ${emailConfig.targetEmail}\n\nWaktu Pengujian: ${new Date().toLocaleString('id-ID')}`;
                      openGmailComposer(emailConfig.targetEmail, testSubject, testBody);
                      setEmailStatusMsg(
                        `Draft email pengujian disiapkan untuk ${emailConfig.targetEmail}`
                      );
                      setTimeout(() => setEmailStatusMsg(null), 4000);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-white border border-[#D9C3A9] text-xs font-bold text-[#1E3A5F] hover:bg-blue-50 flex items-center justify-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Uji Kirim Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const logs = getEmailLogs();
                      setEmailLogs(logs);
                      setEmailStatusMsg(`Memperbarui log: ${logs.length} pengiriman tercatat.`);
                      setTimeout(() => setEmailStatusMsg(null), 3000);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-white border border-[#D9C3A9] text-xs font-bold text-[#3B2314] hover:bg-[#F4EDE2] flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Perbarui Log</span>
                  </button>
                </div>

                {emailStatusMsg && (
                  <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    ✓ {emailStatusMsg}
                  </p>
                )}
              </div>

              {/* Email Outbox Logs list */}
              {emailLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#6E5039] block">
                    Riwayat Log Masuk Email Terakhir:
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {emailLogs.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-lg bg-[#FDFBF7] border border-[#E5D7C3] text-[11px] flex items-start justify-between gap-1"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#2A1810] truncate">{log.subject}</p>
                          <p className="text-[10px] text-[#6E5039]">
                            {log.timestamp} · {log.summary}
                          </p>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== LOGOUT BUTTON ==================== */}
            {onLogout && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-3 rounded-2xl bg-[#24140B] hover:bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all border border-[#5C3A21]"
                >
                  <LogOut className="w-4 h-4 text-[#C89D54]" />
                  <span>Keluar dari Akun (Logout)</span>
                </button>
                <p className="text-[10px] text-[#6E5039] text-center mt-1.5">
                  Kembali ke layar masuk untuk beralih akun peserta atau admin.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================== MODAL: BUAT / EDIT AKUN PESERTA (OLEH ADMIN) ==================== */}
      {showMemberAccountModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#FBF8F3] rounded-2xl border-2 border-[#3B2314] p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <h3 className="text-sm font-extrabold text-[#2A1810]">
                {adminEditingAccount ? 'Edit Akun Peserta' : 'Buat Akun Peserta Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowMemberAccountModal(false)}
                className="p-1 rounded-lg text-[#6E5039] hover:bg-[#E5D7C3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!accountFormName.trim() || !accountFormUsername.trim()) return;

                const saved = adminSaveMemberAccount({
                  id: adminEditingAccount?.id,
                  name: accountFormName,
                  kelas: accountFormKelas,
                  jabatan: accountFormJabatan,
                  sangga: accountFormSangga,
                  phone: accountFormPhone,
                  username: accountFormUsername,
                  password: accountFormPassword || 'pramuka123',
                });

                // Update allMembers
                const match = allMembers.find(
                  (m) =>
                    m.id === saved.id ||
                    m.name.toLowerCase() === saved.name.toLowerCase()
                );
                if (match) {
                  onUpdateMember({
                    ...match,
                    name: saved.name,
                    kelas: saved.kelas || match.kelas,
                    jabatan: saved.jabatan || match.jabatan,
                    sangga: saved.sangga || match.sangga,
                    phone: saved.phone || match.phone,
                  });
                } else {
                  onRegisterMember({
                    id: saved.id,
                    name: saved.name,
                    nia: `06.171.2026.${Math.floor(100 + Math.random() * 899)}`,
                    kelas: saved.kelas || 'XI IPA 1',
                    jabatan: saved.jabatan || 'Penegak Bantara',
                    sangga: saved.sangga || 'Sangga Perintis',
                    phone: saved.phone || '0812-3456-7890',
                    signatureDataUrl: createSignatureDataUrl(saved.name, '#111111'),
                  });
                }

                setAuthAccountsList(getAuthAccounts());
                setShowMemberAccountModal(false);
              }}
              className="space-y-2.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                  Nama Lengkap Anggota *
                </label>
                <input
                  type="text"
                  required
                  value={accountFormName}
                  onChange={(e) => setAccountFormName(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormKelas}
                    onChange={(e) => setAccountFormKelas(e.target.value)}
                    placeholder="XI IPA 1"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    Jabatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormJabatan}
                    onChange={(e) => setAccountFormJabatan(e.target.value)}
                    placeholder="Penegak Bantara"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    Sangga
                  </label>
                  <input
                    type="text"
                    value={accountFormSangga}
                    onChange={(e) => setAccountFormSangga(e.target.value)}
                    placeholder="Sangga Perintis"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={accountFormPhone}
                    onChange={(e) => setAccountFormPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9C3A9]">
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormUsername}
                    onChange={(e) => setAccountFormUsername(e.target.value)}
                    placeholder="Username siswa"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#3B2314] mb-0.5">
                    Kata Sandi *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountFormPassword}
                    onChange={(e) => setAccountFormPassword(e.target.value)}
                    placeholder="Kata sandi"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C3A9] font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#3B2314] hover:bg-[#25150a] text-white font-extrabold text-xs shadow-md mt-2 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-[#C89D54]" />
                <span>Simpan Akun Peserta</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== BOTTOM SHEET: PENGEMBALIAN BARANG ==================== */}
      {returningTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Form Pengembalian Barang"
        >
          <form
            onSubmit={confirmReturnSubmission}
            className="w-full max-w-md bg-[#FBF8F3] rounded-t-3xl border-t-2 border-[#3B2314] p-5 space-y-3.5 shadow-2xl max-h-[88vh] overflow-y-auto"
          >
            <div className="w-10 h-1.5 bg-[#D9C3A9] rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#2A1810]">
                  Pengembalian Barang & Bukti Sesudah
                </h3>
                <p className="text-[11px] font-mono text-[#8B5A2B]">
                  {returningTx.id} · Penerima: {returningTx.officerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturningTx(null)}
                className="text-xs font-bold text-[#8B5A2B] px-2 py-1"
              >
                Tutup
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1">
                Keterangan Kondisi Barang Saat Dikembalikan
              </label>
              <input
                type="text"
                required
                value={returnConditionText}
                onChange={(e) => setReturnConditionText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3B2314]">
                Rincian Barang & Unit Rusak (Bila Ada)
              </label>
              {returningTx.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#D9C3A9]"
                >
                  <div className="text-xs">
                    <p className="font-extrabold text-[#2A1810]">{item.name}</p>
                    <p className="text-[10px] text-[#8B5A2B]">Dipinjam: {item.qty} unit</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-[#DC2626]">Rusak:</label>
                    <input
                      type="number"
                      min={0}
                      max={item.qty}
                      value={returnDamagedCounts[item.itemId] || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(item.qty, parseInt(e.target.value, 10) || 0));
                        setReturnDamagedCounts((prev) => ({ ...prev, [item.itemId]: val }));
                      }}
                      className="w-12 text-center text-xs font-mono font-bold border border-[#D9C3A9] rounded-lg py-1 bg-[#FEF2F2]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-white border border-[#D9C3A9] space-y-1.5">
                <p className="text-[10px] font-bold text-[#3B2314]">
                  1. Foto Kondisi (Sesudah)
                </p>
                <img
                  src={returnPhotoAfter}
                  alt="Kondisi Sesudah"
                  className="w-full h-20 object-cover rounded"
                />
                <label className="block text-center py-1.5 rounded-lg bg-[#F4EDE2] text-[10px] font-bold text-[#3B2314] cursor-pointer">
                  Unggah Foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleImageFileUpload(e, setReturnPhotoAfter)}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#D9C3A9] space-y-1.5">
                <p className="text-[10px] font-bold text-[#3B2314]">
                  2. Foto Kembali + Inventaris
                </p>
                <img
                  src={returnPhotoHandover}
                  alt="Serah Terima Kembali"
                  className="w-full h-20 object-cover rounded"
                />
                <label className="block text-center py-1.5 rounded-lg bg-[#F4EDE2] text-[10px] font-bold text-[#3B2314] cursor-pointer">
                  Unggah Foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleImageFileUpload(e, setReturnPhotoHandover)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-extrabold shadow-md"
            >
              Simpan Pengembalian & Buat Surat Pengembalian PDF
            </button>
          </form>
        </div>
      )}

      {/* ==================== BOTTOM SHEET: TAMBAH BARANG BARU ==================== */}
      {showAddItemSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Tambah Barang Inventaris Baru"
        >
          <form
            onSubmit={handleCreateInventoryItem}
            className="w-full max-w-md bg-[#FBF8F3] rounded-t-3xl border-t-2 border-[#3B2314] p-5 space-y-3 shadow-2xl"
          >
            <div className="w-10 h-1.5 bg-[#D9C3A9] rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <h3 className="text-sm font-extrabold text-[#2A1810]">
                Tambah Data Barang & Kode Barcode
              </h3>
              <button
                type="button"
                onClick={() => setShowAddItemSheet(false)}
                className="text-xs font-bold text-[#6E5039]"
              >
                Tutup
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1">
                Nama Peralatan Pramuka *
              </label>
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Misal: Tenda Regu Kapasitas 10 Orang"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
              />
            </div>
            {/* Kode Barcode & Generator Otomatis */}
            <div className="space-y-1.5 p-3 rounded-xl bg-white border border-[#D9C3A9]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#3B2314]">
                  Kode Barcode Unik
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setNewItemBarcode(generateAutoBarcode('BRG', items.length + 1))
                  }
                  className="text-[11px] font-bold text-[#8B2500] hover:underline flex items-center gap-1"
                >
                  ⚡ Buat Barcode Otomatis
                </button>
              </div>
              <input
                type="text"
                required
                value={newItemBarcode}
                onChange={(e) => setNewItemBarcode(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#FBF8F3] border border-[#D9C3A9] text-xs font-mono font-bold"
              />

              {/* Live SVG Barcode Preview */}
              <div
                className="pt-1 flex items-center justify-center overflow-x-auto"
                dangerouslySetInnerHTML={{
                  __html: generateCode128Svg(newItemBarcode || 'BRG-0171-SAMPLE', {
                    height: 38,
                    barWidth: 1.5,
                    showText: true,
                  }),
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Kondisi Barang *
                </label>
                <select
                  value={newItemCondition}
                  onChange={(e) =>
                    setNewItemCondition(
                      e.target.value as 'Baik' | 'Perlu Perawatan' | 'Rusak Ringan'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-bold text-[#2A1810]"
                >
                  <option value="Baik">Baik (Siap Pakai)</option>
                  <option value="Perlu Perawatan">Perlu Perawatan</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Jumlah Stok Total *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Kategori
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) =>
                    setNewItemCategory(e.target.value as Exclude<ItemCategory, 'Semua'>)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-bold"
                >
                  <option value="Tongkat & Pionering">Tongkat & Pionering</option>
                  <option value="Tenda & Kemah">Tenda & Kemah</option>
                  <option value="Navigasi & Komlek">Navigasi & Komlek</option>
                  <option value="Dapur">Dapur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Lokasi Rak di Sanggar
                </label>
                <input
                  type="text"
                  value={newItemLocation}
                  onChange={(e) => setNewItemLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs"
                />
              </div>
            </div>

            {/* Foto Dokumentasi Barang */}
            <div className="p-3 rounded-xl bg-white border border-[#D9C3A9] space-y-2">
              <label className="block text-xs font-bold text-[#3B2314]">
                Foto Dokumentasi Barang
              </label>
              {newItemPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-[#D9C3A9]">
                  <img
                    src={newItemPhoto}
                    alt="Preview Barang"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setNewItemPhoto(null)}
                    className="absolute top-2 right-2 px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-bold shadow-md hover:bg-red-700"
                  >
                    Hapus / Ganti Foto
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="new-item-photo-input"
                    onChange={handleItemPhotoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="new-item-photo-input"
                    className="w-full py-3 px-4 border-2 border-dashed border-[#D9C3A9] hover:border-[#3B2314] rounded-xl flex items-center justify-center gap-2 cursor-pointer bg-[#FDFBF7] text-xs font-bold text-[#6E5039] transition-colors"
                  >
                    <Camera className="w-4 h-4 text-[#8B2500]" />
                    <span>Ambil Foto Kamera / Pilih dari Galeri</span>
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#3B2314] hover:bg-[#25150a] text-[#FBF8F3] text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-[#C89D54]" />
              <span>Simpan Barang & Aktifkan Barcode</span>
            </button>
          </form>
        </div>
      )}

      {/* ==================== MODAL: LABEL & STIKER BARCODE RESMI ==================== */}
      {selectedBarcodeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#FBF8F3] rounded-2xl border-2 border-[#3B2314] p-5 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <span className="text-xs font-mono font-bold text-[#8B5A2B]">
                LABEL BARCODE RESMI MAN 11
              </span>
              <button
                type="button"
                onClick={() => setSelectedBarcodeItem(null)}
                className="p-1 rounded-lg text-[#6E5039] hover:bg-[#E5D7C3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-sm font-extrabold text-[#2A1810]">
                {selectedBarcodeItem.name}
              </p>
              <p className="text-xs text-[#6E5039]">
                📍 {selectedBarcodeItem.location} · Kondisi: {selectedBarcodeItem.condition}
              </p>
            </div>

            {/* SVG Rendered Code 128 Barcode */}
            <div
              className="p-3 bg-white rounded-xl border border-[#D9C3A9] shadow-inner flex items-center justify-center overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: generateCode128Svg(selectedBarcodeItem.barcode, {
                  height: 55,
                  barWidth: 1.8,
                  showText: true,
                }),
              }}
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  printBarcodeSticker(
                    selectedBarcodeItem.barcode,
                    selectedBarcodeItem.name,
                    selectedBarcodeItem.location
                  )
                }
                className="py-2.5 px-3 rounded-xl bg-[#C89D54] hover:bg-[#d8ae66] text-[#2A1810] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Barcode className="w-4 h-4" />
                Cetak Stiker
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBarcodeSvgFile(
                    selectedBarcodeItem.barcode,
                    selectedBarcodeItem.name
                  )
                }
                className="py-2.5 px-3 rounded-xl bg-[#3B2314] hover:bg-[#25150a] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                Unduh SVG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BOTTOM SHEET: DETAIL VERIFIKASI 2 FOTO BUKTI ==================== */}
      {inspectingTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Detail Verifikasi Bukti Foto Ganda"
        >
          <div className="w-full max-w-md bg-[#FBF8F3] rounded-t-3xl border-t-2 border-[#3B2314] p-5 space-y-3.5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-[#D9C3A9] rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#2A1810]">
                  Dokumentasi Kondisi Sebelum & Sesudah · {inspectingTx.id}
                </h3>
                <p className="text-xs text-[#6E5039]">
                  {inspectingTx.memberName} ({inspectingTx.memberKelas})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingTx(null)}
                className="text-xs font-bold text-[#8B5A2B] px-2 py-1"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2 rounded-xl bg-white border border-[#E5D7C3]">
                <p className="text-[10px] font-bold text-[#3B2314] mb-1">
                  1. Kondisi (Sebelum)
                </p>
                <img
                  src={inspectingTx.photoConditionBefore}
                  alt="Kondisi Sebelum"
                  className="w-full h-24 object-cover rounded"
                />
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#E5D7C3]">
                <p className="text-[10px] font-bold text-[#3B2314] mb-1">
                  2. Serah-Terima Pinjam
                </p>
                <img
                  src={inspectingTx.photoHandoverBorrow}
                  alt="Serah Terima Pinjam"
                  className="w-full h-24 object-cover rounded"
                />
              </div>
              {inspectingTx.photoConditionAfter && (
                <div className="p-2 rounded-xl bg-white border border-[#BBF7D0]">
                  <p className="text-[10px] font-bold text-[#15803D] mb-1">
                    3. Kondisi (Sesudah)
                  </p>
                  <img
                    src={inspectingTx.photoConditionAfter}
                    alt="Kondisi Sesudah"
                    className="w-full h-24 object-cover rounded"
                  />
                </div>
              )}
              {inspectingTx.photoHandoverReturn && (
                <div className="p-2 rounded-xl bg-white border border-[#BBF7D0]">
                  <p className="text-[10px] font-bold text-[#15803D] mb-1">
                    4. Serah-Terima Kembali
                  </p>
                  <img
                    src={inspectingTx.photoHandoverReturn}
                    alt="Serah Terima Kembali"
                    className="w-full h-24 object-cover rounded"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = inspectingTx;
                  setInspectingTx(null);
                  onOpenLetterModal(target, target.status === 'returned' ? 'return' : 'borrow');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold"
              >
                Buka & Sesuaikan Surat Resmi PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BOTTOM SHEET: EDIT DATA BARANG ==================== */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Data Barang Inventaris"
        >
          <form
            onSubmit={handleSaveEditItem}
            className="w-full max-w-md bg-[#FBF8F3] rounded-t-3xl border-t-2 border-[#3B2314] p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="w-10 h-1.5 bg-[#D9C3A9] rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between border-b border-[#D9C3A9] pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#2A1810]">
                  Edit Data Barang Inventaris
                </h3>
                <p className="text-[10px] font-mono text-[#8B5A2B]">
                  Kode Barcode: {editingItem.barcode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-xs font-bold text-[#6E5039]"
              >
                Batal
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1">
                Nama Peralatan Pramuka *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Total Stok
                </label>
                <input
                  type="number"
                  min={editingItem.borrowedQty}
                  required
                  value={editTotalQty}
                  onChange={(e) => setEditTotalQty(parseInt(e.target.value, 10) || 0)}
                  className={`w-full px-3 py-2 rounded-xl bg-white border ${
                    editingItem && editTotalQty < editingItem.borrowedQty
                      ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                      : 'border-[#D9C3A9]'
                  } text-xs font-mono font-bold`}
                />
                {editingItem.borrowedQty > 0 && (
                  <p className="text-[10px] text-[#8B5A2B] mt-0.5">
                    Sedang dipinjam: <span className="font-bold font-mono text-[#DC2626]">{editingItem.borrowedQty} unit</span> (Min: {editingItem.borrowedQty})
                  </p>
                )}
                {editingItem && editTotalQty < editingItem.borrowedQty && (
                  <p className="text-[10px] font-bold text-[#DC2626] mt-1 bg-[#FEF2F2] p-1 rounded border border-[#FECACA]">
                    Total stok tidak boleh lebih kecil dari {editingItem.borrowedQty}!
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Jumlah Rusak
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editDamagedQty}
                  onChange={(e) => setEditDamagedQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Kategori
                </label>
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as Exclude<ItemCategory, 'Semua'>)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-bold"
                >
                  <option value="Tongkat & Pionering">Tongkat & Pionering</option>
                  <option value="Tenda & Kemah">Tenda & Kemah</option>
                  <option value="Navigasi & Komlek">Navigasi & Komlek</option>
                  <option value="Dapur">Dapur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Kondisi Fisik
                </label>
                <select
                  value={editCondition}
                  onChange={(e) =>
                    setEditCondition(e.target.value as 'Baik' | 'Perlu Perawatan' | 'Rusak Ringan')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-bold"
                >
                  <option value="Baik">Baik</option>
                  <option value="Perlu Perawatan">Perlu Perawatan</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1">
                Lokasi Rak di Sanggar
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B2314] mb-1">
                Catatan Khusus (Opsional)
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan kondisi, kelengkapan aksesoris, atau riwayat servis..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={Boolean(editingItem && editTotalQty < editingItem.borrowedQty)}
                className="flex-1 py-2.5 rounded-xl bg-[#3B2314] text-[#FBF8F3] text-xs font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== DIALOG: KONFIRMASI HAPUS BARANG ==================== */}
      {deletingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Hapus Barang"
        >
          <div className="w-full max-w-sm bg-[#FBF8F3] rounded-2xl border-2 border-[#FECACA] p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#991B1B]">
              <AlertTriangle className="w-6 h-6 text-[#DC2626] shrink-0" />
              <h3 className="text-sm font-extrabold text-[#2A1810]">
                Hapus Barang Inventaris?
              </h3>
            </div>
            <p className="text-xs text-[#6E5039] leading-relaxed">
              Apakah Anda yakin ingin menghapus barang{' '}
              <strong className="text-[#2A1810] font-bold">[{deletingItem.barcode}] {deletingItem.name}</strong>?
              Tindakan ini akan menghapus data barang dari katalog inventaris sanggar.
            </p>
            {deletingItem.borrowedQty > 0 ? (
              <div className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] p-2.5 rounded-xl border border-[#FECACA] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <p>Barang tidak dapat dihapus selama masih ada unit yang dipinjam.</p>
                  <p className="font-normal text-[10px] text-[#991B1B] mt-0.5">
                    Saat ini ada <strong>{deletingItem.borrowedQty} unit</strong> yang sedang dipinjam. Selesaikan pengembalian terlebih dahulu sebelum menghapus barang ini.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                disabled={deletingItem.borrowedQty > 0}
                className="flex-1 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#DC2626]"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DIALOG: KONFIRMASI RESET DATA MAN 11 ==================== */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Reset Data ke Sampel Awal"
        >
          <div className="w-full max-w-sm bg-[#FBF8F3] rounded-2xl border-2 border-[#FCA5A5] p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#991B1B]">
              <RefreshCw className="w-6 h-6 text-[#DC2626] shrink-0" />
              <h3 className="text-sm font-extrabold text-[#2A1810]">
                Reset ke Sampel Awal MAN 11?
              </h3>
            </div>
            <p className="text-xs text-[#6E5039] leading-relaxed">
              Seluruh data inventaris, anggota, dan riwayat peminjaman di memori lokal akan dikembalikan ke data sampel resmi Gudep 06.171–06.172 MAN 11 Jakarta.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-white border border-[#D9C3A9] text-[#5C3A21] text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetData}
                className="flex-1 py-2 rounded-xl bg-[#991B1B] hover:bg-[#7F1D1D] text-white text-xs font-extrabold transition-colors"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FIXED 5-MENU BOTTOM NAVIGATION BAR ==================== */}
      <nav
        aria-label="Navigasi Utama Aplikasi"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-[#3B2314] text-[#D9C3A9] border-t border-[#5C3A21] px-2 pt-1.5 pb-2.5 shadow-[0_-6px_20px_rgba(42,24,16,0.25)]"
      >
        <div className="grid grid-cols-5 items-end">
          {/* Kiri 1: Beranda */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center min-h-[46px] transition-colors ${
              activeTab === 'home' ? 'text-[#C89D54] font-bold' : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Beranda</span>
          </button>

          {/* Kiri 2: Katalog */}
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex flex-col items-center justify-center min-h-[46px] transition-colors ${
              activeTab === 'catalog'
                ? 'text-[#C89D54] font-bold'
                : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Katalog</span>
          </button>

          {/* Tengah (FAB Menonjol): Scan Barcode */}
          <div className="flex flex-col items-center justify-end -mt-6">
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              aria-label="Scan Barcode"
              className="group flex flex-col items-center justify-end focus:outline-none"
            >
              <span
                className={`w-13 h-13 rounded-full flex items-center justify-center shadow-[0_4px_18px_rgba(200,157,84,0.55)] border-[3px] transition-transform group-active:scale-95 ${
                  activeTab === 'scan'
                    ? 'bg-[#C89D54] text-[#2A1810] border-[#FBF8F3]'
                    : 'bg-gradient-to-b from-[#5C3A21] to-[#2A1810] text-[#FBF8F3] border-[#C89D54]'
                }`}
              >
                <ScanLine className="w-6 h-6" />
              </span>
              <span
                className={`text-[10px] mt-1 tracking-tight whitespace-nowrap ${
                  activeTab === 'scan' ? 'text-[#C89D54] font-extrabold' : 'text-[#FBF8F3] font-bold'
                }`}
              >
                Scan Barcode
              </span>
            </button>
          </div>

          {/* Kanan 1: Riwayat & Surat */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center min-h-[46px] transition-colors ${
              activeTab === 'history'
                ? 'text-[#C89D54] font-bold'
                : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Riwayat</span>
          </button>

          {/* Kanan 2: Profil & TTD */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center min-h-[46px] transition-colors ${
              activeTab === 'profile'
                ? 'text-[#C89D54] font-bold'
                : 'text-[#D9C3A9] hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-1 tracking-tight">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
