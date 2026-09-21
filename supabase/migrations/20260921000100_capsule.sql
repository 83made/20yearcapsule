-- The 20 Year Capsule — schema.
--
-- The entire product is a promise that nobody reads these messages until 2047. That promise is
-- enforced HERE, in the database, not in the frontend. Two tables, deliberately:
--
--   capsule_entries  — holds the message text. NO anon/authenticated access at all. Ever.
--   capsule_wall     — redacted public metadata only. Never contains message text.
--
-- Why two tables rather than one with a view: RLS cannot restrict columns, and a Postgres view
-- runs as its owner by default, which quietly bypasses the underlying table's RLS. A separate
-- table written by the webhook has no such subtlety — there is simply no path from the anon key
-- to the message text.

-- ---------------------------------------------------------------------------------------------
-- Sealed contents. service_role only.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.capsule_entries (
  id                  uuid primary key default gen_random_uuid(),
  seq                 bigint generated always as identity,
  message             text not null check (char_length(message) between 1 and 100),
  message_hash        text not null,           -- sha256 hex of `message`, published on the wall
  display_name        text,                    -- shown publicly; null = Anonymous
  location            text,                    -- shown publicly, free text e.g. "Reno, NV"
  contact_email       text,                    -- so we can tell them in 2047; never shown publicly
  stripe_session_id   text unique not null,
  amount_cents        integer not null,
  created_at          timestamptz not null default now()
);

create index if not exists capsule_entries_seq_idx on public.capsule_entries (seq);
create index if not exists capsule_entries_created_idx on public.capsule_entries (created_at);

alter table public.capsule_entries enable row level security;
-- No policies are created on purpose. RLS with zero policies denies everything to anon and
-- authenticated. service_role bypasses RLS, which is how the webhook writes. Do not add a
-- SELECT policy here for any reason — that would break the only promise this site makes.

-- ---------------------------------------------------------------------------------------------
-- Public wall. Redacted metadata only — no message text, no email.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.capsule_wall (
  seq            bigint primary key,
  display_name   text,
  location       text,
  char_count     integer not null check (char_count between 1 and 100),
  message_hash   text not null,
  created_at     timestamptz not null default now()
);

create index if not exists capsule_wall_created_idx on public.capsule_wall (created_at desc);

alter table public.capsule_wall enable row level security;

drop policy if exists "wall is world readable" on public.capsule_wall;
create policy "wall is world readable"
  on public.capsule_wall for select
  to anon, authenticated
  using (true);
-- No insert/update/delete policies: only service_role (the webhook) writes here.

-- ---------------------------------------------------------------------------------------------
-- Counters, without exposing the entries table.
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

-- ---------------------------------------------------------------------------------------------
-- Guard: a message must not be insertable after the capsule seals.
-- Belt and braces — the edge function checks this too, but the clock that matters is the database's.
-- 2026-12-31 23:59:59 PST == 2027-01-01 07:59:59 UTC
-- ---------------------------------------------------------------------------------------------
create or replace function public.capsule_reject_after_seal()
returns trigger
language plpgsql
as $$
begin
  if now() >= timestamptz '2027-01-01 07:59:59+00' then
    raise exception 'The capsule sealed on 2026-12-31 23:59:59 PST. No further entries.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capsule_seal_guard on public.capsule_entries;
create trigger trg_capsule_seal_guard
  before insert on public.capsule_entries
  for each row execute function public.capsule_reject_after_seal();
