-- charge_date can genuinely be unknown: Cal only states it once per file in
-- the title line (the very first Cal export we ever received didn't have
-- that line at all), and Max's per-row charge-date cell can in principle be
-- empty/malformed. NOT NULL would silently reject those rows on import
-- rather than recording them with an honestly-unknown charge date. Any
-- future charge-date-based monthly grouping (the Summary view) needs to
-- account for nulls here rather than assume every row has one.
alter table public.transactions alter column charge_date drop not null;
