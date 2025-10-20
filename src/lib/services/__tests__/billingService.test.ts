import { beforeEach, describe, it, expect } from 'vitest';
import { BillingService } from '../billingService';
import type { Transaction } from '../../types';

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
  });

  describe('generateMonthPeriods', () => {
    it('should generate correct 15th-to-14th periods', () => {
      // Test case: January 1st to March 31st
      const startDate = new Date(2024, 0, 1); // January 1, 2024
      const endDate = new Date(2024, 2, 31); // March 31, 2024
      
      const periods = (billingService as any).generateMonthPeriods(startDate, endDate);
      
      // Expected periods:
      // 1. December 15, 2023 - January 14, 2024
      // 2. January 15, 2024 - February 14, 2024
      // 3. February 15, 2024 - March 14, 2024
      // 4. March 15, 2024 - March 31, 2024
      
      expect(periods).toHaveLength(4);
      
      // Period 1: December 15, 2023 - January 14, 2024
      expect(periods[0].startDate).toEqual(new Date(2023, 11, 15));
      expect(periods[0].endDate).toEqual(new Date(2024, 0, 14));
      
      // Period 2: January 15, 2024 - February 14, 2024
      expect(periods[1].startDate).toEqual(new Date(2024, 0, 15));
      expect(periods[1].endDate).toEqual(new Date(2024, 1, 14));
      
      // Period 3: February 15, 2024 - March 14, 2024
      expect(periods[2].startDate).toEqual(new Date(2024, 1, 15));
      expect(periods[2].endDate).toEqual(new Date(2024, 2, 14));
      
      // Period 4: March 15, 2024 - March 31, 2024
      expect(periods[3].startDate).toEqual(new Date(2024, 2, 15));
      expect(periods[3].endDate).toEqual(new Date(2024, 2, 31));
    });

    it('should handle edge case when start date is after the 15th', () => {
      // Test case: January 20th to February 10th
      const startDate = new Date(2024, 0, 20); // January 20, 2024
      const endDate = new Date(2024, 1, 10); // February 10, 2024
      
      const periods = (billingService as any).generateMonthPeriods(startDate, endDate);
      
      // Expected periods:
      // 1. January 15, 2024 - February 10, 2024 (partial period)
      
      expect(periods).toHaveLength(1);
      expect(periods[0].startDate).toEqual(new Date(2024, 0, 15));
      expect(periods[0].endDate).toEqual(new Date(2024, 1, 10));
    });
  });

  describe('getAvailableMonths', () => {
    it('should return correct month labels for 15th-to-14th cycles', () => {
      // Create test transactions spanning different periods
      const transactions: Transaction[] = [
        // Transaction in December 15, 2023 - January 14, 2024 period
        {
          id: '1',
          date: new Date(2024, 0, 10), // January 10, 2024
          sender: 'Monir',
          item: 'milk',
          amount: 100,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        // Transaction in January 15, 2024 - February 14, 2024 period
        {
          id: '2',
          date: new Date(2024, 0, 20), // January 20, 2024
          sender: 'Monir',
          item: 'bread',
          amount: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        // Transaction in February 15, 2024 - March 14, 2024 period
        {
          id: '3',
          date: new Date(2024, 1, 20), // February 20, 2024
          sender: 'Monir',
          item: 'eggs',
          amount: 120,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const months = billingService.getAvailableMonths(transactions);
      
      // Should have 3 months:
      // 1. January 2024 (covers Dec 15, 2023 - Jan 14, 2024)
      // 2. February 2024 (covers Jan 15, 2024 - Feb 14, 2024)
      // 3. March 2024 (covers Feb 15, 2024 - Mar 14, 2024) - but ends early because no transactions after Feb 20
      
      expect(months).toHaveLength(3);
      
      expect(months[0].month).toBe('January');
      expect(months[0].year).toBe(2024);
      expect(months[0].startDate).toEqual(new Date(2023, 11, 15));
      expect(months[0].endDate).toEqual(new Date(2024, 0, 14));
      
      expect(months[1].month).toBe('February');
      expect(months[1].year).toBe(2024);
      expect(months[1].startDate).toEqual(new Date(2024, 0, 15));
      expect(months[1].endDate).toEqual(new Date(2024, 1, 14));
      
      expect(months[2].month).toBe('March');
      expect(months[2].year).toBe(2024);
      expect(months[2].startDate).toEqual(new Date(2024, 1, 15));
      // The end date should be February 20, 2024 (the latest transaction date) since there are no later transactions
      expect(months[2].endDate).toEqual(new Date(2024, 1, 20));
    });
  });
});