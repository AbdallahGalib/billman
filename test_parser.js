// Simple test to verify the parser works with কেনা amounts
import { WhatsAppParser } from './src/lib/services/whatsappParser.ts';

const testContent = `04/10/2025, 9:20pm - Monir: লেনদেন রেকর্ড 
কাস্টমার মোবাইল নং 01784414331
৪ অক্টোবর ২০২৫ , ০৯:২০ PM

পূর্বের বাকি ৮,৭৬৩
কেনা ২০
বর্তমান বাকি ৮,৭৮৩

বিবরণ biscuit 

04/10/2025, 10:23pm - Monir: লেনদেন রেকর্ড 
কাস্টমার মোবাইল নং 01784414331
৪ অক্টোবর ২০২৫ , ১০:২৩ PM

পূর্বের বাকি ৮,৭৮৩
কেনা ১২০
বর্তমান বাকি ৮,৯০৩

বিবরণ ice 75
chips 20
biscuit 25`;

async function testParser() {
  const parser = new WhatsAppParser();
  const result = await parser.parseFile(testContent);
  
  console.log('Parsed transactions:');
  result.transactions.forEach(t => {
    console.log(`- ${t.item}: ${t.amount} (${t.date.toLocaleDateString()})`);
  });
  
  console.log(`\nTotal transactions: ${result.transactions.length}`);
  console.log(`Errors: ${result.errors.length}`);
}

testParser().catch(console.error);