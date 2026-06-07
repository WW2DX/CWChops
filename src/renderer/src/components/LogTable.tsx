import { useMemo } from 'react'
import { dupeKey } from '@shared/scoring'
import { freqToKhz } from '@shared/bands'
import type { Qso } from '@shared/types'

interface Props {
  qsos: Qso[]
  onDelete: (id: number) => void
}

function hhmm(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
}

export function LogTable({ qsos, onDelete }: Props) {
  // Mark dupes: any QSO whose call+band appeared earlier in time order.
  const dupeIds = useMemo(() => {
    const seen = new Set<string>()
    const ids = new Set<number>()
    for (const q of [...qsos].sort((a, b) => a.ts - b.ts || a.id - b.id)) {
      const k = dupeKey(q.callsign, q.band)
      if (seen.has(k)) ids.add(q.id)
      else seen.add(k)
    }
    return ids
  }, [qsos])

  const rows = useMemo(() => [...qsos].sort((a, b) => b.ts - a.ts || b.id - a.id), [qsos])

  return (
    <div className="panel logtable">
      <div className="logtable-head">
        <h3>QSOs ({qsos.length})</h3>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>UTC</th>
              <th>Call</th>
              <th>Band</th>
              <th>Freq</th>
              <th>Name</th>
              <th>Nr/SPC</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted center">
                  No QSOs yet — type a call and exchange, press Enter.
                </td>
              </tr>
            )}
            {rows.map((q, i) => (
              <tr key={q.id} className={dupeIds.has(q.id) ? 'dupe-row' : ''}>
                <td className="muted">{rows.length - i}</td>
                <td>{hhmm(q.ts)}</td>
                <td className="call">{q.callsign}</td>
                <td>{q.band}</td>
                <td className="num">{freqToKhz(q.freqHz)}</td>
                <td>{q.name}</td>
                <td className={q.isMember ? 'member' : ''}>{q.exch}</td>
                <td>
                  <button className="link danger" onClick={() => onDelete(q.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
