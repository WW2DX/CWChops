import { copyFileSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { CH } from '@shared/api'
import type { ExportResult } from '@shared/api'
import { scoreLog } from '@shared/scoring'
import { cwtSessionLabel } from '@shared/session'
import { DEFAULT_MACROS, migrateMacros } from '@shared/exchange'
import { DEFAULT_ESM_MODE, type EsmMode } from '@shared/esm'
import { DEFAULT_TCI_SETTINGS, DEFAULT_WPM } from '@shared/types'
import type { Contest, Macro, NewQso, Qso, Station, TciSettings } from '@shared/types'
import type { LogDatabase } from './db/database'
import type { TciClient } from './tci/client'
import type { Roster } from './members/roster'
import { fetchCwopsRoster } from './members/rosterSource'
import { buildCabrillo } from './export/cabrillo'
import { buildAdif } from './export/adif'

export interface AppContext {
  db: LogDatabase
  tci: TciClient
  roster: Roster
  userDataDir: string
  /** Id of the contest the UI is currently logging into. */
  activeContestId: number
}

/** Ensure there is a contest to log into; reuse the most recent, else create one. */
export function ensureActiveContest(ctx: AppContext, now: Date): Contest {
  const existing = ctx.db.listContests()
  if (existing.length > 0) {
    ctx.activeContestId = existing[0].id
    return existing[0]
  }
  const contest = ctx.db.createContest('CWT', cwtSessionLabel(now), now.getTime())
  ctx.activeContestId = contest.id
  return contest
}

function requireStation(ctx: AppContext): Station {
  return (
    ctx.db.getStation() ?? {
      callsign: '',
      name: '',
      memberNumber: '',
      spc: '',
      isMember: false
    }
  )
}

export function registerIpc(ctx: AppContext): void {
  const h = ipcMain.handle.bind(ipcMain)

  // ---- radio ----
  h(CH.tciConnect, (_e, settings: TciSettings) => {
    ctx.db.setSetting('tci', settings)
    ctx.tci.connect(settings)
  })
  h(CH.tciDisconnect, () => ctx.tci.disconnect())
  h(CH.tciGetState, () => ctx.tci.getState())
  h(CH.tciSetFrequency, (_e, hz: number) => ctx.tci.setFrequency(hz))
  h(CH.tciSetCwMode, () => ctx.tci.setCwMode())
  h(CH.tciSetPtt, (_e, on: boolean) => ctx.tci.setPtt(on))
  h(CH.tciSetWpm, (_e, wpm: number) => {
    ctx.db.setSetting('wpm', wpm)
    ctx.tci.setWpm(wpm)
  })
  h(CH.getWpm, () => ctx.db.getSetting<number>('wpm') ?? DEFAULT_WPM)
  h(CH.tciSendCw, (_e, text: string) => ctx.tci.sendCw(text))
  h(CH.tciStopCw, () => ctx.tci.stopCw())

  // ---- contest / log ----
  h(CH.currentContest, () => ensureActiveContest(ctx, new Date()))
  h(CH.newContest, (_e, session: string) => {
    const c = ctx.db.createContest('CWT', session, Date.now())
    ctx.activeContestId = c.id
    return c
  })
  h(CH.listContests, () => ctx.db.listContests())
  h(CH.selectContest, (_e, id: number) => {
    const c = ctx.db.getContest(id)
    if (c) ctx.activeContestId = c.id
    return c
  })
  h(CH.listQsos, (_e, contestId: number) => ctx.db.listQsos(contestId))
  h(CH.addQso, (_e, qso: NewQso) => ctx.db.addQso(qso))
  h(CH.updateQso, (_e, qso: Qso) => ctx.db.updateQso(qso))
  h(CH.deleteQso, (_e, id: number) => ctx.db.deleteQso(id))
  h(CH.score, (_e, contestId: number) => scoreLog(ctx.db.listQsos(contestId)))

  // ---- settings ----
  h(CH.getStation, () => ctx.db.getStation())
  h(CH.setStation, (_e, station: Station) => ctx.db.setSetting('station', station))
  h(CH.getTciSettings, () => ctx.db.getSetting<TciSettings>('tci') ?? DEFAULT_TCI_SETTINGS)
  h(CH.setTciSettings, (_e, settings: TciSettings) => {
    ctx.db.setSetting('tci', settings)
    ctx.tci.updateSettings(settings)
  })
  h(CH.getMacros, () => {
    const saved = ctx.db.getSetting<Macro[]>('macros')
    if (!saved) return DEFAULT_MACROS
    // Heal macros left on a superseded default (e.g. F2 without {CALL}).
    const { macros, changed } = migrateMacros(saved)
    if (changed) ctx.db.setSetting('macros', macros)
    return macros
  })
  h(CH.setMacros, (_e, macros: Macro[]) => ctx.db.setSetting('macros', macros))
  h(CH.getEsmMode, () => ctx.db.getSetting<EsmMode>('esmMode') ?? DEFAULT_ESM_MODE)
  h(CH.setEsmMode, (_e, mode: EsmMode) => ctx.db.setSetting('esmMode', mode))

  // ---- roster ----
  h(CH.rosterLookup, (_e, call: string) => ctx.roster.lookup(call))
  h(CH.rosterSize, () => ctx.roster.size)
  h(CH.rosterUpdate, async () => {
    const entries = await fetchCwopsRoster()
    ctx.roster.setEntries(entries)
    try {
      writeFileSync(join(ctx.userDataDir, 'cwops-roster.csv'), ctx.roster.serialize())
    } catch {
      /* non-fatal: roster still usable in-memory this session */
    }
    return ctx.roster.size
  })
  h(CH.rosterImport, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import CWops roster CSV (callsign,name,number)',
      filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return ctx.roster.size
    const count = ctx.roster.loadFile(res.filePaths[0])
    // Persist a copy so it reloads next launch.
    try {
      copyFileSync(res.filePaths[0], join(ctx.userDataDir, 'cwops-roster.csv'))
    } catch {
      /* non-fatal */
    }
    return count
  })

  // ---- export ----
  h(CH.exportCabrillo, async (_e, contestId: number): Promise<ExportResult> => {
    const contest = ctx.db.getContest(contestId)
    if (!contest) return { path: null, count: 0 }
    const qsos = ctx.db.listQsos(contestId)
    const text = buildCabrillo(contest, requireStation(ctx), qsos)
    return saveText(`${contest.session}.cbr`, text, qsos.length, [
      { name: 'Cabrillo', extensions: ['cbr', 'log', 'txt'] }
    ])
  })
  h(CH.exportAdif, async (_e, contestId: number): Promise<ExportResult> => {
    const contest = ctx.db.getContest(contestId)
    if (!contest) return { path: null, count: 0 }
    const qsos = ctx.db.listQsos(contestId)
    const text = buildAdif(requireStation(ctx), qsos)
    return saveText(`${contest.session}.adi`, text, qsos.length, [
      { name: 'ADIF', extensions: ['adi'] }
    ])
  })
}

async function saveText(
  defaultName: string,
  text: string,
  count: number,
  filters: Electron.FileFilter[]
): Promise<ExportResult> {
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const res = await dialog.showSaveDialog(win!, { defaultPath: defaultName, filters })
  if (res.canceled || !res.filePath) return { path: null, count: 0 }
  writeFileSync(res.filePath, text, 'utf8')
  return { path: res.filePath, count }
}
