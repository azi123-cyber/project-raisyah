import React, { useState, useEffect } from 'react';
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from './data/seedData';
import {
  calculateReturnItemStock,
  createSignatureDataUrl,
  type InventoryItem,
  type ScoutMember,
  type LoanTransaction,
} from './utils/inventoryLogic';
import {
  getCurrentUser,
  setCurrentUser as saveCurrentUserStorage,
  logoutCurrentUser,
  getAuthAccounts,
  type UserAccount,
} from './utils/authLogic';
import {
  sendNewItemEmail,
  sendBorrowRequestEmail,
  sendReturnRequestEmail,
} from './utils/emailService';
import { AuthScreen } from './components/AuthScreen';
import { MemberMobileApp } from './components/MemberMobileApp';
import { OfficialLetterModal } from './components/OfficialLetterModal';

/**
 * Safely loads an array from localStorage.
 * Ensures non-array JSON or syntax errors fall back cleanly to default seed data without throwing TypeError.
 */
function loadStorageArray<T>(key: string, fallback: T[], requireNonEmpty = false): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    if (requireNonEmpty && parsed.length === 0) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Authentication state (Session persistence)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());

  const [role, setRole] = useState<'member' | 'admin'>(() => {
    const initialUser = getCurrentUser();
    return initialUser ? initialUser.role : 'member';
  });

  const [items, setItems] = useState<InventoryItem[]>(() =>
    loadStorageArray('sipraka_items_v3', INITIAL_INVENTORY_ITEMS)
  );

  const [members, setMembers] = useState<ScoutMember[]>(() =>
    loadStorageArray('sipraka_members_v3', INITIAL_MEMBERS, true)
  );

  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    const initialUser = getCurrentUser();
    if (initialUser && initialUser.role === 'member') {
      const match = INITIAL_MEMBERS.find((m) => m.name.toLowerCase() === initialUser.name.toLowerCase());
      if (match) return match.id;
    }
    return INITIAL_MEMBERS[0].id;
  });

  const [transactions, setTransactions] = useState<LoanTransaction[]>(() =>
    loadStorageArray('sipraka_tx_v3', INITIAL_TRANSACTIONS)
  );

  const [activeOfficerId, setActiveOfficerId] = useState<string>(DEWAN_INVENTARIS_LIST[0].id);
  const [activePradanaId, setActivePradanaId] = useState<string>(PRADANA_LIST[0].id);

  const [letterModalTx, setLetterModalTx] = useState<LoanTransaction | null>(null);
  const [letterModalType, setLetterModalType] = useState<'borrow' | 'return'>('borrow');

  useEffect(() => {
    try {
      localStorage.setItem('sipraka_items_v3', JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('sipraka_members_v3', JSON.stringify(members));
    } catch {
      // ignore storage errors
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem('sipraka_tx_v3', JSON.stringify(transactions));
    } catch {
      // ignore storage errors
    }
  }, [transactions]);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    saveCurrentUserStorage(user);
    setRole(user.role);

    if (user.role === 'member') {
      // Ensure member exists in members list
      const matched = members.find(
        (m) => m.name.toLowerCase() === user.name.toLowerCase() || m.id === user.id
      );
      if (matched) {
        setCurrentMemberId(matched.id);
      } else {
        const newM: ScoutMember = {
          id: user.id,
          name: user.name,
          nia: `06.171.${new Date().getFullYear()}.${String(members.length + 1).padStart(3, '0')}`,
          kelas: user.kelas || 'XI IPA 1',
          jabatan: user.jabatan || 'Penegak Bantara',
          sangga: user.sangga || 'Sangga Perintis',
          phone: user.phone || '0812-0000-0000',
          signatureDataUrl: createSignatureDataUrl(user.name, '#111111'),
        };
        setMembers((prev) => [newM, ...prev]);
        setCurrentMemberId(newM.id);
      }
    } else {
      // Admin logged in: set active officer to matched officer if any
      const matchedOfficer = DEWAN_INVENTARIS_LIST.find(
        (o) =>
          o.name.toLowerCase().includes(user.name.toLowerCase()) ||
          user.name.toLowerCase().includes(o.name.toLowerCase())
      );
      if (matchedOfficer) {
        setActiveOfficerId(matchedOfficer.id);
      }
    }
  };

  const handleLogout = () => {
    logoutCurrentUser();
    setCurrentUser(null);
  };

  // If not logged in, display the Scout Authentication screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const currentMember =
    members.find((m) => m.id === currentMemberId) || members[0];
  const activeOfficer =
    DEWAN_INVENTARIS_LIST.find((o) => o.id === activeOfficerId) ||
    DEWAN_INVENTARIS_LIST[0];
  const activePradana =
    PRADANA_LIST.find((p) => p.id === activePradanaId) || PRADANA_LIST[0];

  const handleUpdateMember = (updated: ScoutMember) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.memberId === updated.id
          ? {
              ...tx,
              memberName: updated.name,
              memberKelas: updated.kelas,
              memberJabatan: `${updated.jabatan} — ${updated.sangga}`,
              memberSignature: updated.signatureDataUrl,
            }
          : tx
      )
    );
  };

  const handleRegisterMember = (newMember: ScoutMember) => {
    setMembers((prev) => [newMember, ...prev]);
    setCurrentMemberId(newMember.id);
  };

  const handleCreateBorrowRequest = (newTx: LoanTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleUpdateTransaction = (updatedTx: LoanTransaction) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === updatedTx.id ? updatedTx : tx))
    );
    setLetterModalTx(updatedTx);
  };

  const handleSubmitReturnRequest = (
    txId: string,
    conditionAfter: string,
    photoAfter: string,
    photoHandoverReturn: string,
    damagedCounts: Record<string, number> = {}
  ) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== txId) return tx;
        return {
          ...tx,
          status: 'pending_return',
          returnDate: new Date().toISOString().slice(0, 16),
          photoConditionAfter: photoAfter,
          photoHandoverReturn,
          items: tx.items.map((item) => ({
            ...item,
            conditionAfter,
            damagedQty: damagedCounts[item.itemId] || 0,
          })),
        };
      })
    );
  };

  const handleApproveBorrow = (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;

    const updatedTx: LoanTransaction = {
      ...target,
      status: 'active_borrowed',
      officerId: activeOfficer.id,
      officerName: activeOfficer.name,
      officerSignature: activeOfficer.signatureDataUrl,
      pradanaName: activePradana.name,
      pradanaSignature: activePradana.signatureDataUrl,
    };

    setTransactions((prev) => prev.map((t) => (t.id === txId ? updatedTx : t)));

    setItems((prevItems) =>
      prevItems.map((inv) => {
        const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
        if (matchingEntries.length === 0) return inv;
        const totalQtyToBorrow = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
        return {
          ...inv,
          borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + totalQtyToBorrow),
        };
      })
    );

    // Auto-dispatch email notification to inventarispramukamanjakartasel@gmail.com
    try {
      sendBorrowRequestEmail(updatedTx);
    } catch {
      // ignore
    }

    setLetterModalTx(updatedTx);
    setLetterModalType('borrow');
  };

  const handleApproveReturn = (
    txId: string,
    damagedCountByItemId: Record<string, number> = {}
  ) => {
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;

    const updatedTx: LoanTransaction = {
      ...target,
      status: 'returned',
      returnDate: target.returnDate || new Date().toISOString().slice(0, 16),
      officerId: activeOfficer.id,
      officerName: activeOfficer.name,
      officerSignature: activeOfficer.signatureDataUrl,
      pradanaName: activePradana.name,
      pradanaSignature: activePradana.signatureDataUrl,
    };

    setTransactions((prev) => prev.map((t) => (t.id === txId ? updatedTx : t)));

    setItems((prevItems) =>
      prevItems.map((inv) => {
        const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
        if (matchingEntries.length === 0) return inv;

        const totalReturned = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
        const fromEntries = matchingEntries.reduce((sum, i) => sum + (i.damagedQty || 0), 0);
        const explicitDamaged = damagedCountByItemId?.[inv.id];
        const damagedToAdd = explicitDamaged !== undefined ? explicitDamaged : fromEntries;

        const { borrowedQty, damagedQty } = calculateReturnItemStock(
          inv,
          totalReturned,
          damagedToAdd
        );

        return {
          ...inv,
          borrowedQty,
          damagedQty,
        };
      })
    );

    // Auto-dispatch email notification to inventarispramukamanjakartasel@gmail.com
    try {
      sendReturnRequestEmail(updatedTx);
    } catch {
      // ignore
    }

    setLetterModalTx(updatedTx);
    setLetterModalType('return');
  };

  const handleRejectTransaction = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'rejected' } : t))
    );
  };

  const handleTriggerMemberAlarm = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId ? { ...t, status: 'overdue', alarmMutedUntilVerified: false } : t
      )
    );
  };

  const handleAddNewItem = (newItem: InventoryItem) => {
    setItems((prev) => [newItem, ...prev]);
    // Auto-dispatch email notification to inventarispramukamanjakartasel@gmail.com
    try {
      sendNewItemEmail(newItem, currentUser?.name || 'Dewan Inventaris');
    } catch {
      // ignore
    }
  };

  const handleEditItem = (updatedItem: InventoryItem) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== updatedItem.id) return item;
        const safeTotalQty = Math.max(item.borrowedQty, updatedItem.totalQty);
        return {
          ...updatedItem,
          totalQty: safeTotalQty,
        };
      })
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target && target.borrowedQty > 0) {
        console.warn(
          `[SIPRAMA] Deletion rejected: item ${itemId} (${target.name}) has ${target.borrowedQty} active loans.`
        );
        return prev;
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const handleResetToSeedData = () => {
    setItems(INITIAL_INVENTORY_ITEMS);
    setMembers(INITIAL_MEMBERS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCurrentMemberId(INITIAL_MEMBERS[0].id);
    setActiveOfficerId(DEWAN_INVENTARIS_LIST[0].id);
    setActivePradanaId(PRADANA_LIST[0].id);
    try {
      localStorage.setItem('sipraka_items_v3', JSON.stringify(INITIAL_INVENTORY_ITEMS));
      localStorage.setItem('sipraka_members_v3', JSON.stringify(INITIAL_MEMBERS));
      localStorage.setItem('sipraka_tx_v3', JSON.stringify(INITIAL_TRANSACTIONS));
    } catch {
      // ignore storage errors
    }
  };

  const handleOpenLetterModal = (tx: LoanTransaction, type: 'borrow' | 'return') => {
    setLetterModalTx(tx);
    setLetterModalType(type);
  };

  return (
    <div className="min-h-screen bg-[#EFE6D8] text-[#2A1810]">
      <MemberMobileApp
        role={role}
        onChangeRole={setRole}
        currentUser={currentUser}
        onLogout={handleLogout}
        currentMember={currentMember}
        allMembers={members}
        onSelectMember={setCurrentMemberId}
        onUpdateMember={handleUpdateMember}
        onRegisterMember={handleRegisterMember}
        items={items}
        onAddNewItem={handleAddNewItem}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
        onResetSeedData={handleResetToSeedData}
        officers={DEWAN_INVENTARIS_LIST}
        activeOfficerId={activeOfficerId}
        onChangeActiveOfficer={setActiveOfficerId}
        pradanaList={PRADANA_LIST}
        activePradanaId={activePradanaId}
        onChangeActivePradana={setActivePradanaId}
        transactions={transactions}
        onCreateBorrowRequest={handleCreateBorrowRequest}
        onSubmitReturnRequest={handleSubmitReturnRequest}
        onApproveBorrow={handleApproveBorrow}
        onApproveReturn={handleApproveReturn}
        onRejectTransaction={handleRejectTransaction}
        onTriggerMemberAlarm={handleTriggerMemberAlarm}
        onOpenLetterModal={handleOpenLetterModal}
      />

      <OfficialLetterModal
        transaction={letterModalTx}
        initialLetterType={letterModalType}
        officers={DEWAN_INVENTARIS_LIST}
        onUpdateTransaction={handleUpdateTransaction}
        onClose={() => setLetterModalTx(null)}
      />
    </div>
  );
}
