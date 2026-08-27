-- card_companies now actually drives which upload slots a user sees (not
-- just stored for reference), so it needs to be a real list rather than
-- free text. Existing values are simple comma-separated names ("Cal, Max")
-- that split cleanly into the new array column.
alter table public.user_settings add column card_companies_new text[];

update public.user_settings
set card_companies_new = (
  select array_agg(trim(value))
  from unnest(string_to_array(card_companies, ',')) as value
  where trim(value) <> ''
)
where card_companies is not null;

alter table public.user_settings drop column card_companies;
alter table public.user_settings rename column card_companies_new to card_companies;
