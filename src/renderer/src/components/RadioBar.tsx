import { freqToDisplay } from '@shared/bands'
import { CWT_BANDS, type Band, type RadioState, type TciSettings } from '@shared/types'

interface Props {
  radio: RadioState
  settings: TciSettings
  manualBand: Band
  wpm: number
  onManualBand: (b: Band) => void
  onConnect: () => void
  onDisconnect: () => void
  onSetCw: () => void
  onWpm: (wpm: number) => void
  onOpenSettings: () => void
}

const STATUS_LABEL: Record<RadioState['connection'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  ready: 'Connected',
  error: 'Error'
}

export function RadioBar({
  radio,
  settings,
  manualBand,
  wpm,
  onManualBand,
  onConnect,
  onDisconnect,
  onSetCw,
  onWpm,
  onOpenSettings
}: Props) {
  const ready = radio.connection === 'ready'
  const connecting = radio.connection === 'connecting'

  return (
    <header className="radiobar">
      <div className="brand">CWChops</div>

      <div className={`status ${radio.connection}`}>
        <span className="dot" />
        {STATUS_LABEL[radio.connection]}
        {radio.connection === 'error' && radio.error ? `: ${radio.error}` : ''}
      </div>

      <div className="freq-block">
        <div className="freq">{freqToDisplay(radio.freqHz)}</div>
        <div className="freq-sub">
          {ready ? radio.band : <BandPicker band={manualBand} onChange={onManualBand} />}
          {' · '}
          {ready ? radio.mode || '—' : 'offline'}
        </div>
      </div>

      {radio.transmitting && <div className="tx">TX</div>}

      <div className="wpm">
        <label>WPM</label>
        <input
          type="number"
          min={5}
          max={60}
          value={wpm}
          onChange={(e) => onWpm(Number(e.target.value))}
          title="CW speed — pushed to the radio (RHR doesn't report its own speed)"
        />
      </div>

      <div className="radio-actions">
        <button onClick={onSetCw} disabled={!ready} title="Set radio to CW mode">
          CW
        </button>
        {ready || connecting ? (
          <button onClick={onDisconnect}>Disconnect</button>
        ) : (
          <button className="primary" onClick={onConnect}>
            Connect&nbsp;{settings.host}:{settings.port}
          </button>
        )}
        <button className="gear" onClick={onOpenSettings} title="Settings">
          ⚙
        </button>
      </div>
    </header>
  )
}

function BandPicker({ band, onChange }: { band: Band; onChange: (b: Band) => void }) {
  return (
    <select value={band} onChange={(e) => onChange(e.target.value as Band)}>
      {CWT_BANDS.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  )
}
