import type { 
  Transaction, 
  BillItem, 
  DayBill, 
  MonthBill, 
  BillingPeriod, 
  BillingSummary 
} from '../types';

export class BillingService {
  
  /**
   * Generate billing summary for a given period
   * Month starts from 15th of previous month to 14th of current month
   */
  generateBillingSummary(transactions: Transaction[], period: BillingPeriod): BillingSummary {
    // Filter transactions within the period
    const filteredTransactions = transactions.filter(t => 
      t.date >= period.startDate && t.date <= period.endDate
    );

    // Generate daily bills
    const dailyBills = this.generateDailyBills(filteredTransactions);
    
    // Generate monthly bills (based on 15th to 14th cycle)
    const monthlyBills = this.generateMonthlyBills(filteredTransactions, period);

    const grandTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      period,
      monthlyBills,
      dailyBills,
      grandTotal
    };
  }

  /**
   * Generate daily bills with combined items
   */
  private generateDailyBills(transactions: Transaction[]): DayBill[] {
    // Group transactions by date
    const transactionsByDate = new Map<string, Transaction[]>();
    
    transactions.forEach(transaction => {
      const dateKey = transaction.date.toISOString().split('T')[0];
      if (!transactionsByDate.has(dateKey)) {
        transactionsByDate.set(dateKey, []);
      }
      transactionsByDate.get(dateKey)!.push(transaction);
    });

    // Convert to daily bills
    const dailyBills: DayBill[] = [];
    
    for (const [dateKey, dayTransactions] of transactionsByDate.entries()) {
      const date = new Date(dateKey);
      const items = this.combineItems(dayTransactions);
      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

      dailyBills.push({
        date,
        items,
        totalAmount
      });
    }

    return dailyBills.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Generate monthly bills based on 15th to 14th cycle
   */
  private generateMonthlyBills(transactions: Transaction[], period: BillingPeriod): MonthBill[] {
    const monthlyBills: MonthBill[] = [];
    
    // Generate month periods from 15th to 14th
    const monthPeriods = this.generateMonthPeriods(period.startDate, period.endDate);
    
    for (const monthPeriod of monthPeriods) {
      const monthTransactions = transactions.filter(t => 
        t.date >= monthPeriod.startDate && t.date <= monthPeriod.endDate
      );

      if (monthTransactions.length === 0) continue;

      // Generate daily bills for this month
      const monthDailyBills = this.generateDailyBills(monthTransactions);
      
      // Combine all items for the month
      const itemSummary = this.combineItems(monthTransactions);
      const totalAmount = itemSummary.reduce((sum, item) => sum + item.totalPrice, 0);

      monthlyBills.push({
        month: monthPeriod.endDate.toLocaleString('default', { month: 'long' }),
        year: monthPeriod.endDate.getFullYear(),
        startDate: monthPeriod.startDate,
        endDate: monthPeriod.endDate,
        days: monthDailyBills,
        totalAmount,
        itemSummary
      });
    }

    return monthlyBills;
  }

  /**
   * Generate month periods from 15th to 14th
   */
  private generateMonthPeriods(startDate: Date, endDate: Date): { startDate: Date; endDate: Date }[] {
    const periods: { startDate: Date; endDate: Date }[] = [];
    
    // Start from the 15th of the month containing startDate
    let currentStart = new Date(startDate.getFullYear(), startDate.getMonth(), 15);
    
    // If startDate is before the 15th, start from previous month's 15th
    if (startDate.getDate() < 15) {
      currentStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 15);
    }

    console.log(`🗓️ Generating month periods from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`🗓️ Starting from: ${currentStart.toDateString()}`);

    while (currentStart <= endDate) {
      // End date is 14th of next month
      const currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 14);
      
      // Don't go beyond the requested end date
      const periodEnd = currentEnd > endDate ? endDate : currentEnd;
      
      console.log(`🗓️ Period: ${currentStart.toDateString()} - ${periodEnd.toDateString()}`);
      
      periods.push({
        startDate: new Date(currentStart),
        endDate: periodEnd
      });

      // Move to next month period (15th of next month)
      currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 15);
    }

    console.log(`🗓️ Generated ${periods.length} periods`);
    return periods;
  }

  /**
   * Combine recurring items and calculate quantities
   */
  private combineItems(transactions: Transaction[]): BillItem[] {
    const itemMap = new Map<string, { quantity: number; totalPrice: number; unitPrice: number }>();

    transactions.forEach(transaction => {
      const itemKey = transaction.item.toLowerCase().trim();
      
      if (itemMap.has(itemKey)) {
        const existing = itemMap.get(itemKey)!;
        existing.quantity += 1;
        existing.totalPrice += transaction.amount;
        // Update unit price to average
        existing.unitPrice = existing.totalPrice / existing.quantity;
      } else {
        itemMap.set(itemKey, {
          quantity: 1,
          totalPrice: transaction.amount,
          unitPrice: transaction.amount
        });
      }
    });

    // Convert to BillItem array
    const billItems: BillItem[] = [];
    for (const [item, data] of itemMap.entries()) {
      billItems.push({
        item,
        quantity: data.quantity,
        unitPrice: Math.round(data.unitPrice * 100) / 100, // Round to 2 decimal places
        totalPrice: Math.round(data.totalPrice * 100) / 100
      });
    }

    // Sort by total price descending
    return billItems.sort((a, b) => b.totalPrice - a.totalPrice);
  }

  /**
   * Create a billing period for a specific month (15th to 14th cycle)
   */
  createMonthPeriod(year: number, month: number): BillingPeriod {
    // Month billing period: 15th of (month-1) to 14th of month
    const startDate = new Date(year, month - 1, 15);
    const endDate = new Date(year, month, 14, 23, 59, 59);

    return {
      startDate,
      endDate,
      type: 'month'
    };
  }

  /**
   * Create a custom billing period
   */
  createCustomPeriod(startDate: Date, endDate: Date): BillingPeriod {
    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: 'custom'
    };
  }

  /**
   * Get available months from transactions
   */
  getAvailableMonths(transactions: Transaction[]): { month: string; year: number; startDate: Date; endDate: Date }[] {
    if (transactions.length === 0) return [];

    // Find the date range of transactions
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    const earliestDate = dates[0];
    const latestDate = dates[dates.length - 1];

    // Generate month periods
    const periods = this.generateMonthPeriods(earliestDate, latestDate);
    
    return periods.map(period => ({
      month: period.endDate.toLocaleString('default', { month: 'long' }),
      year: period.endDate.getFullYear(),
      startDate: period.startDate,
      endDate: period.endDate
    }));
  }

  /**
   * Format bill for display
   */
  formatBillForDisplay(bill: MonthBill | DayBill): string {
    let output = '';
    
    if ('month' in bill) {
      // Monthly bill
      output += `Month: ${bill.month} ${bill.year} | Total: ৳${bill.totalAmount.toFixed(2)}\n`;
      output += `Period: ${bill.startDate.toLocaleDateString()} - ${bill.endDate.toLocaleDateString()}\n\n`;
      
      output += 'Items:\n';
      bill.itemSummary.forEach(item => {
        output += `${item.item} x${item.quantity} @ ৳${item.unitPrice.toFixed(2)} = ৳${item.totalPrice.toFixed(2)}\n`;
      });
    } else {
      // Daily bill
      output += `Day: ${bill.date.toLocaleDateString()} | Total: ৳${bill.totalAmount.toFixed(2)}\n\n`;
      
      output += 'Items:\n';
      bill.items.forEach(item => {
        output += `${item.item} x${item.quantity} @ ৳${item.unitPrice.toFixed(2)} = ৳${item.totalPrice.toFixed(2)}\n`;
      });
    }

    return output;
  }
}