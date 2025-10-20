import type {
  Transaction,
  FilterConfig,
  SortConfig,
  SyncResult,
  TransactionEvent
} from '../types';
import { validateTransaction } from '../validation/schemas';
import { generateId, deepClone, sortBy, filterBy } from '../utils/helpers';

export class TransactionManager {
  private transactions: Transaction[] = [];
  private listeners: ((event: TransactionEvent) => void)[] = [];
  private storageKey = 'whatsapp-transactions';

  constructor() {
    this.loadFromStorage();
  }

  // CRUD Operations
  async addTransactions(newTransactions: Transaction[]): Promise<void> {
    const validTransactions: Transaction[] = [];

    for (const transaction of newTransactions) {
      const validation = validateTransaction(transaction);
      if (validation.isValid) {
        // Check for duplicates
        const isDuplicate = this.transactions.some(existing =>
          this.isDuplicateTransaction(existing, transaction)
        );

        if (!isDuplicate) {
          validTransactions.push({
            ...transaction,
            id: transaction.id || generateId(),
            createdAt: transaction.createdAt || new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    this.transactions.push(...validTransactions);
    await this.saveToStorage();

    // Notify listeners
    validTransactions.forEach(transaction => {
      this.notifyListeners({
        type: 'create',
        transaction,
        timestamp: new Date()
      });
    });
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const updatedTransaction = {
      ...this.transactions[index],
      ...updates,
      updatedAt: new Date()
    };

    const validation = validateTransaction(updatedTransaction);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
    }

    this.transactions[index] = updatedTransaction;
    await this.saveToStorage();

    this.notifyListeners({
      type: 'update',
      transaction: updatedTransaction,
      timestamp: new Date()
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const deletedTransaction = this.transactions[index];
    this.transactions.splice(index, 1);
    await this.saveToStorage();

    this.notifyListeners({
      type: 'delete',
      transaction: deletedTransaction,
      timestamp: new Date()
    });
  }

  async deleteMultipleTransactions(ids: string[]): Promise<void> {
    const deletedTransactions: Transaction[] = [];

    for (const id of ids) {
      const index = this.transactions.findIndex(t => t.id === id);
      if (index !== -1) {
        deletedTransactions.push(this.transactions[index]);
        this.transactions.splice(index, 1);
      }
    }

    await this.saveToStorage();

    deletedTransactions.forEach(transaction => {
      this.notifyListeners({
        type: 'delete',
        transaction,
        timestamp: new Date()
      });
    });
  }

  // Query Operations
  getTransactions(filters?: FilterConfig, sort?: SortConfig): Transaction[] {
    let result = deepClone(this.transactions);

    // Apply filters
    if (filters) {
      result = this.applyFilters(result, filters);
    }

    // Apply sorting
    if (sort) {
      result = sortBy(result, sort.field, sort.direction);
    }

    return result;
  }

  getTransaction(id: string): Transaction | null {
    return this.transactions.find(t => t.id === id) || null;
  }

  getTransactionCount(filters?: FilterConfig): number {
    if (!filters) return this.transactions.length;
    return this.applyFilters(this.transactions, filters).length;
  }

  // Filtering and Searching
  private applyFilters(transactions: Transaction[], filters: FilterConfig): Transaction[] {
    let result = [...transactions];

    // Date range filter
    if (filters.dateRange) {
      result = result.filter(t =>
        t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      );
    }

    // Sender filter
    if (filters.sender) {
      result = result.filter(t =>
        t.sender.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    // Item search filter
    if (filters.itemSearch) {
      result = result.filter(t =>
        t.item.toLowerCase().includes(filters.itemSearch!.toLowerCase())
      );
    }

    // Amount range filter
    if (filters.amountRange) {
      result = result.filter(t =>
        t.amount >= filters.amountRange!.min && t.amount <= filters.amountRange!.max
      );
    }

    return result;
  }

  searchTransactions(query: string): Transaction[] {
    if (!query.trim()) return this.transactions;

    const searchTerm = query.toLowerCase();
    return this.transactions.filter(transaction =>
      transaction.item.toLowerCase().includes(searchTerm) ||
      transaction.sender.toLowerCase().includes(searchTerm) ||
      transaction.amount.toString().includes(searchTerm) ||
      (transaction.originalMessage && transaction.originalMessage.toLowerCase().includes(searchTerm))
    );
  }

  // Analytics helpers
  getUniqueItems(): string[] {
    const items = new Set(this.transactions.map(t => t.item));
    return Array.from(items).sort();
  }

  getUniqueSenders(): string[] {
    const senders = new Set(this.transactions.map(t => t.sender));
    return Array.from(senders).sort();
  }

  getTotalAmount(filters?: FilterConfig): number {
    const transactions = filters ? this.applyFilters(this.transactions, filters) : this.transactions;
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  getAverageAmount(filters?: FilterConfig): number {
    const transactions = filters ? this.applyFilters(this.transactions, filters) : this.transactions;
    if (transactions.length === 0) return 0;
    return this.getTotalAmount(filters) / transactions.length;
  }

  // Storage Operations
  private async saveToStorage(): Promise<void> {
    try {
      const data = JSON.stringify(this.transactions);
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error('Failed to save transactions to storage:', error);
      throw new Error('Failed to save data locally');
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.transactions = parsed.map((t: any) => ({
          ...t,
          date: new Date(t.date),
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load transactions from storage:', error);
      this.transactions = [];
    }
  }

  async clearAllTransactions(): Promise<void> {
    const deletedTransactions = [...this.transactions];
    this.transactions = [];
    await this.saveToStorage();

    deletedTransactions.forEach(transaction => {
      this.notifyListeners({
        type: 'delete',
        transaction,
        timestamp: new Date()
      });
    });
  }

  // Export/Import Operations
  exportToJSON(): string {
    return JSON.stringify(this.transactions, null, 2);
  }

  exportToCSV(): string {
    if (this.transactions.length === 0) return '';

    const headers = ['Date', 'Sender', 'Item', 'Amount', 'Original Message'];
    const rows = this.transactions.map(t => [
      t.date.toISOString().split('T')[0],
      t.sender,
      t.item,
      t.amount.toString(),
      t.originalMessage || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  async importFromJSON(jsonData: string): Promise<{ imported: number; errors: string[] }> {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) {
        throw new Error('Invalid JSON format: expected array');
      }

      const validTransactions: Transaction[] = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        try {
          const item = data[i];
          const transaction: Transaction = {
            id: item.id || generateId(),
            date: new Date(item.date),
            sender: item.sender,
            item: item.item,
            amount: parseFloat(item.amount),
            originalMessage: item.originalMessage,
            createdAt: new Date(item.createdAt || Date.now()),
            updatedAt: new Date(item.updatedAt || Date.now())
          };

          const validation = validateTransaction(transaction);
          if (validation.isValid) {
            validTransactions.push(transaction);
          } else {
            errors.push(`Row ${i + 1}: ${Object.values(validation.errors).join(', ')}`);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
        }
      }

      await this.addTransactions(validTransactions);
      return { imported: validTransactions.length, errors };
    } catch (error) {
      throw new Error(`Failed to import JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Event Listeners
  addEventListener(listener: (event: TransactionEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: TransactionEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: TransactionEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in transaction event listener:', error);
      }
    });
  }

  // Utility Methods
  private isDuplicateTransaction(existing: Transaction, newTransaction: Transaction): boolean {
    // Consider transactions duplicates if they have the same sender, item, amount,
    // and are within 5 minutes of each other
    const timeDiff = Math.abs(existing.date.getTime() - newTransaction.date.getTime());
    const fiveMinutes = 5 * 60 * 1000;

    // Enhanced duplicate detection for incremental uploads:
    // Also consider as duplicate if same sender, item, amount, and very close date (within 1 day)
    // This helps when re-uploading files with slightly different timestamps
    const oneDay = 24 * 60 * 60 * 1000;
    
    const sameBasicInfo = existing.sender === newTransaction.sender &&
      existing.item === newTransaction.item &&
      existing.amount === newTransaction.amount;

    // Strict duplicate check (5 minutes)
    if (sameBasicInfo && timeDiff < fiveMinutes) {
      return true;
    }

    // Relaxed duplicate check for incremental uploads (1 day) - only if original message is very similar
    if (sameBasicInfo && timeDiff < oneDay) {
      // If original messages exist, check if they're very similar
      if (existing.originalMessage && newTransaction.originalMessage) {
        // Normalize messages for comparison (remove extra spaces, convert to lowercase)
        const normalizeMsg = (msg: string) => msg.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedExisting = normalizeMsg(existing.originalMessage);
        const normalizedNew = normalizeMsg(newTransaction.originalMessage);
        
        // If messages are very similar (Levenshtein distance < 10% of message length)
        const distance = this.levenshteinDistance(normalizedExisting, normalizedNew);
        const maxLength = Math.max(normalizedExisting.length, normalizedNew.length);
        
        if (distance / maxLength < 0.1) {
          return true;
        }
      }
      
      // If no original messages or messages are not similar, still consider as duplicate
      // if the date difference is very small and all other fields match
      if (timeDiff < 30 * 60 * 1000) { // 30 minutes
        return true;
      }
    }

    return false;
  }

  // Levenshtein distance algorithm for string similarity
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Statistics
  getStatistics() {
    const total = this.transactions.length;
    const totalAmount = this.getTotalAmount();
    const averageAmount = this.getAverageAmount();
    const uniqueItems = this.getUniqueItems().length;
    const uniqueSenders = this.getUniqueSenders().length;

    // Date range
    const dates = this.transactions.map(t => t.date.getTime()).sort((a, b) => a - b);
    const dateRange = dates.length > 0 ? {
      earliest: new Date(dates[0]),
      latest: new Date(dates[dates.length - 1])
    } : null;

    // Top items by count
    const itemCounts = this.transactions.reduce((acc, t) => {
      acc[t.item] = (acc[t.item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }));

    return {
      total,
      totalAmount,
      averageAmount,
      uniqueItems,
      uniqueSenders,
      dateRange,
      topItems
    };
  }

  // Group similar items together
  getGroupedTransactions(): Transaction[] {
    const groupedTransactions = [...this.transactions];
    const itemGroups = new Map<string, string>();

    // First pass: identify similar items
    const normalizedItems = new Map<string, string[]>();

    this.transactions.forEach(transaction => {
      const normalizedItem = this.normalizeForGrouping(transaction.item);
      if (!normalizedItems.has(normalizedItem)) {
        normalizedItems.set(normalizedItem, []);
      }
      normalizedItems.get(normalizedItem)!.push(transaction.item);
    });

    // Create mapping from original item to normalized item
    normalizedItems.forEach((originalItems, normalizedItem) => {
      // Use the shortest, cleanest version as the canonical name
      const canonicalItem = originalItems
        .sort((a, b) => a.length - b.length)
        .find(item => !(/^\d/.test(item))) || originalItems[0];

      originalItems.forEach(item => {
        itemGroups.set(item, canonicalItem);
      });
    });

    // Update transactions with grouped item names
    return groupedTransactions.map(transaction => ({
      ...transaction,
      item: itemGroups.get(transaction.item) || transaction.item
    }));
  }

  private normalizeForGrouping(item: string): string {
    return item
      .toLowerCase()
      .replace(/^\d+\s*/, '') // Remove leading numbers
      .replace(/[^\w\s\u0980-\u09FF]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get item frequency analysis
  getItemFrequencyAnalysis(): {
    frequent: { item: string; count: number; totalAmount: number }[];
    nonFrequent: { item: string; count: number; totalAmount: number }[];
    threshold: number;
  } {
    const groupedTransactions = this.getGroupedTransactions();
    const itemStats = new Map<string, { count: number; totalAmount: number }>();

    groupedTransactions.forEach(transaction => {
      const existing = itemStats.get(transaction.item) || { count: 0, totalAmount: 0 };
      itemStats.set(transaction.item, {
        count: existing.count + 1,
        totalAmount: existing.totalAmount + transaction.amount
      });
    });

    const allItems = Array.from(itemStats.entries()).map(([item, stats]) => ({
      item,
      count: stats.count,
      totalAmount: stats.totalAmount
    })).sort((a, b) => b.count - a.count);

    // Calculate threshold (items bought more than 3 times are considered frequent)
    const threshold = 3;

    const frequent = allItems.filter(item => item.count > threshold);
    const nonFrequent = allItems.filter(item => item.count <= threshold);

    return { frequent, nonFrequent, threshold };
  }
}