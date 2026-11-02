-- ================================================================
-- MIFOS PRODUCTION MIGRATION 001: KAHATHOTUWA BRANCH & HARDENED RLS
-- ================================================================

-- 1. Ensure Kahathotuwa (KHT) branch exists in public.branches
INSERT INTO public.branches (id, name, is_active, created_at)
VALUES ('KHT', 'Kahathotuwa', true, NOW())
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    is_active = true;

-- 2. Ensure initial branch_status for KHT exists
INSERT INTO public.branch_status (branch_id, status, updated_at)
VALUES ('KHT', 'CLOSED', NOW())
ON CONFLICT (branch_id) DO NOTHING;

-- 3. SQL Helper Functions for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_branch_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. Harden Row Level Security (RLS) Policies Across All Tables

-- --- BRANCHES ---
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public branches select" ON public.branches;
DROP POLICY IF EXISTS "Public branches insert" ON public.branches;
DROP POLICY IF EXISTS "Public branches update" ON public.branches;

CREATE POLICY "Authenticated branches select" ON public.branches
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin branches modify" ON public.branches
FOR ALL USING (public.get_auth_user_role() = 'ADMIN');

-- --- PROFILES ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;

CREATE POLICY "Users read own or Admin reads all profiles" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR public.get_auth_user_role() = 'ADMIN'
);

CREATE POLICY "Users update own profile or Admin updates all" ON public.profiles
FOR UPDATE USING (
  id = auth.uid() OR public.get_auth_user_role() = 'ADMIN'
);

CREATE POLICY "Admin insert profile" ON public.profiles
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR id = auth.uid()
);

-- --- BRANCH STATUS ---
ALTER TABLE public.branch_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public branch_status select" ON public.branch_status;
DROP POLICY IF EXISTS "Public branch_status insert" ON public.branch_status;
DROP POLICY IF EXISTS "Public branch_status update" ON public.branch_status;

CREATE POLICY "Authenticated branch_status select" ON public.branch_status
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Branch status modify" ON public.branch_status
FOR UPDATE USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

-- --- CLIENTS ---
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public clients select" ON public.clients;
DROP POLICY IF EXISTS "Public clients insert" ON public.clients;
DROP POLICY IF EXISTS "Public clients update" ON public.clients;

CREATE POLICY "Clients branch read" ON public.clients
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR "branchId" = public.get_auth_user_branch_id()
);

CREATE POLICY "Clients branch insert" ON public.clients
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR "branchId" = public.get_auth_user_branch_id()
);

CREATE POLICY "Clients branch update" ON public.clients
FOR UPDATE USING (
  public.get_auth_user_role() = 'ADMIN' OR "branchId" = public.get_auth_user_branch_id()
);

-- --- PAWNS ---
ALTER TABLE public.pawns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public pawns select" ON public.pawns;
DROP POLICY IF EXISTS "Public pawns insert" ON public.pawns;
DROP POLICY IF EXISTS "Public pawns update" ON public.pawns;

CREATE POLICY "Pawns branch read" ON public.pawns
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Pawns branch insert" ON public.pawns
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Pawns branch update" ON public.pawns
FOR UPDATE USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

-- --- DAILY LEDGERS ---
ALTER TABLE public.daily_ledgers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public daily_ledgers select" ON public.daily_ledgers;
DROP POLICY IF EXISTS "Public daily_ledgers insert" ON public.daily_ledgers;
DROP POLICY IF EXISTS "Public daily_ledgers update" ON public.daily_ledgers;
DROP POLICY IF EXISTS "Public daily_ledgers delete" ON public.daily_ledgers;

CREATE POLICY "Daily ledgers branch read" ON public.daily_ledgers
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Daily ledgers branch insert" ON public.daily_ledgers
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Daily ledgers branch update" ON public.daily_ledgers
FOR UPDATE USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

-- --- VAULT TRANSFER ---
ALTER TABLE public.vault_transfer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public vault_transfer select" ON public.vault_transfer;
DROP POLICY IF EXISTS "Public vault_transfer insert" ON public.vault_transfer;
DROP POLICY IF EXISTS "Public vault_transfer update" ON public.vault_transfer;

CREATE POLICY "Vault transfer branch read" ON public.vault_transfer
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR from_vault = public.get_auth_user_branch_id() OR to_vault = public.get_auth_user_branch_id()
);

CREATE POLICY "Vault transfer branch insert" ON public.vault_transfer
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR from_vault = public.get_auth_user_branch_id()
);

-- --- STOCK ITEMS ---
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public stock_items select" ON public.stock_items;
DROP POLICY IF EXISTS "Public stock_items insert" ON public.stock_items;
DROP POLICY IF EXISTS "Public stock_items update" ON public.stock_items;

CREATE POLICY "Stock items branch read" ON public.stock_items
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Stock items branch insert" ON public.stock_items
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

-- --- STOCK CUSTOMERS ---
CREATE TABLE IF NOT EXISTS public.stock_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  branch_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public stock_customers select" ON public.stock_customers;
DROP POLICY IF EXISTS "Public stock_customers insert" ON public.stock_customers;
DROP POLICY IF EXISTS "Public stock_customers update" ON public.stock_customers;

CREATE POLICY "Stock customers branch read" ON public.stock_customers
FOR SELECT USING (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);

CREATE POLICY "Stock customers branch insert" ON public.stock_customers
FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'ADMIN' OR branch_id = public.get_auth_user_branch_id()
);
