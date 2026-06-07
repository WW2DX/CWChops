import { freqToKhz } from '@shared/bands'
import { scoreLog } from '@shared/scoring'
import { sentExchangeToken } from '@shared/exchange'
import type { Contest, Qso, Station } from '@shared/types'

function utcParts(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}${mi}` }
}

export interface CabrilloOptions {
  /** SINGLE-OP / etc. */
  category?: string
  /** HIGH / LOW / QRP. */
  power?: 'HIGH' | 'LOW' | 'QRP'
}

/**
 * Build a Cabrillo 3.0 log for a CWT session. CONTEST id is CWOPS. Per N1MM
 * convention, both RST slots carry 599 even though RST isn't spoken in CWT.
 */
export function buildCabrillo(
  contest: Contest,
  station: Station,
  qsos: Qso[],
  opts: CabrilloOptions = {}
): string {
  const score = scoreLog(qsos)
  const myExchToken = sentExchangeToken(station)
  const myCall = station.callsign.toUpperCase()
  const power = opts.power ?? 'HIGH'
  const category = opts.category ?? 'SINGLE-OP'

  const lines: string[] = [
    'START-OF-LOG: 3.0',
    'CONTEST: CWOPS',
    `CALLSIGN: ${myCall}`,
    `CATEGORY-OPERATOR: ${category}`,
    'CATEGORY-BAND: ALL',
    'CATEGORY-MODE: CW',
    `CATEGORY-POWER: ${power}`,
    'CATEGORY-TRANSMITTER: ONE',
    `CLAIMED-SCORE: ${score.total}`,
    `OPERATORS: ${myCall}`,
    `NAME: ${station.name}`,
    `CREATED-BY: CWChops`,
    `SOAPBOX: Session ${contest.session}`
  ]

  for (const q of qsos) {
    const { date, time } = utcParts(q.ts)
    const khz = Math.round(Number(freqToKhz(q.freqHz)))
    // QSO: freq mode date time  sent-call rst sent-exch  rcvd-call rst rcvd-exch
    lines.push(
      `QSO: ${khz} CW ${date} ${time} ` +
        `${myCall} 599 ${station.name} ${myExchToken} ` +
        `${q.callsign.toUpperCase()} 599 ${q.name} ${q.exch}`
    )
  }

  lines.push('END-OF-LOG:')
  return lines.join('\n') + '\n'
}
