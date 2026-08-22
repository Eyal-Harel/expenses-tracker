-- The original seed list was the owner's personal taxonomy verbatim, including
-- categories that only make sense for one specific life situation (Israeli
-- military reserve duty pay, a specific therapist line item) rather than a
-- generic starter set any new signup would recognize. Drops those two;
-- everyone can still add them back (or anything else) via the app's own
-- "add category" flow. Only affects NEW signups going forward — does not
-- touch any existing user's already-seeded categories or transactions.
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, section) values
    (new.id, 'Salary', 'Credits'),
    (new.id, 'Other Credits', 'Credits'),
    (new.id, 'Rent', 'Fixed Expenses'),
    (new.id, 'Bills', 'Fixed Expenses'),
    (new.id, 'Subscriptions', 'Running Expenses'),
    (new.id, 'Transportation', 'Running Expenses'),
    (new.id, 'Groceries + Daily Produce', 'Running Expenses'),
    (new.id, 'Clothing + Ali Express', 'Running Expenses'),
    (new.id, 'Recreations & Wolt', 'Running Expenses'),
    (new.id, 'Friends weddings', 'Running Expenses'),
    (new.id, 'Aesthetics', 'Running Expenses'),
    (new.id, 'Health', 'Running Expenses'),
    (new.id, 'Paybox / Bit', 'Running Expenses'),
    (new.id, 'Bank Fees', 'Running Expenses'),
    (new.id, 'Others', 'Running Expenses'),
    (new.id, 'Travel', 'Irregular Expenses'),
    (new.id, 'Furniture', 'Irregular Expenses'),
    (new.id, 'Others Irregulars', 'Irregular Expenses'),
    (new.id, 'Irrelevant', 'Excluded');
  return new;
end;
$$;
