import { describe, expect, it } from 'vitest'
import { dupeKey, isDupe, scoreLog } from './scoring'
import type { Qso } from './types'

function qso(partial: Partial<Qso>): Qso {
  return {
    id: 1,
    contestId: 1,
    ts: 0,
    callsign: 'W1ABC',
    band: '20m',
    freqHz: 14_030_000,
    mode: 'CW',
    rstSent: '599',
    rstRcvd: '599',
    name: 'Joe',
    exch: '1',
    isMember: true,
    ...partial
  }
}

describe('dupeKey', () => {
  it('normalizes case and is band-specific', () => {
    expect(dupeKey('w1abc', '20m')).toBe('W1ABC|20m')
    expect(dupeKey('W1ABC', '40m')).not.toBe(dupeKey('W1ABC', '20m'))
  })
})

describe('isDupe', () => {
  const log = [qso({ id: 1, callsign: 'W1ABC', band: '20m' })]
  it('flags same call same band', () => {
    expect(isDupe('w1abc', '20m', log)).toBe(true)
  })
  it('allows same call on a different band', () => {
    expect(isDupe('W1ABC', '40m', log)).toBe(false)
  })
  it('ignores the QSO being edited', () => {
    expect(isDupe('W1ABC', '20m', log, 1)).toBe(false)
  })
})

describe('scoreLog', () => {
  it('scores 1 point per QSO times unique callsigns', () => {
    const log = [
      qso({ id: 1, callsign: 'W1ABC', band: '20m', ts: 1 }),
      qso({ id: 2, callsign: 'K2DEF', band: '20m', ts: 2 }),
      qso({ id: 3, callsign: 'N3GHI', band: '40m', ts: 3 })
    ]
    const s = scoreLog(log)
    expect(s.qsos).toBe(3)
    expect(s.mults).toBe(3)
    expect(s.total).toBe(9)
    expect(s.dupes).toBe(0)
  })

  it('counts a station worked on two bands as 2 QSOs but 1 mult', () => {
    const log = [
      qso({ id: 1, callsign: 'W1ABC', band: '20m', ts: 1 }),
      qso({ id: 2, callsign: 'W1ABC', band: '40m', ts: 2 })
    ]
    const s = scoreLog(log)
    expect(s.qsos).toBe(2)
    expect(s.mults).toBe(1)
    expect(s.total).toBe(2)
  })

  it('excludes same-band dupes from points and mults', () => {
    const log = [
      qso({ id: 1, callsign: 'W1ABC', band: '20m', ts: 1 }),
      qso({ id: 2, callsign: 'W1ABC', band: '20m', ts: 2 })
    ]
    const s = scoreLog(log)
    expect(s.qsos).toBe(1)
    expect(s.dupes).toBe(1)
    expect(s.mults).toBe(1)
    expect(s.total).toBe(1)
  })

  it('tracks per-band valid counts', () => {
    const log = [
      qso({ id: 1, callsign: 'A', band: '20m', ts: 1 }),
      qso({ id: 2, callsign: 'B', band: '20m', ts: 2 }),
      qso({ id: 3, callsign: 'C', band: '40m', ts: 3 })
    ]
    expect(scoreLog(log).perBand).toEqual({ '20m': 2, '40m': 1 })
  })
})
