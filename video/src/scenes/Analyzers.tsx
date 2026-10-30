import { useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { Headline } from '../components/Headline'
import { SampleTag } from '../components/SampleTag'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { fill, sample } from '../data'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'analyzers')!.copy
const SEGMENTS = 4 // low, moderate, high, critical

// One idea: every holding goes through the same eight checks, each with a
// severity. Only high and critical findings take the accent.
export const Analyzers = () => {
  const frame = useCurrentFrame()
  return (
    <Stage>
      <SampleTag />
      <Headline text={fill(copy.headline)} sub={copy.sub} />
      <div
        style={{
          marginTop: 80,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 120,
          rowGap: 44,
        }}
      >
        {sample.analyzers.map((a, i) => {
          const start = 34 + i * 7
          const strong = a.level >= 3
          const label = copy.labels[a.key as keyof typeof copy.labels] ?? a.key
          return (
            <div key={a.key} style={{ ...rise(frame, start, 30, 14) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: type.body, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: type.label, color: strong ? color.accent : color.dim }}>
                  {copy.severities[a.severity]}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {Array.from({ length: SEGMENTS }, (_, s) => {
                  const on = s < a.level ? progress(frame, start + 14 + s * 5, 20) : 0
                  return (
                    <div key={s} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: color.faint, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${on * 100}%`,
                          height: '100%',
                          backgroundColor: strong ? color.accent : color.dim,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
