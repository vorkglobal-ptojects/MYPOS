-- ================================================================================
-- MIFOS SYSTEM - MIGRATION 003: SCHEMA REPAIR & MISSING COLUMNS
-- ================================================================================
-- Execute this migration script in Supabase SQL Editor to repair column names,
-- add missing tables, and align database schema for double-entry GL accounting.

-- 1. CREATE MISSING public.transaction TABLE
CREATE TABLE IF NOT EXISTS public.transaction (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
    target_branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transaction ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated transaction access" ON public.transaction;
CREATE POLICY "Allow authenticated transaction access" ON public.transaction FOR ALL USING (true);


-- 2. ADD MISSING COLUMNS TO public.daily_ledgers
ALTER TABLE public.daily_ledgers 
ADD COLUMN IF NOT EXISTS opening_capital NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS transfer_in_type TEXT,
ADD COLUMN IF NOT EXISTS transfer_out_type TEXT,
ADD COLUMN IF NOT EXISTS is_flag_ignored BOOLEAN DEFAULT FALSE;


-- 3. ADD MISSING COLUMNS TO public.daily_ledger_transactions
ALTER TABLE public.daily_ledger_transactions 
ADD COLUMN IF NOT EXISTS fs_type TEXT,
ADD COLUMN IF NOT EXISTS redeem_no TEXT,
ADD COLUMN IF NOT EXISTS type_ir TEXT,
ADD COLUMN IF NOT EXISTS quantity TEXT;


-- 4. ADD MISSING bill_no AND COLLATERAL COLUMNS TO public.pawns
ALTER TABLE public.pawns 
ADD COLUMN IF NOT EXISTS bill_no TEXT,
ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10,3) DEFAULT 0.000,
ADD COLUMN IF NOT EXISTS weight_mg NUMERIC(10,3) DEFAULT 0.000,
ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2) DEFAULT 3.50,
ADD COLUMN IF NOT EXISTS period_months INTEGER DEFAULT 3;


-- 5. ADD MISSING PROFILE DETAILS TO public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- 6. STANDARDIZE public.clients COLUMNS TO SNAKE_CASE
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'nationalId'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "nationalId" TO national_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'firstName'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "firstName" TO first_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'lastName'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "lastName" TO last_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'branchId'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "branchId" TO branch_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'createdByUserId'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "createdByUserId" TO created_by_user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE public.clients RENAME COLUMN "createdAt" TO created_at;
    END IF;
END $$;

-- 7. RELAX NOT NULL CONSTRAINT ON CREATED_BY_USER_ID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'createdByUserId'
    ) THEN
        ALTER TABLE public.clients ALTER COLUMN "createdByUserId" DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'created_by_user_id'
    ) THEN
        ALTER TABLE public.clients ALTER COLUMN created_by_user_id DROP NOT NULL;
    END IF;
END $$;
-- ================================================================================
