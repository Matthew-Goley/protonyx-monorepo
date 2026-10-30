import { useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { SampleTag } from '../components/SampleTag'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { sample } from '../data'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'caution')!.copy
const SCALE_MAX = 99

// A half circle, drawn left to right.
const R = 360
const STROKE = 18
const ARC_LEN = Math.PI * R

// One idea: the whole read collapses into one number. The gauge and the count
// sweep up together, slowly, to the engine's score.
export const Caution = () => {
  const frame = useCurrentFrame()
  const p = progress(frame, 24, 75)
  const shown = Math.round(sample.caution_score * p)
  const filled = (sample.caution_score / SCALE_MAX) * p
  return (
    <Stage center>
      <SampleTag />
      <div style={{ position: 'relative', width: 2 * R + STROKE, height: R + STROKE / 2, ...rise(frame, 6, 30, 16) }}>
        <svg width={2 * R + STROKE} height={R + STROKE} style={{ position: 'absolute', inset: 0 }}>
          <path
            d={`M ${STROKE / 2} ${R + STROKE / 2} A ${R} ${R} 0 0 1 ${2 * R + STROKE / 2} ${R + STROKE / 2}`}
            fill="none"
            stroke={color.faint}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={`M ${STROKE / 2} ${R + STROKE / 2} A ${R} ${R} 0 0 1 ${2 * R + STROKE / 2} ${R + STROKE / 2}`}
            fill="none"
            stroke={color.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={ARC_LEN * (1 - filled)}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            width: '100%',
            textAlign: 'center',
            fontSize: 260,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {shown}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 72 }}>
        <div style={{ fontSize: type.headline, fontWeight: 600, letterSpacing: '-0.02em', ...rise(frame, 70, 30) }}>
          {copy.headline}
        </div>
        <div style={{ fontSize: type.sub, color: color.dim, marginTop: 24, ...rise(frame, 82, 30) }}>{copy.sub}</div>
      </div>
    </Stage>
  )
}
