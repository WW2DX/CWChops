// Pure helpers for building and parsing TCI wire messages.
// Spec: github.com/ExpertSDR3/TCI ("TCI Protocol.pdf", v1.9).
// Format: `command:arg1,arg2,...;` — lowercase name, ';' terminates.

export interface TciMessage {
  cmd: string
  args: string[]
}

/**
 * Parse a single TCI command string (without the trailing ';') into a
 * command name and arguments. Names are lowercased; args are trimmed.
 */
export function parseTciMessage(raw: string): TciMessage | null {
  const s = raw.trim().replace(/;+$/, '')
  if (!s) return null
  const colon = s.indexOf(':')
  if (colon === -1) {
    return { cmd: s.toLowerCase(), args: [] }
  }
  const cmd = s.slice(0, colon).trim().toLowerCase()
  const args = s
    .slice(colon + 1)
    .split(',')
    .map((a) => a.trim())
  return { cmd, args }
}

/** Split a raw WebSocket text frame (which may hold several `;`-terminated commands). */
export function splitFrames(data: string): string[] {
  return data
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Escape the three protocol-reserved characters inside CW macro text, per the
 * spec: ':' -> '^', ',' -> '~', ';' -> '*'. The TCI server converts them back.
 */
export function escapeCwText(text: string): string {
  return text.replace(/:/g, '^').replace(/,/g, '~').replace(/;/g, '*')
}

// ---- command builders (each returns a full `...;` frame) ----

export function cmdReadVfo(trx: number, channel: number): string {
  return `vfo:${trx},${channel};`
}

export function cmdSetVfo(trx: number, channel: number, freqHz: number): string {
  return `vfo:${trx},${channel},${Math.round(freqHz)};`
}

export function cmdReadModulation(trx: number): string {
  return `modulation:${trx};`
}

export function cmdSetModulation(trx: number, mode: string): string {
  return `modulation:${trx},${mode};`
}

export function cmdSetTrx(trx: number, on: boolean, source?: string): string {
  return source ? `trx:${trx},${on},${source};` : `trx:${trx},${on};`
}

export function cmdReadTrx(trx: number): string {
  return `trx:${trx};`
}

/** Send free CW text. Reserved characters are escaped. */
export function cmdCwMacros(trx: number, text: string): string {
  return `cw_macros:${trx},${escapeCwText(text)};`
}

/** Send a structured CW message: prefix / callsign / suffix. */
export function cmdCwMsg(trx: number, prefix: string, call: string, suffix: string): string {
  return `cw_msg:${trx},${escapeCwText(prefix)},${escapeCwText(call)},${escapeCwText(suffix)};`
}

/** Correct the not-yet-sent portion of the callsign mid-transmission. */
export function cmdCwMsgCorrect(call: string): string {
  return `cw_msg:${escapeCwText(call)};`
}

export function cmdSetCwSpeed(wpm: number): string {
  return `cw_macros_speed:${Math.round(wpm)};`
}

export function cmdReadCwSpeed(): string {
  return 'cw_macros_speed;'
}

/**
 * Keyer speed. Some TCI servers (RHR) key CW at the keyer speed rather than the
 * macros speed, so we set both to cover either implementation.
 */
export function cmdSetCwKeyerSpeed(wpm: number): string {
  return `cw_keyer_speed:${Math.round(wpm)};`
}

export function cmdCwStop(): string {
  return 'cw_macros_stop;'
}
