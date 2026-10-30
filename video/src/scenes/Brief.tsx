import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { FULL_CUT } from '../config'
import { SampleTag } from '../components/SampleTag'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { sample } from '../data'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'brief')!.copy
const lines = sample.brief.display
const FIRST = 24
const TAIL = 30

// One idea: the engine explains itself in plain sentences. The lines are the
// engine's own brief (its factual clauses, see generate_sample.py). Each line
// takes focus in turn; earlier lines step back to grey. Timing spreads evenly
// over whatever the scene length is, so retiming in config just works.
export const Brief = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const step = (durationInFrames - FIRST - TAIL) / lines.length
  return (
    <Stage>
      <SampleTag />
      <div style={{ fontSize: type.label, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.accent, ...rise(frame, 4, 24, 10) }}>
        {copy.headline}
      </div>
      <div style={{ marginTop: 72, display: 'flex', flexDirection: 'column', gap: 56 }}>
        {lines.map((line, i) => {
          const start = FIRST + i * step
          const stepBack =
            i < lines.length - 1 ? interpolate(progress(frame, start + step, 24), [0, 1], [1, 0.35]) : 1
          return (
            <div
              key={i}
              style={{
                fontSize: 64,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.18,
                maxWidth: 1500,
                ...rise(frame, start, 34, 22),
                opacity: progress(frame, start, 34) * stepBack,
              }}
            >
              {line}
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
