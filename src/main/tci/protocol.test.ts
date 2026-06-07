import { describe, expect, it } from 'vitest'
import {
  cmdCwMacros,
  cmdCwMsg,
  cmdSetModulation,
  cmdSetTrx,
  cmdSetVfo,
  escapeCwText,
  parseTciMessage,
  splitFrames
} from './protocol'

describe('escapeCwText', () => {
  it('escapes the three reserved characters', () => {
    expect(escapeCwText('a:b,c;d')).toBe('a^b~c*d')
  })
})

describe('command builders', () => {
  it('builds vfo set with rounded Hz', () => {
    expect(cmdSetVfo(0, 0, 14_025_000.6)).toBe('vfo:0,0,14025001;')
  })
  it('builds modulation set', () => {
    expect(cmdSetModulation(0, 'cw')).toBe('modulation:0,cw;')
  })
  it('builds trx PTT with and without source', () => {
    expect(cmdSetTrx(0, true)).toBe('trx:0,true;')
    expect(cmdSetTrx(0, false)).toBe('trx:0,false;')
  })
  it('escapes CW macro text', () => {
    expect(cmdCwMacros(0, 'TU; NR,1')).toBe('cw_macros:0,TU* NR~1;')
  })
  it('builds a structured CW message', () => {
    expect(cmdCwMsg(0, 'TU', 'RA6LH', '599 004')).toBe('cw_msg:0,TU,RA6LH,599 004;')
  })
})

describe('parseTciMessage', () => {
  it('parses command and args', () => {
    expect(parseTciMessage('vfo:0,0,14025000;')).toEqual({
      cmd: 'vfo',
      args: ['0', '0', '14025000']
    })
  })
  it('parses an argless command', () => {
    expect(parseTciMessage('ready;')).toEqual({ cmd: 'ready', args: [] })
  })
  it('lowercases the command name', () => {
    expect(parseTciMessage('READY;')?.cmd).toBe('ready')
  })
})

describe('splitFrames', () => {
  it('splits a multi-command frame', () => {
    expect(splitFrames('start;ready;vfo:0,0,7000000;')).toEqual([
      'start',
      'ready',
      'vfo:0,0,7000000'
    ])
  })
})
