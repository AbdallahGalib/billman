import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Transaction, SyncResult } from '../types';
import { validateTransaction } from '../validation/schemas';

// Database types
interface DatabaseTransaction {
  id: string;
  date: string;
  sender: string;
  item: string;
  amount: number;
  original_message?: string;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  private client: SupabaseClient;
  private tableName = 'transactions';

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // Connection test
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from(this.tableName).select('count', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  }

  // CRUD Operations
  async saveTransactions(transactions: Transaction[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: []
    };

    try {
      // Validate all transactions first
      const validTransactions: Transaction[] = [];
      for (const transaction of transactions) {
        const validation = validateTransaction(transaction);
        if (validation.isValid) {
          validTransactions.push(transaction);
        } else {
          result.errors.push(`Invalid transaction ${transaction.id}: ${Object.values(validation.errors).join(', ')}`);
        }
      }

      if (validTransactions.length === 0) {
        result.errors.push('No valid transactions to save');
        return result;
      }

      // Convert to database format
      const dbTransactions: Omit<DatabaseTransaction, 'created_at' | 'updated_at'>[] = validTransactions.map(t => ({
        id: t.id,
        date: t.date.toISOString(),
        sender: t.sender,
        item: t.item,
        amount: t.amount,
        original_message: t.originalMessage
      }));

      // Use upsert to handle duplicates
      const { data, error } = await this.client
        .from(this.tableName)
        .upsert(dbTransactions, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        result.errors.push(`Database error: ${error.message}`);
        return result;
      }

      result.success = true;
      result.syncedCount = data?.length || 0;

    } catch (error) {
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async loadTransactions(): Promise<Transaction[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw new Error(`Failed to load transactions: ${error.message}`);
      }

      // Convert from database format
      return (data || []).map(this.convertFromDatabase);

    } catch (error) {
      console.error('Error loading transactions:', error);
      throw error;
    }
  }

  async loadTransactionsPaginated(page: number = 1, limit: number = 100): Promise<{
    transactions: Transaction[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error(`Failed to get transaction count: ${countError.message}`);
      }

      // Get paginated data
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to load transactions: ${error.message}`);
      }

      const transactions = (data || []).map(this.convertFromDatabase);
      const total = count || 0;
      const hasMore = offset + limit < total;

      return { transactions, total, hasMore };

    } catch (error) {
      console.error('Error loading paginated transactions:', error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    try {
      const validation = validateTransaction({ id, ...updates } as Transaction);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
      }

      const dbUpdates: Partial<DatabaseTransaction> = {};
      
      if (updates.date) dbUpdates.date = updates.date.toISOString();
      if (updates.sender) dbUpdates.sender = updates.sender;
      if (updates.item) dbUpdates.item = updates.item;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.originalMessage !== undefined) dbUpdates.original_message = updates.originalMessage;

      const { error } = await this.client
        .from(this.tableName)
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete transaction: ${error.message}`);
      }

    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  async deleteMultipleTransactions(ids: string[]): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .in('id', ids);

      if (error) {
        throw new Error(`Failed to delete transactions: ${error.message}`);
      }

    } catch (error) {
      console.error('Error deleting multiple transactions:', error);
      throw error;
    }
  }

  // Analytics queries
  async getTransactionStats(): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageAmount: number;
    dateRange: { earliest: Date; latest: Date } | null;
  }> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('amount, date');

      if (error) {
        throw new Error(`Failed to get transaction stats: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          totalTransactions: 0,
          totalAmount: 0,
          averageAmount: 0,
          dateRange: null
        };
      }

      const totalTransactions = data.length;
      const totalAmount = data.reduce((sum, t) => sum + t.amount, 0);
      const averageAmount = totalAmount / totalTransactions;

      const dates = data.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
      const dateRange = {
        earliest: dates[0],
        latest: dates[dates.length - 1]
      };

      return {
        totalTransactions,
        totalAmount,
        averageAmount,
        dateRange
      };

    } catch (error) {
      console.error('Error getting transaction stats:', error);
      throw error;
    }
  }

  async getItemDistribution(): Promise<{ item: string; count: number; totalAmount: number }[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('item, amount');

      if (error) {
        throw new Error(`Failed to get item distribution: ${error.message}`);
      }

      // Group by item
      const itemMap = new Map<string, { count: number; totalAmount: number }>();
      
      (data || []).forEach(t => {
        const existing = itemMap.get(t.item) || { count: 0, totalAmount: 0 };
        itemMap.set(t.item, {
          count: existing.count + 1,
          totalAmount: existing.totalAmount + t.amount
        });
      });

      return Array.from(itemMap.entries())
        .map(([item, stats]) => ({ item, ...stats }))
        .sort((a, b) => b.count - a.count);

    } catch (error) {
      console.error('Error getting item distribution:', error);
      throw error;
    }
  }

  async getMonthlySpending(): Promise<{ month: string; year: number; total: number; transactionCount: number }[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('date, amount');

      if (error) {
        throw new Error(`Failed to get monthly spending: ${error.message}`);
      }

      // Group by month/year
      const monthMap = new Map<string, { total: number; transactionCount: number; year: number }>();
      
      (data || []).forEach(t => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = date.toLocaleString('default', { month: 'long' });
        
        const existing = monthMap.get(monthKey) || { total: 0, transactionCount: 0, year: date.getFullYear() };
        monthMap.set(monthKey, {
          total: existing.total + t.amount,
          transactionCount: existing.transactionCount + 1,
          year: date.getFullYear()
        });
      });

      return Array.from(monthMap.entries())
        .map(([key, stats]) => {
          const [year, monthIndex] = key.split('-');
          const date = new Date(parseInt(year), parseInt(monthIndex));
          return {
            month: date.toLocaleString('default', { month: 'long' }),
            year: parseInt(year),
            ...stats
          };
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
        });

    } catch (error) {
      console.error('Error getting monthly spending:', error);
      throw error;
    }
  }

  // Utility methods
  private convertFromDatabase(dbTransaction: DatabaseTransaction): Transaction {
    return {
      id: dbTransaction.id,
      date: new Date(dbTransaction.date),
      sender: dbTransaction.sender,
      item: dbTransaction.item,
      amount: dbTransaction.amount,
      originalMessage: dbTransaction.original_message,
      createdAt: new Date(dbTransaction.created_at),
      updatedAt: new Date(dbTransaction.updated_at)
    };
  }

  // Backup and restore
  async exportAllTransactions(): Promise<Transaction[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to export transactions: ${error.message}`);
      }

      return (data || []).map(this.convertFromDatabase);

    } catch (error) {
      console.error('Error exporting transactions:', error);
      throw error;
    }
  }

  async clearAllTransactions(): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .neq('id', ''); // Delete all records

      if (error) {
        throw new Error(`Failed to clear transactions: ${error.message}`);
      }

    } catch (error) {
      console.error('Error clearing transactions:', error);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const isConnected = await this.testConnection();
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        message: isConnected ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}