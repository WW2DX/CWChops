import { describe, expect, it } from 'vitest'
import { esmAction, esmHint } from './esm'

describe('esmAction — Run mode', () => {
  it('sends CQ from an empty Call field', () => {
    expect(esmAction('run', 'call', false)).toEqual({ macro: 'cq' })
  })
  it('sends the exchange and advances to Name once a call is entered', () => {
    expect(esmAction('run', 'call', true)).toEqual({ macro: 'exch', focus: 'name' })
  })
  it('advances Name -> Nr', () => {
    expect(esmAction('run', 'name', true)).toEqual({ focus: 'nr' })
  })
  it('sends TU and logs from the Nr field', () => {
    expect(esmAction('run', 'nr', true)).toEqual({ macro: 'tu', log: true })
  })
})

describe('esmAction — S&P mode', () => {
  it('sends my call and advances to Name', () => {
    expect(esmAction('sp', 'call', true)).toEqual({ macro: 'mycall', focus: 'name' })
  })
  it('sends the exchange from an empty Call', () => {
    expect(esmAction('sp', 'call', false)).toEqual({ macro: 'exch' })
  })
  it('sends my exchange and logs from the Nr field', () => {
    expect(esmAction('sp', 'nr', true)).toEqual({ macro: 'exch', log: true })
  })
})

describe('esmAction — Off mode', () => {
  it('walks the fields and logs from Nr, keying nothing', () => {
    expect(esmAction('off', 'call', true)).toEqual({ focus: 'name' })
    expect(esmAction('off', 'name', true)).toEqual({ focus: 'nr' })
    expect(esmAction('off', 'nr', true)).toEqual({ log: true })
  })
})

describe('esmHint', () => {
  it('describes the Enter action per field', () => {
    expect(esmHint('run', 'call', false)).toBe('Enter: CQ')
    expect(esmHint('run', 'call', true)).toBe('Enter: send exchange →')
    expect(esmHint('run', 'name', true)).toBe('Enter: next field →')
    expect(esmHint('run', 'nr', true)).toBe('Enter: TU + log')
    expect(esmHint('sp', 'call', true)).toBe('Enter: send my call →')
    expect(esmHint('sp', 'nr', true)).toBe('Enter: exchange + log')
    expect(esmHint('off', 'nr', true)).toBe('Enter: log')
    expect(esmHint('sp', 'call', false)).toBe('Enter: send exchange →')
  })
})
