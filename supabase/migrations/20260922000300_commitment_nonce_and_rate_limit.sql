-- Two fixes found in the 2026-09-22 security sweep.
--
-- ============================================================================================
-- 1. The proof code was guessable. This is the important one.
-- ============================================================================================
--
-- The wall publishes, for every entry, to anyone with the public anon key:
--
--     display_name, location, char_count, message_hash = sha256(message)
--
-- An unsalted SHA-256 of a short English sentence is not a commitment, it is a lookup key. The
-- message space is small and the wall hands an attacker everything needed to search it:
--
--   * char_count gives the EXACT length, pruning the search space enormously
--   * display_name and location make the guessing targeted rather than generic
--   * plain SHA-256 runs at ~650k guesses/sec on one laptop core, and billions/sec on a GPU
--
-- So anyone could take a wordlist of plausible sentences, hash it once, and read a slice of the
-- capsule today. The site's own suggested examples are the worst case: the compose box PREFILLS
-- them on click, so every user who submits one unchanged is crackable from a 20-item list.
--
-- That defeats the only promise the site makes, twenty years early, and it fails silently — you
-- would never know it had happened.
--
-- The fix is a real commitment scheme. Each entry gets 32 bytes of secret randomness, and the
-- published code becomes:
--
--     sha256('capsule-v2|' || nonce || '|' || message)
--
-- The nonce lives in capsule_entries (which anon cannot read) and is released in 2047 alongside
-- the message. Then anyone can recompute the code and verify nothing changed — the property the
-- site advertises is fully preserved. But until then the nonce carries 256 bits of entropy, so
-- guessing the message is not merely expensive, it is useless: without the nonce every candidate
-- message is equally consistent with the published code.
--
-- This also means char_count can stay public, so the redaction bar still reflects real length.

alter table public.capsule_entries
  add column if not exists nonce text;

comment on column public.capsule_entries.nonce is
  'Per-entry secret randomness (32 bytes, hex). Published with the message in 2047 so the proof '
  'code can be verified. NEVER expose this before the capsule opens — it is what stops the '
  'published hash from being brute-forced against a wordlist.';

comment on column public.capsule_entries.message_hash is
  'sha256(''capsule-v2|'' || nonce || ''|'' || message). Published on the wall.';

-- ============================================================================================
-- 2. Checkout creation had no rate limit.
-- ============================================================================================
--
-- create-capsule-checkout accepts POST from any origin with no throttle. Ten rapid requests in
-- the sweep returned ten live Stripe Checkout Sessions. Nothing is charged for an abandoned
-- session, so this is not theft, but it lets anyone flood the Stripe account with junk sessions
-- and burn the Stripe API quota the real buyers need.
--
-- Counted per IP. Only a hash of the IP is stored: throttling does not require knowing who
-- anyone is, and a site whose entire pitch is "we do not look at your message" should not be
-- accumulating a table of visitor IP addresses.

create table if not exists public.capsule_rate_limit (
  id          bigserial primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists capsule_rate_limit_lookup_idx
  on public.capsule_rate_limit (ip_hash, created_at desc);

alter table public.capsule_rate_limit enable row level security;
-- Zero policies, as with capsule_entries: service_role only.

create or replace function public.capsule_rate_check(
  p_ip_hash text,
  p_limit   integer  default 15,
  p_window  interval default '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- Opportunistic cleanup; this table should never grow large.
  delete from public.capsule_rate_limit where created_at < now() - interval '3 hours';

  select count(*) into n
    from public.capsule_rate_limit
   where ip_hash = p_ip_hash
     and created_at > now() - p_window;

  if n >= p_limit then
    return false;
  end if;

  insert into public.capsule_rate_limit (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Callable only by the edge function's service role. anon must never be able to poke this.
revoke all on function public.capsule_rate_check(text, integer, interval) from public, anon, authenticated;
