# Design Document

## Overview

This design document outlines the implementation of advanced filtering, categorization, and enhanced transaction management features for the WhatsApp Purchase Analyzer. The solution introduces a flexible categorization system, multi-dimensional filtering capabilities, hierarchical transaction views, and enhanced analytics while maintaining the existing application architecture.

## Architecture

### High-Level Architecture

The enhanced system builds upon the existing SvelteKit application with the following architectural additions:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│ Enhanced Components:                                        │
│ • FilterControls.svelte (new)                             │
│ • CategoryManager.svelte (new)                            │
│ • HierarchicalTransactionView.svelte (new)               │
│ • EnhancedAnalyticsCharts.svelte (updated)               │
│ • TransactionTable.svelte (updated)                      │
│ • FileUpload.svelte (updated)                            │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
├─────────────────────────────────────────────────────────────┤
│ Enhanced Services:                                          │
│ • CategoryService.ts (new)                                │
│ • FilterService.ts (new)                                  │
│ • TransactionManager.ts (updated)                         │
│ • AnalyticsService.ts (new)                              │
│ • ExportService.ts (updated)                             │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│ Enhanced Storage:                                           │
│ • LocalStorage (categories, filter presets)               │
│ • IndexedDB (transactions with categories)                │
│ • Supabase (optional, with category support)             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Filter Application**: User applies filters → FilterService processes → Components update
2. **Categorization**: User assigns category → CategoryService manages → TransactionManager updates
3. **Analytics**: Filtered data → AnalyticsService processes → Charts update
4. **Export**: Filtered data → ExportService formats → Download triggered

## Components and Interfaces

### 1. Enhanced Data Models

