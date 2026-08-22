# expenses-tracker web app (Phase 2)

Multi-tenant web app replacing the manual Google Sheets review with a real dashboard — built alongside, not instead of, the Phase 1 pipeline in `../scripts/categorize/` (which keeps running unchanged). See `../docs/runbook.md` for how that pipeline works; the parsing/categorization logic here is a from-scratch TypeScript port of the same rules, not a dependency on the Python code.

Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres + Auth), deployed on Vercel — all free-tier.

## Status

Scaffolded so far: Next.js + Tailwind + shadcn/ui, core UI components (table/dialog/input/label/card/badge), Supabase client helpers (`src/lib/supabase/client.ts` for Client Components, `src/lib/supabase/server.ts` for Server Components), and `src/proxy.ts` (Next.js 16's replacement for `middleware.ts` — session refresh + redirect signed-out users to `/login`).

Not yet built: the Supabase project itself, the database schema/RLS policies, auth pages, the TypeScript parser ports, or any real UI beyond the default scaffold page.

## Setup

```
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
