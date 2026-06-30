import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scoreLog } from '@shared/scoring'
import { bandForFreq } from '@shared/bands'
import { DEFAULT_ESM_MODE, type EsmMode } from '@shared/esm'
import { DEFAULT_TCI_SETTINGS, DEFAULT_WPM, type Band, type Contest, type Macro, type Qso, type RadioState, type Station, type TciSettings } from '@shared/types'
import { api } from './api'
import { RadioBar } from './components/RadioBar'
import { EntryForm } from './components/EntryForm'
import { LogTable } from './components/LogTable'
import { Scoreboard } from './components/Scoreboard'
import { SettingsPanel } from './components/SettingsPanel'

const EMPTY_STATION: Station = {
  callsign: '',
  name: '',
  memberNumber: '',
  spc: '',
  isMember: false
}

const initialRadio: RadioState = {
  connection: 'disconnected',
  freqHz: 0,
  band: 'other',
  mode: '',
  transmitting: false,
  wpm: 25
}

export function App() {
  const [contest, setContest] = useState<Contest | null>(null)
  const [qsos, setQsos] = useState<Qso[]>([])
  const [station, setStation] = useState<Station>(EMPTY_STATION)
  const [macros, setMacros] = useState<Macro[]>([])
  const [tciSettings, setTciSettings] = useState<TciSettings>(DEFAULT_TCI_SETTINGS)
  const [radio, setRadio] = useState<RadioState>(initialRadio)
  const [manualBand, setManualBand] = useState<Band>('20m')
  const [esmMode, setEsmMode] = useState<EsmMode>(DEFAULT_ESM_MODE)
  const [wpm, setWpm] = useState(DEFAULT_WPM)
  const [rosterCount, setRosterCount] = useState(0)

  // Latest WPM + last connection state, for pushing speed to the radio on connect.
  const wpmRef = useRef(wpm)
  wpmRef.current = wpm
  const prevConnRef = useRef<RadioState['connection']>('disconnected')
  const [showSettings, setShowSettings] = useState(false)
  const [newSessionLabel, setNewSessionLabel] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])

  // Initial load.
  useEffect(() => {
    void (async () => {
      const [c, st, mc, tci, rs, count, esm, savedWpm] = await Promise.all([
        api.currentContest(),
        api.getStation(),
        api.getMacros(),
        api.getTciSettings(),
        api.tciGetState(),
        api.rosterSize(),
        api.getEsmMode(),
        api.getWpm()
      ])
      setContest(c)
      setStation(st ?? EMPTY_STATION)
      setMacros(mc)
      setTciSettings(tci)
      setRadio(rs)
      setRosterCount(count)
      setEsmMode(esm)
      setWpm(savedWpm)
      setQsos(await api.listQsos(c.id))
      if (!st || !st.callsign) setShowSettings(true)
    })()
  }, [])

  // Radio + log event subscriptions.
  useEffect(() => {
    const off1 = api.onRadioState((s) => {
      // On a fresh connect, push the app's CW speed to the radio (RHR never
      // reports its own speed, so the app is the source of truth).
      if (s.connection === 'ready' && prevConnRef.current !== 'ready') {
        void api.tciSetWpm(wpmRef.current)
      }
      prevConnRef.current = s.connection
      setRadio(s)
    })
    const off2 = api.onLog((line) => setLogLines((prev) => [...prev.slice(-49), line]))
    const off3 = api.onRosterUpdated((count) => {
      setRosterCount(count)
      setLogLines((prev) => [...prev.slice(-49), `roster updated: ${count} members`])
    })
    return () => {
      off1()
      off2()
      off3()
    }
  }, [])

  const score = useMemo(() => scoreLog(qsos), [qsos])

  // When the radio is ready use its band/freq; otherwise the manual selection.
  const ready = radio.connection === 'ready'
  const activeBand: Band = ready ? bandForFreq(radio.freqHz) : manualBand
  const activeFreqHz = ready ? radio.freqHz : 0

  const handleLogged = useCallback(
    async (qso: Qso) => {
      // qso already inserted by EntryForm; just refresh.
      setQsos((prev) => [...prev, qso])
    },
    []
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await api.deleteQso(id)
      setQsos((prev) => prev.filter((q) => q.id !== id))
    },
    []
  )

  // `window.prompt` isn't supported in Electron (returns null silently), so we
  // open an in-app modal instead. `newSessionLabel` null = closed.
  const handleNewSession = useCallback(() => setNewSessionLabel('CWT-1900'), [])

  const handleCreateSession = useCallback(async () => {
    const label = newSessionLabel?.trim()
    if (!label) return
    const c = await api.newContest(label)
    setContest(c)
    setQsos([])
    setNewSessionLabel(null)
    setLogLines((p) => [...p.slice(-49), `new session: ${label}`])
  }, [newSessionLabel])

  const handleExport = useCallback(
    async (kind: 'cabrillo' | 'adif') => {
      if (!contest) return
      const res =
        kind === 'cabrillo'
          ? await api.exportCabrillo(contest.id)
          : await api.exportAdif(contest.id)
      if (res.path) {
        setLogLines((p) => [...p.slice(-49), `exported ${res.count} QSOs → ${res.path}`])
      }
    },
    [contest]
  )

  const handleSaveSettings = useCallback(
    async (next: { station: Station; tci: TciSettings; macros: Macro[] }) => {
      await api.setStation(next.station)
      await api.setTciSettings(next.tci)
      await api.setMacros(next.macros)
      setStation(next.station)
      setTciSettings(next.tci)
      setMacros(next.macros)
      setShowSettings(false)
    },
    []
  )

  const handleEsmChange = useCallback((mode: EsmMode) => {
    setEsmMode(mode)
    void api.setEsmMode(mode)
  }, [])

  const handleWpm = useCallback((next: number) => {
    if (!Number.isFinite(next)) return
    const clamped = Math.max(5, Math.min(60, Math.round(next)))
    setWpm(clamped)
    void api.tciSetWpm(clamped) // persists + sends to radio
  }, [])

  const handleImportRoster = useCallback(async () => {
    const count = await api.rosterImport()
    setRosterCount(count)
  }, [])

  const [rosterBusy, setRosterBusy] = useState(false)
  const handleUpdateRoster = useCallback(async () => {
    setRosterBusy(true)
    setLogLines((p) => [...p.slice(-49), 'downloading CWops roster…'])
    try {
      const count = await api.rosterUpdate()
      setRosterCount(count)
    } catch (err) {
      setLogLines((p) => [...p.slice(-49), `roster update failed: ${(err as Error).message}`])
    } finally {
      setRosterBusy(false)
    }
  }, [])

  return (
    <div className="app">
      <RadioBar
        radio={radio}
        settings={tciSettings}
        manualBand={manualBand}
        onManualBand={setManualBand}
        wpm={wpm}
        onConnect={() => api.tciConnect(tciSettings)}
        onDisconnect={() => api.tciDisconnect()}
        onSetCw={() => api.tciSetCwMode()}
        onWpm={handleWpm}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="body">
        <main className="logging">
          <EntryForm
            contestId={contest?.id ?? 0}
            band={activeBand}
            freqHz={activeFreqHz}
            qsos={qsos}
            station={station}
            macros={macros}
            radioReady={ready}
            esmMode={esmMode}
            onEsmChange={handleEsmChange}
            onLogged={handleLogged}
          />
          <LogTable qsos={qsos} onDelete={handleDelete} />
        </main>

        <aside className="sidebar">
          <Scoreboard contest={contest} score={score} />
          <div className="panel actions">
            <h3>Log</h3>
            <button onClick={() => handleExport('cabrillo')} disabled={!qsos.length}>
              Export Cabrillo
            </button>
            <button onClick={() => handleExport('adif')} disabled={!qsos.length}>
              Export ADIF
            </button>
            <button onClick={handleNewSession}>New Session…</button>
            <div className="roster-line">
              Roster: {rosterCount} members{' '}
              <button className="link" onClick={handleUpdateRoster} disabled={rosterBusy}>
                {rosterBusy ? 'updating…' : 'update'}
              </button>{' '}
              <button className="link" onClick={handleImportRoster}>
                import…
              </button>
            </div>
          </div>
          <div className="panel log-feed">
            <h3>Activity</h3>
            <div className="log-lines">
              {logLines.length === 0 ? (
                <div className="muted">No activity yet.</div>
              ) : (
                logLines.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </div>
          <div className="credit">
            Vibe coded by <strong>WW2DX</strong> &amp; Claude · for RHR CWops ops &amp; any TCI system
          </div>
        </aside>
      </div>

      {newSessionLabel !== null && (
        <div className="modal-backdrop" onClick={() => setNewSessionLabel(null)}>
          <div className="modal new-session" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2>New Session</h2>
              <button className="link" onClick={() => setNewSessionLabel(null)}>
                ✕
              </button>
            </header>
            <div className="modal-body">
              <p className="muted">
                Starts a fresh log for the next contest. Your current QSOs stay saved under their
                own session — export them first if you haven't.
              </p>
              <label>
                Session label
                <input
                  autoFocus
                  value={newSessionLabel}
                  onChange={(e) => setNewSessionLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateSession()
                    else if (e.key === 'Escape') setNewSessionLabel(null)
                  }}
                  placeholder="CWT-1900"
                />
              </label>
            </div>
            <footer className="modal-foot">
              <button className="link" onClick={() => setNewSessionLabel(null)}>
                Cancel
              </button>
              <button onClick={() => void handleCreateSession()} disabled={!newSessionLabel.trim()}>
                Start session
              </button>
            </footer>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          station={station}
          tci={tciSettings}
          macros={macros}
          rosterCount={rosterCount}
          onImportRoster={handleImportRoster}
          onUpdateRoster={handleUpdateRoster}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
