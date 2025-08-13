import type { Transaction, FilterState, FilterPreset, Category } from '../types';
import { generateId } from '../utils/helpers';

export class FilterService {
  private filterPresets: FilterPreset[] = [];
  private currentFilters: FilterState = this.getEmptyFilterState();
  private storageKey = 'whatsapp-filter-presets';
  private currentFiltersKey = 'whatsapp-current-filters';

  constructor() {
    this.loadFilterPresets();
    this.loadPersistedFilters();
  }

  // Filter application
  applyFilters(transactions: Transaction[], filters: FilterState): Transaction[] {
    let result = [...transactions];

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter(transaction => {
        if (!transaction.categoryId) return false;
        return filters.categories.includes(transaction.categoryId);
      });
    }

    // Item filter
    if (filters.items.length > 0) {
      result = result.filter(transaction => 
        filters.items.some(item => 
          transaction.item.toLowerCase().includes(item.toLowerCase())
        )
      );
    }

    // Sender filter
    if (filters.senders.length > 0) {
      result = result.filter(transaction => 
        filters.senders.some(sender => 
          transaction.sender.toLowerCase().includes(sender.toLowerCase())
        )
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      result = result.filter(transaction => {
        const transactionDate = transaction.date;
        
        if (filters.dateRange.start && transactionDate < filters.dateRange.start) {
          return false;
        }
        
        if (filters.dateRange.end && transactionDate > filters.dateRange.end) {
          return false;
        }
        
        return true;
      });
    }

    // Amount range filter
    if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
      result = result.filter(transaction => {
        if (filters.amountRange.min !== null && transaction.amount < filters.amountRange.min) {
          return false;
        }
        
        if (filters.amountRange.max !== null && transaction.amount > filters.amountRange.max) {
          return false;
        }
        
        return true;
      });
    }

