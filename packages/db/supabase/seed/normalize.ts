import { z } from 'zod'

export type Chamber = 'federal_house' | 'federal_senate'
export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'ID'

export interface NormalizedMember {
  bioguideId: string
  firstName: string
  lastName: string
  fullName: string
  chamber: Chamber
  party: Party
  state: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  portraitUrl: string
  officialUrl: string | null
  nextElection: string | null
}

export const CongressGovMemberSchema = z.object({
  bioguideId: z.string().min(5),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  directOrderName: z.string().min(1),
  partyName: z.string(),
  state: z.string(),
  stateCode: z.string().length(2),
  chamber: z.string(),
  district: z.number().nullable(),
  senateClass: z.number().nullable(),
  terms: z.object({
    item: z.array(z.object({
      chamber: z.string(),
      startYear: z.number(),
      endYear: z.number().nullable().optional(),
    })),
  }),
  officialWebsiteUrl: z.string().url().nullable(),
  nextElection: z.string().nullable(),
})

export type CongressGovMember = z.infer<typeof CongressGovMemberSchema>

const PARTY_MAP: Record<string, Party> = {
  Democratic: 'D',
  Republican: 'R',
  Independent: 'I',
  Libertarian: 'L',
  Green: 'G',
}

function mapParty(partyName: string): Party {
  return PARTY_MAP[partyName] ?? 'ID'
}

function buildPortraitUrl(bioguideId: string): string {
  const firstLetter = bioguideId[0].toUpperCase()
  return `https://bioguide.congress.gov/bioguide/photo/${firstLetter}/${bioguideId}.jpg`
}

function normalizeChamber(raw: string): Chamber {
  if (raw === 'Senate') return 'federal_senate'
  if (raw === 'House of Representatives') return 'federal_house'
  throw new Error(`Unexpected chamber: ${raw}`)
}

export function normalizeMember(raw: unknown): NormalizedMember {
  const m = CongressGovMemberSchema.parse(raw)
  const chamber = normalizeChamber(m.chamber)
  return {
    bioguideId: m.bioguideId,
    firstName: m.firstName,
    lastName: m.lastName,
    fullName: m.directOrderName,
    chamber,
    party: mapParty(m.partyName),
    state: m.stateCode,
    districtNumber: chamber === 'federal_senate' ? null : (m.district ?? null),
    senateClass: chamber === 'federal_senate'
      ? (m.senateClass === 1 || m.senateClass === 2 || m.senateClass === 3
          ? m.senateClass
          : null)
      : null,
    portraitUrl: buildPortraitUrl(m.bioguideId),
    officialUrl: m.officialWebsiteUrl ?? null,
    nextElection: m.nextElection ?? null,
  }
}
