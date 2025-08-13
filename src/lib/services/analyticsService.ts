import type { Transaction, Category, CategoryAnalytics, TrendData, ComparisonData, AnalyticsInsight } from '../types';
import { getMonthPeriodFor15thCycle } from '../utils/helpers';

export class AnalyticsService {
  
  // Calculate category-based analytics
  calculateCategoryAnalytics(transactions: Transaction[], categories: Category[]): CategoryAnalytics {
    const categorizedTransactions = transactions.filter(t => t.categoryId);
    const uncategorizedTransactions = transactions.filter(t => !t.categoryId);
    
    // Calculate category breakdown
    const categoryStats = new Map<string, {
      transactionCount: number;
      totalAmount: number;
      lastUsed: Date;
    }>();

    // Initialize all categories
    categories.forEach(category => {
      categoryStats.set(category.id, {
        transactionCount: 0,
        totalAmount: 0,
        lastUsed: new Date(0)
      });
    });

    // Calculate stats from transactions
    categorizedTransactions.forEach(transaction => {
      if (transaction.categoryId) {
        const stats = categoryStats.get(transaction.categoryId);
        if (stats) {
          stats.transactionCount++;
          stats.totalAmount += transaction.amount;
          if (transaction.date > stats.lastUsed) {
            stats.lastUsed = transaction.date;
          }
        }
      }
    });

    // Convert to breakdown array
    const categoryBreakdown = Array.from(categoryStats.entries()).map(([categoryId, stats]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        transactionCount: stats.transactionCount,
        totalAmount: stats.totalAmount,
        averageAmount: stats.transactionCount > 0 ? stats.totalAmount / stats.transactionCount : 0,
        lastUsed: stats.lastUsed
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalCategories: categories.length,
      categorizedTransactions: categorizedTransactions.length,
      uncategorizedTransactions: uncategorizedTransactions.length,
      categoryBreakdown,
      topCategories: categoryBreakdown.slice(0, 5)
    };
  }

  // Calculate trend analytics using 15th-to-15th periods for months
  calculateTrendAnalytics(transactions: Transaction[], groupBy: 'day' | 'week' | 'month' = 'month'): TrendData[] {
    const trends = new Map<string, {
      date: Date;
      totalAmount: number;
      transactionCount: number;
      categoryBreakdown: Map<string, number>;
    }>();

    transactions.forEach(transaction => {
      let periodKey: string;
      let periodDate: Date;

      switch (groupBy) {
        case 'day':
          periodKey = transaction.date.toISOString().split('T')[0];
          periodDate = new Date(transaction.date.getFullYear(), transaction.date.getMonth(), transaction.date.getDate());
          break;
        case 'week':
          const weekStart = new Date(transaction.date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          periodDate = weekStart;
          break;
        case 'month':
        default:
          // Use 15th-to-15th periods for monthly calculations
          const monthPeriod = getMonthPeriodFor15thCycle(transaction.date);
          periodKey = `${monthPeriod.year}-${String(monthPeriod.month).padStart(2, '0')}`;
          periodDate = monthPeriod.startDate;
          break;
      }

      if (!trends.has(periodKey)) {
        trends.set(periodKey, {
          date: periodDate,
          totalAmount: 0,
          transactionCount: 0,
          categoryBreakdown: new Map()
        });
      }

      const trend = trends.get(periodKey)!;
      trend.totalAmount += transaction.amount;
      trend.transactionCount++;

      if (transaction.categoryId) {
        const currentAmount = trend.categoryBreakdown.get(transaction.categoryId) || 0;
        trend.categoryBreakdown.set(transaction.categoryId, currentAmount + transaction.amount);
      }
    });

    return Array.from(trends.entries())
      .map(([period, data]) => ({
        period: groupBy === 'month' ? data.date.toLocaleDateString('en-US', { month: 'short' }) : period,
        date: data.date,
        totalAmount: data.totalAmount,
        transactionCount: data.transactionCount,
        categoryBreakdown: Object.fromEntries(data.categoryBreakdown)
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }



  // Calculate comparative analytics
  calculateComparativeAnalytics(transactions: Transaction[], compareBy: 'category' | 'item' = 'category', categories: Category[] = []): ComparisonData[] {
    const comparisons = new Map<string, number>();

    transactions.forEach(transaction => {
      let key: string;
      
      if (compareBy === 'category') {
        if (transaction.categoryId) {
          const category = categories.find(c => c.id === transaction.categoryId);
          key = category?.name || 'Unknown Category';
        } else {
          key = 'Uncategorized';
        }
      } else {
        key = transaction.item;
      }

      comparisons.set(key, (comparisons.get(key) || 0) + transaction.amount);
    });

    const totalAmount = Array.from(comparisons.values()).reduce((sum, amount) => sum + amount, 0);

    return Array.from(comparisons.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }

  // Generate insights
  generateInsights(transactions: Transaction[], categories: Category[] = []): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    if (transactions.length === 0) {
      return insights;
    }

    // Calculate basic stats
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalAmount / transactions.length;
    const amounts = transactions.map(t => t.amount).sort((a, b) => a - b);
    const medianAmount = amounts[Math.floor(amounts.length / 2)];

    // Spending trend insight
    const monthlyTrends = this.calculateTrendAnalytics(transactions, 'month');
    if (monthlyTrends.length >= 2) {
      const lastMonth = monthlyTrends[monthlyTrends.length - 1];
      const previousMonth = monthlyTrends[monthlyTrends.length - 2];
      const change = ((lastMonth.totalAmount - previousMonth.totalAmount) / previousMonth.totalAmount) * 100;

      insights.push({
        type: 'trend',
        title: change > 0 ? 'Spending Increased' : 'Spending Decreased',
        description: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to last month`,
        severity: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low',
        data: { change, lastMonth: lastMonth.totalAmount, previousMonth: previousMonth.totalAmount }
      });
    }

    // High-value transaction insight
    const highValueThreshold = averageAmount * 2;
    const highValueTransactions = transactions.filter(t => t.amount > highValueThreshold);
    
    if (highValueTransactions.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'High-Value Transactions',
        description: `Found ${highValueTransactions.length} transactions above ৳${highValueThreshold.toFixed(0)} (2x average)`,
        severity: highValueTransactions.length > 5 ? 'high' : 'medium',
        data: { count: highValueTransactions.length, threshold: highValueThreshold }
      });
    }

    // Category distribution insight
    if (categories.length > 0) {
      const categoryAnalytics = this.calculateCategoryAnalytics(transactions, categories);
      const uncategorizedPercentage = (categoryAnalytics.uncategorizedTransactions / transactions.length) * 100;

      if (uncategorizedPercentage > 20) {
        insights.push({
          type: 'recommendation',
          title: 'Categorize More Transactions',
          description: `${uncategorizedPercentage.toFixed(1)}% of your transactions are uncategorized. Consider assigning categories for better insights.`,
          severity: uncategorizedPercentage > 50 ? 'high' : 'medium',
          data: { uncategorizedCount: categoryAnalytics.uncategorizedTransactions, percentage: uncategorizedPercentage }
        });
      }
    }

    // Frequent items insight
    const itemCounts = new Map<string, number>();
    transactions.forEach(t => {
      itemCounts.set(t.item, (itemCounts.get(t.item) || 0) + 1);
    });

    const frequentItems = Array.from(itemCounts.entries())
      .filter(([, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (frequentItems.length > 0) {
      insights.push({
        type: 'pattern',
        title: 'Frequent Purchases',
        description: `Your most frequent purchases: ${frequentItems.map(([item, count]) => `${item} (${count}x)`).join(', ')}`,
        severity: 'low',
        data: { frequentItems }
      });
    }

    return insights;
  }

  // Calculate spending velocity (transactions per day)
  calculateSpendingVelocity(transactions: Transaction[]): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    if (transactions.length === 0) {
      return { daily: 0, weekly: 0, monthly: 0 };
    }

    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    const daily = transactions.length / daysDiff;
    const weekly = daily * 7;
    const monthly = daily * 30;

    return { daily, weekly, monthly };
  }

  // Calculate category efficiency (average amount per category)
  calculateCategoryEfficiency(transactions: Transaction[], categories: Category[]): {
    categoryId: string;
    categoryName: string;
    efficiency: number; // amount per transaction
    totalAmount: number;
    transactionCount: number;
  }[] {
    const categoryStats = new Map<string, { totalAmount: number; count: number }>();

    transactions.forEach(transaction => {
      if (transaction.categoryId) {
        const stats = categoryStats.get(transaction.categoryId) || { totalAmount: 0, count: 0 };
        stats.totalAmount += transaction.amount;
        stats.count++;
        categoryStats.set(transaction.categoryId, stats);
      }
    });

    return Array.from(categoryStats.entries()).map(([categoryId, stats]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        efficiency: stats.totalAmount / stats.count,
        totalAmount: stats.totalAmount,
        transactionCount: stats.count
      };
    }).sort((a, b) => b.efficiency - a.efficiency);
  }
}