-- Gifts, done properly: a prepaid entry the recipient writes themselves.
--
-- The first attempt had the buyer write a note *to* someone. That is a different product. What this
-- is for: putting your mum in the capsule without making her pay $5 or face a Stripe checkout. She
-- gets a link, she writes her own sentence, it seals under her name.
--
-- The buyer therefore never writes anything and never appears in capsule_entries. They appear here.
--
-- ---------------------------------------------------------------------------------------------
-- Why a separate table rather than more columns on capsule_entries
-- ---------------------------------------------------------------------------------------------
-- A purchased gift is not an entry. It is a paid-for right to create one, and until it is redeemed
-- there is no message, no hash and nothing to put on the wall. Modelling it as a half-built entry
-- would mean capsule_entries could contain rows with no message, and every query and export in the
-- project assumes that cannot happen. It also keeps the funding count honest for free: the wall
-- counts entries, so an unredeemed gift simply is not in it.

create table if not exists public.capsule_gifts (
  id                  uuid primary key default gen_random_uuid(),

  -- sha256 of the token that appears in the redemption URL. The raw token is never stored, for the
  -- same reason a password is not: it is a bearer credential, and anyone holding it can write into
  -- the capsule. It exists in the buyer's email and their printable card, and nowhere else.
  token_hash          text unique not null,

  -- Who paid. purchaser_name is shown to the recipient ("a gift from Jon"), so it is screened
  -- before it is stored. purchaser_email gets the link, the card, and the refund if it lapses.
  purchaser_name      text,
  purchaser_email     text,

  -- Who it is for. Both optional: a buyer who intends to hand the card over in person does not
  -- need to tell us anything about them, and asking would be collecting a third party's address
  -- for no reason.
  recipient_name      text,
  recipient_email     text,

  -- An optional line from the buyer, shown on the redemption page only. Never sealed, never
  -- published, never in the capsule - it is wrapping paper, not contents.
  gift_note           text check (gift_note is null or char_length(gift_note) <= 200),

  stripe_session_id   text unique not null,
  stripe_payment_intent text,
  amount_cents        integer not null,

  -- Redemption. entry_seq is the entry the recipient created, so a gift can be traced to what it
  -- became without capsule_entries having to know it was a gift at all.
  redeemed_at         timestamptz,
  entry_seq           bigint,

  -- Lapsed gifts are refunded when the capsule seals: money was taken for an entry that now cannot
  -- exist. Mirrors the columns on capsule_entries so refund-all.mjs can treat both the same way.
  refunded_at         timestamptz,
  stripe_refund_id    text,

  created_at          timestamptz not null default now(),

  -- A redeemed gift must know what it became, and an unredeemed one must not claim to.
  constraint capsule_gifts_redeemed_has_entry
    check ((redeemed_at is null) = (entry_seq is null))
);

create index if not exists capsule_gifts_token_idx on public.capsule_gifts (token_hash);
create index if not exists capsule_gifts_open_idx
  on public.capsule_gifts (created_at)
  where redeemed_at is null and refunded_at is null;
create index if not exists capsule_gifts_purchaser_idx
  on public.capsule_gifts (purchaser_email)
  where purchaser_email is not null;

alter table public.capsule_gifts enable row level security;
-- Zero policies, exactly like capsule_entries. anon and authenticated are denied everything; only
-- service_role touches this table. A SELECT policy here would expose token hashes, both email
-- addresses and the buyer's private note in one go. Redemption goes through an edge function that
-- takes the raw token and looks up its hash - never through PostgREST.

-- ---------------------------------------------------------------------------------------------
-- Capacity has to count outstanding gifts.
-- ---------------------------------------------------------------------------------------------
-- A paid gift has reserved a slot even though no entry exists yet. Counting only the wall would let
-- the capsule oversell itself, and the person turned away at the door would be the recipient of a
-- present someone already paid for - the worst possible person to refuse.
create or replace function public.capsule_slots_taken()
returns bigint
language sql
security definer
set search_path = public
as $$
  select (select count(*) from public.capsule_wall)
       + (select count(*) from public.capsule_gifts
          where redeemed_at is null and refunded_at is null);
