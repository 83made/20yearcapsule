-- Moderation state and refund tracking.
--
-- Two things this has to get right:
--   1. A removed entry must disappear from the public wall but must NOT disappear from the
--      accounting — we still need to know a payment happened and whether it was refunded.
--   2. A refund must be recorded so a bulk refund run can never double-refund. Stripe is
--      idempotent per-charge, but we should not rely on discovering that by trying.

-- ---------------------------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------------------------
alter table public.capsule_entries
  add column if not exists flagged       boolean not null default false,
  add column if not exists flag_reasons  text[]  not null default '{}',
  add column if not exists reviewed_at   timestamptz,
  add column if not exists removed_at    timestamptz,
  add column if not exists removal_note  text;

create index if not exists capsule_entries_flagged_idx
  on public.capsule_entries (flagged) where flagged and reviewed_at is null;

create index if not exists capsule_entries_removed_idx
  on public.capsule_entries (removed_at) where removed_at is not null;

-- ---------------------------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------------------------
alter table public.capsule_entries
  add column if not exists refunded_at        timestamptz,
  add column if not exists stripe_refund_id   text,
  add column if not exists stripe_payment_intent text;

create index if not exists capsule_entries_refund_idx
  on public.capsule_entries (refunded_at) where refunded_at is null;

-- ---------------------------------------------------------------------------------------------
-- Removing an entry pulls it off the public wall, keeping the two tables consistent.
-- The row in capsule_entries stays — we need it for the refund and the audit trail.
-- ---------------------------------------------------------------------------------------------
create or replace function public.capsule_sync_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    delete from public.capsule_wall where seq = new.seq;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capsule_sync_removal on public.capsule_entries;
create trigger trg_capsule_sync_removal
  after update of removed_at on public.capsule_entries
  for each row execute function public.capsule_sync_removal();

-- ---------------------------------------------------------------------------------------------
-- Public counters must not count removed entries.
-- ---------------------------------------------------------------------------------------------
create or replace function public.capsule_stats()
returns table (total bigint, last_sealed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint, max(created_at) from public.capsule_wall;
$$;

revoke all on function public.capsule_stats() from public;
grant execute on function public.capsule_stats() to anon, authenticated;
