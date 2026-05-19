import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'
import { BioAlignmentChipRow } from './BioAlignmentChipRow'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'federal_house' | 'federal_senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
}

export function BioHeader(p: BioHeaderProps): React.JSX.Element {
  return (
    <section
      aria-label={`${p.fullName} bio`}
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '24px 16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a1714' }}>{p.fullName}</h1>
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        stateAbbrev={p.state}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </section>
  )
}
