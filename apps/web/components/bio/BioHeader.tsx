import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'

export interface BioHeaderProps {
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'house' | 'senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
}

function districtChipLabel(p: BioHeaderProps): string {
  if (p.chamber === 'senate') return p.stateName
  if (p.atLarge) return `${p.state}-AL`
  if (p.districtNumber == null) return p.state
  const num = String(p.districtNumber).padStart(2, '0')
  return `${p.state}-${num}`
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
      <BioIdentityRow party={p.party} chamber={p.chamber} districtChipLabel={districtChipLabel(p)} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </section>
  )
}
