// Utility helper functions

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date: Date, format: string = 'DD/MM/YYYY'): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY HH:mm':
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    default:
      return date.toLocaleDateString();
  }
}

export function formatCurrency(amount: number, symbol: string = '৳'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

export function getDateRange(period: 'week' | 'month' | 'year' | 'all'): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;

  switch (period) {
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      start = new Date(2020, 0, 1); // Arbitrary old date
      break;
  }

  return { start, end };
}

export function groupBy<T, K extends keyof any>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = key(item);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

export function sortBy<T>(
  array: T[],
  key: keyof T | ((item: T) => any),
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  const getValue = typeof key === 'function' ? key : (item: T) => item[key];
  
  return [...array].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function filterBy<T>(
  array: T[],
  filters: Partial<Record<keyof T, any>>
): T[] {
  return array.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      
      const itemValue = item[key as keyof T];
      
      if (typeof value === 'string' && typeof itemValue === 'string') {
        return itemValue.toLowerCase().includes(value.toLowerCase());
      }
      
      return itemValue === value;
    });
  });
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100; // Round to 2 decimal places
}

export function getMonthName(monthIndex: number): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[monthIndex] || '';
}

// Helper function to determine which 15th-to-15th period a transaction belongs to
export function getMonthPeriodFor15thCycle(transactionDate: Date): {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
} {
  const day = transactionDate.getDate();
  const month = transactionDate.getMonth();
  const year = transactionDate.getFullYear();

  if (day >= 15) {
    // Transaction is in the period starting from 15th of this month
    // Period ends on 14th of next month, so we label it as next month
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
    
    return {
      year: nextYear,
      month: adjustedMonth + 1, // 1-based month
      startDate: new Date(year, month, 15),
      endDate: new Date(nextYear, adjustedMonth, 14)
    };
  } else {
    // Transaction is in the period that started from 15th of previous month
    // Period ends on 14th of current month, so we label it as current month
    return {
      year: year,
      month: month + 1, // 1-based month
      startDate: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 15),
      endDate: new Date(year, month, 14)
    };
  }
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'utf-8');
  });
}

export function getFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function getStorageUsage(): Promise<{ used: number; available: number; percentage: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return navigator.storage.estimate().then(estimate => ({
      used: estimate.usage || 0,
      available: estimate.quota || 0,
      percentage: estimate.quota ? Math.round((estimate.usage || 0) / estimate.quota * 100) : 0
    }));
  }
  
  // Fallback for browsers that don't support storage estimation
  return Promise.resolve({ used: 0, available: 0, percentage: 0 });
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        resolve();
      } catch (error) {
        textArea.remove();
        reject(error);
      }
    });
  }
}

export function generateColors(count: number): string[] {
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
  ];
  
  if (count <= colors.length) {
    return colors.slice(0, count);
  }
  
  // Generate additional colors if needed
  const additionalColors = [];
  for (let i = colors.length; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation
    additionalColors.push(`hsl(${hue}, 70%, 60%)`);
  }
  
  return [...colors, ...additionalColors];
}

// Period filtering utility
export function filterTransactionsByPeriod<T extends { date: Date }>(
  transactions: T[],
  startMonth?: string,
  endMonth?: string
): T[] {
  if (!startMonth && !endMonth) {
    return transactions;
  }

  return transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
    const transactionYear = transactionDate.getFullYear();
    const transactionMonth = transactionDate.getMonth() + 1; // 0-based to 1-based
    const transactionYearMonth = `${transactionYear}-${String(transactionMonth).padStart(2, '0')}`;

    let includeTransaction = true;

    if (startMonth) {
      includeTransaction = includeTransaction && transactionYearMonth >= startMonth;
    }

    if (endMonth) {
      includeTransaction = includeTransaction && transactionYearMonth <= endMonth;
    }

    return includeTransaction;
  });
}

// Get month-year string from date
export function getMonthYearString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Parse month-year string to date (first day of month)
export function parseMonthYearString(monthYear: string): Date {
  const [year, month] = monthYear.split('-').map(Number);
  return new Date(year, month - 1, 1);
}