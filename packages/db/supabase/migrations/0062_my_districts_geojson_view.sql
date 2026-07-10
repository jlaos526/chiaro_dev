-- Slice 67 C9 (S1/S2 dedupe): a per-user view returning the caller's districts
-- with the shared whole-state federal_senate geometry emitted ONCE.
--
-- The two U.S. Senate seats per state (codes STATE-S1 / STATE-S2, Gotcha #2)
-- carry byte-identical geometry — the entire state outline, the largest polygon
-- in a user's home-map payload. getMyDistricts previously fetched both via
-- districts_geojson, so that polygon crossed the wire twice. This view keeps the
-- geometry on the first senate row (row_number() = 1) and NULLs the sibling;
-- getMyDistricts re-attaches the shared object client-side so both toggles still
-- render (behavior unchanged, one copy transferred). It also collapses
-- getMyDistricts from two round-trips (user_districts -> districts_geojson) to
-- one by pre-joining here.
--
-- Partitioning by (state, tier) is safe: federal_senate is the ONLY tier where a
-- user holds >1 district row per (state, tier), and those rows share geometry.
-- Every other tier is one-row-per-(state, tier), so row_number() = 1 keeps it.
--
-- security_invoker = true so the underlying user_districts RLS (self-scoped
-- since migration 0060) enforces the boundary; the explicit auth.uid() filter is
-- defense-in-depth. Reuses districts_geojson (0061) so geometry is already
-- display-simplified.
create or replace view public.my_districts_geojson
  with (security_invoker = true) as
  select
    dg.id,
    dg.tier,
    dg.state,
    dg.code,
    dg.name,
    case
      when row_number() over (partition by dg.state, dg.tier order by dg.code) = 1
        then dg.geometry
      else null
    end as geometry
  from public.districts_geojson dg
  join public.user_districts ud on ud.district_id = dg.id
  where ud.user_id = (select auth.uid());

grant select on public.my_districts_geojson to authenticated;
