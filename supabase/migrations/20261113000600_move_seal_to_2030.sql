-- Moves the seal from 2026-12-31 23:59:59 PST to 2030-01-01 00:00:00 PST, and the opening from
-- 2047-01-01 to 2050-01-01 00:01 PST (the opening date lives only in app code; the database only
-- guards the seal). Changed 2026-11-13 at the operator's request.
--
-- 2030-01-01 00:00:00 PST == 2030-01-01 08:00:00 UTC (January, so PST, not PDT).
create or replace function public.capsule_reject_after_seal()
returns trigger
language plpgsql
as $$
begin
  if now() >= timestamptz '2030-01-01 08:00:00+00' then
    raise exception 'The capsule sealed on 2030-01-01 00:00:00 PST. No further entries.';
  end if;
  return new;
end;
$$;
