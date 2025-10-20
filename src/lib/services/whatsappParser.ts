import type {
  Transaction,
  ParseResult,
  ParseError,
  ParseSummary,
  ParseConfig
} from '../types';
import { validateTransaction, normalizeAmount, normalizeItemName, normalizeSenderName } from '../validation/schemas';
import { generateId } from '../utils/helpers';

export class WhatsAppParser {
  private config: ParseConfig;

  constructor(config?: Partial<ParseConfig>) {
    this.config = {
      // WhatsApp message format: DD/MM/YYYY, HH:MM [am/pm] - Sender: Message
      messagePattern: /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*(am|pm)?\s*-\s*([^:]+):\s*(.+)$/i,
      transactionPatterns: [
        // Main pattern: "item amount" (e.g., "milk 100", "alo 140", "tel173")
        /^([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]*?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/gm
      ],
      dateFormat: 'DD/MM/YYYY',
      currencySymbol: '৳',
      ...config
    };
  }

  async parseFile(content: string): Promise<ParseResult> {
    const startTime = performance.now();
    const errors: ParseError[] = [];
    const suspiciousTransactions: SuspiciousTransaction[] = [];

    // Step 1: Pre-parsing - Remove "বিবরণ" prefixes but preserve WhatsApp message format
    const lines = content.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
        .replace(/বিবরণ\s+/gi, '') // Remove "বিবরণ" prefix
        .trim();

      if (line) {
        processedLines.push(line);
      }
    }

    // Step 2: Parse with enhanced filtering and validation
    const allTransactions = this.enhancedContextBasedParsing(processedLines, errors);
    const suspicious: SuspiciousTransaction[] = [];

    // Step 3: Group similar items using context-based categorizing
    const groupedTransactions = this.contextBasedCategorizing(allTransactions);

    // Step 4: Remove duplicates to prevent inflated counts
    const uniqueTransactions = this.removeDuplicates(groupedTransactions);
    const duplicatesSkipped = groupedTransactions.length - uniqueTransactions.length;

    const processingTime = performance.now() - startTime;

    const summary: ParseSummary = {
      totalLines: lines.length,
      successfulTransactions: uniqueTransactions.length,
      failedLines: errors.length,
      duplicatesSkipped,
      processingTime
    };

    console.log('🎯 FINAL PARSING RESULTS:');
    console.log(`  📊 Total lines: ${lines.length}`);
    console.log(`  ✅ Successful transactions: ${uniqueTransactions.length}`);
    console.log(`  🚨 Suspicious transactions: ${suspiciousTransactions.length}`);
    console.log(`  ❌ Failed lines: ${errors.length}`);

    return {
      transactions: uniqueTransactions,
      errors,
      summary,
      suspiciousTransactions
    };
  }

  private enhancedContextBasedParsing(lines: string[], errors: ParseError[]): Transaction[] {
    const transactions: Transaction[] = [];
    let currentDate: Date | null = null;
    let currentSender = '';

    console.log('🔍 Enhanced parsing started');
    console.log(`📊 Total lines to process: ${lines.length}`);
    console.log(`🎯 Message pattern: ${this.config.messagePattern}`);

    let messageHeaderCount = 0;
    let monirMessageCount = 0;
    let continuationLineCount = 0;
    let skippedLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skippedLineCount++;
        continue;
      }

