-- Bug fix: the original view computed abs(sum(amount)) — absolute value of
-- the NET — instead of sum(abs(amount)), the sum of each row's absolute
-- value. Those only agree when every row in a category shares one sign.
-- Discovered comparing real June data against the Google Sheet: a Travel
-- refund (-68.02 among 8 positive charges) made abs(sum()) undercount that
-- category by 136, and a Bank Fees reversal undercounted by another 30 —
-- both silently netted away instead of being counted as real spend.
create or replace view public.monthly_category_totals
with (security_invoker = true)
as
select
  c.user_id,
  c.section,
  c.name as category,
  date_trunc('month', t.charge_date)::date as month,
  sum(abs(t.amount)) as total
from public.transactions t
join public.categories c on c.user_id = t.user_id and c.name = t.category
where t.category is not null
  and t.category <> 'Irrelevant'
  and t.charge_date is not null
group by c.user_id, c.section, c.name, date_trunc('month', t.charge_date);
