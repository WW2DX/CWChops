import { statSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, nativeImage, shell } from 'electron'
import { CH } from '@shared/api'
import { DEFAULT_TCI_SETTINGS } from '@shared/types'
import type { TciSettings } from '@shared/types'
import { LogDatabase } from './db/database'
import { TciClient } from './tci/client'
import { Roster } from './members/roster'
import { fetchCwopsRoster } from './members/rosterSource'
import { ensureActiveContest, registerIpc, type AppContext } from './ipc'

const APP_NAME = 'CWChops'
// In a packaged build the icon is baked into the bundle; in dev we point at the
// source PNG so the dock/taskbar show the CWChops icon instead of the Electron atom.
const IS_DEV = !!process.env['ELECTRON_RENDERER_URL'] || !app.isPackaged
const DEV_ICON_PATH = join(process.cwd(), 'build', 'icon.png')
const CREDIT = 'Vibe coded by WW2DX and Claude.'
const CREDIT_LONG =
  'For RemoteHamRadio (RHR) CWops operators, and any other TCI-supported system.'

// Set before the app is ready so the menu bar / dock show the app name in dev too.
app.setName(APP_NAME)

const ROSTER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Configure the native About panel and a minimal app menu carrying the name. */
function configureAppMenu(): void {
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    version: '',
    copyright: `${CREDIT}\n${CREDIT_LONG}`,
    credits: 'A CWops CWT contest logger with TCI rig control.'
  })

  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' as const, label: `About ${APP_NAME}` },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: `Quit ${APP_NAME}` }
            ]
          }
        ]
      : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: `About ${APP_NAME}`, click: () => app.showAboutPanel() }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Age of the cached roster file in ms, or Infinity if it doesn't exist. */
function rosterCacheAge(path: string): number {
  try {
    return Date.now() - statSync(path).mtimeMs
  } catch {
    return Infinity
  }
}

/**
 * Refresh the CWops roster from the live sheet if the cache is missing or stale.
 * Runs in the background; on success it rewrites the cache and notifies the UI.
 */
async function maybeRefreshRoster(roster: Roster, cachePath: string): Promise<void> {
  if (rosterCacheAge(cachePath) < ROSTER_MAX_AGE_MS && roster.size > 0) return
  try {
    const entries = await fetchCwopsRoster()
    if (entries.length === 0) return
    roster.setEntries(entries)
    writeFileSync(cachePath, roster.serialize())
    mainWindow?.webContents.send(CH.evRosterUpdated, roster.size)
  } catch {
    // Offline or download failed — keep whatever cached roster we have.
  }
}

let mainWindow: BrowserWindow | null = null
let ctx: AppContext | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 560,
    title: 'CWChops',
    backgroundColor: '#11151c',
    icon: IS_DEV ? DEV_ICON_PATH : undefined,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function wireRadioEvents(tci: TciClient): void {
  const push = (channel: string, payload: unknown): void => {
    mainWindow?.webContents.send(channel, payload)
  }
  let lastConn = ''
  tci.on('state', (s) => {
    push(CH.evRadioState, s)
    // Mirror connection-state transitions to the terminal for live debugging.
    if (s.connection !== lastConn) {
      lastConn = s.connection
      console.log(
        `[tci] ${s.connection}` +
          (s.connection === 'ready'
            ? ` — ${(s.freqHz / 1e6).toFixed(3)} MHz, mode ${s.mode || '?'}, band ${s.band}`
            : s.error
              ? `: ${s.error}`
              : '')
      )
    }
  })
  tci.on('callsign', (c) => {
    push(CH.evCallsign, c)
    console.log(`[tci] callsign keyed: ${c}`)
  })
  tci.on('log', (l) => {
    push(CH.evLog, l)
    console.log(`[tci] ${l}`)
  })
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')
  const db = new LogDatabase(join(userDataDir, 'cwchops.sqlite'))

  const rosterCachePath = join(userDataDir, 'cwops-roster.csv')
  const roster = new Roster()
  roster.loadFile(rosterCachePath)

  const tciSettings = db.getSetting<TciSettings>('tci') ?? DEFAULT_TCI_SETTINGS
  const tci = new TciClient(tciSettings)

  ctx = { db, tci, roster, userDataDir, activeContestId: 0 }
  ensureActiveContest(ctx, new Date())
  registerIpc(ctx)

  configureAppMenu()
  // Show the CWChops icon in the macOS dock during development.
  if (process.platform === 'darwin' && IS_DEV && app.dock) {
    const img = nativeImage.createFromPath(DEV_ICON_PATH)
    if (!img.isEmpty()) app.dock.setIcon(img)
  }
  createWindow()
  wireRadioEvents(tci)
  // CWT_NO_ROSTER_FETCH lets tests/offline runs skip the startup network call.
  if (!process.env['CWT_NO_ROSTER_FETCH']) {
    void maybeRefreshRoster(roster, rosterCachePath)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ctx?.tci.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  ctx?.tci.disconnect()
  ctx?.db.close()
})
