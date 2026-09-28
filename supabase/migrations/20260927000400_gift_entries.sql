-- Gift entries.
--
-- A gift is an ordinary sealed note with a second person attached: the buyer writes it, the
-- recipient is told immediately that it exists, and neither of them reads it until 2047. It is
-- deliberately NOT a prepaid slot the recipient redeems later. A redemption model would need codes,
-- an expiry before the December 31 seal, and a rule for what happens to a code that is bought and
-- never used — which lands straight on the refund threshold, since an unredeemed code is money
-- taken for an entry that does not exist.
--
-- Three columns, and the split between them is the same split the whole schema turns on:
--
--   recipient_email  is contact data. It goes in capsule_entries ONLY, alongside contact_email,
--                    and is never published. It exists so the 2047 send reaches the person the
--                    note was written for and not only the person who paid.
--   recipient_name   is published, exactly like display_name, because "from Jon — for Sarah" on
--                    the wall is the entire point of a gift being public. The compose form says
--                    so before it is typed.
--   is_gift          is published, so the wall can mark it without inferring from a null name.

-- ---------------------------------------------------------------------------------------------
-- Sealed side.
-- ---------------------------------------------------------------------------------------------
alter table public.capsule_entries
  add column if not exists is_gift         boolean not null default false,
  add column if not exists recipient_name  text,
  add column if not exists recipient_email text;

-- A gift with nobody to give it to is a data error, not a product state. Written as NOT VALID so
-- the 144 rows sealed before gifts existed are not re-checked: they are all is_gift = false and
-- therefore already satisfy it, but validating a live table under a webhook write is a lock this
-- does not need to take.
alter table public.capsule_entries
  drop constraint if exists capsule_entries_gift_has_recipient;
alter table public.capsule_entries
  add constraint capsule_entries_gift_has_recipient
  check (not is_gift or (recipient_name is not null and char_length(btrim(recipient_name)) > 0))
  not valid;

-- The 2047 mail-merge reads this. A gift has up to two people to reach and the buyer's address is
-- already indexed by contact_email; this covers the other one.
create index if not exists capsule_entries_recipient_email_idx
  on public.capsule_entries (recipient_email)
  where recipient_email is not null;

-- ---------------------------------------------------------------------------------------------
-- Public side. recipient_email is absent from this table on purpose and must stay absent.
-- ---------------------------------------------------------------------------------------------
alter table public.capsule_wall
  add column if not exists is_gift        boolean not null default false,
  add column if not exists recipient_name text;

create index if not exists capsule_wall_gift_idx
  on public.capsule_wall (is_gift)
  where is_gift;

-- ---------------------------------------------------------------------------------------------
-- Removal has to take the recipient's name down too.
-- ---------------------------------------------------------------------------------------------
-- capsule_sync_removal already deletes the whole wall row when removed_at is set, so the
-- recipient's name goes with it. Re-asserted here only as a note for anyone who later changes that
-- trigger to blank columns instead of deleting the row: recipient_name is a third party's name and
-- must be cleared in that case too.
