import type { Macro, Station } from './types'

/** A parsed received exchange: their name plus their number/SPC token. */
export interface ParsedExchange {
  name: string
  exch: string
  isMember: boolean
}

/** True when a token is a CWops member number (all digits). */
export function isMemberNumber(token: string): boolean {
  return /^\d+$/.test(token.trim())
}

/**
 * Parse a free-typed exchange like "Bud 1" or "Joe TX" or "Hans DL" into
 * name + exchange token. The last whitespace-separated token is the
 * number/SPC; everything before it is the name. A single token is treated as
 * the name with an empty exchange (operator still typing).
 */
export function parseExchange(input: string): ParsedExchange {
  const parts = input.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', exch: '', isMember: false }
  if (parts.length === 1) return { name: parts[0], exch: '', isMember: false }
  const exch = parts[parts.length - 1].toUpperCase()
  const name = parts.slice(0, -1).join(' ')
  return { name, exch, isMember: isMemberNumber(exch) }
}

/** The operator's own sent exchange token (number for members, SPC otherwise). */
export function sentExchangeToken(station: Station): string {
  return station.isMember ? station.memberNumber : station.spc
}

/**
 * Expand macro placeholders against the current contest state. Supported:
 *   {CALL}  — the worked station's callsign
 *   {MYCALL}— operator callsign
 *   {NAME}  — operator's first name
 *   {NR}    — operator's sent exchange token (number or SPC)
 *   {EXCH}  — "{NAME} {NR}" (the full sent exchange)
 *   {HISNAME}— the worked station's name (as entered)
 */
export function expandMacro(
  text: string,
  ctx: { station: Station; call: string; hisName: string }
): string {
  const nr = sentExchangeToken(ctx.station)
  return text
    .replace(/\{CALL\}/gi, ctx.call.toUpperCase())
    .replace(/\{MYCALL\}/gi, ctx.station.callsign.toUpperCase())
    .replace(/\{NAME\}/gi, ctx.station.name)
    .replace(/\{NR\}/gi, nr)
    .replace(/\{EXCH\}/gi, `${ctx.station.name} ${nr}`.trim())
    .replace(/\{HISNAME\}/gi, ctx.hisName)
    .trim()
}

/**
 * Default F-key macros for a CWT run. F1/F2/F3/F5 double as the ESM roles
 * (CQ / exchange / TU / my-call); see ESM_MACRO_KEYS in shared/esm.ts.
 */
export const DEFAULT_MACROS: Macro[] = [
  { key: 1, label: 'CQ', text: 'CQ CWT {MYCALL}' },
  { key: 2, label: 'Exch', text: '{CALL} {NAME} {NR}' },
  { key: 3, label: 'TU', text: 'TU {MYCALL}' },
  { key: 4, label: 'His Call', text: '{CALL}' },
  { key: 5, label: 'My Call', text: '{MYCALL}' },
  { key: 6, label: 'AGN', text: 'AGN?' },
  { key: 7, label: 'NR?', text: 'NR?' },
  { key: 8, label: 'Name?', text: 'NAME?' }
]

/**
 * Macro texts shipped as defaults in earlier versions that should be upgraded
 * to the current default (keyed by F-key). ESM relies on F2 containing {CALL},
 * so the original F2 default is migrated forward automatically.
 */
const SUPERSEDED_MACRO_TEXT: Record<number, string[]> = {
  2: ['{HISNAME} {EXCH}']
}

/**
 * Upgrade any macro still holding an outdated shipped default to the current
 * default text. Returns the (possibly) updated list and whether anything changed.
 */
export function migrateMacros(saved: Macro[]): { macros: Macro[]; changed: boolean } {
  let changed = false
  const macros = saved.map((m) => {
    const stale = SUPERSEDED_MACRO_TEXT[m.key]
    const def = DEFAULT_MACROS.find((d) => d.key === m.key)
    if (stale && def && stale.includes(m.text.trim()) && def.text !== m.text) {
      changed = true
      return { ...m, text: def.text }
    }
    return m
  })
  return { macros, changed }
}
