import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  DEWAN_INVENTARIS_LIST,
  PRADANA_LIST,
} from '../../src/data/seedData';
import {
  type InventoryItem,
  type ScoutMember,
  type LoanTransaction,
  type DewanInventarisOfficer,
  getAvailableQty,
  calculateInventoryStats,
  findItemByBarcode,
  isTransactionOverdue,
  formatIndonesianDate,
  buildOfficialLetterMeta,
  calculateAllowedCartQty,
  calculateReturnItemStock,
  updateInventoryItemInList,
  deleteInventoryItemFromList,
  exportInventoryToCsv,
  exportTransactionsToCsv,
} from '../../src/utils/inventoryLogic';

/**
 * Standard in-memory Mock of HTML5 Web Storage (localStorage)
 */
export class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

/**
 * Headless state controller modeling the exact state lifecycle and persistence
 * contracts of SiPraka as defined in PROJECT.md and src/App.tsx.
 */
export class SiPrakaStateStore {
  private storage: MockLocalStorage;
  private items: InventoryItem[] = [];
  private members: ScoutMember[] = [];
  private transactions: LoanTransaction[] = [];

  constructor(storage?: MockLocalStorage) {
    this.storage = storage ?? new MockLocalStorage();
    this.loadFromStorage();
  }

  public loadFromStorage(): void {
    try {
      const savedItems = this.storage.getItem('sipraka_items_v3');
      const parsed = savedItems ? JSON.parse(savedItems) : null;
      this.items = Array.isArray(parsed)
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    } catch {
      this.items = JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    }

    try {
      const savedMembers = this.storage.getItem('sipraka_members_v3');
      const parsed = savedMembers ? JSON.parse(savedMembers) : null;
      this.members = Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    } catch {
      this.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    }

    try {
      const savedTx = this.storage.getItem('sipraka_tx_v3');
      const parsed = savedTx ? JSON.parse(savedTx) : null;
      this.transactions = Array.isArray(parsed)
        ? parsed
        : JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    } catch {
      this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    }
  }

  public saveToStorage(): void {
    this.storage.setItem('sipraka_items_v3', JSON.stringify(this.items));
    this.storage.setItem('sipraka_members_v3', JSON.stringify(this.members));
    this.storage.setItem('sipraka_tx_v3', JSON.stringify(this.transactions));
  }

  public resetToSeedData(): void {
    this.storage.clear();
    this.items = JSON.parse(JSON.stringify(INITIAL_INVENTORY_ITEMS));
    this.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
    this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    this.saveToStorage();
  }

  public getStorage(): MockLocalStorage {
    return this.storage;
  }

  public getItems(): InventoryItem[] {
    return JSON.parse(JSON.stringify(this.items));
  }

  public getMembers(): ScoutMember[] {
    return JSON.parse(JSON.stringify(this.members));
  }

  public getTransactions(): LoanTransaction[] {
    return JSON.parse(JSON.stringify(this.transactions));
  }

  public getItemById(id: string): InventoryItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  public getItemByBarcode(barcode: string): InventoryItem | undefined {
    return findItemByBarcode(this.items, barcode);
  }

  public getMemberById(id: string): ScoutMember | undefined {
    return this.members.find((m) => m.id === id);
  }

  public getTransactionById(id: string): LoanTransaction | undefined {
    return this.transactions.find((t) => t.id === id);
  }

  // --- ITEM MUTATIONS ---
  public addNewItem(newItem: InventoryItem): void {
    this.items = [newItem, ...this.items];
    this.saveToStorage();
  }

  public editItem(updatedItem: InventoryItem): { success: boolean; error?: string } {
    const existing = this.getItemById(updatedItem.id);
    if (!existing) {
      return { success: false, error: 'Item not found' };
    }
    if (updatedItem.totalQty < existing.borrowedQty) {
      return {
        success: false,
        error: `Cannot update item '${existing.name}': totalQty (${updatedItem.totalQty}) cannot be less than borrowedQty (${existing.borrowedQty}).`,
      };
    }
    this.items = updateInventoryItemInList(this.items, updatedItem);
    this.saveToStorage();
    return { success: true };
  }

  public deleteItem(itemId: string): { success: boolean; error?: string } {
    const item = this.getItemById(itemId);
    if (!item) {
      return { success: false, error: 'Item not found' };
    }
    // Safety check: verify item is not currently borrowed
    if (item.borrowedQty > 0) {
      return {
        success: false,
        error: `Cannot delete item '${item.name}': ${item.borrowedQty} unit(s) are currently on active loan.`,
      };
    }
    this.items = deleteInventoryItemFromList(this.items, itemId);
    this.saveToStorage();
    return { success: true };
  }

