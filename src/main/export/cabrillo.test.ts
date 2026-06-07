import { describe, expect, it } from 'vitest'
import { buildCabrillo } from './cabrillo'
import type { Contest, Qso, Station } from '@shared/types'

const contest: Contest = { id: 1, name: 'CWT', session: 'CWT-1900', startedAt: 0 }
const station: Station = {
  callsign: 'K1ABC',
  name: 'Joe',
  memberNumber: '1234',
  spc: '',
  isMember: true
}

// 2026-06-03 19:05 UTC
const ts = Date.UTC(2026, 5, 3, 19, 5, 0)
const qsos: Qso[] = [
  {
    id: 1,
    contestId: 1,
    ts,
    callsign: 'W9XYZ',
    band: '20m',
    freqHz: 14_025_300,
    mode: 'CW',
    rstSent: '599',
    rstRcvd: '599',
    name: 'Sam',
    exch: 'IL',
    isMember: false
  }
]

describe('buildCabrillo', () => {
  const out = buildCabrillo(contest, station, qsos)
  const lines = out.split('\n')

  it('emits the CWOPS contest header', () => {
    expect(lines).toContain('CONTEST: CWOPS')
    expect(lines).toContain('CALLSIGN: K1ABC')
    expect(lines[0]).toBe('START-OF-LOG: 3.0')
  })

  it('puts the claimed score in the header', () => {
    expect(out).toContain('CLAIMED-SCORE: 1')
  })

  it('formats the QSO line with 599 in both RST slots', () => {
    const qsoLine = lines.find((l) => l.startsWith('QSO:'))
    expect(qsoLine).toBe('QSO: 14025 CW 2026-06-03 1905 K1ABC 599 Joe 1234 W9XYZ 599 Sam IL')
  })

  it('terminates the log', () => {
    expect(out.trimEnd().endsWith('END-OF-LOG:')).toBe(true)
  })
})
