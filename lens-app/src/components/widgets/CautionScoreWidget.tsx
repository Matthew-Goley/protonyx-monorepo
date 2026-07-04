import { type LensResult } from '@/api/lens'
import { Panel } from '@/components/common/Panel'
import { CautionGauge } from '@/components/analysis/CautionGauge'

/*
  Caution Score - Lens Arc's flagship differentiator, at home on the dashboard.
  A compact square tile: the real engine-backed 0-100 score (gradient arc +
  value, reusing the Analysis-page gauge at 'sm' so the two never diverge) plus
  the band label word in its band color, so a total beginner reads good-vs-bad
  in half a second.
*/
export function CautionScoreWidget({ result }: { result: LensResult }) {
  const score = result.caution_score

  return (
    <Panel className="flex flex-col">
      <h3 className="text-xl font-semibold text-primary">Caution Score</h3>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        {/* Gauge renders the gradient arc + score + band label word (band color).
            Its own caption is suppressed. */}
        <CautionGauge score={score} size="sm" caption="" />
      </div>
    </Panel>
  )
}