  // --- MEMBER MUTATIONS ---
  public registerMember(newMember: ScoutMember): void {
    this.members = [newMember, ...this.members];
    this.saveToStorage();
  }

  public updateMember(updated: ScoutMember): void {
    this.members = this.members.map((m) => (m.id === updated.id ? updated : m));
    // Cascade to past transactions matching App.tsx:87-102
    this.transactions = this.transactions.map((tx) =>
      tx.memberId === updated.id
        ? {
            ...tx,
            memberName: updated.name,
            memberKelas: updated.kelas,
            memberJabatan: `${updated.jabatan} — ${updated.sangga}`,
            memberSignature: updated.signatureDataUrl,
          }
        : tx
    );
    this.saveToStorage();
  }

  // --- BORROW FLOW ---
  public createBorrowRequest(newTx: LoanTransaction): void {
    this.transactions = [newTx, ...this.transactions];
    this.saveToStorage();
  }

  public approveBorrow(
    txId: string,
    officer: DewanInventarisOfficer = DEWAN_INVENTARIS_LIST[0],
    pradana = PRADANA_LIST[0]
  ): LoanTransaction {
    const target = this.getTransactionById(txId);
    if (!target) throw new Error(`Transaction ${txId} not found`);

    const updatedTx: LoanTransaction = {
      ...target,
      status: 'active_borrowed',
      officerId: officer.id,
      officerName: officer.name,
      officerSignature: officer.signatureDataUrl,
      pradanaName: pradana.name,
      pradanaSignature: pradana.signatureDataUrl,
    };

    this.transactions = this.transactions.map((t) => (t.id === txId ? updatedTx : t));

    // Deduct stock (increase borrowedQty)
    this.items = this.items.map((inv) => {
      const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
      if (matchingEntries.length === 0) return inv;
      const totalQtyToBorrow = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
      return {
        ...inv,
        borrowedQty: Math.min(inv.totalQty, inv.borrowedQty + totalQtyToBorrow),
      };
    });

    this.saveToStorage();
    return updatedTx;
  }

  public rejectTransaction(txId: string): void {
    this.transactions = this.transactions.map((t) =>
      t.id === txId ? { ...t, status: 'rejected' } : t
    );
    this.saveToStorage();
  }

  // --- RETURN FLOW ---
  public submitReturnRequest(
    txId: string,
    conditionAfter: string,
    photoAfter: string,
    photoHandoverReturn: string
  ): void {
    this.transactions = this.transactions.map((tx) => {
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
        })),
      };
    });
    this.saveToStorage();
  }

  public approveReturn(
    txId: string,
    officer: DewanInventarisOfficer = DEWAN_INVENTARIS_LIST[0],
    pradana = PRADANA_LIST[0],
    damagedCountByItemId: Record<string, number> = {}
  ): LoanTransaction {
    const target = this.getTransactionById(txId);
    if (!target) throw new Error(`Transaction ${txId} not found`);

    const updatedTx: LoanTransaction = {
      ...target,
      status: 'returned',
      returnDate: target.returnDate || new Date().toISOString().slice(0, 16),
      officerId: officer.id,
      officerName: officer.name,
      officerSignature: officer.signatureDataUrl,
      pradanaName: pradana.name,
      pradanaSignature: pradana.signatureDataUrl,
    };

    this.transactions = this.transactions.map((t) => (t.id === txId ? updatedTx : t));

    // Restore stock (decrease borrowedQty), increment damagedQty if any damage reported
    this.items = this.items.map((inv) => {
      const matchingEntries = target.items.filter((i) => i.itemId === inv.id);
      if (matchingEntries.length === 0) return inv;

      const totalReturned = matchingEntries.reduce((sum, i) => sum + i.qty, 0);
      const fromEntries = matchingEntries.reduce((sum, i) => sum + (i.damagedQty || 0), 0);
      const explicitDamaged = damagedCountByItemId[inv.id];
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
    });

    this.saveToStorage();
    return updatedTx;
  }

  public triggerMemberAlarm(txId: string): void {
    this.transactions = this.transactions.map((t) =>
      t.id === txId ? { ...t, status: 'overdue', alarmMutedUntilVerified: false } : t
    );
    this.saveToStorage();
  }
}
