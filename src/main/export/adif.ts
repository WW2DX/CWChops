import { sentExchangeToken } from '@shared/exchange'
import type { Qso, Station } from '@shared/types'

function field(name: string, value: string): string {
  return `<${name}:${value.length}>${value}`
}

function utcDateTime(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return {
    date: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  }
}

/** Build an ADIF 3 (.adi) document. CWops number/SPC is carried in STX/SRX strings. */
export function buildAdif(station: Station, qsos: Qso[]): string {
  const myToken = sentExchangeToken(station)
  const out: string[] = [
    'CWChops ADIF export',
    field('ADIF_VER', '3.1.4'),
    field('PROGRAMID', 'CWChops'),
    '<EOH>',
    ''
  ]

  for (const q of qsos) {
    const { date, time } = utcDateTime(q.ts)
    const freqMhz = (q.freqHz / 1_000_000).toFixed(6)
    const parts = [
      field('CALL', q.callsign.toUpperCase()),
      field('QSO_DATE', date),
      field('TIME_ON', time),
      field('BAND', q.band),
      field('FREQ', freqMhz),
      field('MODE', 'CW'),
      field('RST_SENT', q.rstSent || '599'),
      field('RST_RCVD', q.rstRcvd || '599'),
      field('NAME', q.name),
      field('CONTEST_ID', 'CWOPS'),
      field('STX_STRING', `${station.name} ${myToken}`.trim()),
      field('SRX_STRING', `${q.name} ${q.exch}`.trim())
    ]
    if (q.isMember) parts.push(field('APP_CWT_MEMBER_NR', q.exch))
    out.push(parts.join(' ') + ' <EOR>')
  }

  return out.join('\n') + '\n'
}
