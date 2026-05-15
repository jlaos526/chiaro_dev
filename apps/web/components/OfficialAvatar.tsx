import { COLORS } from '@chiaro/ui-tokens'

interface Props {
  fullName: string
  portraitUrl?: string | null
  size?: number
}

export function OfficialAvatar({ fullName, portraitUrl, size = 64 }: Props) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  if (portraitUrl) {
    return (
      <img
        src={portraitUrl}
        alt={fullName}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={fullName}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: COLORS.neutral.surface,
        color: COLORS.brand.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}