    return result;
  }

  // Filter state management
  getCurrentFilters(): FilterState {
    return { ...this.currentFilters };
  }

  setCurrentFilters(filters: FilterState): void {
    this.currentFilters = { ...filters };
    this.persistFilters(filters);
  }

  clearFilters(): FilterState {
    const emptyFilters = this.getEmptyFilterState();
    this.setCurrentFilters(emptyFilters);
    return emptyFilters;
  }

  hasActiveFilters(filters: FilterState = this.currentFilters): boolean {
    return (
      filters.categories.length > 0 ||
      filters.items.length > 0 ||
      filters.senders.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.amountRange.min !== null ||
      filters.amountRange.max !== null
    );
  }

  getActiveFilterCount(filters: FilterState = this.currentFilters): number {
    let count = 0;
    
    if (filters.categories.length > 0) count++;
    if (filters.items.length > 0) count++;
    if (filters.senders.length > 0) count++;
    if (filters.dateRange.start !== null || filters.dateRange.end !== null) count++;
    if (filters.amountRange.min !== null || filters.amountRange.max !== null) count++;
    
    return count;
  }

  getActiveFilterSummary(filters: FilterState = this.currentFilters): string[] {
    const summary: string[] = [];
    
    if (filters.categories.length > 0) {
      summary.push(`${filters.categories.length} category${filters.categories.length > 1 ? 'ies' : ''}`);
    }
    
    if (filters.items.length > 0) {
      summary.push(`${filters.items.length} item${filters.items.length > 1 ? 's' : ''}`);
    }
    
    if (filters.senders.length > 0) {
      summary.push(`${filters.senders.length} sender${filters.senders.length > 1 ? 's' : ''}`);
    }
    
    if (filters.dateRange.start || filters.dateRange.end) {
      if (filters.dateRange.start && filters.dateRange.end) {
        summary.push(`Date range: ${this.formatDate(filters.dateRange.start)} - ${this.formatDate(filters.dateRange.end)}`);
      } else if (filters.dateRange.start) {
        summary.push(`From: ${this.formatDate(filters.dateRange.start)}`);
      } else if (filters.dateRange.end) {
        summary.push(`Until: ${this.formatDate(filters.dateRange.end)}`);
      }
    }
    
    if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
      if (filters.amountRange.min !== null && filters.amountRange.max !== null) {
        summary.push(`Amount: ৳${filters.amountRange.min} - ৳${filters.amountRange.max}`);
      } else if (filters.amountRange.min !== null) {
        summary.push(`Min amount: ৳${filters.amountRange.min}`);
      } else if (filters.amountRange.max !== null) {
        summary.push(`Max amount: ৳${filters.amountRange.max}`);
      }
    }
    
    return summary;
  }

  // Filter presets management
  async saveFilterPreset(name: string, filters: FilterState): Promise<FilterPreset> {
    // Check for duplicate names
    const existingPreset = this.filterPresets.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingPreset) {
      throw new Error('Filter preset with this name already exists');
    }

    const preset: FilterPreset = {
      id: generateId(),
      name,
      filters: { ...filters },
      createdAt: new Date()
    };

    this.filterPresets.push(preset);
    await this.saveFilterPresets();
    return preset;
  }

  async updateFilterPreset(id: string, updates: { name?: string; filters?: FilterState }): Promise<FilterPreset> {
    const index = this.filterPresets.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Filter preset not found');
    }

    // Check for duplicate names if name is being updated
    if (updates.name) {
      const existingPreset = this.filterPresets.find(p => 
        p.id !== id && p.name.toLowerCase() === updates.name!.toLowerCase()
      );
      
      if (existingPreset) {
        throw new Error('Filter preset with this name already exists');
      }
    }

    const updatedPreset = {
      ...this.filterPresets[index],
      ...updates
    };

    this.filterPresets[index] = updatedPreset;
    await this.saveFilterPresets();
    return updatedPreset;
  }

  async deleteFilterPreset(id: string): Promise<void> {
    const index = this.filterPresets.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Filter preset not found');
    }

    this.filterPresets.splice(index, 1);
    await this.saveFilterPresets();
  }

  async getFilterPresets(): Promise<FilterPreset[]> {
    return [...this.filterPresets];
  }

  async getFilterPreset(id: string): Promise<FilterPreset | null> {
    return this.filterPresets.find(p => p.id === id) || null;
  }

  // URL synchronization
  serializeFiltersToURL(filters: FilterState): string {
    const params = new URLSearchParams();

    if (filters.categories.length > 0) {
      params.set('categories', filters.categories.join(','));
    }

    if (filters.items.length > 0) {
      params.set('items', filters.items.join(','));
    }

    if (filters.senders.length > 0) {
      params.set('senders', filters.senders.join(','));
    }

    if (filters.dateRange.start) {
      params.set('dateStart', filters.dateRange.start.toISOString().split('T')[0]);
    }

    if (filters.dateRange.end) {
      params.set('dateEnd', filters.dateRange.end.toISOString().split('T')[0]);
    }

    if (filters.amountRange.min !== null) {
      params.set('amountMin', filters.amountRange.min.toString());
    }

    if (filters.amountRange.max !== null) {
      params.set('amountMax', filters.amountRange.max.toString());
    }

    return params.toString();
  }

  deserializeFiltersFromURL(urlParams: URLSearchParams): FilterState {
    const filters: FilterState = this.getEmptyFilterState();

    const categories = urlParams.get('categories');
    if (categories) {
      filters.categories = categories.split(',').filter(c => c.trim());
    }

    const items = urlParams.get('items');
    if (items) {
      filters.items = items.split(',').filter(i => i.trim());
    }

    const senders = urlParams.get('senders');
    if (senders) {
      filters.senders = senders.split(',').filter(s => s.trim());
    }

    const dateStart = urlParams.get('dateStart');
    if (dateStart) {
      try {
        filters.dateRange.start = new Date(dateStart);
      } catch (error) {
        console.warn('Invalid dateStart parameter:', dateStart);
      }
    }

    const dateEnd = urlParams.get('dateEnd');
    if (dateEnd) {
      try {
        filters.dateRange.end = new Date(dateEnd);
      } catch (error) {
        console.warn('Invalid dateEnd parameter:', dateEnd);
      }
    }

    const amountMin = urlParams.get('amountMin');
    if (amountMin) {
      const min = parseFloat(amountMin);
      if (!isNaN(min)) {
        filters.amountRange.min = min;
      }
    }

    const amountMax = urlParams.get('amountMax');
    if (amountMax) {
      const max = parseFloat(amountMax);
      if (!isNaN(max)) {
        filters.amountRange.max = max;
      }
    }

    return filters;
  }

  // Persistence
  persistFilters(filters: FilterState): void {
    try {
      const data = JSON.stringify(filters, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      localStorage.setItem(this.currentFiltersKey, data);
    } catch (error) {
      console.error('Failed to persist filters:', error);
    }
  }

  loadPersistedFilters(): FilterState {
    try {
      const data = localStorage.getItem(this.currentFiltersKey);
      if (data) {
        const parsed = JSON.parse(data, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        
        this.currentFilters = {
          ...this.getEmptyFilterState(),
          ...parsed
        };
        
        return this.currentFilters;
      }
    } catch (error) {
      console.error('Failed to load persisted filters:', error);
    }
    
    this.currentFilters = this.getEmptyFilterState();
    return this.currentFilters;
  }

  // Helper methods for filter options
  getAvailableFilterOptions(transactions: Transaction[], categories: Category[]): {
    categories: { id: string; name: string; count: number }[];
    items: { name: string; count: number }[];
    senders: { name: string; count: number }[];
    dateRange: { min: Date; max: Date } | null;
    amountRange: { min: number; max: number } | null;
  } {
    // Category options with transaction counts
    const categoryMap = new Map<string, number>();
    const itemMap = new Map<string, number>();
    const senderMap = new Map<string, number>();
    
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    let minAmount: number | null = null;
    let maxAmount: number | null = null;

    transactions.forEach(transaction => {
      // Count categories
      if (transaction.categoryId) {
        categoryMap.set(transaction.categoryId, (categoryMap.get(transaction.categoryId) || 0) + 1);
      }

      // Count items
      itemMap.set(transaction.item, (itemMap.get(transaction.item) || 0) + 1);

      // Count senders
      senderMap.set(transaction.sender, (senderMap.get(transaction.sender) || 0) + 1);

      // Track date range
      if (!minDate || transaction.date < minDate) minDate = transaction.date;
      if (!maxDate || transaction.date > maxDate) maxDate = transaction.date;

      // Track amount range
      if (minAmount === null || transaction.amount < minAmount) minAmount = transaction.amount;
      if (maxAmount === null || transaction.amount > maxAmount) maxAmount = transaction.amount;
    });

    // Build category options
    const categoryOptions = Array.from(categoryMap.entries()).map(([categoryId, count]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        id: categoryId,
        name: category?.name || 'Unknown Category',
        count
      };
    }).sort((a, b) => b.count - a.count);

    // Build item options
    const itemOptions = Array.from(itemMap.entries()).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // Build sender options
    const senderOptions = Array.from(senderMap.entries()).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    return {
      categories: categoryOptions,
      items: itemOptions,
      senders: senderOptions,
      dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
      amountRange: minAmount !== null && maxAmount !== null ? { min: minAmount, max: maxAmount } : null
    };
  }

  // Utility methods
  private getEmptyFilterState(): FilterState {
    return {
      categories: [],
      items: [],
      senders: [],
      dateRange: {
        start: null,
        end: null
      },
      amountRange: {
        min: null,
        max: null
      }
    };
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Storage operations
  private async saveFilterPresets(): Promise<void> {
    try {
      const data = JSON.stringify(this.filterPresets, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error('Failed to save filter presets:', error);
      throw new Error('Failed to save filter presets locally');
    }
  }

  private loadFilterPresets(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        this.filterPresets = parsed;
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
      this.filterPresets = [];
    }
  }

  // Export/Import operations
  exportFilterPresets(): string {
    return JSON.stringify(this.filterPresets, null, 2);
  }

  async importFilterPresets(jsonData: string): Promise<{ imported: number; errors: string[] }> {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) {
        throw new Error('Invalid JSON format: expected array');
      }

      const errors: string[] = [];
      let imported = 0;

      for (const presetData of data) {
        try {
          // Check if preset already exists
          const existing = this.filterPresets.find(p => p.name === presetData.name);
          if (!existing && presetData.name && presetData.filters) {
            await this.saveFilterPreset(presetData.name, presetData.filters);
            imported++;
          }
        } catch (error) {
          errors.push(`Failed to import preset "${presetData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { imported, errors };
    } catch (error) {
      throw new Error(`Failed to import filter presets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}