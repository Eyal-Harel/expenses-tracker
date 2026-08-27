-- Adds IsraCard as a fourth supported import source, alongside Bank/Cal/Max.
alter table public.transactions
  drop constraint transactions_source_check,
  add constraint transactions_source_check check (source in ('Bank', 'Cal', 'Max', 'IsraCard'));
