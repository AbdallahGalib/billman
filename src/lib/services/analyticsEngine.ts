import type { 
  Transaction, 
  AnalyticsData, 
  ItemCount, 
  MonthlyTotal,
  ChartData,
  ChartOptions,
  FilterConfig 
} from '../types';
import { groupBy, calculatePercentage, getMonthName, generateColors } from '../utils/helpers';

export class AnalyticsEngine {
  private transactions: Transaction[] = [];

  constructor(transactions: Transaction[] = []) {
    this.transactions = transactions;
  }

  updateTransactions(transactions: Transaction[]): void {
    this.transactions = transactions;
  }

  // Main analytics data generation
  generateAnalytics(filters?: FilterConfig): AnalyticsData {
    const filteredTransactions = this.applyFilters(this.transactions, filters);

    return {
      itemDistribution: this.calculateItemDistribution(filteredTransactions),
      monthlySpending: this.calculateMonthlySpending(filteredTransactions),
      totalTransactions: filteredTransactions.length,
      totalAmount: this.calculateTotalAmount(filteredTransactions),
      averageTransaction: this.calculateAverageTransaction(filteredTransactions)
    };
  }

  // Item distribution analysis
  private calculateItemDistribution(transactions: Transaction[]): ItemCount[] {
    const itemMap = new Map<string, { count: number; totalAmount: number }>();

    transactions.forEach(transaction => {
      const existing = itemMap.get(transaction.item) || { count: 0, totalAmount: 0 };
      itemMap.set(transaction.item, {
        count: existing.count + 1,
        totalAmount: existing.totalAmount + transaction.amount
      });
    });

    return Array.from(itemMap.entries())
      .map(([item, data]) => ({
        item,
        count: data.count,
        totalAmount: data.totalAmount
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Monthly spending analysis
  private calculateMonthlySpending(transactions: Transaction[]): MonthlyTotal[] {
    const monthMap = new Map<string, { total: number; transactionCount: number; year: number }>();

    transactions.forEach(transaction => {
      const date = transaction.date;
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      const existing = monthMap.get(monthKey) || { 
        total: 0, 
        transactionCount: 0, 
        year: date.getFullYear() 
      };
      
      monthMap.set(monthKey, {
        total: existing.total + transaction.amount,
        transactionCount: existing.transactionCount + 1,
        year: date.getFullYear()
      });
    });

    return Array.from(monthMap.entries())
      .map(([key, data]) => {
        const [year, monthIndex] = key.split('-').map(Number);
        return {
          month: getMonthName(monthIndex),
          year: data.year,
          total: data.total,
          transactionCount: data.transactionCount
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        const aMonthIndex = new Date(`${a.month} 1, ${a.year}`).getMonth();
        const bMonthIndex = new Date(`${b.month} 1, ${b.year}`).getMonth();
        return aMonthIndex - bMonthIndex;
      });
  }

  // Chart data generation
  generatePieChartData(itemDistribution: ItemCount[], maxItems: number = 50): ChartData {
    // Show all items separately, no "Others" category
    const allItems = itemDistribution;
    
    const labels = allItems.map(item => item.item);
    const data = allItems.map(item => item.count); // Use count instead of totalAmount

    const colors = generateColors(labels.length);

    return {
      labels,
      datasets: [{
        label: 'Purchase Count',
        data,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.8', '1')),
        borderWidth: 2
      }]
    };
  }

  // Generate separate charts for frequent vs non-frequent items
  generateFrequentItemsChartData(frequentItems: ItemCount[]): ChartData {
    const labels = frequentItems.map(item => item.item);
    const data = frequentItems.map(item => item.count); // Use count instead of totalAmount
    const colors = generateColors(labels.length);

    return {
      labels,
      datasets: [{
        label: 'Frequent Items (>3 purchases) - Purchase Count',
        data,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.8', '1')),
        borderWidth: 2
      }]
    };
  }

  generateNonFrequentItemsChartData(nonFrequentItems: ItemCount[]): ChartData {
    const labels = nonFrequentItems.map(item => item.item);
    const data = nonFrequentItems.map(item => item.count); // Use count instead of totalAmount
    const colors = generateColors(labels.length);

    return {
      labels,
      datasets: [{
        label: 'Occasional Items (≤3 purchases) - Purchase Count',
        data,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.8', '1')),
        borderWidth: 2
      }]
    };
  }

  generateBarChartData(monthlySpending: MonthlyTotal[]): ChartData {
    const labels = monthlySpending.map(month => `${month.month} ${month.year}`);
    const data = monthlySpending.map(month => month.total);

    return {
      labels,
      datasets: [{
        label: 'Total Spending',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    };
  }

  generateLineChartData(monthlySpending: MonthlyTotal[]): ChartData {
    const labels = monthlySpending.map(month => `${month.month} ${month.year}`);
    const spendingData = monthlySpending.map(month => month.total);
    const transactionData = monthlySpending.map(month => month.transactionCount);

    return {
      labels,
      datasets: [
        {
          label: 'Total Spending',
          data: spendingData,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2
        },
        {
          label: 'Transaction Count',
          data: transactionData,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2
        }
      ]
    };
  }

  // Chart options
  getPieChartOptions(): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
              const percentage = calculatePercentage(value, total);
              return `${label}: ${value} purchases (${percentage}%)`;
            }
          }
        }
      }
    };
  }

  getBarChartOptions(): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y || 0;
              return `Total: ৳${value.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value: any) {
              return '৳' + value.toFixed(0);
            }
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    };
  }

  getLineChartOptions(): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label || '';
              const value = context.parsed.y || 0;
              if (datasetLabel === 'Total Spending') {
                return `${datasetLabel}: ৳${value.toFixed(2)}`;
              }
              return `${datasetLabel}: ${value}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value: any) {
              return typeof value === 'number' ? value.toFixed(0) : value;
            }
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    };
  }

  // Advanced analytics
  getTopSpenders(limit: number = 5): { sender: string; total: number; count: number }[] {
    const senderMap = new Map<string, { total: number; count: number }>();

    this.transactions.forEach(transaction => {
      const existing = senderMap.get(transaction.sender) || { total: 0, count: 0 };
      senderMap.set(transaction.sender, {
        total: existing.total + transaction.amount,
        count: existing.count + 1
      });
    });

    return Array.from(senderMap.entries())
      .map(([sender, data]) => ({ sender, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  getSpendingTrends(): {
    currentMonth: number;
    previousMonth: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const currentMonthTransactions = this.transactions.filter(t => 
      t.date >= currentMonth && t.date < nextMonth
    );
    const previousMonthTransactions = this.transactions.filter(t => 
      t.date >= previousMonth && t.date < currentMonth
    );

    const currentMonthTotal = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const previousMonthTotal = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

    let percentageChange = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (previousMonthTotal > 0) {
      percentageChange = ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
      trend = percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable';
    } else if (currentMonthTotal > 0) {
      trend = 'up';
      percentageChange = 100;
    }

    return {
      currentMonth: currentMonthTotal,
      previousMonth: previousMonthTotal,
      percentageChange: Math.abs(percentageChange),
      trend
    };
  }

  getItemInsights(): {
    mostFrequent: string;
    mostExpensive: string;
    averagePriceByItem: { item: string; averagePrice: number }[];
  } {
    const itemStats = new Map<string, { count: number; total: number; prices: number[] }>();

    this.transactions.forEach(transaction => {
      const existing = itemStats.get(transaction.item) || { count: 0, total: 0, prices: [] };
      itemStats.set(transaction.item, {
        count: existing.count + 1,
        total: existing.total + transaction.amount,
        prices: [...existing.prices, transaction.amount]
      });
    });

    const itemArray = Array.from(itemStats.entries()).map(([item, stats]) => ({
      item,
      count: stats.count,
      total: stats.total,
      averagePrice: stats.total / stats.count
    }));

    const mostFrequent = itemArray.sort((a, b) => b.count - a.count)[0]?.item || '';
    const mostExpensive = itemArray.sort((a, b) => b.total - a.total)[0]?.item || '';
    const averagePriceByItem = itemArray
      .sort((a, b) => b.averagePrice - a.averagePrice)
      .slice(0, 10);

    return {
      mostFrequent,
      mostExpensive,
      averagePriceByItem
    };
  }

  // Utility methods
  private calculateTotalAmount(transactions: Transaction[]): number {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  private calculateAverageTransaction(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;
    return this.calculateTotalAmount(transactions) / transactions.length;
  }

  private applyFilters(transactions: Transaction[], filters?: FilterConfig): Transaction[] {
    if (!filters) return transactions;

    let result = [...transactions];

    if (filters.dateRange) {
      result = result.filter(t => 
        t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      );
    }

    if (filters.sender) {
      result = result.filter(t => 
        t.sender.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    if (filters.itemSearch) {
      result = result.filter(t => 
        t.item.toLowerCase().includes(filters.itemSearch!.toLowerCase())
      );
    }

    if (filters.amountRange) {
      result = result.filter(t => 
        t.amount >= filters.amountRange!.min && t.amount <= filters.amountRange!.max
      );
    }

    return result;
  }

  // Export analytics data
  exportAnalyticsData(format: 'json' | 'csv' = 'json'): string {
    const analytics = this.generateAnalytics();
    
    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    }

    // CSV format
    const csvData = [
      ['Metric', 'Value'],
      ['Total Transactions', analytics.totalTransactions.toString()],
      ['Total Amount', analytics.totalAmount.toFixed(2)],
      ['Average Transaction', analytics.averageTransaction.toFixed(2)],
      [''],
      ['Item Distribution'],
      ['Item', 'Count', 'Total Amount'],
      ...analytics.itemDistribution.map(item => [item.item, item.count.toString(), item.totalAmount.toFixed(2)]),
      [''],
      ['Monthly Spending'],
      ['Month', 'Year', 'Total', 'Transaction Count'],
      ...analytics.monthlySpending.map(month => [month.month, month.year.toString(), month.total.toFixed(2), month.transactionCount.toString()])
    ];

    return csvData.map(row => row.join(',')).join('\n');
  }
}