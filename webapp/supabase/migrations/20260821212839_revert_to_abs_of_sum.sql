-- Reverts the previous migration (20260821173231): that "fix" was itself
-- wrong. Verified directly against the Google Sheet's real Summary tab
-- formula (=ABS(SUMIFS(...))) and its live computed values (e.g. June
-- Travel = 502, June Bank Fees = 18) — the Sheet takes the absolute value
-- of the NET sum per category, not the sum of absolute values. This is
-- also the economically correct behavior: a refund/return in the same
-- category as the original purchase should net against it (e.g. a ₪695
-- clothing refund reduces that month's Clothing spend), not get added on
-- top as if it were itself an expense. The June/July gaps this was
-- originally meant to explain were always fully accounted for by real
-- categorization mismatches (already identified separately), not by this
-- aggregation choice.
create or replace view public.monthly_category_totals
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
