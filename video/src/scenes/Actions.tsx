import { useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { Headline } from '../components/Headline'
import { SampleTag } from '../components/SampleTag'
import { Stage } from '../components/Stage'
import { rise } from '../components/motion'
import { money, sample } from '../data'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'actions')!.copy
const actions = sample.actions.slice(0, copy.maxActions)

// One idea: the findings become a short, ordered list. Rank comes straight from
// the engine's priority order; the first item takes the accent.
export const Actions = () => {
  const frame = useCurrentFrame()
  return (
    <Stage>
      <SampleTag />
      <Headline text={copy.headline} />
      <div style={{ marginTop: 84, display: 'flex', flexDirection: 'column' }}>
        {actions.map((a, i) => {
          const first = i === 0
          const verb = copy.verbs[a.action as keyof typeof copy.verbs] ?? a.action
          return (
            <div
              key={a.rank}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 48,
                padding: '30px 0',
                borderTop: `1px solid ${color.faint}`,
                ...rise(frame, 26 + i * 12, 32, 18),
              }}
            >
              <div style={{ width: 72, fontSize: type.sub, color: first ? color.accent : color.dim, fontVariantNumeric: 'tabular-nums' }}>
                {String(a.rank).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, fontSize: 64, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <span style={{ color: first ? color.accent : color.text }}>{verb}</span> {a.ticker}
              </div>
              <div style={{ fontSize: type.body, color: first ? color.text : color.dim, fontVariantNumeric: 'tabular-nums' }}>
                {a.dollars > 0 ? money(a.dollars) : ''}
              </div>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
