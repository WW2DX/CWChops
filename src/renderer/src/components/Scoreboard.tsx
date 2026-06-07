import { CWT_BANDS, type Contest, type ScoreSummary } from '@shared/types'

interface Props {
  contest: Contest | null
  score: ScoreSummary
}

export function Scoreboard({ contest, score }: Props) {
  return (
    <div className="panel scoreboard">
      <h3>{contest ? contest.session : 'CWT'}</h3>
      <div className="score-total">{score.total.toLocaleString()}</div>
      <div className="score-grid">
        <div>
          <span className="big">{score.qsos}</span>
          <span className="lbl">QSOs</span>
        </div>
        <div>
          <span className="big">{score.mults}</span>
          <span className="lbl">Mults</span>
        </div>
        <div>
          <span className="big">{score.dupes}</span>
          <span className="lbl">Dupes</span>
        </div>
      </div>
      <div className="perband">
        {CWT_BANDS.map((b) => (
          <div key={b} className={`perband-cell ${score.perBand[b] ? 'active' : ''}`}>
            <span className="b">{b}</span>
            <span className="n">{score.perBand[b] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
