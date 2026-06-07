import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let win: Page

test.beforeAll(async () => {
  // Fresh user-data dir => first-run state (Settings dialog auto-opens, empty log).
  const userDir = mkdtempSync(join(tmpdir(), 'cwt-e2e-'))
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDir}`],
    env: { ...process.env, CWT_NO_ROSTER_FETCH: '1' }
  })
  win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
})

test('logs a CWT QSO end-to-end through the UI', async () => {
  await test.step('app shell renders', async () => {
    await expect(win.locator('.brand')).toHaveText('CWChops')
  })

  await test.step('first-run Settings opens; configure station', async () => {
    const modal = win.locator('.modal')
    await expect(modal.locator('h2')).toHaveText('Settings')

    await modal.getByPlaceholder('W1XYZ').fill('K1ABC')
    await modal.getByPlaceholder('Joe').fill('Lee')
    await modal.getByText('I am a CWops member').click()
    await modal.getByPlaceholder('1234').fill('2000')
    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(win.locator('.modal')).toHaveCount(0)
  })

  await test.step('enter a QSO across the split fields and log it', async () => {
    await win.locator('.field.call input').fill('W9XYZ')
    await win.locator('.field.name input').fill('Sam')
    const nr = win.locator('.field.nr input')
    await nr.fill('IL')
    await nr.press('Enter')

    // Row appears in the log with the name + SPC.
    const row = win.locator('.logtable tbody tr', { hasText: 'W9XYZ' })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Sam')
    await expect(row).toContainText('IL')
    await expect(win.locator('.logtable-head h3')).toHaveText('QSOs (1)')
  })

  await test.step('scoreboard reflects 1 QSO and 1 mult', async () => {
    const stats = win.locator('.score-grid .big')
    await expect(stats.nth(0)).toHaveText('1') // QSOs
    await expect(stats.nth(1)).toHaveText('1') // Mults
    await expect(win.locator('.score-total')).toHaveText('1')
  })

  await test.step('re-entering the same call on the same band flags a DUPE', async () => {
    await win.locator('.field.call input').fill('W9XYZ')
    await expect(win.locator('.dupe-badge')).toBeVisible()
  })

  await test.step('ESM defaults to Run and shows the next-action hint', async () => {
    await expect(win.locator('.esm-toggle button.active')).toHaveText('Run')
    await win.locator('.field.call input').fill('')
    await win.locator('.field.name input').fill('')
    await win.locator('.field.nr input').fill('')
    await win.locator('.field.call input').click()
    await expect(win.locator('.esm-hint')).toHaveText('Enter: CQ')
  })

  await test.step('ESM Run works a new station, advancing fields with Enter', async () => {
    const call = win.locator('.field.call input')
    const name = win.locator('.field.name input')
    const nr = win.locator('.field.nr input')

    await call.fill('K5XYZ')
    await expect(win.locator('.esm-hint')).toHaveText('Enter: send exchange →')
    await call.press('Enter') // ESM: send exchange, focus -> Name

    await name.fill('Tom')
    await name.press('Enter') // advance -> Nr

    await nr.fill('100')
    await expect(win.locator('.esm-hint')).toHaveText('Enter: TU + log')
    await nr.press('Enter') // ESM: send TU + log

    await expect(win.locator('.logtable tbody tr', { hasText: 'K5XYZ' })).toHaveCount(1)
    await expect(win.locator('.logtable-head h3')).toHaveText('QSOs (2)')
    await expect(win.locator('.score-grid .big').nth(1)).toHaveText('2') // 2 mults
  })
})
