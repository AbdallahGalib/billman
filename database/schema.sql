-- WhatsApp Purchase Analyzer Database Schema
-- This file contains the SQL commands to set up the database schema in Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  sender TEXT NOT NULL,
  item TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  original_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender);
CREATE INDEX IF NOT EXISTS idx_transactions_item ON transactions(item);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_date_sender ON transactions(date, sender);
CREATE INDEX IF NOT EXISTS idx_transactions_item_amount ON transactions(item, amount);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS (adjust based on your authentication needs)
-- For now, we'll allow all operations for authenticated users
-- In production, you might want to restrict based on user_id

-- Policy for SELECT operations
CREATE POLICY "Allow authenticated users to view transactions" ON transactions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for INSERT operations
CREATE POLICY "Allow authenticated users to insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for UPDATE operations
CREATE POLICY "Allow authenticated users to update transactions" ON transactions
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy for DELETE operations
CREATE POLICY "Allow authenticated users to delete transactions" ON transactions
    FOR DELETE USING (auth.role() = 'authenticated');

-- If you want to allow anonymous access (for demo purposes), use these policies instead:
-- WARNING: Only use these for development/demo environments

-- DROP POLICY IF EXISTS "Allow authenticated users to view transactions" ON transactions;
-- DROP POLICY IF EXISTS "Allow authenticated users to insert transactions" ON transactions;
-- DROP POLICY IF EXISTS "Allow authenticated users to update transactions" ON transactions;
-- DROP POLICY IF EXISTS "Allow authenticated users to delete transactions" ON transactions;

-- CREATE POLICY "Allow anonymous access to transactions" ON transactions
--     FOR ALL USING (true);

-- Create a view for analytics (optional)
CREATE OR REPLACE VIEW transaction_analytics AS
SELECT 
    DATE_TRUNC('month', date) as month,
    sender,
    item,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount,
    MIN(amount) as min_amount,
    MAX(amount) as max_amount
FROM transactions
GROUP BY DATE_TRUNC('month', date), sender, item
ORDER BY month DESC, total_amount DESC;

-- Create a function to get monthly spending summary
CREATE OR REPLACE FUNCTION get_monthly_spending()
RETURNS TABLE (
    month TEXT,
    year INTEGER,
    total_amount DECIMAL,
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE_TRUNC('month', t.date), 'Month') as month,
        EXTRACT(YEAR FROM t.date)::INTEGER as year,
        SUM(t.amount) as total_amount,
        COUNT(*) as transaction_count
    FROM transactions t
    GROUP BY DATE_TRUNC('month', t.date), EXTRACT(YEAR FROM t.date)
    ORDER BY DATE_TRUNC('month', t.date) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get item distribution
CREATE OR REPLACE FUNCTION get_item_distribution()
RETURNS TABLE (
    item TEXT,
    count BIGINT,
    total_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.item,
        COUNT(*) as count,
        SUM(t.amount) as total_amount
    FROM transactions t
    GROUP BY t.item
    ORDER BY COUNT(*) DESC, SUM(t.amount) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get transaction statistics
CREATE OR REPLACE FUNCTION get_transaction_stats()
RETURNS TABLE (
    total_transactions BIGINT,
    total_amount DECIMAL,
    average_amount DECIMAL,
    earliest_date TIMESTAMP WITH TIME ZONE,
    latest_date TIMESTAMP WITH TIME ZONE,
    unique_items BIGINT,
    unique_senders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        COUNT(DISTINCT item) as unique_items,
        COUNT(DISTINCT sender) as unique_senders
    FROM transactions;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data (optional, for testing)
-- Uncomment the following lines if you want to insert sample data

/*
INSERT INTO transactions (date, sender, item, amount, original_message) VALUES
('2024-01-03 21:35:00+00', 'Monir', 'alo', 140, 'alo 140'),
('2024-01-03 21:35:00+00', 'Monir', 'chapati', 110, 'chapati 110'),
('2024-01-03 21:35:00+00', 'Monir', 'milk', 100, 'milk 100'),
('2024-01-03 21:35:00+00', 'Monir', 'dim', 45, 'dim 45'),
('2024-01-04 22:43:00+00', 'Monir', 'ghee', 160, 'ghee 160'),
('2024-01-04 22:43:00+00', 'Monir', 'sauce', 100, 'sauce 100');
*/

-- Grant necessary permissions (adjust based on your needs)
-- These are typically handled by Supabase automatically, but included for completeness

-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT ALL ON transactions TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_monthly_spending() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_item_distribution() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_transaction_stats() TO authenticated;