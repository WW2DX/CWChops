import { useEffect, useState } from 'react'
import { nextCwtSession } from '@shared/session'

/** Format ms as "2d 05:13:42", dropping the day part when under 24h. */
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const hms = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return days > 0 ? `${days}d ${hms}` : hms
}

/**
 * Live countdown to the next CWT session (or time remaining when one is
 * running). Ticks once a second and recomputes the schedule each tick, so it
 * rolls over to the following session on its own.
 */
export function CwtCountdown() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const session = nextCwtSession(now)
  const live = now >= session.start && now < session.end
  const remaining = live ? session.end.getTime() - now.getTime() : session.start.getTime() - now.getTime()

  return (
    <div className={`cwt-countdown ${live ? 'live' : ''}`}>
      <span className="cwt-countdown-lbl">
        {live ? `${session.label} live · ends in` : `Next ${session.label} in`}
      </span>
      <span className="cwt-countdown-time">{formatRemaining(remaining)}</span>
    </div>
  )
}
