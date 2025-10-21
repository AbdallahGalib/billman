import { WhatsAppParser } from './src/lib/services/whatsappParser.ts';
import fs from 'fs';

const content = fs.readFileSync('WhatsApp Chat with Monir.txt', 'utf8');

async function debug() {
  const parser = new WhatsAppParser();
  const result = await parser.parseFile(content);
  
  console.log(`Found ${result.transactions.length} transactions:`);
  result.transactions.forEach((t, i) => {
    console.log(`${i+1}. ${t.item} - ${t.amount} (${t.date.toDateString()})`);
  });
}

debug();