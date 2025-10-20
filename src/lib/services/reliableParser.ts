import type { Transaction, ParseResult, ParseError, ParseSummary } from '../types';
import { generateId } from '../utils/helpers';

export class ReliableParser {
  
  async parseFile(content: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const transactions: Transaction[] = [];
    const errors: ParseError[] = [];
    
    let currentDate: Date | null = null;
    let currentSender = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        // Check for WhatsApp message header
        const messageMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*(am|pm)?\s*-\s*([^:]+):\s*(.+)$/i);
        
        if (messageMatch) {
          const [, dateStr, timeStr, ampm, sender, message] = messageMatch;
          currentDate = this.parseDate(dateStr, timeStr, ampm);
          currentSender = sender.trim().toLowerCase();
          
          if (currentSender === 'monir' && currentDate) {
            const extracted = this.extractAllItems(message);
            for (const item of extracted) {
              transactions.push({
                id: generateId(),
                date: new Date(currentDate),
                sender: 'monir',
                item: item.item,
                amount: item.amount,
                originalMessage: message,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
        } else if (currentSender === 'monir' && currentDate) {
          // Continuation line
          const extracted = this.extractAllItems(line);
          for (const item of extracted) {
            transactions.push({
              id: generateId(),
              date: new Date(currentDate),
              sender: 'monir',
              item: item.item,
              amount: item.amount,
              originalMessage: line,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      } catch (error) {
        errors.push({
          line: i + 1,
          message: error instanceof Error ? error.message : 'Parse error',
          originalText: line
        });
      }
    }
    
    return {
      transactions,
      errors,
      summary: {
        totalLines: lines.length,
        successfulTransactions: transactions.length,
        failedLines: errors.length,
        duplicatesSkipped: 0,
        processingTime: 0
      },
      suspiciousTransactions: []
    };
  }
  
  private extractAllItems(text: string): { item: string; amount: number }[] {
    const items: { item: string; amount: number }[] = [];
    let cleanText = this.convertBengaliText(text);
    
    // Get কেনা amount
    const kenaMatch = cleanText.match(/কেনা\s+(\d+)/);
    const kenaAmount = kenaMatch ? parseFloat(kenaMatch[1]) : 0;
    
    // Get everything after বিবরণ
    const parts = cleanText.split('বিবরণ');
    if (parts.length < 2) return items;
    
    let content = parts[1].split('moriom')[0].trim();
    
    // Remove common words
    content = content.replace(/টাকা|taka/g, '').trim();
    
    const words = content.split(/\s+/);
    const foundItems: string[] = [];
    const foundAmounts: number[] = [];
    
    // Extract all items and amounts separately
    for (const word of words) {
      const clean = word.replace(/[^a-zA-Z\u0980-\u09FF\d]/g, '');
      
      if (/^\d+$/.test(clean)) {
        const num = parseFloat(clean);
        if (num > 0 && num <= 5000) {
          foundAmounts.push(num);
        }
      } else if (clean.length > 1 && this.isValidItem(clean)) {
        foundItems.push(this.standardizeItem(clean));
      }
      
      // Check for attached numbers
      const match = clean.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/);
      if (match) {
        const itemPart = match[1];
        const numPart = parseFloat(match[2]);
        if (this.isValidItem(itemPart) && numPart > 0 && numPart <= 5000) {
          foundItems.push(this.standardizeItem(itemPart));
          foundAmounts.push(numPart);
        }
      }
    }
    
    // Match items with amounts
    if (foundItems.length === 1 && foundAmounts.length === 0 && kenaAmount > 0) {
      // Single item, use কেনা amount
      items.push({ item: foundItems[0], amount: kenaAmount });
    } else if (foundItems.length === foundAmounts.length) {
      // Equal items and amounts, pair them
      for (let i = 0; i < foundItems.length; i++) {
        items.push({ item: foundItems[i], amount: foundAmounts[i] });
      }
    } else {
      // Try to match by position
      const maxLen = Math.min(foundItems.length, foundAmounts.length);
      for (let i = 0; i < maxLen; i++) {
        items.push({ item: foundItems[i], amount: foundAmounts[i] });
      }
    }
    
    return items;
  }
  
  private convertBengaliText(text: string): string {
    // Bengali numerals to Western
    const numerals: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    
    // Bengali number words to digits
    const numberWords: Record<string, string> = {
      'পঞ্চাশ': '50', 'ষাট': '60', 'সত্তর': '70', 'আশি': '80', 'নব্বই': '90',
      'একশ': '100', 'দুইশ': '200', 'তিনশ': '300', 'চারশ': '400', 'পাঁচশ': '500'
    };
    
    let result = text;
    
    // Replace numerals
    for (const [bengali, western] of Object.entries(numerals)) {
      result = result.replace(new RegExp(bengali, 'g'), western);
    }
    
    // Replace number words
    for (const [bengali, number] of Object.entries(numberWords)) {
      result = result.replace(new RegExp(bengali, 'g'), number);
    }
    
    return result;
  }
  
  private isValidItem(word: string): boolean {
    const cleanWord = word.replace(/[^a-zA-Z\u0980-\u09FF]/g, '');
    return cleanWord.length > 0 && !/^\d+$/.test(cleanWord);
  }
  
  private standardizeItem(item: string): string {
    const map: Record<string, string> = {
      'ডিম': 'eggs', 'দুধ': 'milk', 'আটা': 'flour', 'রোটি': 'bread',
      'চাল': 'rice', 'আলো': 'potato', 'আদা': 'ginger', 'পিঁয়াজ': 'onion',
      'রসুন': 'garlic', 'মরিচ': 'chili', 'বিস্কুট': 'biscuit', 'চিপস': 'chips',
      'টিস্যু': 'tissue', 'মিল্ক': 'milk', 'রিমুভার': 'remover', 'নিমকি': 'nimki',
      'ফ্রিডম': 'freedom', 'কোক': 'coke', 'ফান্তা': 'fanta', 'দই': 'yogurt',
      'tel': 'oil', 'dim': 'eggs', 'milk': 'milk', 'ata': 'flour', 'chal': 'rice',
      'alo': 'potato', 'ada': 'ginger', 'piaz': 'onion', 'rosun': 'garlic',
      'chips': 'chips', 'tissue': 'tissue', 'biscuit': 'biscuit', 'bread': 'bread',
      'coke': 'coke', 'fanta': 'fanta', 'doi': 'yogurt', 'freedom': 'freedom',
      'koyel': 'koyel', 'koyel60': 'koyel', 'rc': 'rc cola', 'paste': 'toothpaste',
      'shampoo': 'shampoo', 'saban': 'soap', 'pani': 'water'
    };
    
    const clean = item.toLowerCase().replace(/[^a-zA-Z\u0980-\u09FF]/g, '');
    return map[clean] || clean;
  }
  
  private parseDate(dateStr: string, timeStr: string, ampm?: string): Date | null {
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      let adjustedHours = hours;
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hours !== 12) {
          adjustedHours += 12;
        } else if (ampm.toLowerCase() === 'am' && hours === 12) {
          adjustedHours = 0;
        }
      }
      
      return new Date(fullYear, month - 1, day, adjustedHours, minutes);
    } catch {
      return null;
    }
  }
}