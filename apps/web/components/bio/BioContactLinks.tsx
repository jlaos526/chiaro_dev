export interface BioContactLinksProps {
  officialUrl: string | null
  twitterHandle: string | null
}

export function BioContactLinks({ officialUrl, twitterHandle }: BioContactLinksProps): React.JSX.Element | null {
  const links: React.ReactNode[] = []
  if (officialUrl) {
    const display = officialUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    links.push(
      <a key="site" href={officialUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#3b6ed1' }}>
        {display}
      </a>
    )
  }
  if (twitterHandle) {
    links.push(
      <a
        key="twitter"
        href={`https://twitter.com/${twitterHandle}`}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: '0.75rem', color: '#3b6ed1' }}
      >
        @{twitterHandle}
      </a>
    )
  }
  if (links.length === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
      {links.map((l, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {i > 0 && <span style={{ color: '#d8d4c9' }}>·</span>}
          {l}
        </span>
      ))}
    </div>
  )
}
