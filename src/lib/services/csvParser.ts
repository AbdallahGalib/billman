import type { Transaction } from '../types';
import { generateId } from '../utils/helpers';

export class CSVParser {
  
  parseCSV(csvContent: string): Transaction[] {
    const lines = csvContent.split('\n');
    const transactions: Transaction[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [dateStr, item, amountStr] = line.split(',');
      
      if (dateStr && item && amountStr) {
        const date = this.parseDate(dateStr);
        const amount = parseFloat(amountStr);
        
        if (date && amount > 0) {
          transactions.push({
            id: generateId(),
            date,
            sender: 'monir',
            item: item.trim(),
            amount,
            originalMessage: line,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }
    
    return transactions;
  }
  
  private parseDate(dateStr: string): Date | null {
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month - 1, day);
    } catch {
      return null;
    }
  }
}