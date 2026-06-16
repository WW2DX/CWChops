import { describe, expect, it } from 'vitest'
import { nextCwtSession } from './session'

describe('nextCwtSession', () => {
  it('returns the same-day 1900Z session from Wednesday morning', () => {
    // Wed 2026-06-10 14:30Z — past 1300Z, before 1900Z.
    const s = nextCwtSession(new Date('2026-06-10T14:30:00Z'))
    expect(s.label).toBe('CWT-1900')
    expect(s.start.toISOString()).toBe('2026-06-10T19:00:00.000Z')
  })

  it('rolls forward to Thursday 0300Z after the Wednesday sessions', () => {
    // Wed 2026-06-10 20:30Z — after 1900Z ended.
    const s = nextCwtSession(new Date('2026-06-10T20:30:00Z'))
    expect(s.label).toBe('CWT-0300')
    expect(s.start.toISOString()).toBe('2026-06-11T03:00:00.000Z')
  })

  it('treats an in-progress session as the next one', () => {
    // Wed 2026-06-10 13:20Z — 1300Z session is live.
    const s = nextCwtSession(new Date('2026-06-10T13:20:00Z'))
    expect(s.label).toBe('CWT-1300')
    expect(s.start.toISOString()).toBe('2026-06-10T13:00:00.000Z')
  })

  it('wraps to next week from Thursday afternoon', () => {
    // Thu 2026-06-11 12:00Z — all of this week's sessions are done.
    const s = nextCwtSession(new Date('2026-06-11T12:00:00Z'))
    expect(s.label).toBe('CWT-1300')
    expect(s.start.toISOString()).toBe('2026-06-17T13:00:00.000Z')
  })

  it('finds the first upcoming session from the weekend', () => {
    // Sat 2026-06-13 09:00Z → next is Wednesday 1300Z.
    const s = nextCwtSession(new Date('2026-06-13T09:00:00Z'))
    expect(s.label).toBe('CWT-1300')
    expect(s.start.toISOString()).toBe('2026-06-17T13:00:00.000Z')
  })
})
