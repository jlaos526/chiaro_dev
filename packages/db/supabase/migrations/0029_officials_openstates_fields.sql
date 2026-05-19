-- Sub-slice 5C: openstates_person_id + district_code + title for state legislators.
-- CHECK enforces exclusivity: federal rows have bioguide_id, state rows have
-- openstates_person_id, never both.
-- Party CHECK constraint relaxed: state legislators include NE Nonpartisan,
-- MN DFL, Working Families, Progressive (VT). Display normalization moves to
-- @chiaro/ui-tokens.

alter table public.officials
  add column if not exists openstates_person_id text,
  add column if not exists district_code        text,
  add column if not exists title                text;

-- State legislator rows have bioguide_id IS NULL. Drop NOT NULL so the XOR
-- CHECK below can hold. Federal rows continue to have bioguide_id NOT NULL
-- in practice (enforced by the XOR + ingest scripts).
alter table public.officials alter column bioguide_id drop not null;

create unique index if not exists officials_openstates_person_idx
  on public.officials(openstates_person_id)
  where openstates_person_id is not null;

-- Exactly one source ID per row. Federal rows have bioguide_id, state rows have
-- openstates_person_id.
alter table public.officials
  add constraint officials_source_id_xor check (
    (bioguide_id is not null and openstates_person_id is null) or
    (bioguide_id is null     and openstates_person_id is not null)
  );

-- Relax party from CHECK-constrained (D/R/I/L/G/ID) to free text — needed for
-- NE Nonpartisan, MN DFL, Working Families, Progressive (VT), etc. Display
-- normalization moves to @chiaro/ui-tokens.
alter table public.officials drop constraint if exists officials_party_check;
