import type { RosterEntry } from './roster'

/**
 * Public CWops member roster, exported as CSV from the official Google Sheet.
 * No login required; the sheet is refreshed by CWops (a "Last Update" timestamp
 * is embedded in the file). Columns of interest: Callsign, Number, First Name.
 */
export const CWOPS_ROSTER_URL =
  'https://docs.google.com/spreadsheets/d/1Ew8b1WAorFRCixGRsr031atxmS0SsycvmOczS_fDqzc/export?format=csv'

/**
 * Parse RFC-4180-ish CSV into rows of fields. Handles double-quoted fields with
 * embedded commas, newlines, and escaped "" quotes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n?/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  // Trailing field/row (no final newline).
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function norm(cell: string | undefined): string {
  return (cell ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Extract member entries from the raw CWops roster CSV. The sheet has several
 * decorative banner rows before a header row containing "Callsign" and
 * "Number"; columns are located by header name so the parser survives column
 * reordering. Only rows with a numeric member number are kept.
 */
export function parseCwopsRoster(raw: string): RosterEntry[] {
  const rows = parseCsv(raw)
  const headerIdx = rows.findIndex(
    (r) => r.some((c) => norm(c).toLowerCase() === 'callsign') && r.some((c) => /number/i.test(c))
  )
  if (headerIdx === -1) return []

  const header = rows[headerIdx].map((c) => norm(c).toLowerCase())
  const callI = header.indexOf('callsign')
  const numI = header.indexOf('number')
  const nameI = header.findIndex((c) => c.startsWith('first'))
  if (callI === -1 || numI === -1) return []

  const out: RosterEntry[] = []
  const seen = new Set<string>()
  for (const r of rows.slice(headerIdx + 1)) {
    const callsign = norm(r[callI]).toUpperCase()
    const number = norm(r[numI])
    if (!callsign || !/^\d+$/.test(number) || seen.has(callsign)) continue
    // Commas would corrupt the normalized CSV we persist; strip from the name.
    const name = nameI === -1 ? '' : norm(r[nameI]).replace(/,/g, '')
    seen.add(callsign)
    out.push({ callsign, name, number })
  }
  return out
}

/** Download and parse the live CWops roster. Throws on network/HTTP failure. */
export async function fetchCwopsRoster(timeoutMs = 30_000): Promise<RosterEntry[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(CWOPS_ROSTER_URL, { signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`roster download failed: HTTP ${res.status}`)
    return parseCwopsRoster(await res.text())
  } finally {
    clearTimeout(timer)
  }
}
