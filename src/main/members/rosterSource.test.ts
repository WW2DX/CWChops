import { describe, expect, it } from 'vitest'
import { parseCsv, parseCwopsRoster } from './rosterSource'

describe('parseCsv', () => {
  it('handles quoted fields with commas and newlines', () => {
    const rows = parseCsv('a,"b,c","d\ne",f\n1,2,3,4\n')
    expect(rows[0]).toEqual(['a', 'b,c', 'd\ne', 'f'])
    expect(rows[1]).toEqual(['1', '2', '3', '4'])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"he said ""hi"""')[0][0]).toBe('he said "hi"')
  })

  it('keeps a trailing row without a final newline', () => {
    expect(parseCsv('x,y')).toEqual([['x', 'y']])
  })
})

// Mirrors the real CWops sheet: banner rows, a multi-line quoted header, then data.
const SAMPLE = `,,,,,,,,
,CWops MEMBER ROSTER,,,,,,,
,,Last Update,20260605 @ 1540 UTC,,,,,
,"Paid
Thru",Callsign,Number,"First or
Nick Name",Last Name,DXCC,W/VE,Blog
,LIFE,2E0OBO,2381,Bob,Blackman,G,--,
,LIFE,K1ABC,1,Joe,"Smith, Jr",K,MA,
,2026,W9XYZ,56,Sam,Jones,K,IL,
,LIFE,BADROW,,NoNumber,Nobody,K,--,
`

describe('parseCwopsRoster', () => {
  const entries = parseCwopsRoster(SAMPLE)

  it('locates columns by header name and keeps numeric-number rows', () => {
    expect(entries).toEqual([
      { callsign: '2E0OBO', name: 'Bob', number: '2381' },
      { callsign: 'K1ABC', name: 'Joe', number: '1' },
      { callsign: 'W9XYZ', name: 'Sam', number: '56' }
    ])
  })

  it('drops rows without a numeric member number', () => {
    expect(entries.find((e) => e.callsign === 'BADROW')).toBeUndefined()
  })

  it('uppercases calls and uses the first name only', () => {
    const k = entries.find((e) => e.callsign === 'K1ABC')
    expect(k?.name).toBe('Joe')
  })

  it('returns empty when no header is present', () => {
    expect(parseCwopsRoster('just,some,garbage\n1,2,3')).toEqual([])
  })
})
