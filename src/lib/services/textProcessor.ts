export class TextProcessor {
  
  processWhatsAppToCSV(content: string): string {
    const lines = content.split('\n');
    const csvRows: string[] = ['Date,Item,Amount'];
    
    let currentDate = '';
    let currentKenaAmount = 0;
    let currentMessage = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check for message header
      const messageMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*(am|pm)?\s*-\s*Monir:/i);
      if (messageMatch) {
        // Process previous message
        if (currentMessage && currentDate) {
          this.processMessage(currentMessage, currentDate, currentKenaAmount, csvRows);
        }
        
        // Start new message
        currentDate = messageMatch[1];
        currentMessage = trimmed;
        currentKenaAmount = 0;
      } else {
        // Continue current message
        currentMessage += ' ' + trimmed;
      }
    }
    
    // Process final message
    if (currentMessage && currentDate) {
      this.processMessage(currentMessage, currentDate, currentKenaAmount, csvRows);
    }
    
    return csvRows.join('\n');
  }
  
  private processMessage(message: string, date: string, kenaAmount: number, csvRows: string[]): void {
    const convertedMessage = this.translateBengali(message);
    
    // Extract কেনা amount
    const kenaMatch = convertedMessage.match(/কেনা\s+([\d,]+)/i);
    const totalKena = kenaMatch ? parseFloat(kenaMatch[1].replace(/,/g, '')) : 0;
    
    // Extract description section
    const descMatch = convertedMessage.match(/বিবরণ\s+(.+?)(?=\s*moriom|\s*যেভাবে|$)/is);
    if (!descMatch) return;
    
    const description = descMatch[1].trim();
    
    // Find item-amount pairs
    const itemMatches = description.match(/([a-zA-Z\u0980-\u09FF]+)\s+(\d+)/g);
    let totalItemAmounts = 0;
    
    if (itemMatches) {
      for (const match of itemMatches) {
        const parts = match.match(/([a-zA-Z\u0980-\u09FF]+)\s+(\d+)/);
        if (parts) {
          const item = parts[1];
          const amount = parseFloat(parts[2]);
          totalItemAmounts += amount;
          csvRows.push(`${date},${item},${amount}`);
        }
      }
    }
    
    // Find items without amounts
    const words = description.split(/\s+/);
    const itemsWithoutAmounts: string[] = [];
    
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z\u0980-\u09FF]/g, '');
      if (cleanWord.length > 2 && 
          !this.isSystemWord(cleanWord) && 
          !itemMatches?.some(m => m.includes(cleanWord))) {
        itemsWithoutAmounts.push(cleanWord);
      }
    }
    
    // Distribute remaining কেনা amount among items without amounts
    if (itemsWithoutAmounts.length > 0 && totalKena > totalItemAmounts) {
      const remainingAmount = totalKena - totalItemAmounts;
      const amountPerItem = remainingAmount / itemsWithoutAmounts.length;
      
      for (const item of itemsWithoutAmounts) {
        csvRows.push(`${date},${item},${amountPerItem.toFixed(2)}`);
      }
    }
  }
  
  private translateBengali(text: string): string {
    const bengaliToWestern: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৆': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    
    return text.replace(/[০-৯]/g, (match) => bengaliToWestern[match] || match);
  }
  
  private isSystemWord(word: string): boolean {
    const systemWords = [
      'কেনা', 'বাকি', 'পূর্বের', 'বর্তমান', 'লেনদেন', 'রেকর্ড',
      'যেভাবে', 'পেমেন্ট', 'কাস্টমার', 'মোবাইল', 'moriom'
    ];
    return systemWords.includes(word.toLowerCase());
  }
}