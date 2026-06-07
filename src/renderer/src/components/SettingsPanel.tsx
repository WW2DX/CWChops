import { useState } from 'react'
import { DEFAULT_MACROS } from '@shared/exchange'
import type { Macro, Station, TciSettings } from '@shared/types'

interface Props {
  station: Station
  tci: TciSettings
  macros: Macro[]
  rosterCount: number
  onImportRoster: () => void
  onUpdateRoster: () => void
  onSave: (next: { station: Station; tci: TciSettings; macros: Macro[] }) => void
  onClose: () => void
}

export function SettingsPanel({
  station,
  tci,
  macros,
  rosterCount,
  onImportRoster,
  onUpdateRoster,
  onSave,
  onClose
}: Props) {
  const [s, setS] = useState<Station>(station)
  const [t, setT] = useState<TciSettings>(tci)
  const [m, setM] = useState<Macro[]>(macros)

  const set = <K extends keyof Station>(k: K, v: Station[K]): void => setS({ ...s, [k]: v })
  const setTci = <K extends keyof TciSettings>(k: K, v: TciSettings[K]): void =>
    setT({ ...t, [k]: v })
  const setMacro = (key: number, patch: Partial<Macro>): void =>
    setM(m.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Settings</h2>
          <button className="link" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          <section>
            <h3>Station</h3>
            <div className="grid2">
              <label>
                Callsign
                <input
                  value={s.callsign}
                  onChange={(e) => set('callsign', e.target.value.toUpperCase())}
                  placeholder="W1XYZ"
                />
              </label>
              <label>
                Name
                <input value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Joe" />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={s.isMember}
                onChange={(e) => set('isMember', e.target.checked)}
              />
              I am a CWops member
            </label>
            <div className="grid2">
              <label>
                CWops Number
                <input
                  value={s.memberNumber}
                  disabled={!s.isMember}
                  onChange={(e) => set('memberNumber', e.target.value)}
                  placeholder="1234"
                />
              </label>
              <label>
                State / Prov / DX prefix
                <input
                  value={s.spc}
                  disabled={s.isMember}
                  onChange={(e) => set('spc', e.target.value.toUpperCase())}
                  placeholder="TX"
                />
              </label>
            </div>
          </section>

          <section>
            <h3>TCI Connection (RemoteHamRadio)</h3>
            <div className="grid3">
              <label>
                Host
                <input value={t.host} onChange={(e) => setTci('host', e.target.value)} />
              </label>
              <label>
                Port
                <input
                  type="number"
                  value={t.port}
                  onChange={(e) => setTci('port', Number(e.target.value))}
                />
              </label>
              <label>
                TRX #
                <input
                  type="number"
                  min={0}
                  value={t.trx}
                  onChange={(e) => setTci('trx', Number(e.target.value))}
                />
              </label>
            </div>
            <p className="hint">Default TCI port is 40001. RHR provides the host/port for your rig.</p>
          </section>

          <section>
            <div className="section-head">
              <h3>CW Macros</h3>
              <button className="link" onClick={() => setM(DEFAULT_MACROS.map((x) => ({ ...x })))}>
                Reset to defaults
              </button>
            </div>
            <p className="hint">
              Placeholders: {'{CALL} {MYCALL} {NAME} {NR} {EXCH} {HISNAME}'}. Speed: {'>'} faster,{' '}
              {'<'} slower. Prosign: |SK|. ESM uses F1=CQ, F2=exchange (include {'{CALL}'}), F3=TU,
              F5=my call.
            </p>
            <div className="macro-edit">
              {m.map((macro) => (
                <div key={macro.key} className="macro-edit-row">
                  <span className="fkey">F{macro.key}</span>
                  <input
                    className="macro-label-in"
                    value={macro.label}
                    onChange={(e) => setMacro(macro.key, { label: e.target.value })}
                  />
                  <input
                    className="macro-text-in"
                    value={macro.text}
                    onChange={(e) => setMacro(macro.key, { text: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>CWops Roster</h3>
            <p className="hint">
              {rosterCount} members loaded. Used to autofill name + number from a callsign. The
              roster auto-updates from CWops weekly; you can also refresh it now.
            </p>
            <div className="roster-buttons">
              <button className="primary" onClick={onUpdateRoster}>
                Update from CWops
              </button>
              <button onClick={onImportRoster}>Import CSV…</button>
            </div>
          </section>

          <section>
            <h3>About</h3>
            <p className="hint about">
              <strong>CWChops</strong> is a vibe-coded CWops CWT contest logger by{' '}
              <strong>WW2DX</strong> and Claude — built for RemoteHamRadio (RHR) CWops operators,
              and any other TCI-supported system.
            </p>
          </section>
        </div>

        <footer className="modal-foot">
          <button className="link" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={() => onSave({ station: s, tci: t, macros: m })}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
