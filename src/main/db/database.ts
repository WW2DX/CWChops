import { DatabaseSync } from 'node:sqlite'
import type { Contest, NewQso, Qso, Station } from '@shared/types'

interface QsoRow {
  id: number
  contest_id: number
  ts: number
  callsign: string
  band: string
  freq_hz: number
  mode: string
  rst_sent: string
  rst_rcvd: string
  name: string
  exch: string
  is_member: number
}

function rowToQso(r: QsoRow): Qso {
  return {
    id: r.id,
    contestId: r.contest_id,
    ts: r.ts,
    callsign: r.callsign,
    band: r.band as Qso['band'],
    freqHz: r.freq_hz,
    mode: r.mode as 'CW',
    rstSent: r.rst_sent,
    rstRcvd: r.rst_rcvd,
    name: r.name,
    exch: r.exch,
    isMember: r.is_member === 1
  }
}

/**
 * SQLite-backed store for contests, QSOs, and app settings, built on the
 * built-in `node:sqlite` (no native module to rebuild — works on every platform
 * Electron ships). All operations are synchronous, so a logged QSO is durably
 * committed before the UI is told it succeeded.
 */
export class LogDatabase {
  private db: DatabaseSync

  constructor(filePath: string) {
    this.db = new DatabaseSync(filePath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contests (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        session    TEXT NOT NULL,
        started_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS qsos (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
        ts         INTEGER NOT NULL,
        callsign   TEXT NOT NULL,
        band       TEXT NOT NULL,
        freq_hz    INTEGER NOT NULL,
        mode       TEXT NOT NULL DEFAULT 'CW',
        rst_sent   TEXT NOT NULL DEFAULT '599',
        rst_rcvd   TEXT NOT NULL DEFAULT '599',
        name       TEXT NOT NULL DEFAULT '',
        exch       TEXT NOT NULL DEFAULT '',
        is_member  INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_qsos_contest ON qsos(contest_id);
      CREATE INDEX IF NOT EXISTS idx_qsos_dupe ON qsos(contest_id, callsign, band);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  // ---- contests ----

  createContest(name: string, session: string, startedAt: number): Contest {
    const info = this.db
      .prepare('INSERT INTO contests (name, session, started_at) VALUES (?, ?, ?)')
      .run(name, session, startedAt)
    return { id: Number(info.lastInsertRowid), name, session, startedAt }
  }

  listContests(): Contest[] {
    const rows = this.db
      .prepare('SELECT id, name, session, started_at FROM contests ORDER BY started_at DESC')
      .all() as Array<{ id: number; name: string; session: string; started_at: number }>
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      session: r.session,
      startedAt: r.started_at
    }))
  }

  getContest(id: number): Contest | null {
    const r = this.db
      .prepare('SELECT id, name, session, started_at FROM contests WHERE id = ?')
      .get(id) as { id: number; name: string; session: string; started_at: number } | undefined
    return r ? { id: r.id, name: r.name, session: r.session, startedAt: r.started_at } : null
  }

  // ---- qsos ----

  addQso(qso: NewQso): Qso {
    const call = qso.callsign.toUpperCase()
    const info = this.db
      .prepare(
        `INSERT INTO qsos
          (contest_id, ts, callsign, band, freq_hz, mode, rst_sent, rst_rcvd, name, exch, is_member)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        qso.contestId,
        qso.ts,
        call,
        qso.band,
        Math.round(qso.freqHz),
        qso.mode,
        qso.rstSent,
        qso.rstRcvd,
        qso.name,
        qso.exch,
        qso.isMember ? 1 : 0
      )
    return { ...qso, id: Number(info.lastInsertRowid), callsign: call }
  }

  updateQso(qso: Qso): void {
    this.db
      .prepare(
        `UPDATE qsos SET
          ts=?, callsign=?, band=?, freq_hz=?, mode=?,
          rst_sent=?, rst_rcvd=?, name=?, exch=?, is_member=?
         WHERE id=?`
      )
      .run(
        qso.ts,
        qso.callsign.toUpperCase(),
        qso.band,
        Math.round(qso.freqHz),
        qso.mode,
        qso.rstSent,
        qso.rstRcvd,
        qso.name,
        qso.exch,
        qso.isMember ? 1 : 0,
        qso.id
      )
  }

  deleteQso(id: number): void {
    this.db.prepare('DELETE FROM qsos WHERE id = ?').run(id)
  }

  listQsos(contestId: number): Qso[] {
    const rows = this.db
      .prepare('SELECT * FROM qsos WHERE contest_id = ? ORDER BY ts ASC, id ASC')
      .all(contestId) as unknown as QsoRow[]
    return rows.map(rowToQso)
  }

  // ---- settings (JSON values) ----

  getSetting<T>(key: string): T | null {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return r ? (JSON.parse(r.value) as T) : null
  }

  setSetting(key: string, value: unknown): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, JSON.stringify(value))
  }

  getStation(): Station | null {
    return this.getSetting<Station>('station')
  }

  close(): void {
    this.db.close()
  }
}
