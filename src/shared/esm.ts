// ESM ("Enter Sends Message") — contextual Enter-key automation for fast
// contesting. The Enter key both navigates the entry fields and keys the right
// CW message for where you are in the QSO, so a run can be worked almost
// entirely from the keyboard.

export type EsmMode = 'off' | 'run' | 'sp'

/** The three entry fields, in tab order. */
export type EntryField = 'call' | 'name' | 'nr'

/** What pressing Enter should do for a given field + mode. */
export interface EsmAction {
  /** ESM macro role to key, if any. */
  macro?: 'cq' | 'exch' | 'tu' | 'mycall'
  /** Log the QSO (after keying the macro, if any). */
  log?: boolean
  /** Field to move focus to next. */
  focus?: EntryField
}

/**
 * Decide what Enter does, from the mode and which field has focus. Driving off
 * the focused field (rather than which fields are filled) keeps the flow correct
 * even when the roster has pre-filled the name/number.
 *
 * Run (calling CQ):  Call empty -> CQ; Call -> send exchange, go to Name;
 *                    Name -> Nr;  Nr -> TU + log.
 * S&P (answering):   Call empty -> exchange;  Call -> send my call, go to Name;
 *                    Name -> Nr;  Nr -> send my exchange + log.
 * Off:               Enter just walks Call -> Name -> Nr -> log.
 */
export function esmAction(mode: EsmMode, field: EntryField, hasCall: boolean): EsmAction {
  if (field === 'call') {
    if (mode === 'run') return hasCall ? { macro: 'exch', focus: 'name' } : { macro: 'cq' }
    if (mode === 'sp') return hasCall ? { macro: 'mycall', focus: 'name' } : { macro: 'exch' }
    return { focus: 'name' } // off
  }
  if (field === 'name') {
    return { focus: 'nr' }
  }
  // field === 'nr' (closing turn)
  if (mode === 'run') return { macro: 'tu', log: true }
  if (mode === 'sp') return { macro: 'exch', log: true }
  return { log: true } // off
}

/** Which F-key macro each ESM role sends. */
export const ESM_MACRO_KEYS = {
  cq: 1,
  exch: 2,
  tu: 3,
  mycall: 5
} as const

/** Short description of what Enter will do next, for the UI hint. */
export function esmHint(mode: EsmMode, field: EntryField, hasCall: boolean): string {
  const a = esmAction(mode, field, hasCall)
  if (a.macro === 'cq') return 'Enter: CQ'
  if (a.macro === 'tu' && a.log) return 'Enter: TU + log'
  if (a.macro === 'exch' && a.log) return 'Enter: exchange + log'
  if (a.macro === 'exch') return 'Enter: send exchange →'
  if (a.macro === 'mycall') return 'Enter: send my call →'
  if (a.log) return 'Enter: log'
  if (a.focus) return 'Enter: next field →'
  return ''
}

export const DEFAULT_ESM_MODE: EsmMode = 'run'
