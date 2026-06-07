// Shared types used by both the Electron main process and the renderer.

/** The six CWT bands plus a fallthrough. */
export type Band = '160m' | '80m' | '40m' | '20m' | '15m' | '10m' | 'other'

export const CWT_BANDS: Band[] = ['160m', '80m', '40m', '20m', '15m', '10m']

/** A logged contact. `id` is assigned by the database on insert. */
export interface Qso {
  id: number
  contestId: number
  /** Epoch milliseconds (UTC) when the QSO was logged. */
  ts: number
  callsign: string
  band: Band
  freqHz: number
  mode: 'CW'
  rstSent: string
  rstRcvd: string
  /** Their first name. */
  name: string
  /**
   * Their exchange token: a CWops member number (digits) for members, or a
   * state/province/DX-prefix (or "CWA") for non-members.
   */
  exch: string
  /** True when `exch` is a numeric CWops member number. */
  isMember: boolean
}

/** A QSO before it has been assigned a database id. */
export type NewQso = Omit<Qso, 'id'>

/** The operator's station settings for the current contest. */
export interface Station {
  callsign: string
  name: string
  /** CWops member number if a member; used as the sent exchange token. */
  memberNumber: string
  /** State/Province/DX prefix used as sent exchange when not a member. */
  spc: string
  /** Whether the operator is a CWops member (sends memberNumber vs spc). */
  isMember: boolean
}

/** Identifies a single CWT running session. */
export interface Contest {
  id: number
  /** Always "CWT" for now. */
  name: string
  /** 3830/Cabrillo session label, e.g. "CWT-1900". */
  session: string
  /** Epoch ms when this contest log was created. */
  startedAt: number
}

export interface ScoreSummary {
  /** Count of valid (non-dupe) QSOs. */
  qsos: number
  /** Number of dupes filtered out. */
  dupes: number
  /** Unique callsigns worked (the multiplier). */
  mults: number
  /** qsos * mults. */
  total: number
  /** Valid QSO count per band. */
  perBand: Record<string, number>
}

// ---- TCI radio state mirrored into the renderer ----

export type TciConnectionState = 'disconnected' | 'connecting' | 'ready' | 'error'

export interface RadioState {
  connection: TciConnectionState
  /** Last error message, if connection === 'error'. */
  error?: string
  freqHz: number
  band: Band
  mode: string
  /** True when the radio is transmitting. */
  transmitting: boolean
  /** Current CW speed in WPM. */
  wpm: number
  /** Last S-meter reading in dBm, if any. */
  smeterDbm?: number
}

export interface TciSettings {
  host: string
  port: number
  /** TCI receiver/transceiver index (0 = first). */
  trx: number
}

export const DEFAULT_TCI_SETTINGS: TciSettings = {
  host: '127.0.0.1',
  port: 40001,
  trx: 0
}

/** Default CW speed (WPM) — app-owned; RHR doesn't report its speed over TCI. */
export const DEFAULT_WPM = 28

/** A keyboard-driven CW macro (F-key). `text` may contain placeholders. */
export interface Macro {
  /** 1-based F-key number. */
  key: number
  label: string
  /** Macro text; see expandMacro() for placeholders. */
  text: string
}
