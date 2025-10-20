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

    // Ensure we don't go to previous year if month is negative (January)
    if (currentStart.getMonth() < 0) {
      currentStart = new Date(currentStart.getFullYear() - 1, 11, 15);
    }

    // Make sure we generate at least one period
    let iterations = 0;
    const maxIterations = 1000; // Safety check to prevent infinite loops

    while (currentStart <= endDate && iterations < maxIterations) {
      // End date is 14th of next month
      const currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 14);
      
      // Handle month overflow (December to January)
      if (currentEnd.getMonth() < currentStart.getMonth()) {
        currentEnd.setFullYear(currentEnd.getFullYear() + 1);
      }
      
      // Don't go beyond the requested end date - use the minimum of currentEnd and endDate
      const periodEnd = currentEnd > endDate ? new Date(endDate) : new Date(currentEnd);
      
      periods.push({
        startDate: new Date(currentStart),
        endDate: new Date(periodEnd) // Make sure we create a new Date object
      });

      // Move to next month period (15th of next month)
      currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 15);
      
      // Handle month overflow (December to January)
      if (currentStart.getMonth() > 11) {
        currentStart.setFullYear(currentStart.getFullYear() + 1);
        currentStart.setMonth(0);
      }
      
      iterations++;
    }

    if (iterations >= maxIterations) {
      console.error('⚠️ Max iterations reached in generateMonthPeriods - possible infinite loop');
    }

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
    
    return periods.map(period => {
      // For the month label, we need to determine which cycle this period belongs to
      // The cycle is determined by the 15th-to-14th rule:
      // - Period from Dec 15 to Jan 14 is labeled as "January"
      // - Period from Jan 15 to Feb 14 is labeled as "February"
      // etc.
      
      // The label should be the month that contains the 14th of the period
      // For a period that starts on the 15th of a month, it ends on the 14th of the next month
      // So we label it with the month that contains the 14th
      
      // But for partial periods (where endDate is not the full 14th), we still label it
      // according to the cycle it belongs to
      
      // Determine the cycle month:
      // If the period starts on the 15th of a month, it belongs to the cycle that ends
      // on the 14th of the next month, so we label it with that next month
      const cycleMonth = new Date(period.startDate.getFullYear(), period.startDate.getMonth() + 1, 1);
      
      return {
        month: cycleMonth.toLocaleString('default', { month: 'long' }),
        year: cycleMonth.getFullYear(),
        startDate: period.startDate,
        endDate: period.endDate
      };
    });
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