#### Category Interface
```typescript
interface Category {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Enhanced Transaction Interface
```typescript
interface Transaction {
  id: string;
  date: Date;
  sender: string;
  item: string;
  amount: number;
  categoryId?: string;
  category?: Category;
  originalText: string;
  confidence?: number;
}
```

#### Filter State Interface
```typescript
interface FilterState {
  categories: string[];
  items: string[];
  senders: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
}
```

#### Filter Preset Interface
```typescript
interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
}
```

### 2. New Components

#### FilterControls.svelte
**Purpose**: Unified filter interface for all views
**Props**:
- `currentFilters: FilterState`
- `availableCategories: Category[]`
- `availableItems: string[]`
- `availableSenders: string[]`
- `showPresets: boolean = true`

**Events**:
- `filtersChanged: FilterState`
- `presetSaved: { name: string, filters: FilterState }`
- `presetApplied: FilterPreset`

#### CategoryManager.svelte
**Purpose**: Category creation, editing, and assignment interface
**Props**:
- `categories: Category[]`
- `selectedTransactions: Transaction[]`
- `mode: 'manage' | 'assign'`

**Events**:
- `categoryCreated: Category`
- `categoryUpdated: Category`
- `categoryDeleted: string`
- `categoriesAssigned: { transactionIds: string[], categoryId: string }`

#### HierarchicalTransactionView.svelte
**Purpose**: Collapsible, grouped transaction display
**Props**:
- `transactions: Transaction[]`
- `groupBy: 'category' | 'item' | 'sender' | 'date'`
- `defaultExpanded: boolean = false`

**Events**:
- `transactionEdit: { id: string, field: string, value: any }`
- `transactionDelete: { id: string }`
- `groupExpanded: { groupKey: string, expanded: boolean }`

### 3. Enhanced Services

#### CategoryService
**Responsibilities**:
- CRUD operations for categories
- Auto-suggestion based on item names
- Category-item mapping management
- Category usage analytics

**Key Methods**:
```typescript
class CategoryService {
  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category>
  async updateCategory(id: string, updates: Partial<Category>): Promise<Category>
  async deleteCategory(id: string): Promise<void>
  async getCategories(): Promise<Category[]>
  async suggestCategoryForItem(itemName: string): Promise<Category | null>
  async assignCategoryToTransactions(transactionIds: string[], categoryId: string): Promise<void>
  async getCategoryUsageStats(): Promise<CategoryUsageStats[]>
}
```

#### FilterService
**Responsibilities**:
- Filter state management
- Filter preset management
- URL state synchronization
- Filter application logic

**Key Methods**:
```typescript
class FilterService {
  applyFilters(transactions: Transaction[], filters: FilterState): Transaction[]
  saveFilterPreset(name: string, filters: FilterState): Promise<FilterPreset>
  loadFilterPresets(): Promise<FilterPreset[]>
  deleteFilterPreset(id: string): Promise<void>
  serializeFiltersToURL(filters: FilterState): string
  deserializeFiltersFromURL(urlParams: URLSearchParams): FilterState
  persistFilters(filters: FilterState): void
  loadPersistedFilters(): FilterState
}
```

#### AnalyticsService
**Responsibilities**:
- Category-based analytics
- Filtered data analytics
- Trend analysis
- Comparative analytics

**Key Methods**:
```typescript
class AnalyticsService {
  calculateCategoryAnalytics(transactions: Transaction[]): CategoryAnalytics
  calculateTrendAnalytics(transactions: Transaction[], groupBy: 'day' | 'week' | 'month'): TrendData[]
  calculateComparativeAnalytics(transactions: Transaction[], compareBy: 'category' | 'item'): ComparisonData[]
  generateInsights(transactions: Transaction[]): AnalyticsInsight[]
}
```

## Data Models

### Enhanced Transaction Storage

The transaction storage will be enhanced to support categories:

```typescript
// IndexedDB Schema
interface TransactionStore {
  id: string; // Primary key
  date: Date;
  sender: string;
  item: string;
  amount: number;
  categoryId?: string;
  originalText: string;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
- byDate: date
- byCategory: categoryId
- byItem: item
- bySender: sender
- byAmount: amount
```

### Category Storage

```typescript
// IndexedDB Schema
interface CategoryStore {
  id: string; // Primary key
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
- byName: name
- byCreatedAt: createdAt
```

### Filter Preset Storage

```typescript
// LocalStorage Schema
interface FilterPresetStore {
  presets: FilterPreset[];
  lastUsedFilters: FilterState;
}
```

## Error Handling

### Category Management Errors
- **Duplicate Category Names**: Prevent creation, suggest alternatives
- **Category Deletion with Dependencies**: Prompt for reassignment
- **Category Assignment Failures**: Rollback and notify user

### Filter Application Errors
- **Invalid Date Ranges**: Auto-correct or prompt user
- **No Results**: Display helpful message with suggestions
- **Filter Preset Conflicts**: Handle gracefully with fallbacks

### File Upload Errors
- **Duplicate Detection Failures**: Allow manual review
- **Category Auto-assignment Failures**: Fall back to manual assignment
- **Large File Processing**: Implement progress indicators and chunking

## Testing Strategy

### Unit Testing
- **CategoryService**: CRUD operations, auto-suggestions, assignments
- **FilterService**: Filter logic, preset management, URL serialization
- **AnalyticsService**: Calculation accuracy, edge cases
- **Component Logic**: Filter interactions, category assignments

### Integration Testing
- **Filter Flow**: Apply filters → Update all views → Persist state
- **Category Flow**: Create category → Assign to transactions → View analytics
- **Upload Flow**: Upload file → Detect duplicates → Assign categories → Import

### User Acceptance Testing
- **Filtering Workflows**: Multi-dimensional filtering across all views
- **Categorization Workflows**: Category management and assignment
- **Analytics Workflows**: Filtered analytics and insights
- **Export Workflows**: Filtered data export with metadata

## Performance Considerations

### Data Processing
- **Large Transaction Sets**: Implement virtual scrolling for transaction lists
- **Filter Performance**: Use indexed queries and memoization
- **Analytics Calculations**: Cache results and update incrementally

### Memory Management
- **Component State**: Use reactive stores for shared state
- **Data Loading**: Implement lazy loading for large datasets
- **Cache Management**: Implement LRU cache for frequently accessed data

### User Experience
- **Loading States**: Show progress indicators for long operations
- **Debounced Inputs**: Prevent excessive filter updates during typing
- **Optimistic Updates**: Update UI immediately, sync in background

## Security Considerations

### Data Privacy
- **Local Storage**: All sensitive data remains client-side
- **Export Security**: Sanitize exported data filenames and content
- **URL Parameters**: Avoid exposing sensitive filter data in URLs

### Input Validation
- **Category Names**: Sanitize and validate category inputs
- **Filter Values**: Validate date ranges and numeric inputs
- **File Uploads**: Validate file types and content structure

## Migration Strategy

### Existing Data Migration
1. **Transaction Enhancement**: Add categoryId field to existing transactions
2. **Default Categories**: Create "Uncategorized" default category
3. **Auto-categorization**: Run initial categorization based on item patterns

### Backward Compatibility
- **Existing Exports**: Maintain compatibility with current export formats
- **API Compatibility**: Ensure existing transaction operations continue working
- **Storage Migration**: Graceful migration from current storage format

## Deployment Considerations

### Build Process
- **Bundle Size**: Monitor impact of new features on bundle size
- **Code Splitting**: Split category and filter features into separate chunks
- **Asset Optimization**: Optimize new component assets

### Browser Compatibility
- **IndexedDB Support**: Provide fallbacks for older browsers
- **LocalStorage Limits**: Handle storage quota exceeded scenarios
- **Modern JavaScript**: Ensure compatibility with target browser versions