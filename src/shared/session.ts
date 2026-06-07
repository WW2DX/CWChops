// CWT runs four fixed sessions (UTC start hours). Pick the closest to a given time.

const SESSION_HOURS = [3, 7, 13, 19] as const

/** Label like "CWT-1900" for the session whose start hour is nearest `date` (UTC). */
export function cwtSessionLabel(date: Date): string {
  const h = date.getUTCHours() + date.getUTCMinutes() / 60
  let best: number = SESSION_HOURS[0]
  let bestDist = 24
  for (const s of SESSION_HOURS) {
    // circular distance on a 24h clock
    const raw = Math.abs(h - s)
    const dist = Math.min(raw, 24 - raw)
    if (dist < bestDist) {
      bestDist = dist
      best = s
    }
  }
  return `CWT-${String(best).padStart(2, '0')}00`
}

/** "CWT-1900 (2026-06-05)" — a human label including the UTC date. */
export function cwtSessionTitle(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${cwtSessionLabel(date)} (${yyyy}-${mm}-${dd})`
}
