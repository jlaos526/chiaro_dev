-- Slice 76 (audit G6, moots C23): push_tokens has had ZERO application
-- consumers since it shipped in slice 3 (0012) — no registration code, no
-- notifications dependency anywhere; Settings ships Notifications as a
-- coming-soon placeholder. The slice-76 table-level consumer audit (all 52
-- tables in types.ts, grep for .from()/seed/embed usage) confirmed it is the
-- ONLY schema-only orphan. Dropped per the slice-13 table-drop precedent
-- (0053 state_stock_transactions); the registration path returns as a real
-- slice when notifications become one.
drop table if exists public.push_tokens;
drop type if exists public.push_platform;
