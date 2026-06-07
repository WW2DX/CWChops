import type { Macro } from '@shared/types'

interface Props {
  macros: Macro[]
  disabled: boolean
  onSend: (macro: Macro) => void
}

/** The F-key CW macro buttons. Presentational — sending is handled by the parent. */
export function MacroBar({ macros, disabled, onSend }: Props) {
  return (
    <div className="macrobar" title={disabled ? 'Connect the radio to send CW' : undefined}>
      {macros.map((m) => (
        <button
          key={m.key}
          className="macro"
          disabled={disabled}
          onClick={() => onSend(m)}
        >
          <span className="fkey">F{m.key}</span>
          <span className="macro-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
