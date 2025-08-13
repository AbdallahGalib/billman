import type { Category, Transaction, CategoryUsageStats, CategoryAnalytics } from '../types';
import { generateId } from '../utils/helpers';

export class CategoryService {
  private categories: Category[] = [];
  private storageKey = 'whatsapp-categories';
  private itemCategoryMappings: Map<string, string> = new Map();

  constructor() {
    this.loadFromStorage();
    this.loadItemMappings();
  }

  // CRUD Operations
  async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    // Check for duplicate names
    const existingCategory = this.categories.find(c => 
      c.name.toLowerCase() === categoryData.name.toLowerCase()
    );
    
    if (existingCategory) {
      throw new Error('Category with this name already exists');
    }

    const category: Category = {
      id: generateId(),
      ...categoryData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.categories.push(category);
    await this.saveToStorage();
    return category;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Category not found');
    }

    // Check for duplicate names if name is being updated
    if (updates.name) {
      const existingCategory = this.categories.find(c => 
        c.id !== id && c.name.toLowerCase() === updates.name!.toLowerCase()
      );
      
      if (existingCategory) {
        throw new Error('Category with this name already exists');
      }
    }

    const updatedCategory = {
      ...this.categories[index],
      ...updates,
      updatedAt: new Date()
    };

    this.categories[index] = updatedCategory;
    await this.saveToStorage();
    return updatedCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Category not found');
    }

    this.categories.splice(index, 1);
    
    // Remove from item mappings
    for (const [item, categoryId] of this.itemCategoryMappings.entries()) {
      if (categoryId === id) {
        this.itemCategoryMappings.delete(item);
      }
    }

    await this.saveToStorage();
    await this.saveItemMappings();
  }

  async getCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  async getCategory(id: string): Promise<Category | null> {
    return this.categories.find(c => c.id === id) || null;
  }

  // Auto-suggestion functionality
  async suggestCategoryForItem(itemName: string): Promise<Category | null> {
    const normalizedItem = this.normalizeItemName(itemName);
    
    // Check exact mapping first
    const mappedCategoryId = this.itemCategoryMappings.get(normalizedItem);
    if (mappedCategoryId) {
      const category = this.categories.find(c => c.id === mappedCategoryId);
      if (category) return category;
    }

    // Check for partial matches in existing mappings
    for (const [mappedItem, categoryId] of this.itemCategoryMappings.entries()) {
      if (this.areItemsSimilar(normalizedItem, mappedItem)) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) return category;
      }
    }

    return null;
  }

  // Bulk assignment operations
  async assignCategoryToTransactions(transactionIds: string[], categoryId: string): Promise<void> {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // This method would typically work with TransactionManager
    // For now, we'll just update the item mappings based on the assumption
    // that the calling code will handle the actual transaction updates
  }

  async assignCategoryToItem(itemName: string, categoryId: string): Promise<void> {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    const normalizedItem = this.normalizeItemName(itemName);
    this.itemCategoryMappings.set(normalizedItem, categoryId);
    await this.saveItemMappings();
  }

  async removeCategoryFromItem(itemName: string): Promise<void> {
    const normalizedItem = this.normalizeItemName(itemName);
    this.itemCategoryMappings.delete(normalizedItem);
    await this.saveItemMappings();
  }

  // Analytics and usage statistics
  async getCategoryUsageStats(transactions: Transaction[]): Promise<CategoryUsageStats[]> {
    const stats = new Map<string, {
      transactionCount: number;
      totalAmount: number;
      lastUsed: Date;
    }>();

    // Initialize stats for all categories
    this.categories.forEach(category => {
      stats.set(category.id, {
        transactionCount: 0,
        totalAmount: 0,
        lastUsed: new Date(0) // Very old date as default
      });
    });

    // Calculate stats from transactions
    transactions.forEach(transaction => {
      if (transaction.categoryId) {
        const existing = stats.get(transaction.categoryId);
        if (existing) {
          existing.transactionCount++;
          existing.totalAmount += transaction.amount;
          if (transaction.date > existing.lastUsed) {
            existing.lastUsed = transaction.date;
          }
        }
      }
    });

    // Convert to CategoryUsageStats array
    return Array.from(stats.entries()).map(([categoryId, data]) => {
      const category = this.categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        transactionCount: data.transactionCount,
        totalAmount: data.totalAmount,
        averageAmount: data.transactionCount > 0 ? data.totalAmount / data.transactionCount : 0,
        lastUsed: data.lastUsed
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getCategoryAnalytics(transactions: Transaction[]): Promise<CategoryAnalytics> {
    const categorizedTransactions = transactions.filter(t => t.categoryId);
    const uncategorizedTransactions = transactions.filter(t => !t.categoryId);
    const categoryBreakdown = await this.getCategoryUsageStats(transactions);
    
    return {
      totalCategories: this.categories.length,
      categorizedTransactions: categorizedTransactions.length,
      uncategorizedTransactions: uncategorizedTransactions.length,
      categoryBreakdown,
      topCategories: categoryBreakdown.slice(0, 5)
    };
  }

  // Utility methods
  private normalizeItemName(itemName: string): string {
    return itemName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0980-\u09FF]/g, '') // Remove special characters, keep Bengali
      .replace(/\s+/g, ' ');
  }

  private areItemsSimilar(item1: string, item2: string): boolean {
    // Simple similarity check - can be enhanced with more sophisticated algorithms
    const words1 = item1.split(' ');
    const words2 = item2.split(' ');
    
    // Check if they share at least 50% of words
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return similarity >= 0.5;
  }

  // Storage operations
  private async saveToStorage(): Promise<void> {
    try {
      const data = JSON.stringify(this.categories);
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error('Failed to save categories to storage:', error);
      throw new Error('Failed to save categories locally');
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.categories = parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load categories from storage:', error);
      this.categories = [];
    }
  }

  private async saveItemMappings(): Promise<void> {
    try {
      const mappingsArray = Array.from(this.itemCategoryMappings.entries());
      const data = JSON.stringify(mappingsArray);
      localStorage.setItem(`${this.storageKey}-mappings`, data);
    } catch (error) {
      console.error('Failed to save item mappings to storage:', error);
    }
  }

  private loadItemMappings(): void {
    try {
      const data = localStorage.getItem(`${this.storageKey}-mappings`);
      if (data) {
        const mappingsArray = JSON.parse(data);
        this.itemCategoryMappings = new Map(mappingsArray);
      }
    } catch (error) {
      console.error('Failed to load item mappings from storage:', error);
      this.itemCategoryMappings = new Map();
    }
  }

  // Export/Import operations
  exportCategories(): string {
    return JSON.stringify({
      categories: this.categories,
      itemMappings: Array.from(this.itemCategoryMappings.entries())
    }, null, 2);
  }

  async importCategories(jsonData: string): Promise<{ imported: number; errors: string[] }> {
    try {
      const data = JSON.parse(jsonData);
      const errors: string[] = [];
      let imported = 0;

      if (data.categories && Array.isArray(data.categories)) {
        for (const categoryData of data.categories) {
          try {
            // Check if category already exists
            const existing = this.categories.find(c => c.name === categoryData.name);
            if (!existing) {
              await this.createCategory({
                name: categoryData.name,
                color: categoryData.color,
                description: categoryData.description
              });
              imported++;
            }
          } catch (error) {
            errors.push(`Failed to import category "${categoryData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (data.itemMappings && Array.isArray(data.itemMappings)) {
        for (const [item, categoryId] of data.itemMappings) {
          // Find category by name if ID doesn't exist
          const category = this.categories.find(c => c.id === categoryId) || 
                          this.categories.find(c => c.name === categoryId);
          if (category) {
            this.itemCategoryMappings.set(item, category.id);
          }
        }
        await this.saveItemMappings();
      }

      return { imported, errors };
    } catch (error) {
      throw new Error(`Failed to import categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get suggestions for bulk assignment
  async getBulkAssignmentSuggestions(transactions: Transaction[]): Promise<{
    item: string;
    suggestedCategory: Category;
    confidence: number;
    transactionCount: number;
  }[]> {
    const suggestions: {
      item: string;
      suggestedCategory: Category;
      confidence: number;
      transactionCount: number;
    }[] = [];

    // Group transactions by item
    const itemGroups = new Map<string, Transaction[]>();
    transactions.forEach(transaction => {
      if (!transaction.categoryId) { // Only suggest for uncategorized items
        const normalizedItem = this.normalizeItemName(transaction.item);
        if (!itemGroups.has(normalizedItem)) {
          itemGroups.set(normalizedItem, []);
        }
        itemGroups.get(normalizedItem)!.push(transaction);
      }
    });

    // Generate suggestions for each item group
    for (const [item, itemTransactions] of itemGroups.entries()) {
      const suggestedCategory = await this.suggestCategoryForItem(item);
      if (suggestedCategory) {
        // Calculate confidence based on how many similar items are already categorized
        const confidence = this.calculateSuggestionConfidence(item);
        
        suggestions.push({
          item,
          suggestedCategory,
          confidence,
          transactionCount: itemTransactions.length
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateSuggestionConfidence(itemName: string): number {
    let matchCount = 0;
    let totalMappings = 0;

    for (const mappedItem of this.itemCategoryMappings.keys()) {
      totalMappings++;
      if (this.areItemsSimilar(itemName, mappedItem)) {
        matchCount++;
      }
    }

    if (totalMappings === 0) return 0;
    return Math.min(matchCount / totalMappings * 100, 95); // Cap at 95%
  }
}