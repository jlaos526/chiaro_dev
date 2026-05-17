export function pacPercent(
  totalRaised: number | null,
  pacSum: number | null,
): number | null {
  if (totalRaised === null || pacSum === null) return null
  if (totalRaised <= 0) return null
  const raw = (pacSum / totalRaised) * 100
  return Math.min(100, Math.round(raw * 10) / 10)
}
