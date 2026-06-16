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

// The weekly CWops CWT is three 1-hour sessions, fixed in UTC. getUTCDay():
// Sunday=0 … Wednesday=3, Thursday=4. The 0300Z session is Thursday UTC but is
// the "Wednesday evening" session in the Americas.
const CWT_SESSIONS = [
  { day: 3, hour: 13 }, // Wednesday 1300Z
  { day: 3, hour: 19 }, // Wednesday 1900Z
  { day: 4, hour: 3 } //  Thursday 0300Z
] as const

const SESSION_DURATION_MS = 60 * 60 * 1000 // each CWT session runs one hour

export interface CwtSession {
  /** Cabrillo-style label, e.g. "CWT-1300". */
  label: string
  start: Date
  end: Date
}

/**
 * The next CWT session relative to `now`. A session already in progress counts
 * as the "next" one (its end is still in the future), so callers can show a
 * "running now" state. Pure date math — the schedule is fixed, no lookup needed.
 */
export function nextCwtSession(now: Date): CwtSession {
  const candidates: CwtSession[] = []
  // Scan a window of days spanning the week boundary so we always find one.
  for (let offset = -1; offset <= 8; offset++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + offset)
    for (const s of CWT_SESSIONS) {
      if (d.getUTCDay() !== s.day) continue
      const start = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), s.hour, 0, 0)
      )
      candidates.push({
        label: `CWT-${String(s.hour).padStart(2, '0')}00`,
        start,
        end: new Date(start.getTime() + SESSION_DURATION_MS)
      })
    }
  }
  candidates.sort((a, b) => a.start.getTime() - b.start.getTime())
  return candidates.find((c) => c.end.getTime() > now.getTime()) ?? candidates[candidates.length - 1]
}
