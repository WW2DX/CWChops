import { existsSync, readFileSync } from 'node:fs'

export interface RosterEntry {
  callsign: string
  name: string
  number: string
}

/**
 * In-memory CWops member roster for callsign autofill. CWops does not publish a
 * clean machine-readable roster, so this loads a user-supplied CSV
 * (`callsign,name,number` per line) and looks members up by call. Absent file =
 * empty roster (autofill simply does nothing).
 */
export class Roster {
  private byCall = new Map<string, RosterEntry>()

  /** Load from a CSV file path if it exists. Returns the number of entries loaded. */
  loadFile(path: string): number {
    if (!existsSync(path)) return 0
    return this.loadCsv(readFileSync(path, 'utf8'))
  }

  /** Parse `callsign,name,number` rows. A header row (non-numeric number col) is skipped. */
  loadCsv(text: string): number {
    this.byCall.clear()
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const [call, name, number] = line.split(',').map((s) => s.trim())
      if (!call || !number || !/^\d+$/.test(number)) continue
      const callsign = call.toUpperCase()
      this.byCall.set(callsign, { callsign, name: name ?? '', number })
    }
    return this.byCall.size
  }

  /** Replace the roster with a parsed set of entries (e.g. from the live download). */
  setEntries(entries: RosterEntry[]): void {
    this.byCall.clear()
    for (const e of entries) {
      this.byCall.set(e.callsign.toUpperCase(), {
        callsign: e.callsign.toUpperCase(),
        name: e.name,
        number: e.number
      })
    }
  }

  /** Serialize the roster as a normalized `callsign,name,number` CSV for caching. */
  serialize(): string {
    const lines = ['callsign,name,number']
    for (const e of this.byCall.values()) {
      lines.push(`${e.callsign},${e.name},${e.number}`)
    }
    return lines.join('\n') + '\n'
  }

  lookup(callsign: string): RosterEntry | null {
    return this.byCall.get(callsign.trim().toUpperCase()) ?? null
  }

  get size(): number {
    return this.byCall.size
  }
}
