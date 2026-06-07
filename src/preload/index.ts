import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '@shared/api'
import type { Api } from '@shared/api'

/** Subscribe to a main->renderer push channel; return an unsubscribe fn. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: Api = {
  // radio
  tciConnect: (s) => ipcRenderer.invoke(CH.tciConnect, s),
  tciDisconnect: () => ipcRenderer.invoke(CH.tciDisconnect),
  tciGetState: () => ipcRenderer.invoke(CH.tciGetState),
  tciSetFrequency: (hz) => ipcRenderer.invoke(CH.tciSetFrequency, hz),
  tciSetCwMode: () => ipcRenderer.invoke(CH.tciSetCwMode),
  tciSetPtt: (on) => ipcRenderer.invoke(CH.tciSetPtt, on),
  tciSetWpm: (wpm) => ipcRenderer.invoke(CH.tciSetWpm, wpm),
  tciSendCw: (text) => ipcRenderer.invoke(CH.tciSendCw, text),
  tciStopCw: () => ipcRenderer.invoke(CH.tciStopCw),
  getWpm: () => ipcRenderer.invoke(CH.getWpm),

  // contest / log
  currentContest: () => ipcRenderer.invoke(CH.currentContest),
  newContest: (session) => ipcRenderer.invoke(CH.newContest, session),
  listContests: () => ipcRenderer.invoke(CH.listContests),
  selectContest: (id) => ipcRenderer.invoke(CH.selectContest, id),
  listQsos: (contestId) => ipcRenderer.invoke(CH.listQsos, contestId),
  addQso: (qso) => ipcRenderer.invoke(CH.addQso, qso),
  updateQso: (qso) => ipcRenderer.invoke(CH.updateQso, qso),
  deleteQso: (id) => ipcRenderer.invoke(CH.deleteQso, id),
  score: (contestId) => ipcRenderer.invoke(CH.score, contestId),

  // settings
  getStation: () => ipcRenderer.invoke(CH.getStation),
  setStation: (station) => ipcRenderer.invoke(CH.setStation, station),
  getTciSettings: () => ipcRenderer.invoke(CH.getTciSettings),
  setTciSettings: (settings) => ipcRenderer.invoke(CH.setTciSettings, settings),
  getMacros: () => ipcRenderer.invoke(CH.getMacros),
  setMacros: (macros) => ipcRenderer.invoke(CH.setMacros, macros),
  getEsmMode: () => ipcRenderer.invoke(CH.getEsmMode),
  setEsmMode: (mode) => ipcRenderer.invoke(CH.setEsmMode, mode),

  // roster
  rosterLookup: (call) => ipcRenderer.invoke(CH.rosterLookup, call),
  rosterImport: () => ipcRenderer.invoke(CH.rosterImport),
  rosterUpdate: () => ipcRenderer.invoke(CH.rosterUpdate),
  rosterSize: () => ipcRenderer.invoke(CH.rosterSize),

  // export
  exportCabrillo: (contestId) => ipcRenderer.invoke(CH.exportCabrillo, contestId),
  exportAdif: (contestId) => ipcRenderer.invoke(CH.exportAdif, contestId),

  // events
  onRadioState: (cb) => on(CH.evRadioState, cb),
  onCallsignSent: (cb) => on(CH.evCallsign, cb),
  onLog: (cb) => on(CH.evLog, cb),
  onRosterUpdated: (cb) => on(CH.evRosterUpdated, cb)
}

contextBridge.exposeInMainWorld('api', api)
