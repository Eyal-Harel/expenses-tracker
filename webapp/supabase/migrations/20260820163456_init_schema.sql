-- Phase 2 schema: transactions, category_rules, categories — all per-user,
-- isolated via Row Level Security. Mirrors the Transaction shape already
-- proven in scripts/categorize/parsers/common.py, with genuine upgrades a
-- real database gives for free: NUMERIC instead of float for money, and a
-- unique constraint that replaces the manual dedup checks Phase 1 relied on.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  charge_date date not null,
  source text not null check (source in ('Bank', 'Cal', 'Max')),
  merchant text not null,
  amount numeric(12, 2) not null,
  category text,
  needs_review boolean not null default false,
  done_by text check (done_by in ('Script', 'AI', 'Manual')),
  created_at timestamptz not null default now(),
  unique (user_id, source, merchant, date, amount)
);

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, merchant)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  section text not null check (section in ('Credits', 'Fixed Expenses', 'Running Expenses', 'Irregular Expenses', 'Excluded')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;
alter table public.categories enable row level security;

create policy "select own transactions" on public.transactions for select using (user_id = auth.uid());
create policy "insert own transactions" on public.transactions for insert with check (user_id = auth.uid());
create policy "update own transactions" on public.transactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own transactions" on public.transactions for delete using (user_id = auth.uid());

create policy "select own category_rules" on public.category_rules for select using (user_id = auth.uid());
create policy "insert own category_rules" on public.category_rules for insert with check (user_id = auth.uid());
create policy "update own category_rules" on public.category_rules for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own category_rules" on public.category_rules for delete using (user_id = auth.uid());

create policy "select own categories" on public.categories for select using (user_id = auth.uid());
create policy "insert own categories" on public.categories for insert with check (user_id = auth.uid());
create policy "update own categories" on public.categories for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own categories" on public.categories for delete using (user_id = auth.uid());

-- Seeds every new user with the same 19-category taxonomy already proven in
-- the Google Sheet, so the app is immediately usable with zero setup. The
-- table is genuinely per-user (not a hardcoded global list), so nothing
-- blocks a future "manage my categories" UI even though v1 doesn't build one.
-- "Irrelevant" is included (section 'Excluded') so it stays a selectable
-- category — matching Phase 1, it's a real category, just excluded from the
-- Credits/Fixed/Running/Irregular rollup grouping.
create function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, section) values
    (new.id, 'Salary', 'Credits'),
    (new.id, 'Other Credits', 'Credits'),
    (new.id, 'Reserved Duty', 'Credits'),
    (new.id, 'Rent', 'Fixed Expenses'),
    (new.id, 'Bills', 'Fixed Expenses'),
    (new.id, 'Subscriptions', 'Running Expenses'),
    (new.id, 'Transportation', 'Running Expenses'),
    (new.id, 'Groceries + Daily Produce', 'Running Expenses'),
    (new.id, 'Psychologist', 'Running Expenses'),
    (new.id, 'Clothing + Ali Express', 'Running Expenses'),
    (new.id, 'Recreations & Wolt', 'Running Expenses'),
    (new.id, 'Friends weddings', 'Running Expenses'),
    (new.id, 'Aesthetics', 'Running Expenses'),
    (new.id, 'Health', 'Running Expenses'),
    (new.id, 'Paybox / Bit', 'Running Expenses'),
    (new.id, 'Bank Fees', 'Running Expenses'),
    (new.id, 'Others', 'Running Expenses'),
    (new.id, 'Travel', 'Irregular Expenses'),
    (new.id, 'Furniture', 'Irregular Expenses'),
    (new.id, 'Others Irregulars', 'Irregular Expenses'),
    (new.id, 'Irrelevant', 'Excluded');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_default_categories();
