import type { Band, Qso, ScoreSummary } from './types'

/** Canonical key for "same station, same band" — the CWT dupe rule. */
export function dupeKey(callsign: string, band: Band): string {
  return `${callsign.trim().toUpperCase()}|${band}`
}

/**
 * Is this call+band already present in `existing`? Optionally ignore a QSO by
 * id (so editing an existing QSO doesn't flag itself as a dupe).
 */
export function isDupe(
  callsign: string,
  band: Band,
  existing: Qso[],
  ignoreId?: number
): boolean {
  const key = dupeKey(callsign, band)
  return existing.some((q) => q.id !== ignoreId && dupeKey(q.callsign, q.band) === key)
}

/**
 * CWT scoring: 1 point per valid QSO (one per band per station), multiplied by
 * the number of unique callsigns worked across the whole log.
 *
 * Dupes (same call already worked on the same band) are excluded from points
 * and do not create a multiplier. The FIRST occurrence of a call+band is the
 * valid one.
 */
export function scoreLog(qsos: Qso[]): ScoreSummary {
  const seen = new Set<string>()
  const calls = new Set<string>()
  const perBand: Record<string, number> = {}
  let valid = 0
  let dupes = 0

  // Score in chronological order so the first contact is the keeper.
  const ordered = [...qsos].sort((a, b) => a.ts - b.ts || a.id - b.id)
  for (const q of ordered) {
    const key = dupeKey(q.callsign, q.band)
    if (seen.has(key)) {
      dupes++
      continue
    }
    seen.add(key)
    valid++
    calls.add(q.callsign.trim().toUpperCase())
    perBand[q.band] = (perBand[q.band] ?? 0) + 1
  }

  return {
    qsos: valid,
    dupes,
    mults: calls.size,
    total: valid * calls.size,
    perBand
  }
}
