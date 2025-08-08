// Core data models and interfaces

export interface Transaction {
  id: string;
  date: Date;
  sender: string;
  item: string;
  amount: number;
  originalMessage?: string;
  flags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsData {
  itemDistribution: ItemCount[];
  monthlySpending: MonthlyTotal[];
  totalTransactions: number;
  totalAmount: number;
  averageTransaction: number;
}

export interface ItemCount {
  item: string;
  count: number;
  totalAmount: number;
}

export interface MonthlyTotal {
  month: string;
  year: number;
  total: number;
  transactionCount: number;
}

export interface ParseResult {
  transactions: Transaction[];
  errors: ParseError[];
  summary: ParseSummary;
}

export interface ParseError {
  line: number;
  message: string;
  originalText: string;
}

export interface ParseSummary {
  totalLines: number;
  successfulTransactions: number;
  failedLines: number;
  duplicatesSkipped: number;
  processingTime: number;
}

export interface FilterConfig {
  dateRange?: DateRange;
  sender?: string;
  itemSearch?: string;
  amountRange?: AmountRange;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AmountRange {
  min: number;
  max: number;
}

export interface SortConfig {
  field: keyof Transaction;
  direction: 'asc' | 'desc';
}

export interface CellReference {
  id: string;
  field: keyof Transaction;
}

export interface ParseConfig {
  messagePattern: RegExp;
  transactionPatterns: RegExp[];
  dateFormat: string;
  currencySymbol?: string;
  itemMap?: Record<string, string>;
  senderFilter?: string;
  performanceTarget?: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins?: {
    legend?: {
      display: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    tooltip?: {
      enabled: boolean;
      callbacks?: any;
    };
  };
  scales?: any;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface NetworkError extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;
}

export interface ValidationError extends Error {
  field?: string;
  value?: any;
}

export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
}

export interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retryCount: number;
}

export interface UserPreferences {
  theme: string;
  dateFormat: string;
  currencySymbol: string;
  itemsPerPage: number;
  autoSync: boolean;
  offlineMode: boolean;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  dateRange?: DateRange;
  includeMetadata: boolean;
  filename?: string;
}

// Utility types
export type TransactionField = keyof Transaction;
export type SortDirection = 'asc' | 'desc';
export type ChartType = 'pie' | 'bar' | 'line' | 'doughnut';
export type OperationType = 'create' | 'update' | 'delete' | 'sync';
export type ConnectionStatus = 'online' | 'offline' | 'syncing';

// Form validation types
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Event types for component communication
export interface TransactionEvent {
  type: 'create' | 'update' | 'delete';
  transaction: Transaction;
  timestamp: Date;
}

export interface FileUploadEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  error?: string;
  result?: {
    content: string;
    filename: string;
    size: number;
  };
}

export interface SyncEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  error?: string;
  result?: SyncResult;
}

// Billing structure types
export interface BillItem {
  item: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DayBill {
  date: Date;
  items: BillItem[];
  totalAmount: number;
}

export interface MonthBill {
  month: string;
  year: number;
  startDate: Date; // 15th of previous month
  endDate: Date;   // 14th of current month
  days: DayBill[];
  totalAmount: number;
  itemSummary: BillItem[]; // Combined items for the month
}

export interface BillingPeriod {
  startDate: Date;
  endDate: Date;
  type: 'month' | 'custom';
}

export interface BillingSummary {
  period: BillingPeriod;
  monthlyBills: MonthBill[];
  dailyBills: DayBill[];
  grandTotal: number;
}