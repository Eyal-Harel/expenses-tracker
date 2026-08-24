-- Signup gating: a valid, unused invite code is required to create an
-- account (checked in the signUp server action). Codes are created
-- manually by the app owner (SQL insert, or the /admin screen) and handed
-- to specific people directly — not self-serve, not published.
--
-- RLS is enabled with no policies at all — there's no authenticated user
-- yet at signup time to scope a policy to, and rather than expose a public
-- anonymous write path here, the signup action reads/claims codes via the
-- service_role admin client (see lib/supabase/admin.ts), which bypasses
-- RLS entirely. That leaves this table completely inaccessible through the
-- public REST API, reachable only from trusted server-side code.
create table public.invite_codes (
  code text primary key,
  used boolean not null default false,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;
