-- The original unique constraint (user_id, source, merchant, date, amount)
-- can't tell apart legitimate multi-installment purchases: a single Max
-- purchase split into N monthly installments produces N rows sharing the
-- exact same source/merchant/date/amount (the installment amount, e.g.
-- 1600 three times for a 4800 purchase), differing only in charge_date —
-- which the old constraint didn't cover. Discovered via a real "payment 3
-- of 3" charge that turned out to be one of three identical rows, only two
-- of which could ever be inserted under the old constraint.
alter table public.transactions
  drop constraint transactions_user_id_source_merchant_date_amount_key,
  add constraint transactions_user_id_source_merchant_date_amount_charge_date_key
    unique (user_id, source, merchant, date, amount, charge_date);
