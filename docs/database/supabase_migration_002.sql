-- ================================================================
-- MIFOS MIGRATION 002: MULTI-ITEM PAWNS & SECURITY AUDIT LOGS
-- ================================================================

-- 1. Create pawn_items table for Multi-Item Pawns
create table if not exists public.pawn_items (
    id uuid default gen_random_uuid() primary key,
    pawn_id uuid references public.pawns(id) on delete cascade,
    item_type varchar(20) not null default 'CH',
    description text not null,
    weight_grams numeric(10, 3) not null default 0.000,
    weight_mg numeric(10, 3) not null default 0.000,
    appraised_value numeric(12, 2) not null default 0.00,
    created_at timestamptz default now()
);

-- 2. Create audit_logs table for Security Activity Tracking
create table if not exists public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid,
    user_email text,
    role text,
    branch_id text references public.branches(id) on delete set null,
    action text not null,
    resource text,
    details jsonb,
    created_at timestamptz default now()
);

-- 3. Enable RLS and add open policies
alter table public.pawn_items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Authenticated pawn_items select" on public.pawn_items;
drop policy if exists "Authenticated pawn_items insert" on public.pawn_items;
create policy "Authenticated pawn_items select" on public.pawn_items for select using (true);
create policy "Authenticated pawn_items insert" on public.pawn_items for insert with check (true);

drop policy if exists "Authenticated audit_logs select" on public.audit_logs;
drop policy if exists "Authenticated audit_logs insert" on public.audit_logs;
create policy "Authenticated audit_logs select" on public.audit_logs for select using (true);
create policy "Authenticated audit_logs insert" on public.audit_logs for insert with check (true);
