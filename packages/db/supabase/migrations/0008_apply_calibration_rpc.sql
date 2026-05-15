-- Atomic apply_calibration RPC.
--
-- Replaces the calibrate-location Edge Function's sequenced delete/upsert/insert
-- with a single transaction-safe operation. Adds a per-user rate limit (default
-- 60s) to throttle GeocodIO usage. Resolves (tier, code) → district_id in one
-- query instead of the prior N+1.
--
-- Invariants:
--   - SECURITY DEFINER + revoked direct writes mean this RPC is the only path
--     by which user_locations and user_districts are mutated.
--   - auth.uid() determines the target user; the caller cannot spoof a user_id.
--   - Function body executes as a single PostgreSQL transaction; any failure
--     rolls back the entire calibration attempt.

create or replace function public.apply_calibration(
  p_address_text      text,
  p_lat               double precision,
  p_lng               double precision,
  p_geocodio_response jsonb,
  p_resolved          jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id         uuid := auth.uid();
  v_now             timestamptz := now();
  v_last_calibrated timestamptz;
  v_throttle_secs   int := coalesce(
    nullif(current_setting('app.calibrate_throttle_seconds', true), '')::int,
    60
  );
  v_districts       jsonb;
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  -- Per-user rate limit. Default 60s; override per-session for tests via
  --   set local app.calibrate_throttle_seconds = '0';
  -- The race window between two concurrent calls is acceptable; cost is at
  -- most one extra GeocodIO call and one redundant transaction.
  select calibrated_at into v_last_calibrated
  from public.user_locations
  where id = v_user_id;

  if v_last_calibrated is not null
     and v_now - v_last_calibrated < make_interval(secs => v_throttle_secs) then
    raise exception 'calibrating_too_frequently' using errcode = 'P0001';
  end if;

  -- 1. Clear prior districts.
  delete from public.user_districts where user_id = v_user_id;

  -- 2. Upsert user_locations.
  insert into public.user_locations (id, home_address_text, home_location, geocodio_response, calibrated_at)
  values (
    v_user_id,
    p_address_text,
    ('SRID=4326;POINT(' || p_lng || ' ' || p_lat || ')')::geography,
    p_geocodio_response,
    v_now
  )
  on conflict (id) do update set
    home_address_text = excluded.home_address_text,
    home_location     = excluded.home_location,
    geocodio_response = excluded.geocodio_response,
    calibrated_at     = excluded.calibrated_at;

  -- 3. Resolve (tier, code) tuples to canonical district_ids in ONE query
  --    (replaces the Edge Function's prior N+1 lookup loop), and insert the
  --    matching rows. Unmatched tuples are silently dropped — matches the
  --    prior Edge Function behavior of logging a warning and continuing.
  with input as (
    select (elem->>'tier')::public.district_tier as tier,
           elem->>'code'                         as code
    from jsonb_array_elements(p_resolved) as elem
  ),
  matched as (
    select d.id, d.tier, d.state, d.code, d.name
    from public.districts d
    join input i on d.tier = i.tier and d.code = i.code
  ),
  ins as (
    insert into public.user_districts (user_id, district_id, tier)
    select v_user_id, m.id, m.tier from matched m
    on conflict (user_id, district_id) do nothing
    returning district_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tier',  m.tier,
    'code',  m.code,
    'state', m.state,
    'name',  m.name
  )), '[]'::jsonb)
  into v_districts
  from matched m;

  return jsonb_build_object(
    'home_location', jsonb_build_object('lat', p_lat, 'lng', p_lng),
    'districts',     v_districts
  );
end;
$$;

revoke all on function public.apply_calibration(text, double precision, double precision, jsonb, jsonb) from public;
grant execute on function public.apply_calibration(text, double precision, double precision, jsonb, jsonb) to authenticated;
