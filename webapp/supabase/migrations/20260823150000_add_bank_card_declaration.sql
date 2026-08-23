-- Captures which bank/card providers a user actually uses, asked once at
-- onboarding. Free text, not a fixed enum, since only Bank Leumi/Cal/Max
-- are supported today — this is purely foreshadowing the multi-parser
-- future (more testers, more providers), not wired into any conditional
-- UI yet. Nullable/optional: skippable, never blocks onboarding.
alter table public.user_settings add column bank_name text;
alter table public.user_settings add column card_companies text;
