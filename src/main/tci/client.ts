import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { bandForFreq } from '@shared/bands'
import type { RadioState, TciSettings } from '@shared/types'
import {
  cmdCwMacros,
  cmdCwMsg,
  cmdCwStop,
  cmdReadModulation,
  cmdReadVfo,
  cmdSetCwSpeed,
  cmdSetModulation,
  cmdSetTrx,
  cmdSetVfo,
  parseTciMessage,
  splitFrames
} from './protocol'

const VFO_CHANNEL = 0 // VFO A

/**
 * Events:
 *   'state'    (state: RadioState)   — any mirrored-state change
 *   'callsign' (call: string)        — TCI confirmed a keyed callsign (callsign_send)
 *   'cw-empty' ()                    — CW queue drained (cw_macros_empty)
 *   'log'      (line: string)        — human-readable diagnostic line
 */
export class TciClient extends EventEmitter {
  private ws: WebSocket | null = null
  private settings: TciSettings
  private cwModeString = 'cw'
  private reconnectTimer: NodeJS.Timeout | null = null
  private wantConnected = false

  private state: RadioState = {
    connection: 'disconnected',
    freqHz: 0,
    band: 'other',
    mode: '',
    transmitting: false,
    wpm: 25
  }

  constructor(settings: TciSettings) {
    super()
    this.settings = settings
  }

  getState(): RadioState {
    return { ...this.state }
  }

  updateSettings(settings: TciSettings): void {
    this.settings = settings
  }

  get url(): string {
    return `ws://${this.settings.host}:${this.settings.port}`
  }

  connect(settings?: TciSettings): void {
    if (settings) this.settings = settings
    this.wantConnected = true
    this.clearReconnect()
    this.openSocket()
  }

  disconnect(): void {
    this.wantConnected = false
    this.clearReconnect()
    if (this.ws) {
      try {
        this.ws.removeAllListeners()
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    this.patch({ connection: 'disconnected', transmitting: false })
  }

  private openSocket(): void {
    this.patch({ connection: 'connecting', error: undefined })
    const url = this.url
    this.emit('log', `connecting to ${url}`)
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      this.fail((err as Error).message)
      return
    }
    this.ws = ws

    ws.on('open', () => this.emit('log', `socket open ${url}`))
    ws.on('message', (data) => this.onMessage(data.toString()))
    ws.on('error', (err) => this.fail(err.message))
    ws.on('close', () => {
      if (this.state.connection !== 'error') {
        this.patch({ connection: 'disconnected', transmitting: false })
      }
      this.ws = null
      if (this.wantConnected) this.scheduleReconnect()
    })
  }

  private fail(message: string): void {
    this.emit('log', `error: ${message}`)
    this.patch({ connection: 'error', error: message, transmitting: false })
    if (this.wantConnected) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.wantConnected) this.openSocket()
    }, 3000)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private onMessage(raw: string): void {
    for (const frame of splitFrames(raw)) {
      const msg = parseTciMessage(frame)
      if (!msg) continue
      this.handle(msg.cmd, msg.args)
    }
  }

  private handle(cmd: string, args: string[]): void {
    switch (cmd) {
      case 'ready': {
        this.patch({ connection: 'ready' })
        this.emit('log', 'ready — querying radio state')
        // Pull the current operating state for our trx. (RHR doesn't report CW
        // speed, so WPM is app-owned and pushed by the renderer on connect.)
        this.send(cmdReadVfo(this.settings.trx, VFO_CHANNEL))
        this.send(cmdReadModulation(this.settings.trx))
        break
      }
      case 'modulations_list': {
        // Pick the radio's actual spelling of CW (case-insensitive match).
        const cw = args.find((m) => m.toLowerCase() === 'cw')
        if (cw) this.cwModeString = cw
        break
      }
      case 'vfo': {
        // vfo:trx,channel,hz
        if (Number(args[0]) === this.settings.trx && Number(args[1]) === VFO_CHANNEL) {
          const hz = Number(args[2])
          if (Number.isFinite(hz)) this.patch({ freqHz: hz, band: bandForFreq(hz) })
        }
        break
      }
      case 'modulation': {
        if (Number(args[0]) === this.settings.trx) {
          this.patch({ mode: (args[1] ?? '').toUpperCase() })
        }
        break
      }
      case 'trx': {
        if (Number(args[0]) === this.settings.trx) {
          this.patch({ transmitting: args[1] === 'true' })
        }
        break
      }
      case 'cw_macros_speed': {
        const wpm = Number(args[0])
        if (Number.isFinite(wpm)) this.patch({ wpm })
        break
      }
      case 'rx_smeter': {
        if (Number(args[0]) === this.settings.trx) {
          const dbm = Number(args[2])
          if (Number.isFinite(dbm)) this.patch({ smeterDbm: dbm })
        }
        break
      }
      case 'callsign_send': {
        this.emit('callsign', args[0] ?? '')
        break
      }
      case 'cw_macros_empty': {
        this.emit('cw-empty')
        break
      }
    }
  }

  // ---- control methods ----

  setFrequency(freqHz: number): void {
    this.send(cmdSetVfo(this.settings.trx, VFO_CHANNEL, freqHz))
  }

  setCwMode(): void {
    this.send(cmdSetModulation(this.settings.trx, this.cwModeString))
  }

  setPtt(on: boolean): void {
    this.send(cmdSetTrx(this.settings.trx, on))
  }

  setWpm(wpm: number): void {
    // RHR keys at the CW macros speed; the command needs the trx index or it's
    // ignored. (RHR has no cw_keyer_speed handler, so don't bother sending it.)
    this.send(cmdSetCwSpeed(this.settings.trx, wpm))
    // Optimistically reflect it: RHR never reports CW speed back.
    this.patch({ wpm })
  }

  /** Send free CW text (escaped per spec). */
  sendCw(text: string): void {
    if (!text.trim()) return
    this.send(cmdCwMacros(this.settings.trx, text))
  }

  /** Send a structured CW message with an editable callsign. */
  sendCwMessage(prefix: string, call: string, suffix: string): void {
    this.send(cmdCwMsg(this.settings.trx, prefix, call, suffix))
  }

  stopCw(): void {
    this.send(cmdCwStop())
  }

  private send(frame: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame)
      this.emit('log', `=> ${frame}`)
    } else {
      this.emit('log', `dropped (not connected): ${frame}`)
    }
  }

  private patch(partial: Partial<RadioState>): void {
    this.state = { ...this.state, ...partial }
    this.emit('state', this.getState())
  }
}
