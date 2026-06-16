import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultFreqForBand } from '@shared/bands'
import { isDupe } from '@shared/scoring'
import { expandMacro, isMemberNumber } from '@shared/exchange'
import {
  ESM_MACRO_KEYS,
  esmAction,
  esmHint,
  type EntryField,
  type EsmMode
} from '@shared/esm'
import type { Band, Macro, NewQso, Qso, Station } from '@shared/types'
import { api } from '../api'
import { MacroBar } from './MacroBar'

const ESM_MODES: { mode: EsmMode; label: string }[] = [
  { mode: 'off', label: 'Off' },
  { mode: 'run', label: 'Run' },
  { mode: 'sp', label: 'S&P' }
]

interface Props {
  contestId: number
  band: Band
  freqHz: number
  qsos: Qso[]
  station: Station
  macros: Macro[]
  radioReady: boolean
  esmMode: EsmMode
  onEsmChange: (mode: EsmMode) => void
  onLogged: (qso: Qso) => void
}

export function EntryForm({
  contestId,
  band,
  freqHz,
  qsos,
  station,
  macros,
  radioReady,
  esmMode,
  onEsmChange,
  onLogged
}: Props) {
  const [call, setCall] = useState('')
  const [name, setName] = useState('')
  const [nr, setNr] = useState('')
  const [focused, setFocused] = useState<EntryField>('call')

  const callRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const nrRef = useRef<HTMLInputElement>(null)

  const dupe = useMemo(
    () => (call.trim() ? isDupe(call, band, qsos) : false),
    [call, band, qsos]
  )

  const focusField = useCallback((field: EntryField) => {
    const ref = field === 'call' ? callRef : field === 'name' ? nameRef : nrRef
    ref.current?.focus()
    ref.current?.select()
  }, [])

  // Roster autofill: when a plausible call is entered and the exchange is still
  // empty, prefill his name + member number from the local roster.
  useEffect(() => {
    const c = call.trim().toUpperCase()
    if (c.length < 3 || name.trim() || nr.trim()) return
    let cancelled = false
    const t = setTimeout(async () => {
      const entry = await api.rosterLookup(c)
      if (!cancelled && entry) {
        setName(entry.name)
        setNr(entry.number)
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [call, name, nr])

  const sendMacro = useCallback(
    (macro: Macro) => {
      if (!radioReady) return
      const text = expandMacro(macro.text, { station, call, hisName: name })
      if (text) void api.tciSendCw(text)
    },
    [radioReady, station, call, name]
  )

  const sendByKey = useCallback(
    (key: number) => {
      const macro = macros.find((m) => m.key === key)
      if (macro) sendMacro(macro)
    },
    [macros, sendMacro]
  )

  const logQso = useCallback(async (): Promise<boolean> => {
    const c = call.trim().toUpperCase()
    const hisName = name.trim()
    const exch = nr.trim().toUpperCase()
    if (!c) {
      focusField('call')
      return false
    }
    if (!hisName) {
      focusField('name')
      return false
    }
    if (!exch) {
      focusField('nr')
      return false
    }
    const newQso: NewQso = {
      contestId,
      ts: Date.now(),
      callsign: c,
      band,
      freqHz: freqHz || defaultFreqForBand(band),
      mode: 'CW',
      rstSent: '599',
      rstRcvd: '599',
      name: hisName,
      exch,
      isMember: isMemberNumber(exch)
    }
    const saved = await api.addQso(newQso)
    onLogged(saved)
    setCall('')
    setName('')
    setNr('')
    focusField('call')
    return true
  }, [call, name, nr, contestId, band, freqHz, onLogged, focusField])

  /** Run the ESM action for Enter pressed in `field`. */
  const handleEnter = useCallback(
    (field: EntryField) => {
      if (esmMode === 'off') {
        // Enter walks the fields, then logs from the last one.
        const a = esmAction('off', field, !!call.trim())
        if (a.log) void logQso()
        else if (a.focus) focusField(a.focus)
        return
      }
      const a = esmAction(esmMode, field, !!call.trim())
      if (a.log) {
        // Closing turn: only key/ log once we have a complete exchange.
        if (call.trim() && name.trim() && nr.trim()) {
          if (a.macro) sendByKey(ESM_MACRO_KEYS[a.macro])
          void logQso()
        } else {
          void logQso() // focuses the missing field
        }
        return
      }
      if (a.macro) sendByKey(ESM_MACRO_KEYS[a.macro])
      if (a.focus) focusField(a.focus)
    },
    [esmMode, call, name, nr, sendByKey, logQso, focusField]
  )

  // Global F-key macros + Escape to stop CW.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        void api.tciStopCw()
        return
      }
      const m = /^F(\d{1,2})$/.exec(e.key)
      if (m) {
        const macro = macros.find((mac) => mac.key === Number(m[1]))
        if (macro) {
          e.preventDefault()
          sendMacro(macro)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [macros, sendMacro])

  // Tab cycles through just the entry boxes (call → name → nr → call), wrapping
  // around, and Shift+Tab goes the other way — so corrections during a QSO are a
  // quick keystroke away without Enter logging or tabbing out to other controls.
  const cycleField = useCallback(
    (field: EntryField, backward: boolean) => {
      const order: EntryField[] = ['call', 'name', 'nr']
      const i = order.indexOf(field)
      const next = order[(i + (backward ? order.length - 1 : 1)) % order.length]
      focusField(next)
    },
    [focusField]
  )

  const keyHandler =
    (field: EntryField) =>
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleEnter(field)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        cycleField(field, e.shiftKey)
      }
    }

  const hint = esmHint(esmMode, focused, !!call.trim())

  return (
    <div className="panel entry">
      <div className="entry-header">
        <div className="esm-toggle" title="Enter Sends Message mode">
          <span className="esm-label">ESM</span>
          {ESM_MODES.map((m) => (
            <button
              key={m.mode}
              className={esmMode === m.mode ? 'active' : ''}
              onClick={() => onEsmChange(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {hint && <span className="esm-hint">{hint}</span>}
      </div>

      <div className="entry-row">
        <div className={`field call ${dupe ? 'dupe' : ''}`}>
          <label>Call</label>
          <input
            ref={callRef}
            value={call}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            onFocus={() => setFocused('call')}
            onChange={(e) => setCall(e.target.value.toUpperCase())}
            onKeyDown={keyHandler('call')}
            placeholder="W1XYZ"
          />
          {dupe && <span className="dupe-badge">DUPE</span>}
        </div>

        <div className="field name">
          <label>Name</label>
          <input
            ref={nameRef}
            value={name}
            spellCheck={false}
            autoComplete="off"
            onFocus={() => setFocused('name')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={keyHandler('name')}
            placeholder="Bud"
          />
        </div>

        <div className={`field nr ${nr && isMemberNumber(nr) ? 'member' : ''}`}>
          <label>Nr / SPC</label>
          <input
            ref={nrRef}
            value={nr}
            spellCheck={false}
            autoComplete="off"
            onFocus={() => setFocused('nr')}
            onChange={(e) => setNr(e.target.value.toUpperCase())}
            onKeyDown={keyHandler('nr')}
            placeholder="1 / TX"
          />
        </div>

        <div className="field band-readout">
          <label>Band</label>
          <div className="band-value">{band === 'other' ? '—' : band}</div>
        </div>

        <button className="log-btn" onClick={() => void logQso()}>
          Log&nbsp;⏎
        </button>
      </div>

      <MacroBar macros={macros} disabled={!radioReady} onSend={sendMacro} />
    </div>
  )
}
