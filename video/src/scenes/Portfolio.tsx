import { useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { Headline } from '../components/Headline'
import { SampleTag } from '../components/SampleTag'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { fill, sample } from '../data'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'portfolio')!.copy
const positions = sample.portfolio.positions
const maxWeight = Math.max(...positions.map((p) => p.weight_pct))

// One idea: the input is just what you hold. Bars are each holding's weight.
export const Portfolio = () => {
  const frame = useCurrentFrame()
  return (
    <Stage>
      <SampleTag />
      <Headline text={copy.headline} sub={fill(copy.sub)} />
      <div style={{ marginTop: 88, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {positions.map((p, i) => {
          const start = 36 + i * 8
          const grow = progress(frame, start + 6, 48)
          const isTop = p.weight_pct === maxWeight
          return (
            <div key={p.ticker} style={{ display: 'flex', alignItems: 'center', gap: 40, ...rise(frame, start, 30, 16) }}>
              <div style={{ width: 150, fontSize: type.body, fontWeight: 600 }}>{p.ticker}</div>
              <div style={{ flex: 1, height: 28, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${(p.weight_pct / maxWeight) * 100 * grow}%`,
                    backgroundColor: isTop ? color.accent : color.faint,
                    borderRadius: 14,
                  }}
                />
              </div>
              <div style={{ width: 150, textAlign: 'right', fontSize: type.body, color: isTop ? color.text : color.dim }}>
                {(p.weight_pct * grow).toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
