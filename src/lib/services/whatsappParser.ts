import type {
  Transaction,
  ParseResult,
  ParseError,
  ParseSummary,
  ParseConfig
} from '../types';
import { TextProcessor } from './textProcessor';
import { CSVParser } from './csvParser';

export class WhatsAppParser {
  private textProcessor = new TextProcessor();
  private csvParser = new CSVParser();

  async parseFile(content: string): Promise<ParseResult> {
    const startTime = performance.now();
    
    // Convert WhatsApp text to CSV
    const csvContent = this.textProcessor.processWhatsAppToCSV(content);
    
    // Parse CSV to transactions
    const transactions = this.csvParser.parseCSV(csvContent);
    
    const processingTime = performance.now() - startTime;
    const summary: ParseSummary = {
      totalLines: content.split('\n').length,
      successfulTransactions: transactions.length,
      failedLines: 0,
      duplicatesSkipped: 0,
      processingTime
    };

    return {
      transactions,
      errors: [],
      summary,
      suspiciousTransactions: []
    };
  }
}