-- Re-derives the Sheets Summary tab's core aggregation as a real SQL view:
-- per-user, per-category, per-month totals, grouped by charge_date (not
-- deal date — the whole point of the earlier charge-date work, so this
-- lines up with real bank statements). ABS() is applied after SUM(), not
-- per-row, so refunds correctly net out before the sign gets normalized —
-- same reasoning already validated in the Sheets formulas. 'Irrelevant' is
-- excluded (fund transfers / bank noise, never real spend or income), and
-- rows with an unknown charge_date are excluded rather than guessed at.
--
-- security_invoker = true is required for RLS on the underlying tables to
-- actually apply to queries against this view — without it, Postgres runs
-- the view with its creator's permissions instead of the querying user's.
create view public.monthly_category_totals
with (security_invoker = true)
as
select
  c.user_id,
  c.section,
  c.name as category,
  date_trunc('month', t.charge_date)::date as month,
  abs(sum(t.amount)) as total
from public.transactions t
join public.categories c on c.user_id = t.user_id and c.name = t.category
where t.category is not null
  and t.category <> 'Irrelevant'
  and t.charge_date is not null
group by c.user_id, c.section, c.name, date_trunc('month', t.charge_date);