$$;

revoke all on function public.capsule_slots_taken() from public, anon, authenticated;
-- service_role only: it reads a table anon cannot see, and the honest public number is the wall.

-- ---------------------------------------------------------------------------------------------
-- Public stat: how many gifts are waiting to be written.
-- ---------------------------------------------------------------------------------------------
-- Deliberately a bare count and nothing else. It is the one fact about gifts that is safe to make
-- public and is worth showing ("9 notes are waiting to be written"), and it exposes no token, no
-- address and no name.
create or replace function public.capsule_gift_stats()
returns table (outstanding bigint)
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from public.capsule_gifts
  where redeemed_at is null and refunded_at is null;
$$;

revoke all on function public.capsule_gift_stats() from public;
grant execute on function public.capsule_gift_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Redemption, as one transaction.
-- ---------------------------------------------------------------------------------------------
-- Claiming the gift and creating the entry have to be atomic. Doing it from the edge function in
-- two steps has no safe order: create the entry first and a lost race leaves an orphan entry that
-- one payment bought twice; claim first and the row violates the redeemed/entry_seq constraint in
-- the window between. FOR UPDATE makes the question "is this gift still open" un-racy, and the
-- whole thing commits or none of it does.
--
-- The commitment (nonce + hash) is computed by the caller so that sha256('capsule-v2|'||nonce||'|'
-- ||message) lives in exactly one place in the codebase, rather than being reimplemented in SQL
-- where it could drift from the webhook's version and quietly produce unverifiable entries.
create or replace function public.capsule_redeem_gift(
  p_token_hash   text,
  p_message      text,
  p_message_hash text,
  p_nonce        text,
  p_display_name text,
  p_location     text,
  p_email        text,
  p_flagged      boolean default false,
  p_flag_reasons text[] default '{}'
)
returns table (seq bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift   public.capsule_gifts%rowtype;
  v_entry  record;
begin
  select * into v_gift
    from public.capsule_gifts
   where token_hash = p_token_hash
     for update;

  if not found then
    raise exception 'gift_not_found' using errcode = 'P0002';
  end if;
  if v_gift.redeemed_at is not null then
    raise exception 'gift_already_redeemed' using errcode = 'P0001';
  end if;
  if v_gift.refunded_at is not null then
    raise exception 'gift_refunded' using errcode = 'P0001';
  end if;

  insert into public.capsule_entries (
    message, message_hash, nonce, display_name, location, contact_email,
    stripe_session_id, amount_cents, flagged, flag_reasons, is_gift
  ) values (
    p_message, p_message_hash, p_nonce,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    -- The gift's own session paid for this entry. Reusing it keeps the unique constraint doing its
    -- job: one payment can never produce two entries, whichever path created them.
    v_gift.stripe_session_id,
    v_gift.amount_cents,
    p_flagged, p_flag_reasons, true
  )
  returning capsule_entries.seq, capsule_entries.created_at into v_entry;

  insert into public.capsule_wall (seq, display_name, location, char_count, message_hash, created_at, is_gift)
  values (
    v_entry.seq,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    char_length(p_message),
    p_message_hash,
    v_entry.created_at,
    true
  );

  update public.capsule_gifts
     set redeemed_at = now(), entry_seq = v_entry.seq
   where id = v_gift.id;

  seq := v_entry.seq;
  created_at := v_entry.created_at;
  return next;
end;
$$;

revoke all on function public.capsule_redeem_gift(text, text, text, text, text, text, text, boolean, text[])
  from public, anon, authenticated;
-- service_role only. This function writes directly into capsule_entries; reachable by anon it would
-- be a free write into the capsule with no payment and no token check worth the name.
