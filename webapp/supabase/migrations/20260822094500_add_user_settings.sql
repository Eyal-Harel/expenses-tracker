-- BYO Gemini API key per user, so Tier-2 LLM categorization isn't bottlenecked
-- by one shared owner key's free-tier daily quota. Named/shaped so adding
-- more providers later (anthropic_api_key, openai_api_key) is additive.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "select own user_settings" on public.user_settings for select using (user_id = auth.uid());
create policy "insert own user_settings" on public.user_settings for insert with check (user_id = auth.uid());
create policy "update own user_settings" on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
