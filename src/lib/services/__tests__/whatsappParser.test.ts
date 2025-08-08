import { describe, it, expect, beforeEach } from 'vitest';
import { WhatsAppParser } from '../whatsappParser';

describe('WhatsAppParser', () => {
    let parser: WhatsAppParser;

    beforeEach(() => {
        parser = new WhatsAppParser();
    });

    describe('parseFile', () => {
        it('should parse basic WhatsApp messages with transactions', async () => {
            const content = `03/01/2024, 9:35 pm - Monir: alo 140
chapati 110
milk 100
dim 45`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(4);
            expect(result.transactions[0]).toMatchObject({
                sender: 'Monir',
                item: 'alo',
                amount: 140
            });
            expect(result.transactions[1]).toMatchObject({
                sender: 'Monir',
                item: 'chapati',
                amount: 110
            });
        });

        it('should handle multi-line messages', async () => {
            const content = `04/01/2024, 10:43 pm - Monir: ghee 160
sauce 100
05/01/2024, 7:55 pm - Munia Mustari: Hath doar saban to ta..gase maka lux eaban akta`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(2);
            expect(result.transactions[0].item).toBe('ghee');
            expect(result.transactions[1].item).toBe('sauce');
        });

        it('should skip system messages', async () => {
            const content = `03/01/2024, 9:35 pm - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. Learn more.
03/01/2024, 9:35 pm - Monir: milk 100
05/01/2024, 7:55 pm - Munia Mustari: null`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(1);
            expect(result.transactions[0].item).toBe('milk');
        });

        it('should handle different transaction patterns', async () => {
            const content = `03/01/2024, 9:35 pm - Monir: milk: 100
bread - 50
100 for rice`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(3);
            expect(result.transactions[0]).toMatchObject({
                item: 'milk',
                amount: 100
            });
            expect(result.transactions[1]).toMatchObject({
                item: 'bread',
                amount: 50
            });
            expect(result.transactions[2]).toMatchObject({
                item: 'rice',
                amount: 100
            });
        });

        it('should parse dates correctly', async () => {
            const content = `03/01/2024, 9:35 pm - Monir: milk 100`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(1);
            const transaction = result.transactions[0];
            expect(transaction.date.getDate()).toBe(3);
            expect(transaction.date.getMonth()).toBe(0); // January is 0
            expect(transaction.date.getFullYear()).toBe(2024);
            expect(transaction.date.getHours()).toBe(21); // 9 PM
            expect(transaction.date.getMinutes()).toBe(35);
        });

        it('should handle AM/PM time format', async () => {
            const content = `03/01/2024, 9:35 am - Monir: milk 100
03/01/2024, 12:35 pm - Monir: bread 50`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(2);
            expect(result.transactions[0].date.getHours()).toBe(9); // 9 AM
            expect(result.transactions[1].date.getHours()).toBe(12); // 12 PM
        });

        it('should remove duplicate transactions', async () => {
            const content = `03/01/2024, 9:35 pm - Monir: milk 100
03/01/2024, 9:36 pm - Monir: milk 100`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(1);
            expect(result.summary.duplicatesSkipped).toBe(1);
        });

        it('should handle Bengali text', async () => {
            const content = `20/02/2024, 10:18 pm - Monir: টিসু70
আর চি40`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(2);
            expect(result.transactions[0].item).toBe('টিসু');
            expect(result.transactions[0].amount).toBe(70);
        });

        it('should skip non-transaction messages', async () => {
            const content = `03/01/2024, 9:35 pm - Monir: ok
03/01/2024, 9:36 pm - Monir: milk 100
03/01/2024, 9:37 pm - Munia Mustari: 👍🏻`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(1);
            expect(result.transactions[0].item).toBe('milk');
        });

        it('should handle parsing errors gracefully', async () => {
            const content = `invalid line format
03/01/2024, 9:35 pm - Monir: milk 100
another invalid line`;

            const result = await parser.parseFile(content);

            expect(result.transactions).toHaveLength(1);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('testPattern', () => {
        it('should test transaction patterns correctly', () => {
            const results = parser.testPattern('milk 100 bread 50');

            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({ item: 'milk', amount: 100 });
            expect(results[1]).toEqual({ item: 'bread', amount: 50 });
        });

        it('should handle colon-separated patterns', () => {
            const results = parser.testPattern('milk: 100');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ item: 'milk', amount: 100 });
        });

        it('should handle dash-separated patterns', () => {
            const results = parser.testPattern('milk - 100');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ item: 'milk', amount: 100 });
        });

        it('should handle "for" patterns', () => {
            const results = parser.testPattern('100 for milk');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ item: 'milk', amount: 100 });
        });
    });

    describe('configuration', () => {
        it('should allow updating configuration', () => {
            const newConfig = {
                currencySymbol: '$',
                dateFormat: 'MM/DD/YYYY'
            };

            parser.updateConfig(newConfig);
            const config = parser.getConfig();

            expect(config.currencySymbol).toBe('$');
            expect(config.dateFormat).toBe('MM/DD/YYYY');
        });
    });
});