// The typed bridge surface exposed to the renderer as `window.api`.
// Implemented in src/preload/index.ts, consumed in the renderer.

import type {
  Contest,
  Macro,
  NewQso,
  Qso,
  RadioState,
  ScoreSummary,
  Station,
  TciSettings
} from './types'
import type { EsmMode } from './esm'

export interface RosterEntry {
  callsign: string
  name: string
  number: string
}

export interface ExportResult {
  /** Absolute path written, or null if the user cancelled the save dialog. */
  path: string | null
  /** Number of QSOs written. */
  count: number
}

export interface Api {
  // ---- radio (TCI) ----
  tciConnect(settings: TciSettings): Promise<void>
  tciDisconnect(): Promise<void>
  tciGetState(): Promise<RadioState>
  tciSetFrequency(hz: number): Promise<void>
  tciSetCwMode(): Promise<void>
  tciSetPtt(on: boolean): Promise<void>
  tciSetWpm(wpm: number): Promise<void>
  tciSendCw(text: string): Promise<void>
  tciStopCw(): Promise<void>
  /** The app-owned CW speed (persisted; RHR doesn't report its own speed). */
  getWpm(): Promise<number>

  // ---- contest / log ----
  currentContest(): Promise<Contest>
  newContest(session: string): Promise<Contest>
  listContests(): Promise<Contest[]>
  selectContest(id: number): Promise<Contest | null>
  listQsos(contestId: number): Promise<Qso[]>
  addQso(qso: NewQso): Promise<Qso>
  updateQso(qso: Qso): Promise<void>
  deleteQso(id: number): Promise<void>
  score(contestId: number): Promise<ScoreSummary>

  // ---- settings ----
  getStation(): Promise<Station | null>
  setStation(station: Station): Promise<void>
  getTciSettings(): Promise<TciSettings>
  setTciSettings(settings: TciSettings): Promise<void>
  getMacros(): Promise<Macro[]>
  setMacros(macros: Macro[]): Promise<void>
  getEsmMode(): Promise<EsmMode>
  setEsmMode(mode: EsmMode): Promise<void>

  // ---- roster ----
  rosterLookup(call: string): Promise<RosterEntry | null>
  rosterImport(): Promise<number>
  /** Download the latest roster from CWops; resolves to the member count (or throws). */
  rosterUpdate(): Promise<number>
  rosterSize(): Promise<number>

  // ---- export ----
  exportCabrillo(contestId: number): Promise<ExportResult>
  exportAdif(contestId: number): Promise<ExportResult>

  // ---- push events (main -> renderer). Each returns an unsubscribe fn. ----
  onRadioState(cb: (state: RadioState) => void): () => void
  onCallsignSent(cb: (call: string) => void): () => void
  onLog(cb: (line: string) => void): () => void
  /** Fired when a background roster refresh completes, with the new member count. */
  onRosterUpdated(cb: (count: number) => void): () => void
}

/** IPC channel names — single source of truth for main + preload. */
export const CH = {
  tciConnect: 'tci:connect',
  tciDisconnect: 'tci:disconnect',
  tciGetState: 'tci:getState',
  tciSetFrequency: 'tci:setFrequency',
  tciSetCwMode: 'tci:setCwMode',
  tciSetPtt: 'tci:setPtt',
  tciSetWpm: 'tci:setWpm',
  tciSendCw: 'tci:sendCw',
  tciStopCw: 'tci:stopCw',
  getWpm: 'settings:getWpm',

  currentContest: 'contest:current',
  newContest: 'contest:new',
  listContests: 'contest:list',
  selectContest: 'contest:select',
  listQsos: 'qso:list',
  addQso: 'qso:add',
  updateQso: 'qso:update',
  deleteQso: 'qso:delete',
  score: 'score:get',

  getStation: 'settings:getStation',
  setStation: 'settings:setStation',
  getTciSettings: 'settings:getTci',
  setTciSettings: 'settings:setTci',
  getMacros: 'settings:getMacros',
  setMacros: 'settings:setMacros',
  getEsmMode: 'settings:getEsm',
  setEsmMode: 'settings:setEsm',

  rosterLookup: 'roster:lookup',
  rosterImport: 'roster:import',
  rosterUpdate: 'roster:update',
  rosterSize: 'roster:size',

  exportCabrillo: 'export:cabrillo',
  exportAdif: 'export:adif',

  // push events
  evRadioState: 'ev:radioState',
  evCallsign: 'ev:callsign',
  evLog: 'ev:log',
  evRosterUpdated: 'ev:rosterUpdated'
} as const
