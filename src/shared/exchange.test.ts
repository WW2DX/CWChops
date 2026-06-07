import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MACROS,
  expandMacro,
  isMemberNumber,
  migrateMacros,
  parseExchange,
  sentExchangeToken
} from './exchange'
import type { Macro, Station } from './types'

const member: Station = {
  callsign: 'K1ABC',
  name: 'Joe',
  memberNumber: '1234',
  spc: '',
  isMember: true
}
const nonMember: Station = {
  callsign: 'W9XYZ',
  name: 'Sam',
  memberNumber: '',
  spc: 'IL',
  isMember: false
}

describe('isMemberNumber', () => {
  it('is true only for all-digit tokens', () => {
    expect(isMemberNumber('1')).toBe(true)
    expect(isMemberNumber('1234')).toBe(true)
    expect(isMemberNumber('TX')).toBe(false)
    expect(isMemberNumber('CWA')).toBe(false)
  })
})

describe('parseExchange', () => {
  it('splits name and member number', () => {
    expect(parseExchange('Bud 1')).toEqual({ name: 'Bud', exch: '1', isMember: true })
  })
  it('splits name and SPC, marking non-member', () => {
    expect(parseExchange('Joe TX')).toEqual({ name: 'Joe', exch: 'TX', isMember: false })
  })
  it('uppercases the exchange token', () => {
    expect(parseExchange('Hans dl').exch).toBe('DL')
  })
  it('handles a multi-word name', () => {
    expect(parseExchange('Mary Jo 5')).toEqual({ name: 'Mary Jo', exch: '5', isMember: true })
  })
  it('returns empty exch when still typing', () => {
    expect(parseExchange('Bud')).toEqual({ name: 'Bud', exch: '', isMember: false })
  })
})

describe('sentExchangeToken', () => {
  it('uses number for members and SPC otherwise', () => {
    expect(sentExchangeToken(member)).toBe('1234')
    expect(sentExchangeToken(nonMember)).toBe('IL')
  })
})

describe('migrateMacros', () => {
  it('upgrades the stale F2 default (no {CALL}) to the current default', () => {
    const saved: Macro[] = [{ key: 2, label: 'Exch', text: '{HISNAME} {EXCH}' }]
    const { macros, changed } = migrateMacros(saved)
    expect(changed).toBe(true)
    expect(macros[0].text).toBe(DEFAULT_MACROS.find((m) => m.key === 2)!.text)
    expect(macros[0].text).toContain('{CALL}')
  })

  it('leaves a user-customized F2 alone', () => {
    const saved: Macro[] = [{ key: 2, label: 'Exch', text: '{CALL} GM {NR}' }]
    const { macros, changed } = migrateMacros(saved)
    expect(changed).toBe(false)
    expect(macros[0].text).toBe('{CALL} GM {NR}')
  })
})

describe('expandMacro', () => {
  const ctx = { station: member, call: 'w1abc', hisName: 'Sam' }
  it('expands callsign and exchange placeholders', () => {
    expect(expandMacro('{HISNAME} {EXCH}', ctx)).toBe('Sam Joe 1234')
    expect(expandMacro('{CALL}', ctx)).toBe('W1ABC')
    expect(expandMacro('CQ CWT {MYCALL}', ctx)).toBe('CQ CWT K1ABC')
    expect(expandMacro('{NR}', ctx)).toBe('1234')
  })
})