      try {
        // Check if this is a message header
        const messageMatch = line.match(this.config.messagePattern);
        if (messageMatch) {
          messageHeaderCount++;
          const [, dateStr, timeStr, ampm, sender, message] = messageMatch;

          console.log(`📅 Line ${i + 1}: Found message header`);
          console.log(`  📅 Date: ${dateStr}, Time: ${timeStr} ${ampm || ''}`);
          console.log(`  👤 Sender: "${sender}"`);
          console.log(`  💬 Message: "${message}"`);

          currentDate = this.parseDate(dateStr, timeStr, ampm);
          currentSender = normalizeSenderName(sender);

          console.log(`  ✅ Parsed date: ${currentDate}`);
          console.log(`  ✅ Normalized sender: "${currentSender}"`);
          console.log(`  🔧 Setting context - Date: ${currentDate}, Sender: ${currentSender}`);

          // Process the message part only for Monir with valid date (case insensitive)
          if (currentDate && currentSender.toLowerCase() === 'monir') {
            console.log(`  🎯 Processing message from ${currentSender}: "${message}"`);
            const result = this.validateAndExtractTransactions(message, currentSender, currentDate, i + 1);
            console.log(`  📦 Extracted ${result.transactions.length} transactions from message`);
            transactions.push(...result.transactions);
            monirMessageCount++;
          } else if (currentDate && currentSender.toLowerCase() !== 'monir') {
            console.log(`  ⏭️ Skipping message from ${currentSender} (only processing Monir)`);
          } else {
            console.log(`  ⏭️ Skipping message with invalid date`);
          }
        } else {
          // This is a continuation line or standalone line
          continuationLineCount++;
          console.log(`📝 Line ${i + 1}: Processing line: "${line}"`);

          // Check if this line contains a date pattern (like "৪ আগস্ট ২০২৫")
          const dateOnlyMatch = line.match(/^(\d{1,2})\s+([\u0980-\u09FF]+)\s+(\d{4})/);
          if (dateOnlyMatch) {
            // This is a date line, update current date but don't create transactions
            const [, day, month, year] = dateOnlyMatch;
            console.log(`  📅 Found date line: ${day} ${month} ${year}`);

            // Try to parse this as a date and update currentDate
            const parsedDate = this.parseDateFromComponents(day, month, year);
            if (parsedDate) {
              currentDate = parsedDate;
              console.log(`  📅 Updated current date to: ${currentDate}`);
            }
            continue; // Skip processing this as a transaction
          }

          // Use the most recent valid context from previous message header
          const useSender = currentSender || 'unknown';
          const useDate = currentDate || new Date();

          console.log(`  📅 Using date: ${useDate}, sender: ${useSender}`);

          // Only process continuation lines if the current sender is Monir (case insensitive)
          if (useSender.toLowerCase() === 'monir') {
            const result = this.validateAndExtractTransactions(line, useSender, useDate, i + 1);
            console.log(`  📦 Extracted ${result.transactions.length} transactions from line`);
            transactions.push(...result.transactions);
          } else {
            console.log(`  ⏭️ Skipping continuation line from ${useSender} (only processing Monir)`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing line ${i + 1}: ${error}`);
        errors.push({
          line: i + 1,
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          originalText: line
        });
      }
    }

    // Count transactions by sender
    const senderCounts = transactions.reduce((acc, t) => {
      acc[t.sender] = (acc[t.sender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Parsing Summary:');
    console.log(`  📨 Message headers found: ${messageHeaderCount}`);
    console.log(`  👤 Transactions by sender:`, senderCounts);
    console.log(`  📝 Continuation lines processed: ${continuationLineCount}`);
    console.log(`  ⏭️ Lines skipped: ${skippedLineCount}`);
    console.log(`  📦 Total transactions extracted: ${transactions.length}`);
    console.log(`  ❌ Errors encountered: ${errors.length}`);

    return transactions;
  }

  private validateAndExtractTransactions(text: string, sender: string, date: Date, lineNumber: number): { transactions: Transaction[]; suspicious: SuspiciousTransaction[] } {
    const transactions: Transaction[] = [];
    const suspicious: SuspiciousTransaction[] = [];

    // Convert Bengali numerals first
    const convertedText = this.convertBengaliNumerals(text);

    // Check for "কেনা" (bought) pattern with Bengali or English numbers
    const kenaMatch = convertedText.match(/কেনা\s+(\d+)/i);
    if (kenaMatch) {
      const totalAmount = parseFloat(kenaMatch[1]);
      
      // Create a single transaction with the total "কেনা" amount
      // Extract item description from "বিবরণ" section if available
      const descriptionMatch = convertedText.match(/বিবরণ\s+(.+?)(?=\s*moriom|$)/i);
      const itemDescription = descriptionMatch ? descriptionMatch[1].trim() : 'purchase';
      
      transactions.push({
        id: generateId(),
        date: new Date(date),
        sender,
        item: itemDescription,
        amount: totalAmount,
        originalMessage: text,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { transactions, suspicious };
    }

    // Fallback to original parsing if no "কেনা" pattern found
    const pairs = this.findSimpleItemAmountPairs(convertedText);
    const actualTotal = pairs.reduce((sum, pair) => sum + pair.amount, 0);

    // Find items without amounts
    const itemsWithoutAmounts = this.findItemsWithoutAmounts(convertedText, pairs);

    // Handle transactions without amounts
    if (pairs.length === 0 && itemsWithoutAmounts.length === 0) {
      const itemOnlyMatch = convertedText.match(/বিবরণ\s+([a-zA-Z\u0980-\u09FF]+)\s*$/i);
      if (itemOnlyMatch) {
        const item = itemOnlyMatch[1].trim();
        if (this.isValidItem(item)) {
          suspicious.push({
            id: generateId(),
            date: new Date(date),
            sender,
            originalMessage: text,
            reason: 'no_amount',
            extractedItems: [{ item: this.standardizeTerminology(item) }]
          });
        }
      }
    }

    if (itemsWithoutAmounts.length > 0) {
      suspicious.push({
        id: generateId(),
        date: new Date(date),
        sender,
        originalMessage: text,
        reason: 'missing_items',
        extractedItems: [...pairs.map(p => ({ item: p.item, amount: p.amount })), ...itemsWithoutAmounts]
      });
    }

    // Create transactions for valid pairs
    for (const pair of pairs) {
      if (pair.amount > 0 && this.isValidItem(pair.item)) {
        transactions.push({
          id: generateId(),
          date: new Date(date),
          sender,
          item: pair.item,
          amount: pair.amount,
          originalMessage: text,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return { transactions, suspicious };
  }

  private findItemsWithoutAmounts(text: string, existingPairs: { item: string; amount: number }[]): { item: string }[] {
    const itemsWithoutAmounts: { item: string }[] = [];
    const existingItems = new Set(existingPairs.map(p => p.item.toLowerCase()));

    // Find standalone items (words that look like items but have no associated number)
    const words = text.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z\u0980-\u09FF]/g, '');
      if (cleanWord.length > 2 && 
          this.isValidItem(cleanWord) && 
          !existingItems.has(cleanWord.toLowerCase()) &&
          !/\d/.test(word)) {
        itemsWithoutAmounts.push({ item: cleanWord });
      }
    }

    return itemsWithoutAmounts;
  }

  private contextBasedParsing(content: string): Transaction[] {
    const transactions: Transaction[] = [];
    const lines = content.split('\n');
    let currentDate: Date | null = null;
    let currentSender = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if this is a message header
      const messageMatch = trimmedLine.match(this.config.messagePattern);
      if (messageMatch) {
        const [, dateStr, timeStr, ampm, sender, message] = messageMatch;
        currentDate = this.parseDate(dateStr, timeStr, ampm);
        currentSender = normalizeSenderName(sender);

        // Process the message part immediately
        if (currentSender === 'monir' && currentDate) {
          const lineTransactions = this.extractFromText(message, currentSender, currentDate);
          transactions.push(...lineTransactions);
        }
      } else {
        // This is a continuation line - process if we have a valid Monir context
        if (currentSender === 'monir' && currentDate) {
          const lineTransactions = this.extractFromText(trimmedLine, currentSender, currentDate);
          transactions.push(...lineTransactions);
        }
      }
    }

    return transactions;
  }

  private extractFromTextEnhanced(text: string, sender: string, date: Date, lineNumber: number): Transaction[] {
    const transactions: Transaction[] = [];

    console.log(`    🔍 Extracting from text (Line ${lineNumber}): "${text}"`);

    // Apply the two simple rules:
    // 1. Remove "বিবরণ" prefix
    // 2. Clean out all commas and periods from transaction text
    let cleanedText = text
      .replace(/বিবরণ\s+/gi, '') // Remove "বিবরণ" prefix
      .replace(/[,\.]/g, ''); // Remove commas and periods from transaction text

    console.log(`    🧹 Cleaned text: "${cleanedText}"`);

    // Find all potential item-amount pairs using simple strategy
    const pairs = this.findSimpleItemAmountPairs(cleanedText);

    console.log(`    📦 Found ${pairs.length} potential pairs:`, pairs);

    for (const pair of pairs) {
      if (pair.amount > 0 && pair.item.length > 0 && this.isValidItem(pair.item)) {
        console.log(`    ✨ Creating transaction: "${pair.item}" (${pair.amount})`);

        const transaction: Transaction = {
          id: generateId(),
          date: new Date(date),
          sender,
          item: pair.item,
          amount: pair.amount,
          originalMessage: text,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        transactions.push(transaction);
      } else {
        console.log(`    ❌ Skipping invalid transaction: "${pair.item}" (${pair.amount}) - reason: ${!this.isValidItem(pair.item) ? 'invalid item' : pair.amount <= 0 ? 'invalid amount' : 'empty item'}`);
      }
    }

    console.log(`    📊 Final transactions from this text: ${transactions.length}`);
    return transactions;
  }

  private extractFromText(text: string, sender: string, date: Date): Transaction[] {
    const transactions: Transaction[] = [];

    // Skip obvious non-transaction text
    if (this.isSystemText(text)) {
      return transactions;
    }

    // Find all potential item-amount pairs using multiple strategies
    const pairs = this.findItemAmountPairs(text);

    for (const pair of pairs) {
      if (pair.amount > 0 && pair.item.length > 0 && this.isValidItem(pair.item)) {
        const transaction: Transaction = {
          id: generateId(),
          date: new Date(date),
          sender,
          item: pair.item,
          amount: pair.amount,
          originalMessage: text,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private findItemAmountPairs(text: string): { item: string; amount: number }[] {
    const pairs: { item: string; amount: number }[] = [];

    // Strategy 1: Standard "item amount" pattern (most flexible)
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      // Check if current word is text and next word is number
      if (/^[a-zA-Z\u0980-\u09FF]/.test(currentWord) && /^\d+(\.\d+)?$/.test(nextWord)) {
        const item = normalizeItemName(currentWord);
        const amount = parseFloat(nextWord);
        if (amount > 0 && item.length > 0) {
          pairs.push({ item, amount });
        }
      }
    }

    // Strategy 2: Numbers attached to words (like "tel173", "rc40", "coff215")
    const attachedMatches = text.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/g);
    if (attachedMatches) {
      for (const match of attachedMatches) {
        const result = match.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1]);
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    // Strategy 3: Multi-word items followed by numbers
    const multiWordMatches = text.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]{1,20}?)\s+(\d+(?:\.\d{1,2})?)/g);
    if (multiWordMatches) {
      for (const match of multiWordMatches) {
        const parts = match.trim().split(/\s+/);
        const amount = parseFloat(parts[parts.length - 1]);
        const item = parts.slice(0, -1).join(' ');
        if (amount > 0 && item.length > 1) {
          pairs.push({ item: normalizeItemName(item), amount });
        }
      }
    }

    // Strategy 4: Bengali text with numbers (any format)
    const bengaliMatches = text.match(/([\u0980-\u09FF]+)\s*(\d+)/g);
    if (bengaliMatches) {
      for (const match of bengaliMatches) {
        const result = match.match(/([\u0980-\u09FF]+)\s*(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1]);
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    // Strategy 5: Context-based extraction - look for any number after text
    const contextMatches = text.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]*?)[\s]*(\d+)/g);
    if (contextMatches) {
      for (const match of contextMatches) {
        const result = match.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]*?)[\s]*(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1].trim());
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0 && !this.isSystemWord(item)) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    return pairs;
  }

  private isSystemWord(word: string): boolean {
    const systemWords = [
      'total', 'null', 'pm', 'am', 'deleted', 'message', 'media', 'omitted',
      'encrypted', 'calls', 'messages', 'dukan', 'number'
    ];
    return systemWords.includes(word.toLowerCase());
  }

  private isSystemText(text: string): boolean {
    // Only filter out very obvious system messages
    const systemPatterns = [
      /^null$/i,
      /^total\s+\d+$/i,
      /^\+?\d{10,}$/,  // Long phone numbers only
      /messages and calls are end-to-end encrypted/i,
      /media omitted/i,
      /this message was deleted/i,
      /^👍+$/,  // Only emoji-only messages
      /^\d+\s*$/,  // Only standalone numbers
    ];

    // Don't filter out if it contains potential transactions
    if (/[a-zA-Z\u0980-\u09FF]\s*\d+/.test(text)) {
      console.log(`      ✅ Contains potential transaction pattern: "${text}"`);
      return false;
    }

    for (const pattern of systemPatterns) {
      if (pattern.test(text)) {
        console.log(`      🚫 System text detected (${pattern}): "${text}"`);
        return true;
      }
    }

    return false;
  }

  private parseDate(dateStr: string, timeStr: string, ampm?: string): Date | null {
    try {
      // Parse date (DD/MM/YYYY or DD/MM/YY)
      const [day, month, year] = dateStr.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;

      // Parse time
      const [hours, minutes] = timeStr.split(':').map(Number);
      let adjustedHours = hours;

      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hours !== 12) {
          adjustedHours += 12;
        } else if (ampm.toLowerCase() === 'am' && hours === 12) {
          adjustedHours = 0;
        }
      }

      const date = new Date(fullYear, month - 1, day, adjustedHours, minutes);

      // Validate the date
      if (isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch {
      return null;
    }
  }



  private contextBasedCategorizing(transactions: Transaction[]): Transaction[] {
    // Step 1: Group items by exact similarity
    const exactGroups = new Map<string, Transaction[]>();

    for (const transaction of transactions) {
      const normalizedItem = this.getNormalizedItemKey(transaction.item);
      if (!exactGroups.has(normalizedItem)) {
        exactGroups.set(normalizedItem, []);
      }
      exactGroups.get(normalizedItem)!.push(transaction);
    }

    // Step 2: Merge groups with high similarity (percentage-based)
    const groupKeys = Array.from(exactGroups.keys());
    const mergedGroups = new Map<string, Transaction[]>();
    const processed = new Set<string>();

    for (const key1 of groupKeys) {
      if (processed.has(key1)) continue;

      const mainGroup = exactGroups.get(key1)!;
      const similarGroups = [mainGroup];

      // Find similar groups
      for (const key2 of groupKeys) {
        if (key1 !== key2 && !processed.has(key2)) {
          const similarity = this.calculateSimilarity(key1, key2);
          if (similarity > 0.2) { // 70% similarity threshold
            similarGroups.push(exactGroups.get(key2)!);
            processed.add(key2);
          }
        }
      }

      // Merge all similar groups
      const allTransactions = similarGroups.flat();
      const bestItemName = this.chooseBestItemName(allTransactions.map(t => t.item));

      mergedGroups.set(key1, allTransactions.map(t => ({
        ...t,
        item: bestItemName
      })));

      processed.add(key1);
    }

    return Array.from(mergedGroups.values()).flat();
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation based on common characters
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private getNormalizedItemKey(item: string): string {
    return item
      .toLowerCase()
      .replace(/\d+/g, '') // Remove all numbers
      .replace(/[^\w\s\u0980-\u09FF]/g, '') // Keep only letters and Bengali
      .replace(/\s+/g, '') // Remove spaces
      .trim();
  }

  private chooseBestItemName(itemNames: string[]): string {
    // Count frequency of each name
    const nameCount = new Map<string, number>();
    for (const name of itemNames) {
      nameCount.set(name, (nameCount.get(name) || 0) + 1);
    }

    // Choose the most frequent name, or the shortest clean name
    let bestName = itemNames[0];
    let maxCount = 0;

    for (const [name, count] of nameCount) {
      if (count > maxCount || (count === maxCount && name.length < bestName.length)) {
        bestName = name;
        maxCount = count;
      }
    }

    // Prefer names without leading numbers
    const cleanNames = itemNames.filter(name => !/^\d/.test(name));
    if (cleanNames.length > 0) {
      const cleanNameCount = new Map<string, number>();
      for (const name of cleanNames) {
        cleanNameCount.set(name, (cleanNameCount.get(name) || 0) + 1);
      }

      for (const [name, count] of cleanNameCount) {
        if (count >= maxCount * 0.5) { // If clean name appears at least 50% as much
          bestName = name;
          break;
        }
      }
    }

    return bestName;
  }



  private removeDuplicates(transactions: Transaction[]): Transaction[] {
    const seen = new Set<string>();
    return transactions.filter(transaction => {
      // Create a unique key based on sender, item, amount, and date (within 5 minutes)
      const dateKey = Math.floor(transaction.date.getTime() / (5 * 60 * 1000)); // 5-minute windows
      const key = `${transaction.sender}-${transaction.item}-${transaction.amount}-${dateKey}`;

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Public method to test parsing patterns
  public testPattern(message: string): { item: string; amount: number }[] {
    // Remove commas first
    const cleanedMessage = message.replace(/,/g, '');

    // Use context-based parsing
    const pairs = this.findItemAmountPairs(cleanedMessage);

    return pairs.filter(pair => pair.amount > 0 && pair.item.length > 0);
  }

  // Method to update parsing configuration
  public updateConfig(newConfig: Partial<ParseConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Method to get current configuration
  public getConfig(): ParseConfig {
    return { ...this.config };
  }

  // Helper methods for enhanced parsing
  private hasBanglaNumbers(text: string): boolean {
    // Check for Bangla numerals (০-৯)
    const hasBangla = /[\u09E6-\u09EF]/.test(text);
    if (hasBangla) {
      console.log(`      🔢 Bangla numerals detected in: "${text}"`);
    }
    return hasBangla;
  }

  private hasWesternNumbers(text: string): boolean {
    // Check for Western digits (0-9)
    const hasWestern = /[0-9]/.test(text);
    if (!hasWestern) {
      console.log(`      🔢 No Western digits in: "${text}"`);
    }
    return hasWestern;
  }

  private standardizeTerminology(item: string): string {
    const ITEM_MAP: Record<string, string> = {
      'dudh': 'milk',
      'dhud': 'milk',
      'tedars': 'tissues',
      'dim': 'eggs',
      'moris': 'chillies',
      'tel': 'oil',
      'alo': 'potato',
      'chal': 'rice',
      'ata': 'flour',
      'piaz': 'onion',
      'rosun': 'garlic',
      'ada': 'ginger',
      'holud': 'turmeric',
      'jira': 'cumin',
      'saban': 'soap',
      'vimbar': 'vim',
      'rin': 'rin',
      'rc': 'rc cola',
      'coff': 'coffee',
      'koyel': 'koyel',
      'koyel60': 'koyel',
      'koyle': 'koyel',
      'koyl': 'koyel',
      'tel': 'oil',
      'teel': 'oil',
      'teil': 'oil',
      'chal': 'rice',
      'chaal': 'rice',
      'chall': 'rice',
      'alo': 'potato',
      'aloo': 'potato',
      'aluu': 'potato',
      'dim': 'eggs',
      'deem': 'eggs',
      'dimm': 'eggs',
      'piaz': 'onion',
      'piyaz': 'onion',
      'peaz': 'onion',
      'rosun': 'garlic',
      'roshun': 'garlic',
      'rosoon': 'garlic',
      'saban': 'soap',
      'sabun': 'soap',
      'sabon': 'soap',
      'rc': 'rc cola',
      'arr': 'rc cola',
      'arsi': 'rc cola',
      'majoni': 'mayonnaise',
      'mosla': 'spice',
      'chini': 'sugar',
      'ghee': 'ghee',
      'dal': 'lentils',
      'beson': 'gram flour',
      'semai': 'vermicelli',
      'muri': 'puffed rice',
      'chanachur': 'chanachur',
      'biscuits': 'biscuits',
      'paratha': 'paratha',
      'chapati': 'chapati',
      'noodles': 'noodles',
      'pasta': 'pasta',
      'sauce': 'sauce',
      'kismis': 'raisins',
      'badam': 'almonds',
      'tissue': 'tissue',
      'paste': 'toothpaste',
      'shampoo': 'shampoo',
      'brush': 'brush',
      'razor': 'razor',
      'freedom': 'freedom pad',
      'whisper': 'whisper pad',
      'harpic': 'harpic',
      'lizol': 'lizol',
      'savlon': 'savlon',
      'ponds': 'ponds',
      'lux': 'lux soap',
      'dew': 'dew',
      'sprite': 'sprite',
      'coke': 'coke',
      'pepsi': 'pepsi'
    };

    // Apply case-insensitive mapping
    const lowerItem = item.toLowerCase();
    
    // First check exact match
    if (ITEM_MAP[lowerItem]) {
      return ITEM_MAP[lowerItem];
    }
    
    // Check for typos by removing trailing numbers
    const withoutNumbers = lowerItem.replace(/\d+$/, '');
    if (ITEM_MAP[withoutNumbers]) {
      return ITEM_MAP[withoutNumbers];
    }
    
    // Check for partial matches (typos)
    for (const [key, value] of Object.entries(ITEM_MAP)) {
      if (key.includes(lowerItem) || lowerItem.includes(key)) {
        if (Math.abs(key.length - lowerItem.length) <= 2) {
          return value;
        }
      }
    }
    
    return item;
  }

  private findItemAmountPairsEnhanced(text: string): { item: string; amount: number }[] {
    const pairs: { item: string; amount: number }[] = [];

    console.log(`      🔍 Strategy analysis for: "${text}"`);

    // Strategy 1: Standard "item amount" pattern (most flexible)
    console.log(`      📝 Strategy 1: Standard "item amount" pattern`);
    const words = text.split(/\s+/);
    console.log(`      📝 Words: [${words.join(', ')}]`);

    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      console.log(`      🔍 Checking: "${currentWord}" + "${nextWord}"`);

      // Check if current word is text and next word is number
      if (/^[a-zA-Z\u0980-\u09FF]/.test(currentWord) && /^\d+(\.\d+)?$/.test(nextWord)) {
        const item = normalizeItemName(currentWord);
        const amount = parseFloat(nextWord);
        console.log(`      ✅ Strategy 1 match: "${currentWord}" → "${item}" (${amount})`);
        if (amount > 0 && item.length > 0) {
          pairs.push({ item, amount });
        }
      } else {
        console.log(`      ❌ No match: text=${/^[a-zA-Z\u0980-\u09FF]/.test(currentWord)}, number=${/^\d+(\.\d+)?$/.test(nextWord)}`);
      }
    }

    // Strategy 2: Numbers attached to words (like "tel173", "rc40", "coff215")
    const attachedMatches = text.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/g);
    if (attachedMatches) {
      for (const match of attachedMatches) {
        const result = match.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1]);
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    // Strategy 3: Multi-word items followed by numbers
    const multiWordMatches = text.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]{1,20}?)\s+(\d+(?:\.\d{1,2})?)/g);
    if (multiWordMatches) {
      for (const match of multiWordMatches) {
        const parts = match.trim().split(/\s+/);
        const amount = parseFloat(parts[parts.length - 1]);
        const item = parts.slice(0, -1).join(' ');
        if (amount > 0 && item.length > 1) {
          pairs.push({ item: normalizeItemName(item), amount });
        }
      }
    }

    // Strategy 4: Bengali text with numbers (any format)
    const bengaliMatches = text.match(/([\u0980-\u09FF]+)\s*(\d+)/g);
    if (bengaliMatches) {
      for (const match of bengaliMatches) {
        const result = match.match(/([\u0980-\u09FF]+)\s*(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1]);
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    // Strategy 5: Context-based extraction - look for any number after text
    const contextMatches = text.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]*?)[\s]*(\d+)/g);
    if (contextMatches) {
      for (const match of contextMatches) {
        const result = match.match(/([a-zA-Z\u0980-\u09FF][a-zA-Z\s\u0980-\u09FF]*?)[\s]*(\d+)/);
        if (result) {
          const item = normalizeItemName(result[1].trim());
          const amount = parseFloat(result[2]);
          if (amount > 0 && item.length > 0 && !this.isSystemWord(item)) {
            pairs.push({ item, amount });
          }
        }
      }
    }

    console.log(`      📊 Final pairs extracted: ${pairs.length}`, pairs);
    return pairs;
  }

  private findSimpleItemAmountPairs(text: string): { item: string; amount: number }[] {
    const pairs: { item: string; amount: number }[] = [];

    console.log(`      🔍 Simple extraction for: "${text}"`);

    // Convert Bengali numerals to Western numerals
    const convertedText = this.convertBengaliNumerals(text);
    console.log(`      � Conve:rted numerals: "${convertedText}"`);

    // Strategy 1: Standard "item amount" pattern (including Bengali text)
    const words = convertedText.split(/\s+/);
    console.log(`      📝 Words: [${words.join(', ')}]`);

    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      // Check if current word is text and next word is number
      if (/^[a-zA-Z\u0980-\u09FF]/.test(currentWord) && /^\d+(\.\d+)?$/.test(nextWord)) {
        const rawItem = currentWord.trim();
        const standardizedItem = this.standardizeTerminology(rawItem);
        const amount = parseFloat(nextWord);

        // Skip invalid items (phone numbers, system words) and unrealistic amounts
        if (this.isValidItem(rawItem) && amount > 0 && amount <= 1000) {
          console.log(`      ✅ Found pair: "${rawItem}" → "${standardizedItem}" (${amount})`);
          pairs.push({ item: standardizedItem, amount });
        } else {
          console.log(`      ❌ Skipped invalid: "${item}" (${amount}) - reason: ${!this.isValidItem(item) ? 'invalid item' : amount <= 0 ? 'invalid amount' : 'amount too high'}`);
        }
      }
    }

    // Strategy 2: Numbers attached to words (like "tel173", "rc40")
    const attachedMatches = convertedText.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/g);
    if (attachedMatches) {
      for (const match of attachedMatches) {
        const result = match.match(/([a-zA-Z\u0980-\u09FF]+)(\d+)/);
        if (result) {
          const rawItem = result[1].trim();
          const attachedNumber = parseFloat(result[2]);
          
          // Check if this looks like a typo (item name + number that's not a price)
          const standardizedItem = this.standardizeTerminology(rawItem + result[2]);
          const isTypo = standardizedItem !== (rawItem + result[2]);
          
          if (isTypo) {
            // This is a typo, use the corrected item name but look for actual price
            console.log(`      🔧 Typo detected: "${rawItem + result[2]}" → "${standardizedItem}"`);
            // Don't use the attached number as price for typos
            continue;
          } else if (this.isValidItem(rawItem) && attachedNumber > 0 && attachedNumber <= 1000) {
            const finalItem = this.standardizeTerminology(rawItem);
            console.log(`      ✅ Found attached: "${rawItem}" → "${finalItem}" (${attachedNumber})`);
            pairs.push({ item: finalItem, amount: attachedNumber });
          } else {
            console.log(`      ❌ Skipped invalid attached: "${item}" (${amount}) - reason: ${!this.isValidItem(item) ? 'invalid item' : amount <= 0 ? 'invalid amount' : 'amount too high'}`);
          }
        }
      }
    }

    console.log(`      📊 Simple pairs found: ${pairs.length}`, pairs);
    return pairs;
  }

  private convertBengaliNumerals(text: string): string {
    const bengaliToWestern: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };

    return text.replace(/[০-৯]/g, (match) => bengaliToWestern[match] || match);
  }

  private parseDateFromComponents(day: string, month: string, year: string): Date | null {
    try {
      // Convert Bengali numerals
      const dayNum = parseInt(this.convertBengaliNumerals(day));
      const yearNum = parseInt(this.convertBengaliNumerals(year));

      // Bengali month mapping
      const bengaliMonths: Record<string, number> = {
        'জানুয়ারি': 0, 'ফেব্রুয়ারি': 1, 'মার্চ': 2, 'এপ্রিল': 3,
        'মে': 4, 'জুন': 5, 'জুলাই': 6, 'আগস্ট': 7,
        'সেপ্টেম্বর': 8, 'অক্টোবর': 9, 'নভেম্বর': 10, 'ডিসেম্বর': 11
      };

      const monthNum = bengaliMonths[month];
      if (monthNum !== undefined) {
        return new Date(yearNum, monthNum, dayNum);
      }

      return null;
    } catch (error) {
      console.log(`  ❌ Failed to parse date: ${day} ${month} ${year}`);
      return null;
    }
  }

  private isValidItem(item: string): boolean {
    // Skip system words and invalid items
    console.log(`    🔍 Validating item: "${item}"`);
    const invalidItems = [
      // System words
      'নং', 'pm', 'am', 'monir', 'munia', 'mustari', 'null', 'total',
      'https', 'http', 'www', 'com', 'org', 'net', 'co', 'bd',
      'deleted', 'message', 'media', 'omitted', 'encrypted',

      // Totals and summaries (don't include these as transactions)
      'কেনা', 'বাকি', 'পূর্বের', 'বর্তমান', 'লেনদেন', 'রেকর্ড', 'পরিশোধ',

      // Month names in English
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',

      // Month names in Bengali (including all variations)
      'জানুয়ারি', 'জানুয়ারী', 'ফেব্রুয়ারি', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল',
      'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
      'জুমা', 'জুম্মা', 'জুমার', 'জুম্মার', 'জমা',

      // Additional month-related words
      'মাস', 'বছর', 'দিন', 'সপ্তাহ', 'তারিখ',

      // Other Bengali system words
      'যেভাবে', 'পেমেন্ট', 'করতে', 'পারবেন', 'কাস্টমার', 'মোবাইল',
      'দোকানের', 'সুপার', 'কোডে', 'আপনার', 'বিকাশ', 'রকেট', 'ব্যাংক',
      'অ্যাপ', 'থেকে', 'স্ক্যান', 'করে', 'বিস্তারিত', 'লিংকে', 'দেখুন',
      'মৌরি', 'দিও', 'lagbe', 'dio', 'takar', 'তাকার', 'টাকার', 'joma', 'জমা'
    ];

    const lowerItem = item.toLowerCase();

    // Skip if it's in the invalid list
    if (invalidItems.includes(lowerItem)) {
      console.log(`    ❌ Item "${item}" is in invalid list`);
      return false;
    }

    // Skip if it looks like a phone number part
    if (/^\d+$/.test(item) || item.length > 20) {
      console.log(`    ❌ Item "${item}" looks like phone number or too long`);
      return false;
    }

    console.log(`    ✅ Item "${item}" is valid`);
    return true;
  }

  private extractDateFromLine(line: string): Date | null {
    // Look for date patterns in lines like "29.1.24", "২৯.১.২৪", etc.
    const convertedLine = this.convertBengaliNumerals(line);

    // Pattern for dates like "29.1.24", "2.2.24", etc.
    const datePattern = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
    const match = convertedLine.match(datePattern);

    if (match) {
      const [, day, month, year] = match;
      const fullYear = parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year);

      try {
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          console.log(`    📅 Extracted date from line: ${day}.${month}.${year} → ${date}`);
          return date;
        }
      } catch (error) {
        console.log(`    ❌ Invalid date: ${day}.${month}.${year}`);
      }
    }

    return null;
  }
}