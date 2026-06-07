// Generate documentation screenshots by driving the built app with Playwright.
// Run after `npm run build` (or `electron-vite build`):  node scripts/make-screenshots.mjs
import { _electron as electron } from '@playwright/test'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SHOTS = 'docs/screenshots'
mkdirSync(SHOTS, { recursive: true })

const userDir = mkdtempSync(join(tmpdir(), 'cwchops-shots-'))
const app = await electron.launch({
  args: ['.', `--user-data-dir=${userDir}`],
  env: { ...process.env, CWT_NO_ROSTER_FETCH: '1' }
})
const win = await app.firstWindow()
await win.waitForLoadState('domcontentloaded')

// --- configure the station ---
const modal = win.locator('.modal')
await modal.locator('h2').waitFor()
await modal.getByPlaceholder('W1XYZ').fill('WW2DX')
await modal.getByPlaceholder('Joe').fill('Lee')
await modal.getByText('I am a CWops member').click()
await modal.getByPlaceholder('1234').fill('2000')
await modal.getByRole('button', { name: 'Save' }).click()
await win.locator('.modal').waitFor({ state: 'detached' })

// --- log a realistic spread of QSOs across bands ---
async function setBand(b) {
  await win.locator('.freq-sub select').selectOption(b)
}
async function log(call, name, nr) {
  await win.locator('.field.call input').fill(call)
  await win.locator('.field.name input').fill(name)
  const nrIn = win.locator('.field.nr input')
  await nrIn.fill(nr)
  await nrIn.press('Enter')
}

await setBand('20m')
await log('K1ABC', 'Bud', '1')
await log('AA3B', 'Bud', '7')
await log('N5DX', 'Joe', '1523')
await log('W9XYZ', 'Sam', 'IL')

await setBand('40m')
await log('K5ZD', 'Randy', '3')
await log('VE3KI', 'Rich', '200')

await setBand('15m')
await log('DL1ABC', 'Hans', 'DL')
await log('W1AW', 'Hiram', '5')

// Leave a call mid-entry so the ESM hint is visible in the shot.
await setBand('20m')
await win.locator('.field.name input').fill('')
await win.locator('.field.nr input').fill('')
await win.locator('.field.call input').fill('K3WW')
await win.locator('.field.call input').click() // focus Call so the hint reads "send exchange"

await win.waitForTimeout(400)
await win.screenshot({ path: join(SHOTS, 'main.png') })

// --- settings panel ---
await win.locator('.gear').click()
await win.locator('.modal').waitFor()
await win.waitForTimeout(200)
await win.screenshot({ path: join(SHOTS, 'settings.png') })

await app.close()
console.log(`screenshots written to ${SHOTS}/`)
