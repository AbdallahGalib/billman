import type { ValidationSchema, ValidationResult, Transaction } from '../types';

// Transaction validation schema
export const transactionSchema: ValidationSchema = {
  date: {
    required: true,
    custom: (value: any) => {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return 'Invalid date format';
      }
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      if (value < oneYearAgo || value > oneYearFromNow) {
        return 'Date must be within the last year or next year';
      }
      return true;
    }
  },
  sender: {
    required: true,
    min: 1,
    max: 100,
    pattern: /^[a-zA-Z\s\u0980-\u09FF]+$/,
    custom: (value: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'Sender name is required';
      }
      return true;
    }
  },
  item: {
    required: true,
    min: 1,
    max: 200,
    custom: (value: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'Item name is required';
      }
      return true;
    }
  },
  amount: {
    required: true,
    min: 0.01,
    max: 999999.99,
    custom: (value: any) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Amount must be a positive number';
      }
      if (num > 999999.99) {
        return 'Amount cannot exceed 999,999.99';
      }
      return true;
    }
  }
};

// File validation schema
export const fileSchema: ValidationSchema = {
  type: {
    required: true,
    custom: (value: string) => {
      const allowedTypes = ['text/plain', 'application/txt'];
      if (!allowedTypes.includes(value)) {
        return 'Only .txt files are allowed';
      }
      return true;
    }
  },
  size: {
    required: true,
    max: 50 * 1024 * 1024, // 50MB
    custom: (value: number) => {
      if (value > 50 * 1024 * 1024) {
        return 'File size cannot exceed 50MB';
      }
      return true;
    }
  }
};

// Filter validation schema
export const filterSchema: ValidationSchema = {
  dateRange: {
    custom: (value: any) => {
      if (value && value.start && value.end) {
        if (value.start > value.end) {
          return 'Start date must be before end date';
        }
      }
      return true;
    }
  },
  amountRange: {
    custom: (value: any) => {
      if (value && typeof value.min === 'number' && typeof value.max === 'number') {
        if (value.min < 0) {
          return 'Minimum amount cannot be negative';
        }
        if (value.min > value.max) {
          return 'Minimum amount must be less than maximum amount';
        }
      }
      return true;
    }
  }
};

// Validation utility functions
export function validateField(value: any, rules: ValidationSchema[string]): string | null {
  if (!rules) return null;

  // Required validation
  if (rules.required && (value === null || value === undefined || value === '')) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!rules.required && (value === null || value === undefined || value === '')) {
    return null;
  }

  // String length validation
  if (typeof value === 'string') {
    if (rules.min && value.length < rules.min) {
      return `Minimum length is ${rules.min} characters`;
    }
    if (rules.max && value.length > rules.max) {
      return `Maximum length is ${rules.max} characters`;
    }
  }

  // Number range validation
  if (typeof value === 'number') {
    if (rules.min && value < rules.min) {
      return `Minimum value is ${rules.min}`;
    }
    if (rules.max && value > rules.max) {
      return `Maximum value is ${rules.max}`;
    }
  }

  // Pattern validation
  if (rules.pattern && typeof value === 'string') {
    if (!rules.pattern.test(value)) {
      return 'Invalid format';
    }
  }

  // Custom validation
  if (rules.custom) {
    const result = rules.custom(value);
    if (result !== true) {
      return typeof result === 'string' ? result : 'Invalid value';
    }
  }

  return null;
}

export function validateObject(obj: any, schema: ValidationSchema): ValidationResult {
  const errors: { [key: string]: string } = {};
  let isValid = true;

  for (const [field, rules] of Object.entries(schema)) {
    const error = validateField(obj[field], rules);
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

export function validateTransaction(transaction: Partial<Transaction>): ValidationResult {
  return validateObject(transaction, transactionSchema);
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

export function normalizeAmount(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  
  // Remove currency symbols, spaces, and commas (for numbers like 8,064)
  const cleaned = amount.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimal places
}

export function normalizeItemName(item: string): string {
  let normalized = item
    .trim()
    .toLowerCase()
    // Remove payment descriptions like "বিবরণ nogod", "064 biboron", etc.
    .replace(/পূর্বের বাকি/gi, '')
    .replace(/বর্তমান বাকি/gi, '')
    .replace(/০৬৪\s*বিবরণ/gi, '')
    .replace(/064\s*biboron/gi, '')
    .replace(/বিবরণ\s*nogod/gi, '')
    .replace(/বিবরণ\s*[a-z]+/gi, '')
    .replace(/বিবরণ/gi, '')
    .replace(/biboron/gi, '')
    .replace(/nogod/gi, '')
    // Remove leading numbers and codes (like "464 coke" -> "coke")
    .replace(/^\d+\s+/g, '')
    .replace(/^[a-z]*\d+[a-z]*\s+/gi, '')
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\u0980-\u09FF-]/g, '') // Keep only alphanumeric, spaces, and Bengali characters
    .substring(0, 200) // Limit length
    .trim(); // Remove leading/trailing spaces after cleanup
  
  // Additional cleanup for common patterns
  normalized = normalized
    .replace(/^(কেনা|kena|buy|bought)\s+/gi, '') // Remove "bought" prefixes
    .replace(/\s+(টাকা|taka|tk)$/gi, '') // Remove currency suffixes
    .trim();
  
  return normalized;
}

export function normalizeSenderName(sender: string): string {
  return sender
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\u0980-\u09FF]/g, '') // Keep only alphanumeric, spaces, and Bengali characters
    .substring(0, 100); // Limit length
}